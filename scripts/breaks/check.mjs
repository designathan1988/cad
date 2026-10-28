// THE BREAK FINDER: random sequences of the app's own operations (the real functions of src/, not copies) on
// generated plans aimed at the special positions (ends that meet, nearly meet or pass, Ts near an end, near
// collinear and sharp angles, thin against thick, arcs), and after every step the contract of
// docs/wall-joins-spec.md checked by sampling, never with the engine's own primitives:
//   §9 never throws, never empty, never deletes a wall; I1 no overlap between walls (unless warned);
//   I3 no hole inside a wall's band; I4 the walls' order changes nothing; I5 moved and moved back is the same;
//   and the metamorphic relations: translated / turned a quarter, the plan is the same plan moved; flipped twice
//   is the same; flipped once does not move the wall (the owner's decision); split then merged is the same;
//   saved and read back is the same; openings stay on their wall, inside it, where they were.
// A break is shrunk (delta debugging over the steps) to the fewest steps that still break, and written as a repro.
//
// usage (from the project's root, after build.cjs): node scripts/breaks/check.mjs .breaks/run <runs> <seed> reports/breaks/breaks.json
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const [runDir, runsArg = '300', seedArg = '1', outFile = 'breaks.json'] = process.argv.slice(2);
const R = resolve(runDir);
const load = (p) => import(pathToFileURL(join(R, 'src', p)).href);
const { deriveGeometry } = await load('app/geometry.js');
const { newDocument, wallThickness } = await load('app/document.js');
const { setWalls, addWalls } = await load('elements/wall/commands.js');
const { flipWalls } = await load('elements/wall/flip.js');
const { moveWalls, stretchEnd, rotateWalls, changeWallType, changeReferenceLine } = await load('tools/edit.js');
const { splitWall, mergeWalls, canMerge } = await load('tools/split.js');
const { transformSelection, rotation, reflection } = await load('tools/transform.js');
const { addOpening, updateOpening, deleteElements } = await load('elements/opening/commands.js');
const { newOpening } = await load('elements/opening/schema.js');
const { writeProject, readProject } = await load('io/project-file.js');
const T = await load('core/tolerance.js');

// ---------- small math, the checker's own ----------
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const P = (x, y) => ({ x, y });
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const mul = (a, s) => P(a.x * s, a.y * s);
const len = (a) => Math.hypot(a.x, a.y);
const dist = (a, b) => len(sub(a, b));
const cross = (a, b) => a.x * b.y - a.y * b.x;
const deg = (d) => (d * Math.PI) / 180;
const dirOf = (a) => P(Math.cos(a), Math.sin(a));
const area = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };
/** Inside a convex polygon by at least `margin` (negative: within that much outside). */
function insideConvex(poly, p, margin) {
  const s = Math.sign(area(poly)) || 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const e = sub(b, a), l = len(e);
    if (l < 1e-12) continue;
    if ((s * cross(e, sub(p, a))) / l < margin) return false;
  }
  return true;
}
function convex(poly) {
  const s = Math.sign(area(poly));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], c = poly[(i + 2) % poly.length];
    if (s * cross(sub(b, a), sub(c, b)) < -1e-9) return false;
  }
  return true;
}
const finite = (v) => Number.isFinite(v);
const deepFreeze = (o) => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); } return o; };

// ---------- the plan's facts, as the checker sees them ----------
const types = newDocument().wallTypes;
const typeIds = types.map((t) => t.id);
// Where a lone wall's band lies from its reference line, for each reference line (measured once, on a lone wall).
const BAND = {};
for (const line of ['centerline', 'interiorFace', 'exteriorFace']) {
  const d = { ...newDocument(), walls: [{ id: 'w', wallTypeId: 'wt_concrete20', start: P(0, 0), end: P(4, 0), referenceLine: line, levelId: 'lvl_ground' }] };
  const ys = deriveGeometry(d).solids.get('w').pieces.flatMap((p) => p.polygon.map((q) => q.y));
  BAND[line] = [Math.min(...ys) / 0.2, Math.max(...ys) / 0.2]; // as shares of the thickness, left of the drawing direction positive
}
const bandOf = (doc, w) => { const t = wallThickness(doc, w); const [a, b] = BAND[w.referenceLine]; return [a * t, b * t]; };

