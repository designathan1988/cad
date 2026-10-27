// The detailed level's inputs (docs/plano-de-escopo.md, phase 14: "motores validados gerados do modelo
// e executados fora da interface"): an EnergyPlus IDF (a zone per room, its walls by their types'
// layers, floors, ceilings, windows), a Radiance scene (the same surfaces with their materials'
// reflectances and the windows' glass) and an FDS input (the walls as obstructions, the doors and
// windows as holes). Each is written for the engine to run; none is run here. Pure.

import type { Doc } from '../app/document';
import type { Room } from '../elements/room/schema';
import { levelOf } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { DEFAULT_SITE } from '../app/sun';
import { distance, dot, normalize, type Point2, sub } from '../core/vector';
import { materialIn } from '../elements/material/schema';
import { insideRing } from '../elements/room/derive';
import { exteriorWindows } from '../sim/exposure';
import { absorptanceOf, physicsOf } from '../sim/physics';

/** A number with up to `places` decimals, its trailing zeros (after the point only) left off. */
const n = (v: number, places = 4) => {
  if (Math.abs(v) < 1e-12) return '0';
  const s = v.toFixed(places);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
};
/** A name an IDF or a Radiance file takes: no commas, semicolons or spaces at the ends; ASCII. */
const safe = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_\- ]/g, '_')
    .trim() || 'x';

interface Surface {
  readonly name: string;
  readonly kind: 'Wall' | 'Floor' | 'Ceiling' | 'Roof';
  readonly construction: string;
  readonly zone: string;
  readonly outside: 'Outdoors' | 'Ground' | 'Adiabatic';
  /** Counter-clockwise seen from outside, from the upper left (GlobalGeometryRules). */
  readonly points: readonly { x: number; y: number; z: number }[];
  readonly windows: readonly { name: string; points: readonly { x: number; y: number; z: number }[] }[];
  readonly materialId: string;
}

/** A room's name as the files carry it: the one the interface shows, given by the caller (the stored one by default). */
export type RoomName = (room: Room) => string;
const storedName: RoomName = (r) => r.name;

/** The rooms' surfaces: each edge of its outline a wall, its floor and ceiling; windows on their walls. */
function surfacesOf(doc: Doc, g: DerivedGeometry, roomName: RoomName): { zones: { name: string; roomId: string; height: number; area: number; z: number }[]; surfaces: Surface[] } {
  const zones: { name: string; roomId: string; height: number; area: number; z: number }[] = [];
  const surfaces: Surface[] = [];
  const windows = exteriorWindows(doc, g);
  const sorted = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  const used = new Set<string>();
  for (const r of doc.rooms) {
    const s = g.rooms.get(r.id);
    if (!s?.enclosed || s.outline.length < 3) continue;
    const level = levelOf(doc, r.levelId);
    const z0 = level?.elevation ?? 0;
    const height = r.height ?? level?.height ?? 2.8;
    let zone = safe(`${r.number} ${roomName(r)}`);
    while (used.has(zone)) zone += '_';
    used.add(zone);
    zones.push({ name: zone, roomId: r.id, height, area: s.area, z: z0 });
    const ring = s.outline;
    const sameLevel = [...g.rooms.values()].filter((x) => x.room.levelId === r.levelId && x.enclosed && x.room.id !== r.id);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const u = normalize(sub(b, a));
      const out = { x: u.y, y: -u.x };
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      // Another room just past this side's wall: inside the building (adiabatic: both sides alike).
      const beyond = { x: mid.x + out.x * 0.4, y: mid.y + out.y * 0.4 };
      const outdoors = !sameLevel.some((x) => insideRing(x.outline, beyond));
      // The wall behind this side: the nearest parallel one, its type the construction.
      const wall = [...doc.walls]
        .filter((w) => w.levelId === r.levelId && !w.bulge && Math.abs(Math.abs(dot(normalize(sub(w.end, w.start)), u)) - 1) < 1e-3)
        .sort((p, q) => Math.abs(dot(sub(mid, p.start), out)) - Math.abs(dot(sub(mid, q.start), out)))[0];
      const name = `${zone} parede ${i + 1}`;
      const mine = windows
        .filter((w) => w.roomId === r.id)
        .flatMap((w) => {
          const o = doc.openings.find((x) => x.id === w.id)!;
          // On this side when its middle projects inside it and the way out is this side's.
          const t = dot(sub(w.at, a), u);
          const len = distance(a, b);
          if (dot(w.out, out) < 0.99 || t < 0 || t > len) return [];
          const t0 = Math.max(0.01, t - o.width / 2);
          const t1 = Math.min(len - 0.01, t + o.width / 2);
          const p0 = { x: a.x + u.x * t0, y: a.y + u.y * t0 };
          const p1 = { x: a.x + u.x * t1, y: a.y + u.y * t1 };
          const lo = z0 + o.sill;
          const hi = Math.min(z0 + height - 0.01, lo + o.height);
          return [{ name: `${name} janela ${safe(o.id)}`, points: [{ ...p0, z: hi }, { ...p0, z: lo }, { ...p1, z: lo }, { ...p1, z: hi }] }];
        });
      surfaces.push({
        name,
        kind: 'Wall',
        construction: safe(wall?.wallTypeId ?? 'parede'),
        zone,
        outside: outdoors ? 'Outdoors' : 'Adiabatic',
        points: [{ ...a, z: z0 + height }, { ...a, z: z0 }, { ...b, z: z0 }, { ...b, z: z0 + height }],
        windows: outdoors ? mine : [],
        materialId: (wall && doc.wallTypes.find((t) => t.id === wall.wallTypeId)?.layers.at(-1)?.materialId) ?? 'plaster',
      });
    }
    const lowest = sorted[0]?.id === r.levelId;
    const above = sorted[sorted.findIndex((l) => l.id === r.levelId) + 1];
    const centre = s.label;
    const covered = above ? [...g.rooms.values()].some((x) => x.room.levelId === above.id && x.enclosed && insideRing(x.outline, centre)) : false;
    surfaces.push({ name: `${zone} piso`, kind: 'Floor', construction: 'laje', zone, outside: lowest ? 'Ground' : 'Adiabatic', points: [...ring].reverse().map((p) => ({ ...p, z: z0 })), windows: [], materialId: r.finishes?.floor ?? 'concrete' });
    surfaces.push({ name: `${zone} teto`, kind: covered ? 'Ceiling' : 'Roof', construction: 'laje', zone, outside: covered ? 'Adiabatic' : 'Outdoors', points: ring.map((p) => ({ ...p, z: z0 + height })), windows: [], materialId: r.finishes?.ceiling ?? 'plaster' });
  }
  return { zones, surfaces };
}

