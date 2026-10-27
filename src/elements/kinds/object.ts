// Parametric objects in the registry (contract.ts, phase 3): the instance and its definition evaluated
// (elements/object/evaluate.ts) into pieces; the plan draws each piece's outline from the lowest up (a
// table's top over its legs), the 3D each piece in its material, the GLB the same. Kept from one
// derivation to the next while the object, its level, the definitions and the materials are the same.

import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Material } from '../material/schema';
import { ARC_SAG } from '../../core/tolerance';
import type { Doc } from '../../app/document';
import { insideRing } from '../room/derive';
import type { BaseGeometry, ElementKind, KindSolid } from '../contract';
import { heightAt } from '../terrain/schema';
import { evaluateObject, type ObjectEval, type Piece, pieceOutline, pieceSpan } from '../object/evaluate';
import { type ObjectItem, objectFields, words } from '../object/fields';
import { isObjectInstance } from '../object/valid';
import { OBJECT_PREFIX, type ObjectDefinition, type ObjectInstance } from '../object/schema';
import { nearSegment, trace } from './paint';
import { t } from '../../ui/i18n';

export interface ObjectSolid extends ObjectItem {
  /** Each piece's outline in plan, lowest first. */
  readonly rings: readonly (readonly { x: number; y: number }[])[];
  /** The voids' outlines (a sink's cutout, a hole): drawn over the pieces, as a cutout is drawn in plan. */
  readonly voids: readonly (readonly { x: number; y: number }[])[];
  /** The box around them all, turned with the object. */
  readonly outline: readonly { x: number; y: number }[];
  /** Its level's floor, and its lowest and highest points (m). */
  readonly floor: number;
  readonly bottom: number;
  readonly top: number;
}

const kept = new WeakMap<ObjectInstance, { defs: readonly ObjectDefinition[]; mats: Doc['materials']; level: unknown; ground: number | null; s: ObjectSolid | null }>();

/**
 * What an object stands on out of doors: the terrain of its level under it (its height there), when it
 * is in no enclosed room and on no floor drawn by its outline; null indoors or off every terrain, where
 * it stands on its level's floor. A tree, a car, a bench placed on a slope sits on it as it would.
 */
export function groundUnder(doc: Doc, g: BaseGeometry, levelId: string, at: { x: number; y: number }): number | null {
  const terrain = doc.terrains.find((t) => t.levelId === levelId && insideRing(t.outline, at));
  if (!terrain) return null;
  for (const r of g.rooms.values()) if (r.room.levelId === levelId && r.enclosed && insideRing(r.outline, at)) return null;
  for (const f of doc.floors) if (f.levelId === levelId && f.source.kind === 'outline' && insideRing(f.source.points, at)) return null;
  return heightAt(terrain.spots, at);
}

function derive(doc: Doc, o: ObjectInstance, g: BaseGeometry): ObjectSolid | null {
  const level = doc.levels.find((l) => l.id === o.levelId);
  // Out of doors on a terrain: its height there is the object's floor (absolute, as the terrain's).
  const ground = level ? groundUnder(doc, g, o.levelId, o.at) : null;
  const hit = kept.get(o);
  if (hit && hit.defs === doc.definitions && hit.mats === doc.materials && hit.level === level && hit.ground === ground) return hit.s;
  const def = doc.definitions.find((d) => d.id === o.definitionId);
  const s = def && level ? build(o, def, evaluateObject(def, o, { definitions: doc.definitions, materials: doc.materials }), ground ?? level.elevation) : null;
  kept.set(o, { defs: doc.definitions, mats: doc.materials, level, ground, s });
  return s;
}