const warnedPair = (g) => {
  const s = new Set();
  for (const w of g.warnings) for (const a of w.walls) for (const b of w.walls) s.add(`${a}|${b}`);
  return s;
};
const warnedWall = (g) => new Set(g.warnings.flatMap((w) => w.walls));

/** Every piece of the plan, with its wall. */
const piecesOf = (g) => [...g.solids].flatMap(([id, s]) => s.pieces.map((p, i) => ({ id, i, layer: p.layerIndex, poly: p.polygon })));

function samplesInBand(doc, w, n, r) {
  const out = [];
  const L = dist(w.start, w.end);
  if (L < 0.01) return out;
  const u = mul(sub(w.end, w.start), 1 / L), nl = P(-u.y, u.x);
  const [lo, hi] = bandOf(doc, w);
  const m = 0.002;
  if (hi - lo < 3 * m || L < 3 * m) return out;
  for (let k = 0; k < n; k++) {
    const s = m + r() * (L - 2 * m), o = lo + m + r() * (hi - lo - 2 * m);
    out.push(add(add(w.start, mul(u, s)), mul(nl, o)));
  }
  return out;
}

/** The checks on one plan: what breaks the contract, with what it was found on. */
function checkDoc(doc, r) {
  const found = [];
  let g;
  try { g = deriveGeometry(doc); } catch (e) { return [{ inv: 'crash.derive', detail: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }]; }
  const pieces = piecesOf(g);
  // Numbers
  for (const p of pieces) if (p.poly.some((q) => !finite(q.x) || !finite(q.y))) { found.push({ inv: 'nan.piece', detail: p.id }); break; }
  for (const [id, o] of g.openings) if (!finite(o.start) || !finite(o.end)) { found.push({ inv: 'nan.opening', detail: id }); break; }
  // §9: never empty, never a wall gone
  const ww = warnedWall(g);
  for (const w of doc.walls) {
    const s = g.solids.get(w.id);
    if (!s) { found.push({ inv: 'wall.missing', detail: w.id }); continue; }
    if (s.pieces.length === 0 && !ww.has(w.id) && dist(w.start, w.end) >= T.MIN_WALL_LENGTH) found.push({ inv: 'wall.empty', detail: w.id });
  }
  // Pieces well formed (§8: convex, none under AREA_EPSILON)
  for (const p of pieces) {
    if (Math.abs(area(p.poly)) < T.AREA_EPSILON) { found.push({ inv: 'piece.degenerate', detail: `${p.id}#${p.i}` }); break; }
    if (!convex(p.poly)) { found.push({ inv: 'piece.nonConvex', detail: `${p.id}#${p.i}` }); break; }
  }
  // Spurs: no piece reaches further from its wall than the miter limit allows.
  for (const p of pieces) {
    const w = doc.walls.find((x) => x.id === p.id);
    if (!w || w.bulge) continue;
    const reach = T.MITER_LIMIT * Math.max(...doc.walls.map((x) => wallThickness(doc, x))) + wallThickness(doc, w) + 0.01;
    const L = dist(w.start, w.end), u = mul(sub(w.end, w.start), 1 / L);
    for (const q of p.poly) {
      const s = Math.max(0, Math.min(L, (q.x - w.start.x) * u.x + (q.y - w.start.y) * u.y));
      if (dist(q, add(w.start, mul(u, s))) > reach) { found.push({ inv: 'piece.spur', detail: `${p.id} reaches ${dist(q, add(w.start, mul(u, s))).toFixed(3)} m` }); break; }
    }
  }
  // I1: points inside pieces of two walls (with 1 µm margin), the pair not warned
  const pairs = warnedPair(g);
  const box = pieces.flatMap((p) => p.poly);
  if (box.length) {
    const minX = Math.min(...box.map((q) => q.x)), maxX = Math.max(...box.map((q) => q.x));
    const minY = Math.min(...box.map((q) => q.y)), maxY = Math.max(...box.map((q) => q.y));
    const pts = [];
    for (const w of doc.walls) if (!w.bulge) pts.push(...samplesInBand(doc, w, 120, r));
    for (let k = 0; k < 600; k++) pts.push(P(minX + r() * (maxX - minX), minY + r() * (maxY - minY)));
    for (const q of pts) {
      const hit = pieces.filter((p) => insideConvex(p.poly, q, 1e-6));
      for (let a = 0; a < hit.length; a++) for (let b = a + 1; b < hit.length; b++) {
        if (hit[a].id === hit[b].id) { if (hit[a].layer !== hit[b].layer || hit[a].i !== hit[b].i) { found.push({ inv: 'overlap.sameWall', detail: `${hit[a].id} layers ${hit[a].layer}/${hit[b].layer} at (${q.x.toFixed(4)}, ${q.y.toFixed(4)})` }); return found; } continue; }
        if (pairs.has(`${hit[a].id}|${hit[b].id}`)) continue;
        found.push({ inv: 'overlap.walls', detail: `${hit[a].id} and ${hit[b].id} at (${q.x.toFixed(4)}, ${q.y.toFixed(4)})` });
        return found;
      }
    }
  }
  // I3: no hole inside a wall's band (openings taken out: they open the plan cut on purpose)
  if (doc.openings.length) {
    try { g = deriveGeometry({ ...doc, openings: [], openingGroups: [] }); } catch (e) { found.push({ inv: 'crash.derive', detail: String(e) }); return found; }
  }
  const all = piecesOf(g);
  const ww2 = warnedWall(g);
  for (const w of doc.walls) {
    if (w.bulge || ww2.has(w.id)) continue;
    for (const q of samplesInBand(doc, w, 150, r)) {
      if (!all.some((p) => insideConvex(p.poly, q, -1e-7))) { found.push({ inv: 'hole.inBand', detail: `${w.id} at (${q.x.toFixed(4)}, ${q.y.toFixed(4)})` }); return found; }
    }
  }
  // Openings: on a wall that exists, inside it, not on each other, or warned
  g = deriveGeometry(doc);
  const ow = new Map();
  for (const w of g.openingWarnings) for (const id of w.openings) ow.set(id, [...(ow.get(id) ?? []), w.kind]);
  const ids = new Set(doc.walls.map((w) => w.id));
  for (const o of doc.openings) {
    const warned = ow.get(o.id) ?? [];
    const placed = g.openings.get(o.id);
    if (!ids.has(o.wallId) && !warned.includes('openingNoHost')) found.push({ inv: 'opening.orphan', detail: o.id });
    if (!placed) continue;
    const host = doc.walls.find((w) => w.id === o.wallId);
    if (!host || host.bulge) continue;
    const L = dist(host.start, host.end);
    if ((placed.start < -1e-6 || placed.end > L + 1e-6) && !warned.includes('openingOutside') && !placed.warnings.includes('openingOutside')) found.push({ inv: 'opening.outsideSilent', detail: `${o.id} ${placed.start.toFixed(3)}..${placed.end.toFixed(3)} of ${L.toFixed(3)}` });
  }
  return found;
}

