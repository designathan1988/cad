// The building in the sun and the sky (docs/plano-de-escopo.md, phase 14, the quick level): its
// exterior faces and windows, each with the way it faces; the hours of direct sun each gets on the
// solstices and the equinox (the sun by NOAA's equations, app/sun.ts), the building's own walls
// casting shade; and each room's average daylight factor through its windows (the BRE formula).
// Estimates, with their premises: the roofs' eaves and the neighbours cast no shade here. Pure.

import type { Doc, DocWall } from '../app/document';
import { levelOf, wallThickness } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { roomsBeside } from '../app/quantities';
import { DEFAULT_SITE, northOf, type Site, sunDirection } from '../app/sun';
import { add, dot, normalize, type Point2, scale, sub } from '../core/vector';
import { insideRing } from '../elements/room/derive';
import { exteriorOffset } from '../elements/wall/geometry/shape';
import { roomFace } from '../tools/edit';

/** Something facing out: where it is (plan and height), the way out (unit, plan), its level and what it is. */
export interface Face {
  readonly id: string;
  readonly levelId: string;
  readonly at: Point2;
  readonly z: number;
  readonly out: Point2;
  /** Degrees from north, clockwise: the way it faces. */
  readonly azimuth: number;
  /** The room behind it (a window's). */
  readonly roomId?: string;
  /** A window's glass: m² (its opening less the frame, adopted 75 %). */
  readonly glass?: number;
}

const inRoomOf = (g: DerivedGeometry) => (levelId: string, p: Point2) => [...g.rooms.values()].some((r) => r.room.levelId === levelId && r.enclosed && insideRing(r.outline, p));

/** The compass way of a plan direction, degrees from the site's north, clockwise. */
export function azimuthOf(site: Site, v: Point2): number {
  const n = northOf(site);
  const e = { x: n.y, y: -n.x };
  const a = (Math.atan2(dot(v, e), dot(v, n)) * 180) / Math.PI;
  return (a + 360) % 360;
}

/** One of the eight ways (N, NE, E…): 0 is north, by 45°. */
export const octant = (azimuth: number): number => Math.round(azimuth / 45) % 8;

/** The straight walls' exterior faces, at their middle and half their height: a room behind on one side only. */
export function exteriorFaces(doc: Doc, g: DerivedGeometry, site: Site = doc.site ?? DEFAULT_SITE): Face[] {
  const inRoom = inRoomOf(g);
  const out: Face[] = [];
  for (const w of doc.walls) {
    if (w.bulge) continue;
    const face = roomFace(doc, w, inRoom);
    if (face !== 'interior' && face !== 'exterior') continue;
    const s = g.solids.get(w.id);
    if (!s) continue;
    const u = normalize(sub(w.end, w.start));
    const n = { x: -u.y, y: u.x };
    const t = wallThickness(doc, w);
    const e = exteriorOffset(w.referenceLine, t);
    const mid = scale(add(w.start, w.end), 0.5);
    // The room is on the interior side: the exterior face looks out, against the left normal.
    const outDir = face === 'interior' ? scale(n, -1) : n;
    const at = add(mid, scale(n, face === 'interior' ? e : e + t));
    out.push({ id: w.id, levelId: w.levelId, at, z: (s.bottom + s.top) / 2, out: outDir, azimuth: azimuthOf(site, outDir) });
  }
  return out;
}

/** The windows with a room on one side only: their middle on the outer face, the way out, their room and glass. */
export function exteriorWindows(doc: Doc, g: DerivedGeometry, site: Site = doc.site ?? DEFAULT_SITE): Face[] {
  const out: Face[] = [];
  for (const o of doc.openings) {
    if (o.kind !== 'window') continue;
    const s = g.openings.get(o.id);
    const wall = doc.walls.find((x) => x.id === o.wallId);
    if (!s?.frame || !wall || !s.valid) continue;
    const [a, b] = roomsBeside(g, o.id, wall.levelId);
    if ((a === null) === (b === null)) continue;
    const f = s.frame;
    const mid = scale(add(f.start, f.end), 0.5);
    // Out toward the side with no room: the exterior face's side when the room is on the interior one.
    const outer = a === null ? f.faces[0] : f.faces[1];
    const inner = a === null ? f.faces[1] : f.faces[0];
    const outDir = scale(f.normal, Math.sign(outer - inner) || 1);
    out.push({ id: o.id, levelId: wall.levelId, at: add(mid, scale(f.normal, outer)), z: (s.bottom + s.top) / 2, out: outDir, azimuth: azimuthOf(site, outDir), roomId: (a ?? b)!.id, glass: o.width * o.height * GLAZED });
  }
  return out;
}

/** A window's glass, of its opening (adopted: the frame takes a quarter). */
export const GLAZED = 0.75;