const vertices = (pts: readonly { x: number; y: number; z: number }[], indent = '    ') => pts.map((p, i) => `${indent}${n(p.x)}, ${n(p.y)}, ${n(p.z)}${i === pts.length - 1 ? ';' : ','}`).join('\n');

/** The project as an EnergyPlus input (version 24.1 fields), free-running: the zones' temperatures hour by hour, with a weather file. */
export function energyPlusIdf(doc: Doc, g: DerivedGeometry, title: string, roomName: RoomName = storedName): string {
  const site = doc.site ?? DEFAULT_SITE;
  const { zones, surfaces } = surfacesOf(doc, g, roomName);
  const lines: string[] = [];
  const obj = (...fields: string[]) => lines.push(`${fields[0]},\n${fields.slice(1).map((f, i, all) => `    ${f}${i === all.length - 1 ? ';' : ','}`).join('\n')}\n`);
  lines.push(`! ${title}: written by cad2 from the model. Run it with a weather file (EPW) of the place.\n! The walls by their types' layers (NBR 15220-2 physics); slabs as 12 cm of concrete; windows as single clear glass (adopted).\n`);
  obj('Version', '24.1');
  obj('Building', safe(title), n(site.north, 2), 'Suburbs', '0.04', '0.4', 'FullInteriorAndExterior', '25', '6');
  obj('GlobalGeometryRules', 'UpperLeftCorner', 'Counterclockwise', 'World');
  obj('Timestep', '4');
  obj('SimulationControl', 'No', 'No', 'No', 'No', 'Yes');
  obj('RunPeriod', 'Ano', '1', '1', '', '12', '31', '', '', 'Yes', 'Yes', 'No', 'Yes', 'Yes');
  obj('Site:Location', safe(title), n(site.latitude), n(site.longitude), n(site.utcOffset, 1), '760');
  // Materials of every type used and of the slab.
  const typeIds = [...new Set(surfaces.filter((s) => s.kind === 'Wall').map((s) => s.construction))];
  const matIds = new Set<string>(['concrete']);
  for (const t of doc.wallTypes) if (typeIds.includes(safe(t.id))) for (const l of t.layers) matIds.add(`${l.materialId}@${l.thickness}`);
  for (const key of matIds) {
    const [id, th] = key.includes('@') ? key.split('@') : [key, '0.12'];
    const m = materialIn(doc.materials, id!);
    const p = physicsOf(m) ?? { conductivity: 1, density: 1500, specificHeat: 1 };
    obj('Material', safe(`${id} ${th}`), 'MediumRough', n(Number(th)), n(p.conductivity), n(p.density), n(p.specificHeat * 1000, 0), '0.9', n(absorptanceOf(m.color), 2), n(absorptanceOf(m.color), 2));
  }
  obj('WindowMaterial:SimpleGlazingSystem', 'vidro simples', '5.8', '0.86', '0.9');
  for (const t of doc.wallTypes) if (typeIds.includes(safe(t.id))) obj('Construction', safe(t.id), ...t.layers.map((l) => safe(`${l.materialId} ${l.thickness}`)));
  if (typeIds.includes('parede')) obj('Construction', 'parede', safe('concrete 0.12'));
  obj('Construction', 'laje', safe('concrete 0.12'));
  obj('Construction', 'janela', 'vidro simples');
  for (const z of zones) obj('Zone', z.name, '0', '0', '0', '0', '1', '1', n(z.height), n(z.area * z.height), n(z.area));
  for (const s of surfaces) {
    lines.push(
      `BuildingSurface:Detailed,\n    ${s.name},\n    ${s.kind},\n    ${s.construction},\n    ${s.zone},\n    ,\n    ${s.outside},\n    ,\n    ${s.outside === 'Outdoors' ? 'SunExposed' : 'NoSun'},\n    ${s.outside === 'Outdoors' ? 'WindExposed' : 'NoWind'},\n    autocalculate,\n    ${s.points.length},\n${vertices(s.points)}\n`,
    );
    for (const w of s.windows) lines.push(`FenestrationSurface:Detailed,\n    ${w.name},\n    Window,\n    janela,\n    ${s.name},\n    ,\n    autocalculate,\n    ,\n    1,\n    4,\n${vertices(w.points)}\n`);
  }
  obj('Output:Variable', '*', 'Zone Mean Air Temperature', 'Hourly');
  obj('Output:Variable', '*', 'Zone Operative Temperature', 'Hourly');
  return lines.join('\n');
}

