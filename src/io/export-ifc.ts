// IFC4 export (docs/plano-de-escopo.md, phase 11): the model as an IFC file a BIM program or viewer reads
// with its classes, types and layers. Written as STEP text with no library: the project, its site and
// building, a storey a level; each wall placed along itself with its type and its type's layers
// (IfcMaterialLayerSet, from the exterior face, as the walls list them), its body the blocks it is built
// of, a void for each door and window and the door or window filling it; rooms as spaces with their area,
// in their zones; floors, ceilings, roofs, stairs, guardrails, columns, beams, curtain walls and objects
// (by category: furniture, sanitary, lights, appliances, plants, the rest proxies) as triangulated
// bodies, in their materials' colours. Pure: the ids are made from the elements' (the same model gives
// the same file, but for its date).

import type * as THREE from 'three';
import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { geometryTriangles, prismTriangles } from '../app/section-drawing';
import type { Point3 } from '../app/section-box';
import type { Point2 } from '../core/vector';
import type { KindSolid } from '../elements/contract';
import type { Material } from '../elements/material/schema';
import { materialIn } from '../elements/material/schema';
import { openingParts } from '../elements/opening/parts';
import { eachSolid } from '../elements/registry';

/** How the file names what it holds, in the interface's language. */
export interface IfcNaming {
  readonly project: string;
  readonly site: string;
  readonly building: string;
  /** A level's, a room's, a wall type's name as shown (i18n.ts `name`). */
  readonly name: (stored: string) => string;
  readonly wall: (n: number) => string;
  readonly material: (m: Material) => string;
  /** A door's or a window's mark (P1, J2), or its kind's word. */
  readonly opening: (id: string, kind: 'door' | 'window') => string;
  /** An element of the registry's kinds, by its kind's word. */
  readonly element: (key: string, n: number) => string;
  /** An object's name, from its definition. */
  readonly object: (definitionId: string) => string;
  /** An object's category, from its definition. */
  readonly category: (definitionId: string) => string | null;
  readonly zone: (stored: string) => string;
}

const IFC_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** 128 bits made from a text (four 32-bit FNV-1a hashes, each seeded apart). */
function hash128(text: string): number[] {
  const out: number[] = [];
  for (let seed = 0; seed < 4; seed++) {
    let h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
    h ^= h >>> 15;
    out.push(h >>> 0);
  }
  return out;
}

/** An IFC GlobalId (22 characters, IFC's base 64) for a text: the same text, the same id. */
export function ifcGuid(text: string): string {
  const words = hash128(text);
  const bytes: number[] = [];
  for (const w of words) bytes.push((w >>> 24) & 255, (w >>> 16) & 255, (w >>> 8) & 255, w & 255);
  // The first character holds 2 bits, then 21 of 6 bits each: 128 bits.
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let s = '';
  for (let i = 0; i < 22; i++) {
    s = IFC_CHARS[Number(n & 63n)]! + s;
    n >>= 6n;
  }
  return IFC_CHARS[IFC_CHARS.indexOf(s[0]!) & 3]! + s.slice(1);
}

/** A STEP string: quotes doubled, backslashes doubled, anything not plain ASCII as \X2\…\X0\. */
export function stepString(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c === 39) out += "''";
    else if (c === 92) out += '\\\\';
    else if (c >= 32 && c < 127) out += ch;
    else if (c <= 0xffff) out += `\\X2\\${c.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`;
    else {
      // Beyond the basic plane: its UTF-16 pair.
      const hi = Math.floor((c - 0x10000) / 0x400) + 0xd800;
      const lo = ((c - 0x10000) % 0x400) + 0xdc00;
      out += `\\X2\\${hi.toString(16).toUpperCase()}${lo.toString(16).toUpperCase()}\\X0\\`;
    }
  }
  return `'${out}'`;
}

/** A STEP real: always with its point ("2." not "2"), exponents as "1.E-05". */
export function stepReal(v: number): string {
  if (!Number.isFinite(v)) return '0.';
  let s = String(Number(v.toPrecision(12)));
  if (s.includes('e')) {
    const [m, e] = s.split('e');
    s = `${m!.includes('.') ? m : `${m}.`}E${e}`;
  } else if (!s.includes('.')) s += '.';
  return s;
}

