// What is wrong with the model, for the diagnostics panel (F7, ui/debug-panel.ts): the engine's own
// warnings (joins, doors and windows, rooms), and checks that need no test run: pieces of two walls
// lying over each other, a wall with nothing left to draw, slivers. Read from the derived geometry, once
// per geometry. Pure.

import { area, overlapArea } from '../elements/wall/geometry/convex';
import type { Doc } from './document';
import { wallNumber } from './document';
import type { DerivedGeometry } from './geometry';

export type Severity = 'error' | 'warn' | 'info';

export interface Diagnostic {
  readonly severity: Severity;
  /** What kind of problem: the engine's warning kind, or a check's name. */
  readonly kind: string;
  /** The elements it is about, to select and frame. */
  readonly ids: readonly string[];
  /** Details: an area, a count. */
  readonly detail?: string;
}

/** Overlaps smaller than this (m²) are rounding, not a fault. */
const OVERLAP = 1e-6;
/** A piece smaller than this (m²) is a sliver. */
const SLIVER = 1e-6;

export function diagnose(g: DerivedGeometry): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const w of g.warnings) out.push({ severity: w.kind === 'wallsOverlap' || w.kind === 'complexJoin' ? 'error' : 'warn', kind: w.kind, ids: w.walls });
  for (const w of g.openingWarnings) out.push({ severity: 'warn', kind: w.kind, ids: w.openings });
  for (const w of g.roomWarnings) out.push({ severity: 'warn', kind: w.kind, ids: [w.roomId] });

  // Every wall that exists draws something; its pieces are no slivers; no two walls' pieces overlap.
  const solids = [...g.solids.values()];
  for (const s of solids) {
    if (s.pieces.length === 0 && s.blocks.length === 0) out.push({ severity: 'error', kind: 'wallEmpty', ids: [s.wall.id] });
    const slivers = s.pieces.filter((p) => p.polygon.length < 3 || area(p.polygon) < SLIVER).length;
    if (slivers > 0) out.push({ severity: 'warn', kind: 'wallSliver', ids: [s.wall.id], detail: String(slivers) });
  }
  const boxes = solids.map((s) =>
    s.pieces.map((p) => {
      const xs = p.polygon.map((v) => v.x);
      const ys = p.polygon.map((v) => v.y);
      return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), poly: p.polygon };
    }),
  );
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      if (solids[i]!.wall.levelId !== solids[j]!.wall.levelId) continue;
      let shared = 0;
      for (const a of boxes[i]!)
        for (const b of boxes[j]!) {
          if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue;
          shared += overlapArea(a.poly, b.poly);
        }
      if (shared > OVERLAP) out.push({ severity: 'error', kind: 'piecesOverlap', ids: [solids[i]!.wall.id, solids[j]!.wall.id], detail: `${(shared * 1e4).toFixed(1)} cm²` });
    }
  }
  const rank: Record<Severity, number> = { error: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** How a diagnostic's elements are named: walls by their number, the rest by their kind and number. */
export function nameOf(doc: Doc, id: string, tag: { wall: (n: number) => string; opening: (kind: string) => string; room: (name: string) => string }): string {
  const w = doc.walls.find((x) => x.id === id);
  if (w) return tag.wall(wallNumber(doc, id) ?? 0);
  const o = doc.openings.find((x) => x.id === id);
  if (o) return tag.opening(o.kind);
  const r = doc.rooms.find((x) => x.id === id);
  if (r) return tag.room(`${r.number} · ${r.name}`);
  return id;
}