/** The rooms' surfaces as a Radiance scene: plastic by each material's colour, the windows as glass. */
export function radianceScene(doc: Doc, g: DerivedGeometry, title: string, roomName: RoomName = storedName): string {
  const site = doc.site ?? DEFAULT_SITE;
  const { surfaces } = surfacesOf(doc, g, roomName);
  const out: string[] = [`# ${title}: written by cad2 from the model, metres, z up.`, `# A sky to go with it, at noon of the June solstice there:`, `# !gensky 6 21 12 +s -a ${n(site.latitude, 2)} -o ${n(-site.longitude, 2)} -m ${n(-site.utcOffset * 15, 0)}`, ''];
  const mats = new Set(surfaces.map((s) => s.materialId));
  for (const id of mats) {
    const m = materialIn(doc.materials, id);
    const c = parseInt(m.color.slice(1), 16);
    const ch = (s: number) => n(((c >> s) & 255) / 255, 3);
    out.push(`void plastic ${safe(id)}\n0\n0\n5 ${ch(16)} ${ch(8)} ${ch(0)} 0 0\n`);
  }
  out.push('void glass vidro\n0\n0\n3 0.96 0.96 0.96\n');
  let k = 0;
  for (const s of surfaces) {
    // Radiance faces its polygons by their order: seen from inside the room (the side the light is on).
    // A window is a hole in its wall, joined to the outline by a seam (the way Radiance takes holes):
    // from the first corner into the hole, round it the other way, and back.
    const outer = [...s.points].reverse();
    const pts = [outer[0]!, ...s.windows.flatMap((w) => [...w.points, w.points[0]!, outer[0]!]), ...outer.slice(1)];
    out.push(`${safe(s.materialId)} polygon s${++k}\n0\n0\n${pts.length * 3}\n${pts.map((p) => `  ${n(p.x)} ${n(p.y)} ${n(p.z)}`).join('\n')}\n`);
    for (const w of s.windows) out.push(`vidro polygon w${++k}\n0\n0\n12\n${[...w.points].reverse().map((p) => `  ${n(p.x)} ${n(p.y)} ${n(p.z)}`).join('\n')}\n`);
  }
  return out.join('\n');
}

