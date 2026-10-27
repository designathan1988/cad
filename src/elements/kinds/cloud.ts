// Revision clouds in the registry (contract.ts): elements/cloud holds the element. Drawn in plan as arcs
// bulging out along the rectangle's sides (30 cm of the model each, 3 mm at 1:100), the
// revision's mark in a triangle at the top right corner and its note beside it; on the DXF as the
// rectangle and the mark. No solid.

import { isObject, isPoint } from '../../core/guards';
import type { ElementKind, PlanPaint } from '../contract';
import { CLOUD_PREFIX, type Cloud, cloudRing } from '../cloud/schema';
import { updateClouds } from '../cloud/commands';
import { nearSegment } from './paint';

/** Each arc's length in the model (m): 3 mm on the paper at 1:100, as a revision cloud is drawn by hand. */
const ARC_M = 0.3;

export const cloudKind: ElementKind<Cloud, Cloud> = {
  key: 'clouds',
  prefix: CLOUD_PREFIX,
  category: null,
  layer: 'top',
  icon: 'warning',
  one: 'cloud.title',
  many: 'cloud.titleMany',
  dropped: 'fix.droppedClouds',
  exportName: 'cloud.title',
  exportColour: 'structure',
  valid: (c): c is Cloud =>
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.levelId === 'string' &&
    isPoint(c.a) &&
    isPoint(c.b) &&
    Math.abs((c.a as { x: number }).x - (c.b as { x: number }).x) > 1e-6 &&
    Math.abs((c.a as { y: number }).y - (c.b as { y: number }).y) > 1e-6 &&
    typeof c.revision === 'string' &&
    (c.note === undefined || typeof c.note === 'string'),
  memo: 'element',
  derive: (_doc, c) => c,
  element: (c) => c,
  outlines: (c) => [cloudRing(c)],
  hit: (c, p, near) => {
    const r = cloudRing(c);
    return r.some((v, i) => nearSegment(p, v, r[(i + 1) % r.length]!, near + 0.1));
  },
  pick: 'first',
  moved: (c, d) => ({ ...c, a: { x: c.a.x + d.x, y: c.a.y + d.y }, b: { x: c.b.x + d.x, y: c.b.y + d.y } }),
  mapped: (c, t, id) => {
    // A turned rectangle is no longer one along the axes: its turned corners' box.
    const r = cloudRing(c).map((p) => t.map(p));
    const xs = r.map((p) => p.x);
    const ys = r.map((p) => p.y);
    return { ...c, id, a: { x: Math.min(...xs), y: Math.min(...ys) }, b: { x: Math.max(...xs), y: Math.max(...ys) } };
  },
  similar: (a, b) => a.revision === b.revision,
  plan: (p, c, lit) => drawCloud(p, c, lit),
  dxfLayers: [{ name: 'A-ANNO-REVS', colour: 1 }],
  dxf: (c, out) => {
    const r = cloudRing(c);
    out.polyline('A-ANNO-REVS', r, true);
    out.text('A-ANNO-REVS', { x: r[2]!.x + 0.15, y: r[2]!.y + 0.15 }, 0.2, `${c.revision}${c.note ? ` ${c.note}` : ''}`);
  },
  fields: (items, { dispatch }) => {
    const ids = items.map((c) => c.id);
    return [
      { id: 'revision', label: 'cloud.revision', kind: 'text', get: (c) => c.revision, set: (v) => dispatch(updateClouds(ids, { revision: v })) },
      { id: 'cloudNote', label: 'cloud.note', kind: 'text', get: (c) => c.note ?? '', set: (v) => dispatch(updateClouds(ids, { note: v })) },
    ];
  },
};

function drawCloud(p: PlanPaint, c: Cloud, lit: boolean): void {
  const { ctx } = p;
  const ring = cloudRing(c).map((v) => p.toScreen(v));
  // The arcs' length in pixels: ARC_M of the model, never under 6 px (zoomed far out they would be dust).
  const arc = Math.max(6, ARC_M * p.scale);
  const color = lit ? p.color('--wall-sel') : p.color('--error');
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = p.pen('annotation') * (lit ? 1.6 : 1);
  ctx.beginPath();
  // The screen ring runs clockwise (plan's y up is the screen's down), so its outside is on each side's
  // left: each half circle goes from the side's start back round through the left normal, out.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / arc));
    const step = { x: (b.x - a.x) / n, y: (b.y - a.y) / n };
    const ang = Math.atan2(step.y, step.x);
    const r = Math.hypot(step.x, step.y) / 2;
    for (let k = 0; k < n; k++) {
      const cx = a.x + step.x * (k + 0.5);
      const cy = a.y + step.y * (k + 0.5);
      ctx.moveTo(cx - Math.cos(ang) * r, cy - Math.sin(ang) * r);
      ctx.arc(cx, cy, r, ang + Math.PI, ang, true);
    }
  }
  ctx.stroke();
  // The mark in a triangle at the top right corner, the note beside it.
  const top = ring.reduce((m, v) => (v.x - v.y > m.x - m.y ? v : m), ring[0]!);
  const s = 11;
  const tx = top.x + s;
  const ty = top.y - s;
  ctx.beginPath();
  ctx.moveTo(tx, ty - s);
  ctx.lineTo(tx + s * 0.95, ty + s * 0.6);
  ctx.lineTo(tx - s * 0.95, ty + s * 0.6);
  ctx.closePath();
  ctx.fillStyle = p.color('--canvas');
  ctx.fill();
  ctx.lineWidth = p.pen('fine');
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = p.font('700', '--fs-xs');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(c.revision, tx, ty + 1.5);
  if (c.note) {
    ctx.textAlign = 'left';
    ctx.font = p.font('600', '--fs-sm');
    ctx.fillText(c.note, tx + s * 1.3, ty);
  }
  ctx.restore();
}
