// Quantity schedules (ref/chat.txt:119, l.147): doors, windows, rooms with their areas, walls with
// their lengths and areas, read from the model and never stored (l.128), and as CSV. Pure.

import { add, scale } from '../core/vector';
import { referenceLength } from '../elements/opening/derive';
import { insideRing } from '../elements/room/derive';
import { type Doc, levelOf, wallHeights, wallNumber } from './document';
import type { DerivedGeometry } from './geometry';

export type ScheduleKind = 'doors' | 'windows' | 'rooms' | 'walls';
export const SCHEDULE_KINDS: readonly ScheduleKind[] = ['doors', 'windows', 'rooms', 'walls'];

/** What a column holds: text, a count, a length (m) or an area (m²). */
export type ColumnUnit = 'text' | 'count' | 'm' | 'm2';

export interface ScheduleColumn {
  /** The column's name, as a message key (schedule.col.*). */
  readonly key: string;
  readonly unit: ColumnUnit;
}

/** A cell: text, or a number in the column's unit; null when there is nothing (a door has no sill). */
export type Cell = string | number | null;

export interface Schedule {
  readonly kind: ScheduleKind;
  readonly columns: readonly ScheduleColumn[];
  readonly rows: readonly (readonly Cell[])[];
  /** The totals row: the count in the first column, sums under lengths and areas, the rest empty. */
  readonly totals: readonly Cell[];
}

/** How the names in it are said: a level's, a room's, a wall type's (i18n.ts `name`), a wall's tag. */
export interface Naming {
  readonly name: (stored: string) => string;
  readonly wallTag: (n: number) => string;
  /** Outside every room, on that side of a door or window. */
  readonly outside: string;
}

const col = (key: string, unit: ColumnUnit): ScheduleColumn => ({ key: `schedule.col.${key}`, unit });

/** Levels from the top down, as the browser lists them; within a level, in drawing order. */
function byLevel<T extends { levelId: string }>(doc: Doc, items: readonly T[]): T[] {
  const height = (id: string) => levelOf(doc, id)?.elevation ?? 0;
  return [...items].sort((a, b) => height(b.levelId) - height(a.levelId));
}

export function schedule(doc: Doc, g: DerivedGeometry, kind: ScheduleKind, naming: Naming): Schedule {
  const levelName = (id: string) => {
    const l = levelOf(doc, id);
    return l ? naming.name(l.name) : '';
  };
  if (kind === 'rooms') {
    const columns = [col('number', 'text'), col('name', 'text'), col('level', 'text'), col('area', 'm2'), col('perimeter', 'm')];
    const rows = byLevel(doc, doc.rooms).map((r) => {
      const solid = g.rooms.get(r.id);
      const enclosed = solid?.enclosed === true;
      return [r.number, naming.name(r.name), levelName(r.levelId), enclosed ? solid.area : null, enclosed ? solid.perimeter : null];
    });
    return { kind, columns, rows, totals: totalsOf(columns, rows) };
  }
  if (kind === 'walls') {
    const columns = [
      col('number', 'text'),
      col('type', 'text'),
      col('level', 'text'),
      col('length', 'm'),
      col('height', 'm'),
      col('grossArea', 'm2'),
      col('openingArea', 'm2'),
      col('netArea', 'm2'),
    ];
    const rows = byLevel(doc, doc.walls).map((w) => {
      const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
      const length = referenceLength(w);
      const { bottom, top } = wallHeights(doc, w);
      const height = Math.max(0, top - bottom);
      // An opening's hole: as wide as it is, from its sill up to its head or the wall's top.
      const holes = doc.openings
        .filter((o) => o.wallId === w.id && g.openings.get(o.id)?.valid)
        .reduce((s, o) => s + o.width * Math.max(0, Math.min(o.height, height - o.sill)), 0);
      const gross = length * height;
      return [naming.wallTag(wallNumber(doc, w.id) ?? 0), type ? naming.name(type.name) : '', levelName(w.levelId), length, height, gross, holes, gross - holes];
    });
    return { kind, columns, rows, totals: totalsOf(columns, rows) };
  }
  const openingKind = kind === 'doors' ? 'door' : 'window';
  const columns = [
    col('number', 'text'),
    col('level', 'text'),
    col('wall', 'text'),
    col('width', 'm'),
    col('height', 'm'),
    ...(kind === 'windows' ? [col('sill', 'm')] : []),
    col('area', 'm2'),
    col('rooms', 'text'),
  ];
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const hosted = doc.openings.filter((o) => o.kind === openingKind && walls.has(o.wallId)).map((o) => ({ o, levelId: walls.get(o.wallId)!.levelId }));
  const rows = byLevel(doc, hosted).map(({ o, levelId }, k) => {
    const n = wallNumber(doc, o.wallId);
    return [
      String(k + 1),
      levelName(levelId),
      n === null ? '' : naming.wallTag(n),
      o.width,
      o.height,
      ...(kind === 'windows' ? [o.sill] : []),
      o.width * o.height,
      sidesOf(g, o.id, levelId, naming),
    ];
  });
  return { kind, columns, rows, totals: totalsOf(columns, rows) };
}