/** The entities of the file, numbered as written. */
class Step {
  readonly lines: string[] = [];
  add(entity: string): string {
    this.lines.push(entity);
    return `#${this.lines.length}`;
  }
}

const list = (items: readonly string[]) => `(${items.join(',')})`;

/** The model as an IFC4 file. */
export function exportIfc(doc: Doc, g: DerivedGeometry, naming: IfcNaming, now: Date): string {
  const s = new Step();
  const guid = (key: string) => stepString(ifcGuid(`${doc.name}|${key}`));
  const pt3 = (p: Point3) => s.add(`IFCCARTESIANPOINT((${stepReal(p.x)},${stepReal(p.y)},${stepReal(p.z)}))`);
  const dir3 = (x: number, y: number, z: number) => s.add(`IFCDIRECTION((${stepReal(x)},${stepReal(y)},${stepReal(z)}))`);
  const origin = pt3({ x: 0, y: 0, z: 0 });
  const zUp = dir3(0, 0, 1);
  const xAxis = dir3(1, 0, 0);
  const world = s.add(`IFCAXIS2PLACEMENT3D(${origin},${zUp},${xAxis})`);
  const context = s.add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${world},$)`);
  const body = s.add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${context},$,.MODEL_VIEW.,$)`);
  const axisContext = s.add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,${context},$,.GRAPH_VIEW.,$)`);
  const units = s.add(
    `IFCUNITASSIGNMENT(${list([
      s.add('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)'),
      s.add('IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)'),
      s.add('IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)'),
      s.add('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)'),
    ])})`,
  );
  const project = s.add(`IFCPROJECT(${guid('project')},$,${stepString(doc.name || naming.project)},$,$,$,$,(${context}),${units})`);
  // Placements: absolute ones (the model's own coordinates), or along a wall.
  const placement = (at: Point3 = { x: 0, y: 0, z: 0 }, along: Point2 = { x: 1, y: 0 }) =>
    s.add(`IFCLOCALPLACEMENT($,${s.add(`IFCAXIS2PLACEMENT3D(${pt3(at)},${zUp},${along.x === 1 && along.y === 0 ? xAxis : dir3(along.x, along.y, 0)})`)})`);
  const site = s.add(`IFCSITE(${guid('site')},$,${stepString(naming.site)},$,$,${placement()},$,$,.ELEMENT.,$,$,$,$,$)`);
  const building = s.add(`IFCBUILDING(${guid('building')},$,${stepString(naming.building)},$,$,${placement()},$,$,.ELEMENT.,$,$,$)`);
  s.add(`IFCRELAGGREGATES(${guid('rel:project')},$,$,$,${project},(${site}))`);
  s.add(`IFCRELAGGREGATES(${guid('rel:site')},$,$,$,${site},(${building}))`);
  const levels = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  const storeys = new Map<string, string>();
  for (const l of levels)
    storeys.set(l.id, s.add(`IFCBUILDINGSTOREY(${guid(l.id)},$,${stepString(naming.name(l.name))},$,$,${placement({ x: 0, y: 0, z: l.elevation })},$,$,.ELEMENT.,${stepReal(l.elevation)})`));
  s.add(`IFCRELAGGREGATES(${guid('rel:building')},$,$,$,${building},${list([...storeys.values()])})`);
  const contained = new Map<string, string[]>();
  const contain = (levelId: string | null, e: string) => {
    const at = levelId && storeys.has(levelId) ? levelId : levels[0]!.id;
    contained.set(at, [...(contained.get(at) ?? []), e]);
  };

  // Colours: a surface style a colour, styled onto each body's items.
  const styles = new Map<string, string>();
  const styleOf = (hex: string) => {
    let st = styles.get(hex);
    if (!st) {
      const v = Number.parseInt(hex.replace('#', ''), 16);
      const rgb = s.add(`IFCCOLOURRGB($,${stepReal(((v >> 16) & 255) / 255)},${stepReal(((v >> 8) & 255) / 255)},${stepReal((v & 255) / 255)})`);
      st = s.add(`IFCSURFACESTYLE($,.BOTH.,(${s.add(`IFCSURFACESTYLESHADING(${rgb},$)`)}))`);
      styles.set(hex, st);
    }
    return st;
  };
  const styled = (item: string, hex: string | null) => {
    if (hex && /^#[0-9a-f]{6}$/i.test(hex)) s.add(`IFCSTYLEDITEM(${item},(${styleOf(hex)}),$)`);
    return item;
  };
  // Bodies: upright prisms swept up from their profile (walls, doors, rooms), or triangles.
  const prism = (poly: readonly Point2[], bottom: number, top: number, hex: string | null) => {
    const pts = [...poly, poly[0]!].map((p) => s.add(`IFCCARTESIANPOINT((${stepReal(p.x)},${stepReal(p.y)}))`));
    const profile = s.add(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${s.add(`IFCPOLYLINE(${list(pts)})`)})`);
    const at = s.add(`IFCAXIS2PLACEMENT3D(${pt3({ x: 0, y: 0, z: bottom })},$,$)`);
    return styled(s.add(`IFCEXTRUDEDAREASOLID(${profile},${at},${zUp},${stepReal(Math.max(1e-4, top - bottom))})`), hex);
  };
  const faceSet = (tris: readonly (readonly [Point3, Point3, Point3])[], hex: string | null) => {
    const index = new Map<string, number>();
    const coords: string[] = [];
    const idx = (p: Point3) => {
      const k = `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
      let i = index.get(k);
      if (i === undefined) {
        coords.push(`(${stepReal(p.x)},${stepReal(p.y)},${stepReal(p.z)})`);
        i = coords.length;
        index.set(k, i);
      }
      return i;
    };
    const faces = tris.flatMap((t) => {
      const [a, b, c] = t.map(idx);
      return a === b || b === c || a === c ? [] : [`(${a},${b},${c})`];
    });
    if (faces.length === 0) return null;
    const points = s.add(`IFCCARTESIANPOINTLIST3D((${coords.join(',')}))`);
    return styled(s.add(`IFCTRIANGULATEDFACESET(${points},$,$,(${faces.join(',')}),$)`), hex);
  };
  /** Its body; a wall's also its axis, its reference line from its start to its end along its own x. */
  const shape = (items: readonly string[], type: 'SweptSolid' | 'Tessellation', axis?: number) => {
    const reps = [s.add(`IFCSHAPEREPRESENTATION(${body},'Body','${type}',${list(items)})`)];
    if (axis !== undefined) {
      const line = s.add(`IFCPOLYLINE((${s.add('IFCCARTESIANPOINT((0.,0.))')},${s.add(`IFCCARTESIANPOINT((${stepReal(axis)},0.))`)}))`);
      reps.unshift(s.add(`IFCSHAPEREPRESENTATION(${axisContext},'Axis','Curve2D',(${line}))`));
    }
    return s.add(`IFCPRODUCTDEFINITIONSHAPE($,$,${list(reps)})`);
  };
  const pset = (key: string, of: string, name: string, props: readonly string[]) => {
    const set = s.add(`IFCPROPERTYSET(${guid(`pset:${key}:${name}`)},$,${stepString(name)},$,${list(props)})`);
    s.add(`IFCRELDEFINESBYPROPERTIES(${guid(`rel:pset:${key}:${name}`)},$,$,$,(${of}),${set})`);
  };
  const boolProp = (name: string, v: boolean) => s.add(`IFCPROPERTYSINGLEVALUE(${stepString(name)},$,IFCBOOLEAN(${v ? '.T.' : '.F.'}),$)`);
  const labelProp = (name: string, v: string) => s.add(`IFCPROPERTYSINGLEVALUE(${stepString(name)},$,IFCLABEL(${stepString(v)}),$)`);

  // Materials and the wall types' layer sets.
  const materials = new Map<string, string>();
  const materialEntity = (id: string) => {
    let m = materials.get(id);
    if (!m) {
      const mat = materialIn(doc.materials, id);
      m = s.add(`IFCMATERIAL(${stepString(naming.material(mat))},$,$)`);
      materials.set(id, m);
    }
    return m;
  };
  const wallTypes = new Map<string, { type: string; layers: string }>();
  for (const wt of doc.wallTypes) {
    const layers = wt.layers.map((l) => s.add(`IFCMATERIALLAYER(${materialEntity(l.materialId)},${stepReal(l.thickness)},$,${stepString(naming.material(materialIn(doc.materials, l.materialId)))},$,$,$)`));
    const set = s.add(`IFCMATERIALLAYERSET(${list(layers)},${stepString(naming.name(wt.name))},$)`);
    const type = s.add(`IFCWALLTYPE(${guid(wt.id)},$,${stepString(naming.name(wt.name))},$,$,$,$,$,$,.STANDARD.)`);
    s.add(`IFCRELASSOCIATESMATERIAL(${guid(`rel:mat:${wt.id}`)},$,$,$,(${type}),${set})`);
    wallTypes.set(wt.id, { type, layers: set });
  }
  const typed = new Map<string, string[]>();

  // Walls: along themselves, their blocks swept up, their layers used from the exterior face.
  let wallNo = 0;
  const wallEntities = new Map<string, string>();
  for (const sol of g.solids.values()) {
    const w = sol.wall;
    wallNo++;
    const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) || 1;
    const dir = { x: (w.end.x - w.start.x) / len, y: (w.end.y - w.start.y) / len };
    const local = (p: Point2): Point2 => {
      const dx = p.x - w.start.x;
      const dy = p.y - w.start.y;
      return { x: dx * dir.x + dy * dir.y, y: -dx * dir.y + dy * dir.x };
    };
    const colourOf = (i: number) => sol.materials[i]?.color ?? null;
    const sloped = sol.blocks.some((b) => b.plane);
    let items: string[];
    if (sloped) {
      // Under a roof the tops slope: as triangles, in the wall's own frame.
      const tris = sol.blocks.flatMap((b) => prismTriangles(b.polygon, b).map((t) => t.map((p) => ({ ...local(p), z: p.z })) as [Point3, Point3, Point3]));
      const f = faceSet(tris, colourOf(0));
      items = f ? [f] : [];
    } else items = sol.blocks.map((b) => prism(b.polygon.map(local), b.bottom, b.top, colourOf(b.layerIndex)));
    if (items.length === 0) continue;
    const e = s.add(`IFCWALL(${guid(w.id)},$,${stepString(naming.wall(wallNo))},$,$,${placement({ x: w.start.x, y: w.start.y, z: 0 }, dir)},${shape(items, sloped ? 'Tessellation' : 'SweptSolid', len)},${stepString(w.id)},.STANDARD.)`);
    wallEntities.set(w.id, e);
    contain(w.levelId, e);
    const wt = wallTypes.get(w.wallTypeId);
    if (wt) {
      typed.set(wt.type, [...(typed.get(wt.type) ?? []), e]);
      // The layers from the exterior face (the right of start → end, the lowest local y), toward the interior.
      const exterior = Math.min(...sol.blocks.flatMap((b) => b.polygon.map((p) => local(p).y)));
      const usage = s.add(`IFCMATERIALLAYERSETUSAGE(${wt.layers},.AXIS2.,.POSITIVE.,${stepReal(exterior)},$)`);
      s.add(`IFCRELASSOCIATESMATERIAL(${guid(`rel:usage:${w.id}`)},$,$,$,(${e}),${usage})`);
    }
    pset(w.id, e, 'Pset_WallCommon', [
      boolProp('IsExternal', [...g.rooms.values()].length === 0 ? false : isExternal(g, sol.wall.id)),
      labelProp('Reference', naming.name(doc.wallTypes.find((x) => x.id === w.wallTypeId)?.name ?? '')),
    ]);
  }

  // Doors and windows: the void through the wall, and the door or window in it.
  for (const o of g.openings.values()) {
    if (!o.frame) continue;
    const host = wallEntities.get(o.opening.wallId);
    const levelId = g.solids.get(o.opening.wallId)?.wall.levelId ?? null;
    if (!host) continue;
    const f = o.frame;
    const thick = (g.solids.get(o.opening.wallId)?.layers ?? []).reduce((t, l) => t + l.thickness, 0) || 0.2;
    // The void: the width between the jambs, from the sill to the head, across the whole wall: its
    // reference line may be a face, so it reaches a thickness and a little to each side of the line.
    const across = { x: -f.dir.y, y: f.dir.x };
    const reach = thick + 0.05;
    const corners = [
      { x: f.start.x - across.x * reach, y: f.start.y - across.y * reach },
      { x: f.end.x - across.x * reach, y: f.end.y - across.y * reach },
      { x: f.end.x + across.x * reach, y: f.end.y + across.y * reach },
      { x: f.start.x + across.x * reach, y: f.start.y + across.y * reach },
    ];
    const voidE = s.add(`IFCOPENINGELEMENT(${guid(`void:${o.opening.id}`)},$,$,$,$,${placement()},${shape([prism(corners, o.bottom, o.top, null)], 'SweptSolid')},$,.OPENING.)`);
    s.add(`IFCRELVOIDSELEMENT(${guid(`rel:void:${o.opening.id}`)},$,$,$,${host},${voidE})`);
    const parts = openingParts(o, f, false).map((p) => {
      const hex = p.role === 'glass' ? '#9fc6e0' : p.role === 'leaf' ? '#c9a77c' : '#8a8f96';
      return prism(p.polygon, p.bottom, p.top, hex);
    });
    const name = stepString(naming.opening(o.opening.id, o.opening.kind));
    const rep = parts.length > 0 ? shape(parts, 'SweptSolid') : '$';
    const h = stepReal(o.top - o.bottom);
    const wd = stepReal(o.opening.width);
    const e =
      o.opening.kind === 'door'
        ? s.add(`IFCDOOR(${guid(o.opening.id)},$,${name},$,$,${placement()},${rep},${stepString(o.opening.id)},${h},${wd},.DOOR.,$,$)`)
        : s.add(`IFCWINDOW(${guid(o.opening.id)},$,${name},$,$,${placement()},${rep},${stepString(o.opening.id)},${h},${wd},.WINDOW.,$,$)`);
    s.add(`IFCRELFILLSELEMENT(${guid(`rel:fill:${o.opening.id}`)},$,$,$,${voidE},${e})`);
    contain(levelId, e);
  }

  // Rooms: spaces from their floor to their ceiling, with their area; in their zones.
  const spaces = new Map<string, string[]>();
  const spaceOf = new Map<string, string>();
  for (const r of g.rooms.values()) {
    if (!r.enclosed || r.outline.length < 3) continue;
    const level = doc.levels.find((l) => l.id === r.room.levelId);
    if (!level) continue;
    const bottom = level.elevation;
    const top = bottom + (r.room.height ?? level.height);
    const e = s.add(
      `IFCSPACE(${guid(r.room.id)},$,${stepString(r.room.number)},$,$,${placement()},${shape([prism(r.outline, bottom, top, null)], 'SweptSolid')},${stepString(naming.name(r.room.name))},.ELEMENT.,.INTERNAL.,$)`,
    );
    spaces.set(r.room.levelId, [...(spaces.get(r.room.levelId) ?? []), e]);
    spaceOf.set(r.room.id, e);
    const q = s.add(`IFCQUANTITYAREA('NetFloorArea',$,$,${stepReal(r.area)},$)`);
    const qto = s.add(`IFCELEMENTQUANTITY(${guid(`qto:${r.room.id}`)},$,'Qto_SpaceBaseQuantities',$,$,(${q}))`);
    s.add(`IFCRELDEFINESBYPROPERTIES(${guid(`rel:qto:${r.room.id}`)},$,$,$,(${e}),${qto})`);
  }
  for (const [levelId, list_] of spaces) s.add(`IFCRELAGGREGATES(${guid(`rel:spaces:${levelId}`)},$,$,$,${storeys.get(levelId)},${list(list_)})`);
  for (const z of doc.zones) {
    const members = z.rooms.flatMap((id) => spaceOf.get(id) ?? []);
    if (members.length === 0) continue;
    const zone = s.add(`IFCZONE(${guid(z.id)},$,${stepString(naming.zone(z.name))},$,$,$)`);
    s.add(`IFCRELASSIGNSTOGROUP(${guid(`rel:zone:${z.id}`)},$,$,$,${list(members)},$,${zone})`);
  }

  // The registry's kinds that have a body: each its IFC class, as triangles in its materials' colours.
  const counts = new Map<string, number>();
  for (const x of eachSolid(g.kinds)) {
    const cls = ifcClassOf(x.kind.key, x.kind.key === 'objects' ? naming.category((x.kind.element(x.solid) as { definitionId: string }).definitionId) : null, x.solid);
    if (!cls || !x.kind.solid) continue;
    const made = x.kind.solid(x.solid);
    if (!made) continue;
    const parts = Array.isArray(made) ? (made as readonly KindSolid[]) : [made as KindSolid];
    const items = parts.flatMap((p) => {
      const hex = typeof p.material === 'string' ? (p.material === 'roof' ? '#9c5b45' : p.material === 'floor' ? '#cfc7b8' : '#d8d4cc') : p.material.color;
      const f = faceSet(geometryTriangles(p.geometry as THREE.BufferGeometry, p.y), hex);
      return f ? [f] : [];
    });
    if (items.length === 0) continue;
    const n = (counts.get(x.kind.key) ?? 0) + 1;
    counts.set(x.kind.key, n);
    const label = x.kind.key === 'objects' ? naming.object((x.kind.element(x.solid) as { definitionId: string }).definitionId) : naming.element(x.kind.key, n);
    const e = s.add(`${cls.entity}(${guid(x.id)},$,${stepString(label)},$,$,${placement()},${shape(items, 'Tessellation')},${stepString(x.id)},${cls.type})`);
    contain(x.levelId, e);
  }

  for (const [type, objects] of typed) s.add(`IFCRELDEFINESBYTYPE(${guid(`rel:type:${type}`)},$,$,$,${list(objects)},${type})`);
  for (const [levelId, elements] of contained) s.add(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid(`rel:contained:${levelId}`)},$,$,$,${list(elements)},${storeys.get(levelId)})`);

  const stamp = now.toISOString().slice(0, 19);
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');",
    `FILE_NAME(${stepString(`${doc.name || naming.project}.ifc`)},'${stamp}',(''),(''),'cad2','cad2','');`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
  ];
  return `${[...header, ...s.lines.map((l, i) => `#${i + 1}=${l};`), 'ENDSEC;', 'END-ISO-10303-21;'].join('\n')}\n`;
}

