// Generates the large reference project for measurements (task step 2): a deterministic 3-level grid of
// layered walls with doors and windows, a room and a floor per cell, furniture objects, guides, and a big
// DXF reference. Writes <out> (default .scratchpad/bigproject.json). With --old, writes a version-66 file
// instead (the reader migrates it; its kept-area fields must survive open/save byte-equal — the round-trip
// gate). Deterministic: same seed, same file.
//
// Usage: node scripts/bigproject.mjs [--old] [out.json]

import fs from 'node:fs';
import path from 'node:path';

const old = process.argv.includes('--old');
const outArg = process.argv.slice(2).find((a) => a.endsWith('.json'));
const out = path.resolve(outArg ?? '.scratchpad/bigproject.json');

// Deterministic PRNG (mulberry32) so the file repeats exactly.
let seed = 0x5eed2ad;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const LEVELS = [
  { id: 'lvl_ground', name: 'Ground floor', elevation: 0, height: 2.8 },
  { id: 'lvl_first', name: 'First floor', elevation: 2.8, height: 2.8 },
  { id: 'lvl_roof', name: 'Roof level', elevation: 5.6, height: 2.8 },
];
const TYPES = ['wt_masonry15', 'wt_masonry20', 'wt_concrete20', 'wt_drywall10'];
const CELL = 4; // m
const COLS = 10; // 10 cells across (40 m)
const ROWS = 6; // 6 cells down (24 m)

const walls = [];
const openings = [];
const rooms = [];
const floors = [];
const objects = [];
const guides = [];
let wallN = 0;
let openN = 0;
let roomN = 0;
let floorN = 0;
let objN = 0;

for (const level of LEVELS) {
  const z = level.elevation;
  const lwalls = [];
  // Vertical wall lines at x = 0..COLS*CELL, each split into ROWS segments.
  for (let c = 0; c <= COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const id = `wall_${++wallN}`;
      lwalls.push({ id, start: { x: c * CELL, y: r * CELL }, end: { x: c * CELL, y: (r + 1) * CELL } });
      walls.push({ id, levelId: level.id, wallTypeId: TYPES[Math.floor(rnd() * TYPES.length)], referenceLine: 'centerline', start: { x: c * CELL, y: r * CELL }, end: { x: c * CELL, y: (r + 1) * CELL } });
    }
  }
  // Horizontal wall lines at y = 0..ROWS*CELL, each split into COLS segments.
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = `wall_${++wallN}`;
      lwalls.push({ id, start: { x: c * CELL, y: r * CELL }, end: { x: (c + 1) * CELL, y: r * CELL } });
      walls.push({ id, levelId: level.id, wallTypeId: TYPES[Math.floor(rnd() * TYPES.length)], referenceLine: 'centerline', start: { x: c * CELL, y: r * CELL }, end: { x: (c + 1) * CELL, y: r * CELL } });
    }
  }
  // A door and a window on ~60% of the walls, clear of the ends.
  for (const w of lwalls) {
    const dx = w.end.x - w.start.x;
    const dy = w.end.y - w.start.y;
    const len = Math.hypot(dx, dy);
    if (rnd() < 0.6) {
      const at = 0.6 + rnd() * (len - 2.6);
      openings.push({ id: `opening_${++openN}`, wallId: w.id, kind: 'door', width: 0.9, height: 2.1, sill: 0, rule: { kind: 'fromStart', distance: Math.round(at * 100) / 100 }, hinge: rnd() < 0.5 ? 'start' : 'end', swing: rnd() < 0.5 ? 'left' : 'right' });
    }
    if (rnd() < 0.5) {
      const at = 0.6 + rnd() * (len - 2.6);
      openings.push({ id: `opening_${++openN}`, wallId: w.id, kind: 'window', width: 1.2, height: 1.2, sill: 1, rule: { kind: 'fromStart', distance: Math.round(at * 100) / 100 }, hinge: 'start', swing: 'left' });
    }
  }
  // A room and a floor per cell.
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const roomId = `room_${++roomN}`;
      rooms.push({ id: roomId, levelId: level.id, seed: { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }, name: `Room ${roomN}`, number: `${roomN}` });
      floors.push({ id: `floor_${++floorN}`, levelId: level.id, source: { kind: 'room', roomId }, thickness: 0.15, offset: 0 });
      // Furniture in ~every other cell: a table and a bookcase.
      if (rnd() < 0.5) {
        objects.push({ id: `object_${++objN}`, levelId: level.id, definitionId: 'def_table', typeId: 'dining', at: { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }, angle: Math.round(rnd() * 6.28 * 100) / 100, elevation: 0, values: {} });
      }
      if (rnd() < 0.4) {
        objects.push({ id: `object_${++objN}`, levelId: level.id, definitionId: 'def_bookcase', typeId: 'b80', at: { x: c * CELL + 1, y: r * CELL + 1 }, angle: 0, elevation: 0, values: {} });
      }
    }
  }
  // A few guides per level (schema: a point and a unit direction; the line has no ends).
  for (let g = 0; g < 5; g++) {
    guides.push({ id: `guide_${level.id}_${g}`, levelId: level.id, point: { x: 0, y: g * 3 - 5 }, dir: { x: 1, y: 0 } });
  }
}