// ---------- metamorphic relations ----------
const round = (v) => Math.round(v * 1e6) / 1e6;
const sig = (g) => JSON.stringify([...g.solids].sort(([a], [b]) => (a < b ? -1 : 1)).map(([id, s]) => [id, s.pieces.map((p) => [p.layerIndex, p.polygon.map((q) => [round(q.x), round(q.y)])])]));
const warnSig = (g) => JSON.stringify(g.warnings.map((w) => [w.kind, [...w.walls].sort()]).sort());
const mapDoc = (doc, f) => ({ ...doc, walls: doc.walls.map((w) => ({ ...w, start: f(w.start), end: f(w.end) })) });
/** Which of a set of points the plan covers. */
const coverage = (g, pts) => { const all = piecesOf(g); return pts.map((q) => all.some((p) => insideConvex(p.poly, q, 1e-6))); };
const openingPoints = (doc, g) => {
  const out = new Map();
  for (const [id, o] of g.openings) {
    const w = doc.walls.find((x) => x.id === o.opening.wallId);
    if (!w || w.bulge) continue;
    const u = mul(sub(w.end, w.start), 1 / dist(w.start, w.end));
    const a = add(w.start, mul(u, o.start)), b = add(w.start, mul(u, o.end));
    out.set(id, [a, b].sort((p, q) => p.x - q.x || p.y - q.y));
  }
  return out;
};
const samePoints = (m1, m2) => { for (const [id, a] of m1) { const b = m2.get(id); if (!b) return id; if (dist(a[0], b[0]) > 1e-6 || dist(a[1], b[1]) > 1e-6) return id; } return null; };

