// The plan's last layer, over everything (PlanView.draw ends with it): the kinds' texts kept off each
// other and off the dimensions, the room and wall tags, the dimensions, the warnings and the snap.

import { drawObjectHandles } from '../session/object-handles';
import { drawDimension } from '../elements/kinds/dimension';
import { drawDim, drawMeasure, drawSnap, label, overlaps, planFont, textWidth } from './plan-text';
import { drawSelectionHandles } from './plan-strokes';
import { crisp } from './plan-walls';
import { type PlanOverlay } from './plan-types';
import type { PlanView } from './plan-view';
import type { PlanPaint } from '../elements/contract';
import type { eachSolid } from '../elements/registry';

/** What the last layer uses of the drawing in progress. */
export interface AnnotationDeps {
  readonly ctx: CanvasRenderingContext2D;
  readonly color: (name: string) => string;
  readonly paint: PlanPaint;
  readonly kinds: readonly (ReturnType<typeof eachSolid> extends Iterable<infer T> ? T : never)[];
  readonly shownLit: (id: string) => boolean;
}

export function drawAnnotations(view: PlanView, o: PlanOverlay, d: AnnotationDeps): void {
  const { ctx, color, paint, kinds, shownLit } = d;
  // The tags keep off the kinds' values and lines (a dimension's: contract.ts, keepOut), the one being made's too.
  const draft = o.dimensionDraft ?? null;
  const kept = [...kinds.flatMap((x) => x.kind.keepOut?.(paint, x.solid) ?? []), ...(draft ? [{ boxes: [], lines: [{ a: view.toScreen(draft.la), b: view.toScreen(draft.lb) }] }] : [])];
  view.drawRoomTags(o.roomLabels, color, [...view.dimValueBoxes(o.dims ?? []), ...kept.flatMap((k) => k.boxes)], o.dims ?? [], kept.flatMap((k) => k.lines));
  // Dimensions over the room tags (contract.ts: layer top): a value under a room's name was lost.
  for (const x of kinds) if (x.kind.layer === 'top') x.kind.plan(paint, x.solid, shownLit(x.id));
  // Outside the norms: the warning sign, over the rest.
  if (draft) drawDimension(paint, draft, draft.text, color('--wall-sel'));
  if (o.draft && o.draft.length > 0) {
    ctx.save();
    ctx.strokeStyle = color('--wall-sel');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    o.draft.forEach((v, i) => {
      const s = view.toScreen(v);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  }
  for (const v of o.draftCorners ?? []) {
    const s = view.toScreen(v);
    ctx.save();
    ctx.fillStyle = color('--bg');
    ctx.strokeStyle = color('--wall-sel');
    ctx.lineWidth = 1.5;
    ctx.fillRect(Math.round(s.x) - 3.5, Math.round(s.y) - 3.5, 7, 7);
    ctx.strokeRect(Math.round(s.x) - 3.5, Math.round(s.y) - 3.5, 7, 7);
    ctx.restore();
  }
  // A wall's tag keeps off the dimensions' values (the tester's R03: "3,00" covered "Parede 49") and
  // the room tags ("Parede 13" over a room whose point a copied wall had covered): moved down past the
  // one it would meet, or up if that runs off the canvas.
  const values = [...view.dimValueBoxes(o.dims ?? []), ...view.labelBoxes];
  for (const tag of o.wallTags ?? []) {
    const font = planFont(view, '600', '--fs-xs');
    const tw = textWidth(view, tag.text, font) + 8;
    const p = view.toScreen(tag.at);
    let dy = 4;
    const box = (y: number) => ({ x: p.x - tw / 2, y: p.y + y - 11, w: tw, h: 16 });
    for (let k = 0; k < values.length + 1; k++) {
      const hit = values.find((v) => overlaps(box(dy), v));
      if (!hit) break;
      dy = hit.y + hit.h + 11 + 2 - p.y;
    }
    if (p.y + dy + 5 > view.size.h) dy = 4 - 24;
    label(view, tag.at, tag.text, color('--wall-sel'), color('--canvas'), font, { x: 0, y: dy });
  }
  drawSelectionHandles(view, o.handles, color('--bg'), color('--wall-sel'));
  if (o.objectHandles) drawObjectHandles(view.ctx, o.objectHandles, color('--bg'), color('--wall-sel'), o.hotHandle ?? null);
  if (o.anchor) {
    const p = view.toScreen(o.anchor);
    ctx.save();
    ctx.strokeStyle = color('--snap');
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  for (const d of o.dims ?? []) drawDim(view, d, color('--wall-sel'));
  if (o.smart) {
    ctx.save();
    ctx.strokeStyle = color('--snap');
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (const l of o.smart.lines) {
      const [a, b] = crisp(view.toScreen(l.a), view.toScreen(l.b));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1.4;
    for (const gp of o.smart.gaps) {
      const a = view.toScreen(gp.a);
      const b = view.toScreen(gp.b);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      for (const p of [a, b]) {
        ctx.moveTo(p.x - n.x * 4, p.y - n.y * 4);
        ctx.lineTo(p.x + n.x * 4, p.y + n.y * 4);
      }
      ctx.stroke();
      label(view, { x: (gp.a.x + gp.b.x) / 2, y: (gp.a.y + gp.b.y) / 2 }, gp.text, color('--snap'), color('--canvas'), planFont(view, '600', '--fs-xs'));
    }
    ctx.restore();
  }
  if (o.circleDraft) {
    const c = view.toScreen(o.circleDraft.center);
    ctx.save();
    ctx.strokeStyle = color('--wall-sel');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, o.circleDraft.radius * view.scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (o.acquired?.length) {
    ctx.save();
    ctx.strokeStyle = color('--snap');
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const a of o.acquired) {
      const q = view.toScreen(a);
      ctx.moveTo(q.x - 4, q.y);
      ctx.lineTo(q.x + 4, q.y);
      ctx.moveTo(q.x, q.y - 4);
      ctx.lineTo(q.x, q.y + 4);
    }
    ctx.stroke();
    ctx.restore();
  }
  const snapBox = o.snap ? drawSnap(view, o.snap, color('--snap'), color('--bg')) : null;
  if (o.measure) drawMeasure(view, o.measure, snapBox, color('--accent-text'), color('--canvas'));
}
