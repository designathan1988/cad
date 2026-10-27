// Quantity schedules (ref/chat.txt:119, l.147): doors, windows, rooms with their areas, walls with
// their lengths, areas and modulation, the construction quantities out of their layers (quantities.ts),
// read from the model and never stored (l.128), and as CSV. Pure.

import type { Opening } from '../elements/opening/schema';
import { openingMarks } from '../elements/opening/marks';
import type { RoomUse } from '../elements/room/schema';
import { type Doc, type DocWall, levelOf, wallNumber } from './document';
import type { DerivedGeometry } from './geometry';
import { finishQuantities, layerQuantities, modulation, roomsBeside, wallAreas } from './quantities';

export type ScheduleKind = 'doors' | 'windows' | 'rooms' | 'walls' | 'construction';
export const SCHEDULE_KINDS: readonly ScheduleKind[] = ['doors', 'windows', 'rooms', 'walls', 'construction'];

/** What a column holds: text, a count, a length (m), an area (m²) or a volume (m³). */
export type ColumnUnit = 'text' | 'count' | 'm' | 'm2' | 'm3';

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
  /** A room's use, as the interface says it. */
  readonly use: (use: RoomUse) => string;
  /** The type marks' prefixes (marks.ts). */
  readonly markPrefix: Readonly<Record<'door' | 'window', string>>;
  /** A door's or window's model as the panel names it (opening/fields.ts modelName). */
  readonly model: (o: Opening) => string;
  /** A material's name by its id: a room's finishes. */
  readonly material: (id: string) => string;
  /** A message of the interface by its key (the construction schedule's items, a wall's modulation). */
  readonly term: (key: string, vars?: Readonly<Record<string, string | number>>) => string;
  /** A number as the interface writes it, to so many places. */
  readonly number: (v: number, places: number) => string;
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
    const columns = [
      col('number', 'text'),
      col('name', 'text'),
      col('use', 'text'),
      col('level', 'text'),
      col('area', 'm2'),
      col('perimeter', 'm'),
      col('ceiling', 'm'),
      col('volume', 'm3'),
      col('finishFloor', 'text'),
      col('finishWall', 'text'),
      col('finishCeiling', 'text'),
      col('zone', 'text'),
    ];
    const zoneOf = (id: string) => doc.zones.find((z) => z.rooms.includes(id));
    const finish = (id: string | undefined) => (id ? naming.material(id) : '');
    const rows = byLevel(doc, doc.rooms).map((r) => {
      const solid = g.rooms.get(r.id);
      const enclosed = solid?.enclosed === true;
      // Its own height, else its level's.
      const height = r.height ?? levelOf(doc, r.levelId)?.height ?? 0;
      return [
        r.number,
        naming.name(r.name),
        r.use ? naming.use(r.use) : '',
        levelName(r.levelId),
        enclosed ? solid.area : null,
        enclosed ? solid.perimeter : null,
        height,
        enclosed ? solid.area * height : null,
        finish(r.finishes?.floor),
        finish(r.finishes?.wall),
        finish(r.finishes?.ceiling),
        naming.name(zoneOf(r.id)?.name ?? ''),
      ];
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
      col('modulation', 'text'),
    ];
    const rows = byLevel(doc, doc.walls).map((w) => {
      const type = doc.wallTypes.find((t) => t.id === w.wallTypeId);
      const { length, height, gross, holes } = wallAreas(doc, g, w);
      return [
        naming.wallTag(wallNumber(doc, w.id) ?? 0),
        type ? naming.name(type.name) : '',
        levelName(w.levelId),
        length,
        height,
        gross,
        holes,
        gross - holes,
        modulationText(doc, w, naming),
      ];
    });
    return { kind, columns, rows, totals: totalsOf(columns, rows) };
  }
  if (kind === 'construction') return construction(doc, g, naming);
  const openingKind = kind === 'doors' ? 'door' : 'window';
  const columns = [
    col('number', 'text'),
    col('mark', 'text'),
    col('level', 'text'),
    col('wall', 'text'),
    col('width', 'm'),
    col('height', 'm'),
    ...(kind === 'windows' ? [col('sill', 'm')] : []),
    col('area', 'm2'),
    col('rooms', 'text'),
    col('model', 'text'),
  ];
  const walls = new Map(doc.walls.map((w) => [w.id, w]));
  const hosted = doc.openings.filter((o) => o.kind === openingKind && walls.has(o.wallId)).map((o) => ({ o, levelId: walls.get(o.wallId)!.levelId }));
  const marks = openingMarks(doc.openings, naming.markPrefix);
  const rows = byLevel(doc, hosted).map(({ o, levelId }, k) => {
    const n = wallNumber(doc, o.wallId);
    return [
      String(k + 1),
      marks.get(o.id) ?? '',
      levelName(levelId),
      n === null ? '' : naming.wallTag(n),
      o.width,
      o.height,
      ...(kind === 'windows' ? [o.sill] : []),
      o.width * o.height,
      sidesOf(g, o.id, levelId, naming),
      naming.model(o),
    ];
  });
  return { kind, columns, rows, totals: totalsOf(columns, rows) };
}

/**
 * The rooms on the two sides of a door or window, "Kitchen / Bedroom 1": by their numbers, the outside
 * last. The same room on both sides (a door inside one space) once.
 */