function build(object: ObjectInstance, def: ObjectDefinition, ev: ObjectEval, floor: number): ObjectSolid {
  const pieces = ev.pieces.filter((p) => !p.cut).sort((a, b) => pieceSpan(a).top - pieceSpan(b).top);
  const rings = pieces.map(pieceOutline);
  // The box around the pieces in the object's own axes, turned back into the plan.
  const c = Math.cos(object.angle);
  const s = Math.sin(object.angle);
  const local = rings.flat().map((p) => ({ u: (p.x - object.at.x) * c + (p.y - object.at.y) * s, v: -(p.x - object.at.x) * s + (p.y - object.at.y) * c }));
  const u0 = local.length ? Math.min(...local.map((p) => p.u)) : -0.1;
  const u1 = local.length ? Math.max(...local.map((p) => p.u)) : 0.1;
  const v0 = local.length ? Math.min(...local.map((p) => p.v)) : -0.1;
  const v1 = local.length ? Math.max(...local.map((p) => p.v)) : 0.1;
  const outline = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => ({ x: object.at.x + u! * c - v! * s, y: object.at.y + u! * s + v! * c }));
  const bottom = floor + (pieces.length ? Math.min(...pieces.map((p) => pieceSpan(p).bottom)) : object.elevation);
  const top = floor + (pieces.length ? Math.max(...pieces.map((p) => pieceSpan(p).top)) : object.elevation + 0.1);
  const voids = ev.pieces.filter((p) => p.cut).map(pieceOutline);
  return { object, def, eval: ev, rings, voids, outline, floor, bottom, top };
}

/**
 * The solid pieces' geometries, each with the voids (cut pieces) that reach it taken out, in three.js's
 * axes; the voids themselves not drawn. A piece no void reaches keeps its own geometry.
 */
export function cutGeometries(pieces: readonly Piece[]): { piece: Piece; geometry: THREE.BufferGeometry }[] {
  const voids = pieces.filter((p) => p.cut);
  const solids = pieces.filter((p) => !p.cut);
  if (voids.length === 0) return solids.map((piece) => ({ piece, geometry: pieceGeometry(piece) }));
  const evaluator = new Evaluator();
  evaluator.attributes = ['position', 'normal'];
  evaluator.useGroups = false;
  const holes = voids.map((v) => {
    const b = new Brush(pieceGeometry(v));
    b.updateMatrixWorld();
    return { brush: b, box: new THREE.Box3().setFromBufferAttribute(b.geometry.getAttribute('position') as THREE.BufferAttribute) };
  });
  const out = solids.map((piece) => {
    let geometry = pieceGeometry(piece);
    const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position') as THREE.BufferAttribute);
    for (const h of holes) {
      if (!box.intersectsBox(h.box)) continue;
      const a = new Brush(geometry.index ? geometry.toNonIndexed() : geometry);
      a.updateMatrixWorld();
      const result = evaluator.evaluate(a, h.brush, SUBTRACTION);
      geometry.dispose();
      geometry = result.geometry;
      // Its lines are drawn by creaseEdges: the cut leaves T-junctions, which edges of one face would show.
      geometry.userData.cut = true;
    }
    return { piece, geometry };
  });
  for (const h of holes) h.brush.geometry.dispose();
  return out;
}

/**
 * An object's pieces as the 3D draws them: those of one material made one geometry, so the object is one
 * draw call a material instead of one a piece (a shelf of goods is hundreds of pieces, a classroom of
 * desks near a thousand; each a draw call kept the view slow). A piece a void was cut from keeps its own
 * geometry: its lines are found by its creases (creaseEdges), not by its faces. Merged geometries keep
 * position and normal, and uv where every piece has it (a pattern's is laid again in the world anyway).
 */
export function byMaterial(parts: readonly { piece: Piece; geometry: THREE.BufferGeometry }[]): { material: Material; geometry: THREE.BufferGeometry }[] {
  const groups = new Map<string, { material: Material; geometries: THREE.BufferGeometry[] }>();
  const out: { material: Material; geometry: THREE.BufferGeometry }[] = [];
  for (const { piece, geometry } of parts) {
    if (geometry.userData.cut === true) {
      out.push({ material: piece.material, geometry });
      continue;
    }
    const key = JSON.stringify(piece.material);
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { material: piece.material, geometries: [] }));
    g.geometries.push(geometry);
  }
  for (const { material, geometries } of groups.values()) {
    if (geometries.length === 1) {
      out.unshift({ material, geometry: geometries[0]! });
      continue;
    }
    const uv = geometries.every((g) => g.getAttribute('uv') !== undefined);
    const flat = geometries.map((g) => {
      const f = g.index ? g.toNonIndexed() : g.clone();
      for (const name of Object.keys(f.attributes)) if (name !== 'position' && name !== 'normal' && !(uv && name === 'uv')) f.deleteAttribute(name);
      if (f.getAttribute('normal') === undefined) f.computeVertexNormals();
      f.morphAttributes = {};
      f.clearGroups();
      return f;
    });
    const merged = mergeGeometries(flat, false);
    for (const f of flat) f.dispose();
    // mergeGeometries gives null for attributes that do not agree: kept apart then, never lost.
    if (!merged) {
      for (const g of geometries) out.unshift({ material, geometry: g });
      continue;
    }
    for (const g of geometries) g.dispose();
    out.unshift({ material, geometry: merged });
  }
  return out;
}