function metamorphic(doc, r, near) {
  const found = [];
  let g0;
  try { g0 = deriveGeometry(doc); } catch { return found; }
  const base = sig(g0), bw = warnSig(g0);
  // I4: the walls' order
  const shuffled = { ...doc, walls: [...doc.walls].reverse() };
  try { if (sig(deriveGeometry(shuffled)) !== base || warnSig(deriveGeometry(shuffled)) !== bw) found.push({ inv: 'I4.order', detail: 'walls listed in reverse give another plan' }); } catch (e) { found.push({ inv: 'crash.derive', detail: String(e) }); }
  if (!near) {
    // Translated far: the same plan moved
    const d = P(1234.5, -987.25);
    try {
      const g = deriveGeometry(mapDoc(doc, (p) => add(p, d)));
      const back = { solids: new Map([...g.solids].map(([id, s]) => [id, { pieces: s.pieces.map((p) => ({ layerIndex: p.layerIndex, polygon: p.polygon.map((q) => sub(q, d)) })) }])) };
      if (sig(back) !== base || warnSig(g) !== bw) found.push({ inv: 'move.translateWhole', detail: 'the whole plan moved 1,2 km is not the same plan' });
    } catch (e) { found.push({ inv: 'crash.derive', detail: String(e) }); }
    // A quarter turn (exact in floating point)
    try {
      const g = deriveGeometry(mapDoc(doc, (p) => P(-p.y, p.x)));
      const back = { solids: new Map([...g.solids].map(([id, s]) => [id, { pieces: s.pieces.map((p) => ({ layerIndex: p.layerIndex, polygon: p.polygon.map((q) => P(q.y, -q.x)) })) }])) };
      if (sig(back) !== base || warnSig(g) !== bw) found.push({ inv: 'move.quarterTurnWhole', detail: 'the whole plan turned 90° is not the same plan turned' });
    } catch (e) { found.push({ inv: 'crash.derive', detail: String(e) }); }
  }
  // I5: some walls moved and moved back
  if (doc.walls.length) {
    const ids = doc.walls.filter(() => r() < 0.5).map((w) => w.id);
    if (ids.length) {
      const d = P((r() - 0.5) * 2, (r() - 0.5) * 2);
      try {
        const there = setWalls(moveWalls(doc, ids, d)).apply(doc);
        const back = setWalls(moveWalls(there, ids, mul(d, -1))).apply(there);
        const worst = Math.max(0, ...doc.walls.map((w, i) => Math.max(dist(w.start, back.walls[i].start), dist(w.end, back.walls[i].end))));
        if (worst > 1e-9) found.push({ inv: 'I5.moveBack', detail: `moved ${JSON.stringify(ids)} by (${d.x.toFixed(3)}, ${d.y.toFixed(3)}) and back: an end is ${worst.toExponential(2)} m off` });
      } catch (e) { found.push({ inv: 'crash.op', detail: `moveWalls: ${e}` }); }
    }
  }
  // Flipped twice is the same; flipped once does not move the wall nor its openings
  const straight = doc.walls.filter((w) => !w.bulge);
  if (straight.length) {
    const w = straight[Math.floor(r() * straight.length)];
    try {
      const once = flipWalls([w.id]).apply(doc);
      const twice = flipWalls([w.id]).apply(once);
      if (JSON.stringify(twice.walls) !== JSON.stringify(doc.walls) || JSON.stringify(twice.openings) !== JSON.stringify(doc.openings)) found.push({ inv: 'flip.twice', detail: `${w.id} flipped twice is not as it was` });
      const pts = samplesInBand(doc, w, 200, r).concat(samplesInBand({ ...doc }, { ...w, start: w.end, end: w.start }, 200, r));
      const g1 = deriveGeometry(once);
      const c0 = coverage(g0, pts), c1 = coverage(g1, pts);
      const moved = c0.filter((c, i) => c !== c1[i]).length;
      if (moved > pts.length * 0.02) found.push({ inv: w.referenceLine === 'centerline' ? 'flip.movesWall' : 'flip.movesFaceWall', detail: `${w.id} (${w.referenceLine}) flipped: ${moved} of ${pts.length} sampled points change between wall and empty` });
      const bad = samePoints(openingPoints(doc, g0), openingPoints(once, g1));
      if (bad) found.push({ inv: 'flip.movesOpening', detail: `${bad} moved when ${w.id} was flipped` });
    } catch (e) { found.push({ inv: 'crash.op', detail: `flipWalls: ${e}` }); }
  }
  // Split at a point and merged back
  if (straight.length) {
    const w = straight[Math.floor(r() * straight.length)];
    const at = add(w.start, mul(sub(w.end, w.start), 0.3 + r() * 0.4));
    try {
      const split = splitWall(doc, w.id, at, 'wall_split');
      if (typeof split !== 'string') {
        const g1 = deriveGeometry(split);
        const pts = samplesInBand(doc, w, 300, r);
        const c0 = coverage(g0, pts), c1 = coverage(g1, pts);
        const diff = c0.filter((c, i) => c !== c1[i]).length;
        if (diff > 0) found.push({ inv: 'split.changesPlan', detail: `${w.id} split at ${(dist(w.start, at)).toFixed(3)} m: ${diff} of ${pts.length} points change` });
        const bad = samePoints(openingPoints(doc, g0), openingPoints(split, g1));
        if (bad) found.push({ inv: 'split.movesOpening', detail: `${bad} moved when ${w.id} was split` });
        if (canMerge(split, w.id, 'wall_split')) {
          const merged = mergeWalls(split, w.id, 'wall_split');
          if (merged && sig(deriveGeometry(merged)) !== base) found.push({ inv: 'merge.notBack', detail: `${w.id} split and merged is another plan` });
        } else found.push({ inv: 'merge.refused', detail: `${w.id} just split cannot be merged back` });
      }
    } catch (e) { found.push({ inv: 'crash.op', detail: `split/merge: ${e}` }); }
  }
  // Saved and read back
  try {
    const read = readProject(writeProject(doc));
    if (!read.ok) found.push({ inv: 'file.unreadable', detail: read.error });
    else {
      if (JSON.stringify(read.doc.walls) !== JSON.stringify(doc.walls)) found.push({ inv: 'file.wallsChange', detail: 'walls read back differ' });
      if (JSON.stringify(read.doc.openings) !== JSON.stringify(doc.openings)) found.push({ inv: 'file.openingsChange', detail: `openings read back differ; fixes: ${JSON.stringify(read.fixes).slice(0, 200)}` });
    }
  } catch (e) { found.push({ inv: 'crash.file', detail: String(e) }); }
  return found;
}