// The big DXF reference: 8000 short lines forming a hatch-like survey drawing under the ground floor.
const lines = [];
for (let i = 0; i < 8000; i++) {
  const x = Math.round(rnd() * COLS * CELL * 100) / 100;
  const y = Math.round(rnd() * ROWS * CELL * 100) / 100;
  lines.push(x, y, Math.round((x + rnd() * 2) * 100) / 100, Math.round((y + rnd() * 2) * 100) / 100);
}
const references = [
  {
    id: 'ref_survey',
    levelId: 'lvl_ground',
    name: 'survey.dxf',
    source: { kind: 'dxf', lines, w: COLS * CELL + 2, h: ROWS * CELL + 2 },
    at: { x: -1, y: -1 },
    scale: 1,
    angle: 0,
    opacity: 0.5,
  },
];

const doc = {
  version: old ? 66 : 67,
  name: 'Big reference project',
  levels: LEVELS,
  wallTypes: [
    { id: 'wt_masonry15', name: 'Masonry 15 cm', layers: [{ thickness: 0.015, function: 'finish1', materialId: 'plaster' }, { thickness: 0.12, function: 'structure', materialId: 'brick' }, { thickness: 0.015, function: 'finish2', materialId: 'plaster' }] },
    { id: 'wt_masonry20', name: 'Masonry 20 cm', layers: [{ thickness: 0.02, function: 'finish1', materialId: 'plaster' }, { thickness: 0.16, function: 'structure', materialId: 'brick' }, { thickness: 0.02, function: 'finish2', materialId: 'plaster' }] },
    { id: 'wt_concrete20', name: 'Concrete 20 cm', layers: [{ thickness: 0.2, function: 'structure', materialId: 'concrete' }] },
    { id: 'wt_drywall10', name: 'Drywall 10 cm', layers: [{ thickness: 0.0125, function: 'finish1', materialId: 'gypsum' }, { thickness: 0.075, function: 'thermal', materialId: 'insulation' }, { thickness: 0.0125, function: 'finish2', materialId: 'gypsum' }] },
  ],
  walls,
  openings,
  openingGroups: [],
  rooms,
  floors,
  guides,
  views: [],
  notes: [],
  dimensions: [],
  grids: [],
  columns: [],
  beams: [],
  roofs: [],
  stairs: [],
  railings: [],
  objects,
  separators: [],
  measures: [],
  curtains: [],
  zones: [],
  sections: [],
  references,
};
if (old) {
  // Fields of the areas taken out of the app (Doc.kept): arbitrary but structured, to prove the round trip.
  doc.rules = [{ id: 'rule_1', kind: 'doorWidth', min: 0.8 }];
  doc.rulePacks = { base: { name: 'Base', version: 1 } };
  doc.costs = { cub: 1500, budget: [] };
  doc.approval = { steps: [{ id: 's1', name: 'Alvará' }] };
  doc.lot = { zone: 'Z1', occupancy: 0.7 };
  doc.site = { sun: { latitude: -23.55 } };
  doc.sheets = [{ id: 'sheet_1', name: 'A01' }];
  doc.points = [{ id: 'pt_1', name: 'Entrance' }];
  doc.clouds = [{ id: 'cloud_1', loop: [] }];
  doc.tags = [{ id: 'tag_1', text: 'x' }];
  doc.terrains = [{ id: 'terrain_1', points: [] }];
  doc.mepPoints = [{ id: 'mep_1', kind: 'outlet' }];
  doc.mepRuns = [{ id: 'run_1', kind: 'wire' }];
  doc.systems = [{ id: 'sys_1', name: 'Elétrica' }];
  doc.simulation = { inside: 24 };
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(doc, null, old ? 2 : 0));
const kb = Math.round(fs.statSync(out).size / 1024);
console.log(
  `${out}: v${doc.version}, ${walls.length} walls (${walls.length / LEVELS.length}/level), ${openings.length} openings, ${rooms.length} rooms, ${floors.length} floors, ${objects.length} objects, ${guides.length} guides, 1 DXF reference (${lines.length / 4} lines), ${kb} KB${old ? ', kept-area fields of 15 kinds' : ''}`,
);