function sidesOf(g: DerivedGeometry, id: string, levelId: string, naming: Naming): string {
  if (!g.openings.get(id)?.frame) return '';
  const rooms = [...roomsBeside(g, id, levelId)];
  const order = (r: (typeof rooms)[number]) => (r === null ? Infinity : Number.parseFloat(r.number) || 0);
  const names = [...rooms].sort((a, b) => order(a) - order(b)).map((r) => (r ? naming.name(r.name) : naming.outside));
  return names[0] === names[1] ? names[0]! : names.join(' / ');
}

/**
 * A wall's modulation, as the walls schedule and its panel say it: its blocks along it and its courses
 * up it, with what is left of each ("20 blocos de 24 cm + 5 cm; 37 fiadas de 7,5 cm"); empty for a wall
 * that is not masonry.
 */
export function modulationText(doc: Doc, w: DocWall, naming: Pick<Naming, 'term' | 'number'>): string {
  const m = modulation(doc, w);
  if (!m) return '';
  // Centimetres to the millimetre, a whole one without its ",0": "24 cm", "7,5 cm".
  const cm = (v: number) => {
    const x = Math.round(v * 1000) / 10;
    return naming.number(x, Number.isInteger(x) ? 0 : 1);
  };
  const along = naming.term(m.rest > 0 ? 'mod.alongRest' : 'mod.along', { n: m.count, m: cm(m.module), r: cm(m.rest) });
  const up = naming.term(m.courseRest > 0 ? 'mod.upRest' : 'mod.up', { n: m.courses, m: cm(m.course), r: cm(m.courseRest) });
  return `${along}; ${up}`;
}

/**
 * The construction quantities (quantities.ts), one row per item and material: the masonry (its blocks),
 * the mortar of its joints, each face's finish, the other layers, the rooms' floors, walls and ceilings.
 * Area, volume and pieces as each has them; no totals but the count, an area of plaster and one of
 * blocks not adding up.
 */
function construction(doc: Doc, g: DerivedGeometry, naming: Naming): Schedule {
  const columns = [col('item', 'text'), col('material', 'text'), col('area', 'm2'), col('volume', 'm3'), col('pieces', 'count')];
  const rows = new Map<string, { item: string; material: string; area: number | null; volume: number | null; pieces: number | null }>();
  const add = (item: string, materialId: string, area: number | null, volume: number | null, pieces: number | null) => {
    const key = `${item}\u0000${materialId}`;
    const r = rows.get(key) ?? { item, material: naming.material(materialId), area: null, volume: null, pieces: null };
    const sum = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);
    rows.set(key, { ...r, area: sum(r.area, area), volume: sum(r.volume, volume), pieces: sum(r.pieces, pieces) });
  };
  for (const q of layerQuantities(doc, g)) {
    if (q.mortar !== null) {
      add(naming.term('qty.masonry'), q.materialId, q.area, q.volume, q.pieces);
      add(naming.term('qty.mortar'), q.materialId, null, q.mortar, null);
    } else if (q.place !== 'inner') add(naming.term(q.place === 'exterior' ? 'qty.faceExterior' : 'qty.faceInterior'), q.materialId, q.area, q.volume, q.pieces);
    else add(naming.term('qty.layer', { fn: naming.term(`fn.${q.function}`) }), q.materialId, q.area, q.volume, q.pieces);
  }
  for (const f of finishQuantities(doc, g)) add(naming.term(`qty.room.${f.surface}`), f.materialId, f.area, null, f.pieces);
  const list = [...rows.values()].map((r) => [r.item, r.material, r.area, r.volume, r.pieces]);
  return { kind: 'construction', columns, rows: list, totals: columns.map((_, i) => (i === 0 ? list.length : null)) };
}

function totalsOf(columns: readonly ScheduleColumn[], rows: readonly (readonly Cell[])[]): Cell[] {
  return columns.map((c, i) => {
    if (i === 0) return rows.length;
    if (c.unit !== 'm' && c.unit !== 'm2' && c.unit !== 'm3') return null;
    // A height or a width does not add up; a length, an area or a volume does.
    if (['schedule.col.height', 'schedule.col.width', 'schedule.col.sill', 'schedule.col.ceiling'].includes(c.key)) return null;
    return rows.reduce((s, r) => s + (typeof r[i] === 'number' ? (r[i] as number) : 0), 0);
  });
}

/**
 * The schedule as CSV, for a spreadsheet: Portuguese with ";" and a decimal comma, as a spreadsheet set
 * to Portuguese reads it; English with "," and a point. A UTF-8 mark first, or accents come garbled.
 * Lengths in the project's unit (`metresPerUnit`: 0.01 for centimetres), to the millimetre.
 */
export function toCsv(s: Schedule, headers: readonly string[], totalLabel: string, lang: 'pt' | 'en', metresPerUnit = 1): string {
  const sep = lang === 'pt' ? ';' : ',';
  const number = (v: number, digits: number) => {
    const text = (Math.abs(v) < 0.5 * 10 ** -digits ? 0 : v).toFixed(digits);
    return lang === 'pt' ? text.replace('.', ',') : text;
  };
  const cell = (v: Cell, unit: ColumnUnit) => {
    if (v === null) return '';
    // A length to the millimetre in any unit: 3 decimals in metres, 1 in centimetres, none in millimetres.
    if (typeof v === 'number' && unit === 'm') return number(v / metresPerUnit, Math.max(0, 3 - Math.round(-Math.log10(metresPerUnit))));
    if (typeof v === 'number') return unit === 'count' || unit === 'text' ? String(v) : number(v, 2);
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
