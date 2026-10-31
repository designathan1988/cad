import type { Scene3D } from './scene-3d';
import { layerMaterial } from './scene-materials';
import { creaseEdges } from '../elements/kinds/object';
import * as THREE from 'three';
import type { DerivedGeometry, OpeningSolid, WallSolid } from '../project/derive';
import type { WallId } from '../elements/wall/schema';
import { blockPaint, type Paint } from './wall-paint';
import { type PrismFaces, visibleFaces } from '../elements/wall/geometry/faces';
import { partPrism, prism, shownPrism, slopedPrism, toThree } from '../elements/prisms';
import { eachSolid } from '../elements/registry';
import { featureEdges, type SlopedTop, underSlopes } from '../elements/wall/geometry/edges';
import { openingParts } from '../elements/opening/parts';
import { boxCaps, sectionCaps, sectionLooks, type UprightPrism } from '../model/section-box';
import type { LevelId } from '../project/doc';

export function facesOf(view: Scene3D, g: DerivedGeometry): Map<WallId, PrismFaces[]> {
  if (view.facesCache?.solids === g.solids) return view.facesCache.faces;
  const owners: WallId[] = [];
  const prisms = [...g.solids.values()].flatMap((s) => s.blocks.map((b) => (owners.push(s.wall.id), b)));
  const all = visibleFaces(prisms);
  const faces = new Map<WallId, PrismFaces[]>();
  all.forEach((f, i) => faces.set(owners[i]!, [...(faces.get(owners[i]!) ?? []), f]));
  view.facesCache = { solids: g.solids, faces };
  return faces;
}

export function build(view: Scene3D, s: WallSolid, state: 'p' | 's' | 'n', faces: readonly PrismFaces[], phase?: 'new' | 'existing' | 'demolish'): THREE.Group {
  const group = new THREE.Group();
  // Each block in its layer's material, as in plan (wall-paint.ts); a wall with a phase all in its phase's.
  const byPhase = phase && state === 'n' ? view.phaseMaterials.get(phase) : undefined;
  const material = (paint: Paint): THREE.Material => byPhase ?? (typeof paint === 'string' ? view.materials[paint] : layerMaterial(view, paint));
  s.blocks.forEach((b, i) => {
    const { side, top } = blockPaint(s.materials, b.layerIndex, state);
    const f = faces[i];
    const geo = b.plane ? slopedPrism(b.polygon, b.bottom, b.plane, f) : f ? shownPrism(b.polygon, b.bottom, b.top, f) : prism(b.polygon, b.bottom, b.top);
    group.add(new THREE.Mesh(geo, [material(side), material(top)]));
  });
  return group;
}

/** A door or window: its parts (opening/parts.ts), each in its role's material, or all in the state's. */
export function buildOpening(view: Scene3D, o: OpeningSolid, state: 'p' | 's' | 'n' | 'i'): THREE.Group {
  const group = new THREE.Group();
  const m = view.materials;
  const shown = state === 'p' ? m.preview : state === 's' ? m.topSel : state === 'i' ? m.invalid : null;
  for (const part of openingParts(o, o.frame!, view.isOpen(o.opening.id))) {
    // Its own materials where its style sets them (frosted glass seen through, as the materials' glass is).
    const own = part.role === 'leaf' ? o.looks?.leaf : part.role === 'glass' ? o.looks?.glass : o.looks?.frame;
    const mat = shown ?? (own ? layerMaterial(view, own) : part.role === 'leaf' ? m.leaf : part.role === 'glass' ? m.glass : m.frame);
    const geo = partPrism(part);
    group.add(new THREE.Mesh(geo, [mat, mat]), outline(view, geo));
  }
  return group;
}

/** A floor's or an opening's edges, as the walls' lines (never picked). */
export function outline(view: Scene3D, geo: THREE.BufferGeometry): THREE.LineSegments {
  // A cut object's part (kinds/object.ts) by its creases only: its T-junctions are no edges.
  const lines = new THREE.LineSegments(geo.userData.cut ? creaseEdges(geo, 20) : new THREE.EdgesGeometry(geo, 20), view.edgeMaterial);
  lines.raycast = () => {};
  return lines;
}

export function drop(view: Scene3D, group: THREE.Group): void {
  view.contentVersion++;
  view.scene.remove(group);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
  });
}