// ---------- the operations, as data, applied with the app's own functions ----------
function apply(doc, op) {
  const has = (id) => doc.walls.some((w) => w.id === id);
  switch (op.op) {
    case 'add': return addWalls([op.wall]).apply(doc);
    case 'move': return op.ids.every(has) ? setWalls(moveWalls(doc, op.ids, op.d)).apply(doc) : doc;
    case 'stretch': return has(op.id) ? setWalls(stretchEnd(doc, op.id, op.end, op.to)).apply(doc) : doc;
    case 'rotate': return op.ids.every(has) ? setWalls(rotateWalls(doc, op.ids, op.pivot, op.angle)).apply(doc) : doc;
    case 'mirror': {
      if (!op.ids.every(has)) return doc;
      let n = 0;
      return transformSelection(doc, deriveGeometry(doc), op.ids, reflection(op.a, op.b), op.copy, (p) => `${p}_m${op.k}_${++n}`).doc;
    }
    case 'turn': {
      if (!op.ids.every(has)) return doc;
      let n = 0;
      return transformSelection(doc, deriveGeometry(doc), op.ids, rotation(op.pivot, op.angle), op.copy, (p) => `${p}_t${op.k}_${++n}`).doc;
    }
    case 'split': { if (!has(op.id)) return doc; const s = splitWall(doc, op.id, op.at, op.newId); return typeof s === 'string' ? doc : s; }
    case 'merge': return has(op.a) && has(op.b) && canMerge(doc, op.a, op.b) ? (mergeWalls(doc, op.a, op.b) ?? doc) : doc;
    case 'flip': return op.ids.every(has) ? flipWalls(op.ids).apply(doc) : doc;
    case 'type': return op.ids.every(has) ? setWalls(changeWallType(doc, op.ids, op.typeId, () => op.kept)).apply(doc) : doc;
    case 'ref': return op.ids.every(has) ? setWalls(changeReferenceLine(doc, op.ids, op.line)).apply(doc) : doc;
    case 'opening': return has(op.o.wallId) ? addOpening(op.o).apply(doc) : doc;
    case 'slide': return doc.openings.some((o) => o.id === op.id) ? updateOpening(op.id, { rule: { kind: 'fromStart', distance: op.distance } }).apply(doc) : doc;
    case 'delete': return deleteElements(op.ids).apply(doc);
    default: throw new Error(`unknown op ${op.op}`);
  }
}