/** A wall is external when a room lies on one side of it only (its middle, a little past each face). */
function isExternal(g: DerivedGeometry, wallId: string): boolean {
  const sol = g.solids.get(wallId);
  if (!sol) return false;
  const w = sol.wall;
  const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) || 1;
  const n = { x: -(w.end.y - w.start.y) / len, y: (w.end.x - w.start.x) / len };
  const thick = sol.layers.reduce((t, l) => t + l.thickness, 0);
  const mid = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
  const rooms = [...g.rooms.values()].filter((r) => r.enclosed && r.room.levelId === w.levelId);
  const inside = (p: Point2) => rooms.some((r) => pointIn(r.outline, p));
  const off = thick + 0.25;
  return inside({ x: mid.x + n.x * off, y: mid.y + n.y * off }) !== inside({ x: mid.x - n.x * off, y: mid.y - n.y * off });
}

function pointIn(ring: readonly Point2[], p: Point2): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** A kind's IFC class and predefined type; null for one with no body in IFC (texts, dimensions, guides). */
export function ifcClassOf(key: string, category: string | null, solid: unknown): { entity: string; type: string } | null {
  switch (key) {
    case 'floors':
      return (solid as { floor?: { kind?: string } }).floor?.kind === 'ceiling' ? { entity: 'IFCCOVERING', type: '.CEILING.' } : { entity: 'IFCSLAB', type: '.FLOOR.' };
    case 'roofs':
      return { entity: 'IFCROOF', type: '.NOTDEFINED.' };
    case 'stairs':
      return { entity: 'IFCSTAIR', type: '.NOTDEFINED.' };
    case 'railings':
      return { entity: 'IFCRAILING', type: '.GUARDRAIL.' };
    case 'columns':
      return { entity: 'IFCCOLUMN', type: '.COLUMN.' };
    case 'beams':
      return { entity: 'IFCBEAM', type: '.BEAM.' };
    case 'curtains':
      return { entity: 'IFCCURTAINWALL', type: '.NOTDEFINED.' };
    case 'objects':
      return category === 'fixture'
        ? { entity: 'IFCSANITARYTERMINAL', type: '.NOTDEFINED.' }
        : category === 'lighting'
          ? { entity: 'IFCLIGHTFIXTURE', type: '.NOTDEFINED.' }
          : category === 'equipment'
            ? { entity: 'IFCELECTRICAPPLIANCE', type: '.NOTDEFINED.' }
            : category === 'plant'
              ? { entity: 'IFCGEOGRAPHICELEMENT', type: '.NOTDEFINED.' }
              : category === 'generic'
                ? { entity: 'IFCBUILDINGELEMENTPROXY', type: '.NOTDEFINED.' }
                : { entity: 'IFCFURNITURE', type: '.NOTDEFINED.' };
    default:
      return null;
  }
}
