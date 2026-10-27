// The budget by element and by room (docs/plano-de-escopo.md, "custo por cômodo e por elemento"): each
// priced line tied to the model shared among what makes its quantity, by its share of it: a wall layer's
// lines among the walls, a room finish's among the rooms, the doors' and windows' among them one by
// one. What is not tied to elements (a typed quantity, the built area) is left as not shared. Pure.

import type { Doc } from '../app/document';
import type { DerivedGeometry } from '../app/geometry';
import { finishQuantities, layerQuantities } from '../app/quantities';
import type { Budget } from './budget';
import type { QuantityRef } from './schema';

export interface Breakdown {
  /** Cost (R$, before the BDI) by element id: walls, rooms, doors and windows. */
  readonly byElement: ReadonlyMap<string, number>;
  /** What no element carries: typed quantities, the built area. */
  readonly unshared: number;
}

/** Each element's part of a line's quantity, by id. */
function parts(doc: Doc, layers: ReturnType<typeof layerQuantities>, finishes: ReturnType<typeof finishQuantities>, ref: QuantityRef): Map<string, number> | null {
  const out = new Map<string, number>();
  const add = (id: string, v: number) => v > 0 && out.set(id, (out.get(id) ?? 0) + v);
  const mine = (id: string) => ref.material === undefined || ref.material === id;
  const of = (x: { area: number; volume?: number; pieces: number | null }) => (ref.measure === 'volume' ? (x.volume ?? 0) : ref.measure === 'pieces' || ref.measure === 'count' ? (x.pieces ?? 0) : x.area);
  switch (ref.of) {
    case 'fixed':
    case 'built':
      return null;
    case 'masonry':
    case 'mortar':
      for (const l of layers) if (l.mortar !== null && mine(l.materialId)) add(l.wallId, ref.of === 'mortar' ? l.mortar : of(l));
      return out;
    case 'faceExterior':
    case 'faceInterior':
    case 'layer': {
      const place = ref.of === 'faceExterior' ? 'exterior' : ref.of === 'faceInterior' ? 'interior' : 'inner';
      for (const l of layers) if (l.place === place && l.mortar === null && mine(l.materialId)) add(l.wallId, of(l));
      return out;
    }
    case 'floor':
    case 'ceiling':
    case 'roomWall': {
      const surface = ref.of === 'roomWall' ? 'wall' : ref.of;
      for (const f of finishes) if (f.surface === surface && mine(f.materialId)) add(f.roomId, of(f));
      return out;
    }
    case 'doors':
    case 'windows': {
      const kind = ref.of === 'doors' ? 'door' : 'window';
      for (const o of doc.openings) if (o.kind === kind) add(o.id, ref.measure === 'count' ? 1 : o.width * o.height);
      return out;
    }
  }
}

export function breakdownOf(doc: Doc, g: DerivedGeometry, b: Budget): Breakdown {
  const layers = layerQuantities(doc, g);
  const finishes = finishQuantities(doc, g);
  const byElement = new Map<string, number>();
  let unshared = 0;
  for (const r of b.rows) {
    if (r.total === null || r.total === 0) continue;
    const p = parts(doc, layers, finishes, r.line.quantity);
    const sum = p ? [...p.values()].reduce((s, v) => s + v, 0) : 0;
    if (!p || sum <= 0) {
      unshared += r.total;
      continue;
    }
    for (const [id, v] of p) byElement.set(id, (byElement.get(id) ?? 0) + (r.total * v) / sum);
  }
  return { byElement, unshared };
}