/** FDS's mesh is square: walls along the axes as one box, the others as steps of the cell. */
export function fdsInput(doc: Doc, g: DerivedGeometry, title: string, cell = 0.2): string {
  const boxes: string[] = [];
  const holes: string[] = [];
  const all: Point2[] = [];
  let top = 0;
  let bottom = 0;
  for (const w of doc.walls) {
    const s = g.solids.get(w.id);
    if (!s || w.bulge) continue;
    const t = s.layers.reduce((x, l) => x + l.thickness, 0) || 0.1;
    top = Math.max(top, s.top);
    bottom = Math.min(bottom, s.bottom);
    const d = sub(w.end, w.start);
    const len = Math.hypot(d.x, d.y);
    const steps = Math.abs(d.x) < 1e-6 || Math.abs(d.y) < 1e-6 ? 1 : Math.max(1, Math.ceil(len / cell));
    for (let i = 0; i < steps; i++) {
      const a = { x: w.start.x + (d.x * i) / steps, y: w.start.y + (d.y * i) / steps };
      const b = { x: w.start.x + (d.x * (i + 1)) / steps, y: w.start.y + (d.y * (i + 1)) / steps };
      const xs = [a.x, b.x];
      const ys = [a.y, b.y];
      const half = steps === 1 ? t / 2 : Math.max(t / 2, cell / 2);
      const x0 = Math.min(...xs) - (Math.abs(d.y) > Math.abs(d.x) || steps > 1 ? half : 0);
      const x1 = Math.max(...xs) + (Math.abs(d.y) > Math.abs(d.x) || steps > 1 ? half : 0);
      const y0 = Math.min(...ys) - (Math.abs(d.x) >= Math.abs(d.y) || steps > 1 ? half : 0);
      const y1 = Math.max(...ys) + (Math.abs(d.x) >= Math.abs(d.y) || steps > 1 ? half : 0);
      all.push({ x: x0, y: y0 }, { x: x1, y: y1 });
      boxes.push(`&OBST ID='${safe(w.id)}${steps > 1 ? `_${i + 1}` : ''}', XB=${n(x0, 3)},${n(x1, 3)},${n(y0, 3)},${n(y1, 3)},${n(s.bottom, 3)},${n(s.top, 3)}, SURF_ID='PAREDE' /`);
    }
    if (steps > 1) continue;
    for (const o of g.openings.values()) {
      if (o.opening.wallId !== w.id || !o.frame || !o.valid) continue;
      const f = o.frame;
      const pad = t / 2 + 0.05;
      const xs = [f.start.x, f.end.x];
      const ys = [f.start.y, f.end.y];
      const alongX = Math.abs(d.x) >= Math.abs(d.y);
      holes.push(
        `&HOLE ID='${safe(o.opening.id)}', XB=${n(Math.min(...xs) - (alongX ? 0 : pad), 3)},${n(Math.max(...xs) + (alongX ? 0 : pad), 3)},${n(Math.min(...ys) - (alongX ? pad : 0), 3)},${n(Math.max(...ys) + (alongX ? pad : 0), 3)},${n(o.bottom, 3)},${n(o.top, 3)} /`,
      );
    }
  }
  if (all.length === 0) return `&HEAD CHID='${safe(title).replace(/ /g, '_')}', TITLE='${safe(title)}' /\n&TAIL /\n`;
  const x0 = Math.min(...all.map((p) => p.x)) - 1;
  const x1 = Math.max(...all.map((p) => p.x)) + 1;
  const y0 = Math.min(...all.map((p) => p.y)) - 1;
  const y1 = Math.max(...all.map((p) => p.y)) + 1;
  const z1 = top + 1;
  const ijk = [x1 - x0, y1 - y0, z1 - bottom].map((v) => Math.max(1, Math.ceil(v / cell)));
  return [
    `&HEAD CHID='${safe(title).replace(/ /g, '_')}', TITLE='${safe(title)}: cad2, the walls as obstructions, the doors and windows as holes' /`,
    `&MESH IJK=${ijk.join(',')}, XB=${n(x0, 3)},${n(x0 + ijk[0]! * cell, 3)},${n(y0, 3)},${n(y0 + ijk[1]! * cell, 3)},${n(bottom, 3)},${n(bottom + ijk[2]! * cell, 3)} /`,
    `&TIME T_END=600. /`,
    `&SURF ID='PAREDE', COLOR='GRAY' /`,
    `! The fire (a &SURF with HRRPUA and an &OBST or &VENT for it) and the fuels are for whoever runs it.`,
    `&VENT MB='XMIN', SURF_ID='OPEN' /`,
    `&VENT MB='XMAX', SURF_ID='OPEN' /`,
    `&VENT MB='YMIN', SURF_ID='OPEN' /`,
    `&VENT MB='YMAX', SURF_ID='OPEN' /`,
    `&VENT MB='ZMAX', SURF_ID='OPEN' /`,
    ...boxes,
    ...holes,
    `&TAIL /`,
    '',
  ].join('\n');
}