/**
 * A cut geometry's lines: only where two faces meet at `angle` degrees or more, its vertices welded by
 * position. three.js's EdgesGeometry also draws every edge of one face, and a cut leaves T-junctions
 * (a vertex in the middle of another triangle's edge): those drew lines across flat faces.
 */
export function creaseEdges(geo: THREE.BufferGeometry, angle = 20): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  // The distinct vertices, welded by position.
  const verts: THREE.Vector3[] = [];
  const index = new Map<string, number>();
  const id = (i: number) => {
    const k = key(i);
    let v = index.get(k);
    if (v === undefined) index.set(k, (v = verts.push(new THREE.Vector3().fromBufferAttribute(pos, i)) - 1));
    return v;
  };
  // All of them first: an edge is split at vertices any triangle has, later ones too.
  const ids: number[] = [];
  for (let i = 0; i < pos.count; i++) ids.push(id(i));
  // Each face edge split at the vertices lying on it (a T-junction's), so both sides of a crease meet on
  // the same pieces; each piece with the normals of the faces it bounds.
  const faces = new Map<string, { n: THREE.Vector3[]; a: number; b: number }>();
  const d = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let t = 0; t + 2 < pos.count; t += 3) {
    const tri = [ids[t]!, ids[t + 1]!, ids[t + 2]!];
    const [a, b, c] = tri.map((k) => verts[k]!);
    const n = b!.clone().sub(a!).cross(c!.clone().sub(a!));
    if (n.lengthSq() < 1e-16) continue;
    n.normalize();
    for (const [i, j] of [[tri[0]!, tri[1]!], [tri[1]!, tri[2]!], [tri[2]!, tri[0]!]] as [number, number][]) {
      const p0 = verts[i]!;
      d.subVectors(verts[j]!, p0);
      const len2 = d.lengthSq();
      if (len2 < 1e-16) continue;
      const on: [number, number][] = [[0, i], [1, j]];
      verts.forEach((v, k) => {
        if (k === i || k === j) return;
        const s = q.subVectors(v, p0).dot(d) / len2;
        if (s <= 1e-6 || s >= 1 - 1e-6) return;
        if (q.subVectors(v, p0).addScaledVector(d, -s).lengthSq() < 1e-10) on.push([s, k]);
      });
      on.sort((x, y) => x[0] - y[0]);
      for (let m = 1; m < on.length; m++) {
        const u = on[m - 1]![1];
        const w = on[m]![1];
        const k = u < w ? `${u}|${w}` : `${w}|${u}`;
        const e = faces.get(k) ?? faces.set(k, { n: [], a: u, b: w }).get(k)!;
        e.n.push(n);
      }
    }
  }
  const cos = Math.cos((angle * Math.PI) / 180);
  const out: number[] = [];
  for (const e of faces.values()) {
    if (e.n.length !== 2 || e.n[0]!.dot(e.n[1]!) > cos) continue;
    const [a, b] = [verts[e.a]!, verts[e.b]!];
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  if (g !== geo) g.dispose();
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
}

/**
 * How many sides a round piece is drawn with: as many as keep its faces within ARC_SAG of the true curve
 * (as a wall's arc is), from 8 for a pin to 64 for a wheel. A fixed 24 drew a 3 mm hook as finely as a
 * 60 cm wheel, and the wheel visibly faceted.
 */
export function roundSides(r: number): number {
  if (!(r > ARC_SAG)) return 8;
  // A multiple of four: a vertex on each axis, so the piece keeps its full size across and along.
  const n = Math.ceil(Math.PI / Math.acos(1 - ARC_SAG / r) / 4) * 4;
  return Math.max(8, Math.min(64, n));
}