/**
 * The rooms on the two sides of a door or window, "Kitchen / Bedroom 1": by their numbers, the outside
 * last. The same room on both sides (a door inside one space) once.
 */
function sidesOf(g: DerivedGeometry, id: string, levelId: string, naming: Naming): string {
  const frame = g.openings.get(id)?.frame;
  if (!frame) return '';
  const middle = scale(add(frame.start, frame.end), 0.5);
  // Just off each face, 5 cm out: in the room on that side, if one is there.
  const rooms = [frame.faces[0] - 0.05, frame.faces[1] + 0.05].map((offset) => {
    const p = add(middle, scale(frame.normal, offset));
    return [...g.rooms.values()].find((r) => r.room.levelId === levelId && r.enclosed && insideRing(r.outline, p))?.room ?? null;
  });
  const order = (r: (typeof rooms)[number]) => (r === null ? Infinity : Number.parseFloat(r.number) || 0);
  const names = [...rooms].sort((a, b) => order(a) - order(b)).map((r) => (r ? naming.name(r.name) : naming.outside));
  return names[0] === names[1] ? names[0]! : names.join(' / ');
}

function totalsOf(columns: readonly ScheduleColumn[], rows: readonly (readonly Cell[])[]): Cell[] {
  return columns.map((c, i) => {
    if (i === 0) return rows.length;
    if (c.unit !== 'm' && c.unit !== 'm2') return null;
    // A height or a width does not add up; a length or an area does.
    if (c.key === 'schedule.col.height' || c.key === 'schedule.col.width' || c.key === 'schedule.col.sill') return null;
    return rows.reduce((s, r) => s + (typeof r[i] === 'number' ? (r[i] as number) : 0), 0);
  });
}

/**
 * The schedule as CSV, for a spreadsheet: Portuguese with ";" and a decimal comma, as a spreadsheet set
 * to Portuguese reads it; English with "," and a point. A UTF-8 mark first, or accents come garbled.
 */
export function toCsv(s: Schedule, headers: readonly string[], totalLabel: string, lang: 'pt' | 'en'): string {
  const sep = lang === 'pt' ? ';' : ',';
  const number = (v: number, digits: number) => {
    const text = (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
    return lang === 'pt' ? text.replace('.', ',') : text;
  };
  const cell = (v: Cell, unit: ColumnUnit) => {
    if (v === null) return '';
    if (typeof v === 'number') return unit === 'count' || unit === 'text' ? String(v) : number(v, unit === 'm2' ? 2 : 3);
    return /[";,\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const line = (cells: readonly Cell[]) => cells.map((v, i) => cell(v, s.columns[i]!.unit)).join(sep);
  const totals = s.totals.map((v, i) => (i === 0 ? `${totalLabel}: ${v ?? 0}` : v));
  const head = headers.map((h) => cell(h, 'text')).join(sep);
  return `${BOM}${[head, ...s.rows.map(line), line(totals)].join(CRLF)}${CRLF}`;
}

/** The UTF-8 byte order mark, and a spreadsheet's line end. */
const BOM = String.fromCharCode(0xfeff);
const CRLF = String.fromCharCode(13, 10);