/** Whether the way to the sun from p (height z) passes a wall of its level or of another, besides `own`. */
function shaded(doc: Doc, g: DerivedGeometry, p: Point2, z: number, sun: { x: number; y: number; z: number }, own: DocWall | undefined): boolean {
  const h = Math.hypot(sun.x, sun.y);
  if (h < 1e-9) return false;
  const u = { x: sun.x / h, y: sun.y / h };
  const rise = sun.z / h;
  for (const w of doc.walls) {
    if (w === own) continue;
    const s = g.solids.get(w.id);
    if (!s) continue;
    // The ray p + k·u against the wall's line a + m·(b − a), m in [0, 1].
    const d = sub(w.end, w.start);
    const den = u.x * d.y - u.y * d.x;
    if (Math.abs(den) < 1e-12) continue;
    const q = sub(w.start, p);
    const k = (q.x * d.y - q.y * d.x) / den;
    const m = (q.x * u.y - q.y * u.x) / den;
    if (k <= 0.05 || m < 0 || m > 1) continue;
    const height = z + k * rise;
    if (height >= s.bottom && height <= s.top) return true;
  }
  return false;
}

/** The days followed: the June and December solstices and the March equinox, of the site's year. */
export function sunDays(site: Site): string[] {
  const year = /^(\d{4})/.exec(site.date)?.[1] ?? '2026';
  return [`${year}-06-21`, `${year}-12-21`, `${year}-03-20`];
}

/** Every 10 minutes of a day: whether the sun reaches the face (above the horizon, in front of it, not shaded). */
export function sunSlots(doc: Doc, g: DerivedGeometry, f: Face, date: string, site: Site = doc.site ?? DEFAULT_SITE): boolean[] {
  const own = doc.walls.find((w) => w.id === f.id) ?? doc.walls.find((w) => w.id === doc.openings.find((o) => o.id === f.id)?.wallId);
  const out: boolean[] = [];
  for (let m = 0; m < 1440; m += SLOT) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    const sun = sunDirection({ ...site, date, time });
    out.push(sun !== null && sun.z > 0 && dot(f.out, sun) > 0 && !shaded(doc, g, add(f.at, scale(f.out, 0.02)), f.z, sun, own));
  }
  return out;
}

/** Minutes a slot stands for. */
export const SLOT = 10;

export const hoursOf = (slots: readonly boolean[]): number => (slots.filter(Boolean).length * SLOT) / 60;

export interface RoomSun {
  readonly roomId: string;
  /** Hours with sun on at least one of its windows, on each of sunDays. */
  readonly hours: readonly number[];
  readonly windows: number;
}

/** Each room's hours of sun through its windows (any of them), on each day. */
export function roomSun(doc: Doc, g: DerivedGeometry, site: Site = doc.site ?? DEFAULT_SITE): RoomSun[] {
  const windows = exteriorWindows(doc, g, site);
  const days = sunDays(site);
  return doc.rooms
    .filter((r) => g.rooms.get(r.id)?.enclosed)
    .map((r) => {
      const mine = windows.filter((w) => w.roomId === r.id);
      const hours = days.map((d) => {
        const all = mine.map((w) => sunSlots(doc, g, w, d, site));
        return hoursOf(all.length === 0 ? [] : all[0]!.map((_, i) => all.some((s) => s[i])));
      });
      return { roomId: r.id, hours, windows: mine.length };
    });
}

export interface Daylight {
  readonly roomId: string;
  /** m² of glass. */
  readonly glass: number;
  /** m²: floor, ceiling and walls. */
  readonly surfaces: number;
  /** %: T·Aw·θ / (A·(1 − R²)). */
  readonly factor: number;
  /** The BS 8206-2 average for its use (%), or none. */
  readonly target: number | null;
}

/** The premises of the daylight factor: the glass's transmittance, the sky angle (no obstruction), the surfaces' mean reflectance. */
export const DAYLIGHT = { transmittance: 0.8, sky: 90, reflectance: 0.5 } as const;

/** BS 8206-2's average daylight factors by use (%): a reference from the United Kingdom, not a Brazilian rule. */
const TARGETS: Readonly<Record<string, number>> = { kitchen: 2, living: 1.5, bedroom: 1, office: 2 };

export function daylightOf(doc: Doc, g: DerivedGeometry): Daylight[] {
  const windows = exteriorWindows(doc, g);
  return doc.rooms.flatMap((r) => {
    const s = g.rooms.get(r.id);
    if (!s?.enclosed) return [];
    const height = r.height ?? levelOf(doc, r.levelId)?.height ?? 2.8;
    const glass = windows.filter((w) => w.roomId === r.id).reduce((t, w) => t + (w.glass ?? 0), 0);
    const surfaces = 2 * s.area + s.perimeter * height;
    // With θ in degrees the formula gives the factor in % (Littlefair, BRE).
    const factor = surfaces > 0 ? (DAYLIGHT.transmittance * glass * DAYLIGHT.sky) / (surfaces * (1 - DAYLIGHT.reflectance ** 2)) : 0;
    return [{ roomId: r.id, glass, surfaces, factor, target: (r.use && TARGETS[r.use]) ?? null }];
  });
}