/** The next operation for this plan, aimed at the special positions. Returns [op, nearThreshold]. */
function nextOp(doc, r, k) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  const walls = doc.walls;
  const ends = walls.flatMap((w) => [w.start, w.end]);
  const JITTER = [0, 0, 0, 0.0004, 0.0009, 0.0011, 0.002, 0.03];
  const ANGLES = [90, -90, 0, 180, 0.5, -0.5, 0.7, -0.7, 179.5, 5, 15, 30, 45, 60, 120, 135, 170, 3];
  const kinds = walls.length < 3 ? ['add'] : ['add', 'add', 'add', 'move', 'stretch', 'rotate', 'mirror', 'turn', 'split', 'merge', 'flip', 'type', 'ref', 'opening', 'opening', 'slide', 'delete'];
  const kind = pick(kinds);
  const typeId = pick(typeIds.slice(0, 6).concat(typeIds));
  const line = pick(['centerline', 'centerline', 'interiorFace', 'exteriorFace']);
  let near = false;
  const w0 = walls.length ? pick(walls) : null;
  if (kind === 'add') {
    let start;
    const mode = walls.length ? pick(['free', 'end', 'end', 'end', 'body', 'nearEnd']) : 'free';
    if (mode === 'free') start = P(r() * 8, r() * 8);
    else if (mode === 'end') { const j = pick(JITTER); near = near || j > 0; const a = r() * 2 * Math.PI; start = add(pick(ends), mul(dirOf(a), j)); }
    else {
      const L = dist(w0.start, w0.end), u = mul(sub(w0.end, w0.start), 1 / Math.max(L, 1e-9));
      const s = mode === 'body' ? L * (0.15 + r() * 0.7) : pick([0.0005, 0.002, 0.01, 0.05]) * (r() < 0.5 ? 1 : -1) + (r() < 0.5 ? 0 : L);
      if (mode === 'nearEnd') near = true;
      start = add(w0.start, mul(u, s));
    }
    let dir;
    if (w0 && r() < 0.7) { const base = Math.atan2(w0.end.y - w0.start.y, w0.end.x - w0.start.x); const a = pick(ANGLES); if (Math.abs(Math.abs(a) - 0.6) < 0.2 || Math.abs(a - 179.5) < 0.2) near = true; dir = dirOf(base + deg(a)); }
    else dir = dirOf(r() * 2 * Math.PI);
    let end = add(start, mul(dir, 0.3 + r() * 5));
    // Closing a loop onto another end sometimes
    if (ends.length > 2 && r() < 0.25) end = pick(ends);
    if (dist(start, end) < 0.05) end = add(start, mul(dir, 1));
    const wall = { id: `wall_${k}`, wallTypeId: typeId, start, end, referenceLine: line, levelId: 'lvl_ground', ...(r() < 0.12 ? { bulge: (r() - 0.5) * 0.8 } : {}) };
    return [{ op: 'add', wall }, near];
  }
  if (!w0) return [{ op: 'add', wall: { id: `wall_${k}`, wallTypeId: typeId, start: P(0, 0), end: P(3, 0), referenceLine: line, levelId: 'lvl_ground' } }, false];
  const some = () => { const ids = walls.filter(() => r() < 0.4).map((w) => w.id); return ids.length ? ids : [w0.id]; };
  switch (kind) {
    case 'move': return [{ op: 'move', ids: some(), d: P((r() - 0.5) * 3, (r() - 0.5) * 3) }, false];
    case 'stretch': {
      const end = r() < 0.5 ? 'start' : 'end';
      const to = r() < 0.4 && ends.length ? add(pick(ends), mul(dirOf(r() * 6.3), pick(JITTER))) : add(end === 'start' ? w0.start : w0.end, P((r() - 0.5) * 2, (r() - 0.5) * 2));
      return [{ op: 'stretch', id: w0.id, end, to }, true];
    }
    case 'rotate': return [{ op: 'rotate', ids: some(), pivot: pick(ends), angle: deg(pick([90, -90, 45, 30, 1, 180, 7])) }, false];
    case 'mirror': { const a = pick(ends); return [{ op: 'mirror', ids: some(), a, b: add(a, dirOf(r() * Math.PI)), copy: r() < 0.5, k }, false]; }
    case 'turn': return [{ op: 'turn', ids: some(), pivot: pick(ends), angle: deg(pick([90, 45, 30, 180, 13])), copy: r() < 0.5, k }, false];
    case 'split': return [{ op: 'split', id: w0.id, at: add(w0.start, mul(sub(w0.end, w0.start), 0.2 + r() * 0.6)), newId: `wall_${k}s` }, false];
    case 'merge': { const w1 = pick(walls); return [{ op: 'merge', a: w0.id, b: w1.id }, false]; }
    case 'flip': return [{ op: 'flip', ids: some() }, false];
    case 'type': return [{ op: 'type', ids: some(), typeId, kept: pick(['exterior', 'interior', 'middle', null]) }, false];
    case 'ref': return [{ op: 'ref', ids: some(), line }, false];
    case 'opening': {
      const L = dist(w0.start, w0.end);
      const kindO = r() < 0.5 ? 'door' : 'window';
      const o = newOpening(`opening_${k}`, w0.id, kindO, { kind: 'fromStart', distance: r() * Math.max(0.1, L - 0.5) });
      return [{ op: 'opening', o }, false];
    }
    case 'slide': {
      const o = doc.openings.length ? pick(doc.openings) : null;
      if (!o) return nextOp(doc, r, k);
      return [{ op: 'slide', id: o.id, distance: (r() - 0.2) * 6 }, true];
    }
    case 'delete': return [{ op: 'delete', ids: [pick(walls).id] }, false];
  }
  return nextOp(doc, r, k);
}

