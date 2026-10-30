// Small helpers the kinds share: tracing a polygon in the plan, and fields written for an element read
// through what the kind derives from it.

import type { Point2 } from '../../model/vector';
import type { Field } from '../fields';
import type { PlanPaint } from '../contract';

/** A closed (or open) path through `points`, on screen, begun anew. */
export function trace(p: PlanPaint, points: readonly Point2[], closed = true): void {
  const { ctx } = p;
  ctx.beginPath();
  points.forEach((v, i) => {
    const s = p.toScreen(v);
    if (i === 0) ctx.moveTo(s.x, s.y);
    else ctx.lineTo(s.x, s.y);
  });
  if (closed) ctx.closePath();
}

/** Whether p is within `near` of the segment a–b. */
export function nearSegment(p: Point2, a: Point2, b: Point2, near: number): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k)) <= near;
}

/** Fields over elements, read through their derived form (the panel holds what the kind derives). */
export function throughElement<E, S>(fields: readonly Field<E>[], of: (s: S) => E): Field<S>[] {
  const all = (items: readonly S[]) => items.map(of);
  return fields.map((f): Field<S> => {
    const common = {
      ...f,
      ...(f.when ? { when: (items: readonly S[]) => f.when!(all(items)) } : {}),
      ...(f.own ? { own: (items: readonly S[]) => f.own!(all(items)) } : {}),
    };
    switch (f.kind) {
      case 'readout':
      case 'note':
        return { ...common, kind: f.kind, text: (items: readonly S[]) => f.text(all(items)) } as Field<S>;
      case 'action':
        return { ...common, kind: 'action', ...(f.enabled ? { enabled: (items: readonly S[]) => f.enabled!(all(items)) } : {}) } as Field<S>;
      case 'number': {
        const min = f.min;
        return {
          ...common,
          kind: 'number',
          get: (s: S) => f.get(of(s)),
          ...(min === undefined ? {} : { min: typeof min === 'function' ? (items: readonly S[]) => min(all(items)) : min }),
        } as Field<S>;
      }
      default:
        return { ...common, get: (s: S) => (f.get as (e: E) => unknown)(of(s)) } as Field<S>;
    }
  });
}