/** A piece's geometry where it is, in three.js's axes: plan x, y and height z are x, −z and y; a turn in
 * plan (counter-clockwise) is one about y. For the 3D, the GLB and the definition editor alike. */
export function pieceGeometry(piece: Piece): THREE.BufferGeometry {
  if (piece.kind === 'revolve') {
    // Turned about three.js's y (the vertical), its points (r, z) as the lathe's (x, y); closed onto the
    // axis at its ends so the solid has a bottom and a top.
    const pts = piece.profile.map((q) => new THREE.Vector2(q.r, q.z));
    if (pts[0]!.x > 1e-6) pts.unshift(new THREE.Vector2(0, pts[0]!.y));
    if (pts.at(-1)!.x > 1e-6) pts.push(new THREE.Vector2(0, pts.at(-1)!.y));
    const g = new THREE.LatheGeometry(pts, roundSides(piece.r));
    g.translate(piece.cx, piece.z, -piece.cy);
    return g;
  }
  if (piece.kind === 'profile') {
    // In plan x and y, extruded along +z by h; turned −90° about x: plan y to −z, the extrusion up.
    const shape = new THREE.Shape(piece.points.map((q) => new THREE.Vector2(q.x, q.y)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: piece.h, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    g.translate(0, piece.z, 0);
    return g;
  }
  const geometry =
    piece.kind === 'mesh'
      ? meshGeometry(piece)
      : piece.kind === 'box'
        ? piece.round > 1e-4
          ? new RoundedBoxGeometry(piece.w, piece.h, piece.d, piece.round < 0.01 ? 2 : 3, piece.round)
          : new THREE.BoxGeometry(piece.w, piece.h, piece.d)
        : piece.kind === 'sphere'
          ? new THREE.SphereGeometry(1, roundSides(Math.max(piece.r, piece.h / 2)), Math.max(6, roundSides(Math.max(piece.r, piece.h / 2)) / 2)).scale(piece.r, piece.h / 2, piece.r)
          : new THREE.CylinderGeometry(piece.r2, piece.r, piece.h, roundSides(Math.max(piece.r, piece.r2)));
  if (piece.kind === 'sphere' && piece.ry !== undefined) {
    // An ellipsoid: r along its x, ry along its y (three.js's −z), h tall; leaning and turned about its base's centre.
    const n = roundSides(Math.max(piece.r, piece.ry, piece.h / 2));
    const g = new THREE.SphereGeometry(1, n, Math.max(6, n / 2)).scale(piece.r, piece.h / 2, piece.ry);
    g.translate(0, piece.h / 2, 0);
    g.rotateX(-(piece.tilt ?? 0));
    g.rotateZ(-(piece.roll ?? 0));
    g.rotateY(piece.angle ?? 0);
    g.translate(piece.cx, piece.z, -piece.cy);
    return g;
  }
  if (piece.kind === 'cylinder' && (piece.tilt || piece.roll)) {
    // As a box leans (below), about its base's centre.
    geometry.translate(0, piece.h / 2, 0);
    geometry.rotateX(-(piece.tilt ?? 0));
    geometry.rotateZ(-(piece.roll ?? 0));
    geometry.rotateY(piece.angle ?? 0);
    geometry.translate(piece.cx, piece.z, -piece.cy);
    return geometry;
  }
  if (piece.kind === 'box' && (piece.tilt || piece.roll)) {
    // About its base's centre: tilt about its x (three.js's x; its top toward plan +y, three.js's −z),
    // then roll about its y (three.js's z; its top toward +x); then its turn in plan.
    geometry.translate(0, piece.h / 2, 0);
    geometry.rotateX(-(piece.tilt ?? 0));
    geometry.rotateZ(-(piece.roll ?? 0));
    geometry.rotateY(piece.angle);
    geometry.translate(piece.cx, piece.z, -piece.cy);
    return geometry;
  }
  if (piece.kind === 'box' || piece.kind === 'mesh') geometry.rotateY(piece.angle);
  geometry.translate(piece.cx, piece.z + piece.h / 2, -piece.cy);
  return geometry;
}

/** A mesh piece's geometry about its box's centre, in three.js's axes (x, height, −y), not yet turned. */
function meshGeometry(p: Extract<Piece, { kind: 'mesh' }>): THREE.BufferGeometry {
  const src = p.mesh.positions;
  const pos = new Float32Array(src.length);
  for (let i = 0; i + 2 < src.length; i += 3) {
    pos[i] = (src[i]! - 0.5) * p.w;
    pos[i + 1] = (src[i + 2]! - 0.5) * p.h;
    pos[i + 2] = -(src[i + 1]! - 0.5) * p.d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex([...p.mesh.indices]);
  g.computeVertexNormals();
  return g;
}

export const objectKind: ElementKind<ObjectInstance, ObjectSolid> = {
  key: 'objects',
  prefix: OBJECT_PREFIX,
  category: 'objects',
  icon: 'box',
  one: 'object.title',
  many: 'object.titleMany',
  title: (items) => ({ icon: 'box', text: items.length === 1 ? `${words(items[0]!.def.name)} · ${words(items[0]!.def.types.find((x) => x.id === items[0]!.object.typeId)?.name ?? items[0]!.def.name)}` : t('object.titleMany', { n: items.length }) }),
  warning: (items) => {
    const said = items.flatMap((i) => [...i.eval.warnings.map(words), ...i.eval.problems.map((p) => t('object.problem', { text: p }))]);
    return said.length ? [...new Set(said)].join(' · ') : null;
  },
  dropped: 'fix.droppedObjects',
  exportName: 'export.object',
  exportColour: 'structure',
  valid: isObjectInstance,
  derive: (doc, o, g) => derive(doc, o, g),
  element: (s) => s.object,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || s.outline.some((v, i) => nearSegment(p, v, s.outline[(i + 1) % s.outline.length]!, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (o, d) => ({ ...o, at: { x: o.at.x + d.x, y: o.at.y + d.y } }),
  // It turns with a turn and a mirror: its x is taken by the transform. Its size stays its parameters'.
  mapped: (o, tr, id) => {
    const at = tr.map(o.at);
    const x = tr.map({ x: o.at.x + Math.cos(o.angle), y: o.at.y + Math.sin(o.angle) });
    return { ...o, id, at, angle: Math.atan2(x.y - at.y, x.x - at.x) };
  },
  similar: (a, b) => a.definitionId === b.definitionId && a.typeId === b.typeId,
  // Each piece from the lowest up, filled with the drawing's colour so the higher hides the lower (the
  // top over the legs), outlined thin; the object's box when selected.
  plan: (p, s, lit) => {
    // At 1:200 and smaller the furniture is left out (drawing/schema.ts, detailOf); selected, it shows.
    if (p.detail === 'coarse' && !lit) return;
    const line = lit ? p.color('--wall-sel') : p.color('--text-2');
    for (const ring of s.rings) {
      trace(p, ring);
      p.ctx.fillStyle = lit ? p.color('--wall-sel-fill') : p.color('--furniture');
      p.ctx.fill();
      p.ctx.strokeStyle = line;
      p.ctx.lineWidth = p.pen('fine');
      p.ctx.stroke();
    }
    // The voids over them: their outline, as a counter's cutout is drawn.
    for (const ring of s.voids) {
      trace(p, ring);
      p.ctx.strokeStyle = line;
      p.ctx.lineWidth = p.pen('fine');
      p.ctx.stroke();
    }
    if (lit) {
      trace(p, s.outline);
      p.ctx.setLineDash([4, 3]);
      p.ctx.strokeStyle = line;
      p.ctx.stroke();
      p.ctx.setLineDash([]);
    }
  },
  solid: (s) =>
    byMaterial(cutGeometries(s.eval.pieces)).map(({ material, geometry }, i): KindSolid => {
      // Its lights go with its first piece (a luminaire's: contract.ts, lights).
      return { geometry, y: s.floor, material, edges: true, ...(i === 0 && s.eval.lights.length > 0 ? { lights: s.eval.lights } : {}) };
    }),
  dxfLayers: [{ name: 'A-FURN', colour: 8 }],
  dxf: (s, out) => {
    for (const ring of s.rings) out.polyline('A-FURN', ring, true);
    for (const ring of s.voids) out.polyline('A-FURN', ring, true);
  },
  fields: (items, { dispatch, doc }) => objectFields(items, doc, dispatch),
};