/** The lines over the walls, again only when the walls changed; lifted with their levels. */
export function syncEdges(view: Scene3D, g: DerivedGeometry, lift: (levelId: LevelId) => number): void {
  if (view.edgesOf !== g.solids) {
    view.edgesOf = g.solids;
    for (const l of view.edges.values()) {
      view.scene.remove(l);
      l.geometry.dispose();
    }
    view.edges.clear();
    const faces = facesOf(view, g);
    const byLevel = new Map<LevelId, { prisms: WallSolid['blocks'][number][]; faces: PrismFaces[]; sloped: SlopedTop[] }>();
    for (const s of g.solids.values()) {
      const mine = faces.get(s.wall.id) ?? [];
      const level = byLevel.get(s.wall.levelId) ?? { prisms: [], faces: [], sloped: [] };
      s.blocks.forEach((b, i) => {
        if (!mine[i]) return;
        level.prisms.push(b);
        level.faces.push(mine[i]!);
        // Under a roof: seen up to its highest point, then cut to its slope (edges.ts, underSlopes).
        if (b.plane) level.sloped.push({ polygon: b.polygon, plane: b.plane, faces: mine[i] });
      });
      byLevel.set(s.wall.levelId, level);
    }
    for (const [levelId, { prisms, faces: shown, sloped }] of byLevel) {
      const pos: number[] = [];
      for (const e of underSlopes(featureEdges(prisms, shown), sloped)) pos.push(e.a.x, e.a.z, -e.a.y, e.b.x, e.b.z, -e.b.y);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const lines = new THREE.LineSegments(geo, view.edgeMaterial);
      // Never picked: a line's pick reaches a metre around it.
      lines.raycast = () => {};
      view.scene.add(lines);
      view.edges.set(levelId, lines);
    }
  }
  for (const [levelId, l] of view.edges) l.position.y = lift(levelId);
}

/** The box's fills, again when the box, the walls or the lifts changed. */
export function syncBoxCaps(view: Scene3D): void {
  const box = view.boxBox;
  const src = view.lastSync;
  const levels = src ? [...new Set([...src.g.solids.values()].map((s) => s.wall.levelId))] : [];
  // The walls and floors by identity (a new derived geometry is a change), the box and lifts by value.
  const key: unknown[] = [src?.g.solids, src?.g.kinds, JSON.stringify([box, view.sectionLine, levels.map((l) => src!.lift(l))])];
  if (key.every((k, i) => k === view.boxCapsKey[i])) return;
  view.boxCapsKey = key;
  for (const c of [...view.boxCapGroup.children]) {
    view.boxCapGroup.remove(c);
    if (c instanceof THREE.Mesh) c.geometry.dispose();
  }
  if ((!box && !view.sectionLine) || !src) return;
  const prisms: UprightPrism[] = [];
  for (const s of src.g.solids.values()) {
    const up = src.lift(s.wall.levelId);
    for (const b of s.blocks) prisms.push({ polygon: b.polygon, bottom: b.bottom + up, top: b.top + up, ...(b.plane ? { plane: { ...b.plane, c: b.plane.c + up } } : {}) });
  }
  // The registry's kinds that a cut fills (a floor: contract.ts, caps).
  for (const x of eachSolid(src.g.kinds)) {
    if (!x.kind.caps || x.levelId === null) continue;
    const up = src.lift(x.levelId);
    for (const c of x.kind.caps(x.solid)) prisms.push({ polygon: c.polygon, bottom: c.bottom + up, top: c.top + up });
  }
  // A hair inside the box, so the face it lies on does not clip it away.
  const e = 0.0005;
  const inside = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo + e), hi - e);
  if (view.sectionLine) {
    // A hair on the kept side of the section's plane, for the same reason.
    const n = sectionLooks(view.sectionLine);
    for (const cap of sectionCaps(prisms, view.sectionLine)) {
      const pts = cap.map((p) => toThree({ x: p.x + n.x * e, y: p.y + n.y * e }, p.z));
      view.boxCapGroup.add(new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([pts[0]!, pts[1]!, pts[2]!, pts[0]!, pts[2]!, pts[3]!]), view.boxCapMaterial));
    }
  }
  if (!box) return;
  for (const cap of boxCaps(prisms, box)) {
    const pts = cap.map((p) => toThree({ x: inside(p.x, box.min.x, box.max.x), y: inside(p.y, box.min.y, box.max.y) }, inside(p.z, box.min.z, box.max.z)));
    let geo: THREE.BufferGeometry;
    if (cap.every((p) => p.z === cap[0]!.z)) {
      // A top or a bottom: the outline may be any polygon.
      geo = new THREE.ShapeGeometry(new THREE.Shape(cap.map((p) => new THREE.Vector2(p.x, p.y))));
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, pts[0]!.y, 0);
    } else {
      geo = new THREE.BufferGeometry().setFromPoints([pts[0]!, pts[1]!, pts[2]!, pts[0]!, pts[2]!, pts[3]!]);
    }
    view.boxCapGroup.add(new THREE.Mesh(geo, view.boxCapMaterial));
  }
}

/** The cut and the box into the planes every material shares (changed in place). */
export function clipPlanes(view: Scene3D): void {
  view.clip.length = 0;
  if (view.cutPlane) view.clip.push(view.cutPlane);
  view.clip.push(...view.boxPlanes);
  if (view.sectionPlane) view.clip.push(view.sectionPlane);
  view.capClip.length = 0;
  view.capClip.push(...view.boxPlanes);
}