/** Runs the steps on a new plan; the first break found, with the step it came at. */
function replay(ops, seed, withMeta, near) {
  const r = rng(seed);
  let doc = deepFreeze(newDocument());
  for (let i = 0; i < ops.length; i++) {
    let next;
    try { next = apply(doc, ops[i]); } catch (e) {
      const msg = String(e && e.message || e);
      return { at: i, inv: /read only|not extensible|Cannot assign|Cannot add property|Cannot delete/.test(msg) ? 'mutates.document' : `crash.op.${ops[i].op}`, detail: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') };
    }
    if (next !== doc) doc = deepFreeze(next);
    const bad = checkDoc(doc, r);
    if (bad.length) return { at: i, ...bad[0], doc };
    if (withMeta) {
      const m = metamorphic(doc, r, near);
      if (m.length) return { at: i, ...m[0], doc };
    }
  }
  return null;
}

/** The fewest steps that still give the same break (Zeller's ddmin over the steps). */
function shrink(ops, seed, inv, near) {
  let cur = ops;
  const fails = (o) => { const b = replay(o, seed, true, near); return b && b.inv === inv ? b : null; };
  let n = 2;
  while (cur.length >= 2) {
    const size = Math.ceil(cur.length / n);
    let reduced = false;
    for (let i = 0; i < cur.length; i += size) {
      const without = cur.slice(0, i).concat(cur.slice(i + size));
      if (without.length && fails(without)) { cur = without; n = Math.max(n - 1, 2); reduced = true; break; }
    }
    if (!reduced) { if (n >= cur.length) break; n = Math.min(cur.length, n * 2); }
  }
  return cur;
}

const runs = Number(runsArg), seed0 = Number(seedArg);
const breaks = new Map();
const counts = new Map();
const t0 = Date.now();
let steps = 0;
for (let run = 0; run < runs; run++) {
  const seed = seed0 * 100003 + run;
  const r = rng(seed ^ 0x9e3779b9);
  const ops = [];
  let doc = newDocument();
  let near = false;
  const n = 4 + Math.floor(r() * 10);
  for (let k = 0; k < n; k++) {
    const [op, nr] = nextOp(doc, r, k);
    near = near || nr;
    ops.push(op);
    try { doc = apply(doc, op); } catch { break; }
  }
  steps += ops.length;
  const b = replay(ops, seed, true, near);
  if (!b) continue;
  counts.set(b.inv, (counts.get(b.inv) ?? 0) + 1);
  if (breaks.has(b.inv) && breaks.get(b.inv).ops.length <= 3) continue;
  const small = shrink(ops.slice(0, b.at + 1), seed, b.inv, near);
  const again = replay(small, seed, true, near);
  const prev = breaks.get(b.inv);
  if (!prev || small.length < prev.ops.length) breaks.set(b.inv, { inv: b.inv, detail: again?.detail ?? b.detail, seed, near, ops: small, doc: again?.doc ? { walls: again.doc.walls, openings: again.doc.openings } : null });
}
const out = { runs, steps, seconds: (Date.now() - t0) / 1000, counts: Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])), breaks: [...breaks.values()] };
mkdirSync(dirname(resolve(outFile)), { recursive: true });
writeFileSync(outFile, JSON.stringify(out, null, 1));
console.log(JSON.stringify({ runs, steps, seconds: out.seconds, counts: out.counts }, null, 1));
for (const b of out.breaks) console.log(`\n[${b.inv}] ${b.detail}\n  ${b.ops.length} steps: ${b.ops.map((o) => o.op).join(' -> ')}${b.near ? '  (near a tolerance)' : ''}`);
