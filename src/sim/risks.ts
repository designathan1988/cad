// Points at risk of water getting in and of cracking (docs/plano-de-escopo.md, phase 14: "verificação
// por regras dos pontos de risco"): rules over the model, each with what it looks at and where its
// threshold comes from (a norm to confirm, or adopted as common practice). The cause of both is in
// details and workmanship, not physics: these say where to look. Pure.

import type { Doc } from '../app/document';
import { wallThickness } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { insideRing } from '../elements/room/derive';
import { heightAt } from '../elements/terrain/schema';
import { add, distance, dot, normalize, scale, sub } from '../core/vector';
import { analyticModel } from '../elements/mep/coordination';
import { exteriorFaces } from './exposure';

export type RiskRule =
  | 'lintel'
  | 'lintelDoor'
  | 'longPanel'
  | 'beamUnder'
  | 'groundLevel'
  | 'wetNoDrain'
  | 'roofSlope'
  | 'flatRoof'
  | 'bareMasonry';

export interface Risk {
  readonly kind: 'fissure' | 'infiltration';
  readonly rule: RiskRule;
  readonly elementId: string;
  /** The measure it was found by (m, %, or none). */
  readonly value?: number;
}

/** The thresholds (adopted unless a norm is named in the report): a masonry panel between braces, the floor over the ground, a tiled roof's slope. */
export const RISK_LIMITS = { panel: 6, floorOverGround: 0.15, tiledSlope: 30 } as const;

/** A wall type is masonry when a layer is brick or concrete (by its material's id or its brick pattern). */
const masonry = (doc: Doc, typeId: string): boolean =>
  (doc.wallTypes.find((t) => t.id === typeId)?.layers ?? []).some((l) => l.materialId === 'brick' || l.materialId === 'concrete' || doc.materials.find((m) => m.id === l.materialId)?.pattern?.kind === 'brick');

export function risksOf(doc: Doc, g: DerivedGeometry): Risk[] {
  const out: Risk[] = [];
  // Fissures. Every door and window in masonry: a lintel over it, and a sill beam under a window.
  for (const o of doc.openings) {
    const w = doc.walls.find((x) => x.id === o.wallId);
    if (w && g.openings.get(o.id)?.valid && masonry(doc, w.wallTypeId)) out.push({ kind: 'fissure', rule: o.kind === 'door' ? 'lintelDoor' : 'lintel', elementId: o.id });
  }
  // A long masonry panel with nothing bracing it: the gaps between the walls and columns that meet it.
  for (const w of doc.walls) {
    if (w.bulge || !masonry(doc, w.wallTypeId)) continue;
    const length = distance(w.start, w.end);
    if (length <= RISK_LIMITS.panel) continue;
    const u = normalize(sub(w.end, w.start));
    const reach = wallThickness(doc, w) / 2 + 0.1;
    const across = (p: { x: number; y: number }) => Math.abs(dot(sub(p, w.start), { x: -u.y, y: u.x }));
    const along = (p: { x: number; y: number }) => dot(sub(p, w.start), u);
    const braces = [0, length];
    for (const x of doc.walls) if (x.id !== w.id && x.levelId === w.levelId) for (const p of [x.start, x.end]) if (across(p) <= reach && along(p) > 0 && along(p) < length) braces.push(along(p));
    for (const c of doc.columns) if (c.levelId === w.levelId && across(c.at) <= reach + Math.max(c.width, c.depth) / 2 && along(c.at) > 0 && along(c.at) < length) braces.push(along(c.at));
    braces.sort((a, b) => a - b);
    const gap = Math.max(...braces.slice(1).map((b, i) => b - braces[i]!));
    if (gap > RISK_LIMITS.panel) out.push({ kind: 'fissure', rule: 'longPanel', elementId: w.id, value: gap });
  }
  // A beam too shallow for its span, or with an end on nothing: the masonry on it cracks as it bends.
  for (const x of analyticModel(g).warnings) if (x.kind === 'beamShallow' || x.kind === 'beamUnsupported') out.push({ kind: 'fissure', rule: 'beamUnder', elementId: x.elementId });
  // Infiltration. The lowest floor close to the ground outside it (where there is a terrain).
  const lowest = [...doc.levels].sort((a, b) => a.elevation - b.elevation)[0];
  const spots = doc.terrains.flatMap((t) => t.spots);
  if (lowest && spots.length > 0)
    for (const f of exteriorFaces(doc, g)) {
      if (f.levelId !== lowest.id) continue;
      const ground = heightAt(spots, add(f.at, scale(f.out, 0.5)));
      const over = lowest.elevation - ground;
      if (over < RISK_LIMITS.floorOverGround) out.push({ kind: 'infiltration', rule: 'groundLevel', elementId: f.id, value: over });
    }
  // A bathroom or a service area with no drain in it.
  for (const r of doc.rooms) {
    if (r.use !== 'bathroom' && r.use !== 'service') continue;
    const s = g.rooms.get(r.id);
    if (!s?.enclosed) continue;
    if (!doc.mepPoints.some((p) => p.levelId === r.levelId && (p.kind === 'drain' || p.kind === 'rainDrain') && insideRing(s.outline, p.at))) out.push({ kind: 'infiltration', rule: 'wetNoDrain', elementId: r.id });
  }
  // A sloped roof flatter than tiles take; a flat one with no rain drain under it.
  for (const roof of doc.roofs) {
    if (roof.kind === 'flat') {
      const drained = doc.mepPoints.some((p) => p.kind === 'rainDrain' && insideRing(roof.outline, p.at));
      if (!drained) out.push({ kind: 'infiltration', rule: 'flatRoof', elementId: roof.id });
      continue;
    }
    const grades = roof.edges.flatMap((e) => (e.grade === null ? [] : [e.grade]));
    const least = grades.length > 0 ? Math.min(...grades) : null;
    if (least !== null && least < RISK_LIMITS.tiledSlope) out.push({ kind: 'infiltration', rule: 'roofSlope', elementId: roof.id, value: least });
  }
  // An exterior face of bare masonry: its outer layer brick or concrete, with no render over it.
  for (const f of exteriorFaces(doc, g)) {
    const w = doc.walls.find((x) => x.id === f.id);
    const type = w && doc.wallTypes.find((t) => t.id === w.wallTypeId);
    if (!type || type.layers.length === 0) continue;
    // The layer on the face that looks out: the first (exterior) one, or the last when the room is on that side.
    const u = normalize(sub(w.end, w.start));
    const outer = dot(f.out, { x: -u.y, y: u.x }) < 0 ? type.layers[0]! : type.layers[type.layers.length - 1]!;
    if (outer.materialId === 'brick' || outer.materialId === 'concrete') out.push({ kind: 'infiltration', rule: 'bareMasonry', elementId: w.id });
  }
  // Water first, then the cracks by their cause, the lintels (one for every opening) last.
  const order = (r: Risk) => (r.kind === 'infiltration' ? 0 : r.rule === 'lintel' || r.rule === 'lintelDoor' ? 2 : 1);
  return out.map((r, i) => ({ r, i })).sort((a, b) => order(a.r) - order(b.r) || a.i - b.i).map((x) => x.r);
}
