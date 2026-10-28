// Measures in the registry (contract.ts): elements/measure holds the element. In plan, as dimensions are
// drawn: an angle's arc between its arms with a tick at each end and its degrees; an arc wall's radius
// (a leader from the centre, "R"), diameter (through the centre, "Ø") or length (an arc beside the wall's,
// "⌒"); a point's coordinates by a leader.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { type MessageKey, num, t } from '../../ui/i18n';
import { lengthNum } from '../../ui/units';
import type { ElementKind, PlanPaint } from '../contract';
import { segmentDistance } from '../dimension/anchor';
import { updateMeasures } from '../measure/commands';
import { placeMeasure, type Placed } from '../measure/place';
import { ARC_FACES, ARC_MEASURES, type ArcFace, type ArcMeasure, isArcMeasure, MEASURE_PREFIX, type Measure } from '../measure/schema';

export interface MeasureSolid {
  readonly m: Measure;
  readonly at: Placed | null;
}

/** The arc of an arc wall's length stands this far outside the wall's line (m), its text beyond. */
const ARC_OUT = 0.4;

/** What a measure says. */
export function measureText(at: Placed): string {
  if (at.type === 'angle') return `${num(at.value, 1)}°`;
  if (at.type === 'coord') return `x ${lengthNum(at.at.x)} · y ${lengthNum(at.at.y)}`;
  return `${at.type === 'radius' ? 'R' : at.type === 'diameter' ? 'Ø' : '⌒'} ${lengthNum(at.value)}`;
}

const polar = (c: Point2, r: number, a: number): Point2 => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

/** An arc as points (plan), for outlines and hits. */
function arcPoints(c: Point2, r: number, start: number, sweep: number): Point2[] {
  const n = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 36)) + 1);
  return Array.from({ length: n }, (_, k) => polar(c, r, start + (sweep * k) / (n - 1)));
}

/** The lines a measure is drawn of, in plan: each a polyline. */
function linesOf(at: Placed): Point2[][] {
  if (at.type === 'angle') return [arcPoints(at.vertex, at.radius, at.start, at.sweep)];
  if (at.type === 'coord') return [[at.at, at.label]];
  const { center, radius, start, sweep } = at.arc;
  const on = polar(center, radius, at.at);
  if (at.type === 'radius') return [[center, on]];
  if (at.type === 'diameter') return [[polar(center, radius, at.at + Math.PI), on]];
  return [arcPoints(center, radius + Math.sign(radius) * ARC_OUT, start, sweep)];
}

/** Where the text stands (plan) and the direction it runs along (radians). */
function textPlace(at: Placed): { p: Point2; along: number } {
  if (at.type === 'angle') {
    const mid = at.start + at.sweep / 2;
    return { p: polar(at.vertex, at.radius + 0.25, mid), along: mid + Math.PI / 2 };
  }
  if (at.type === 'coord') return { p: at.label, along: 0 };
  const { center, radius, start, sweep } = at.arc;
  if (at.type === 'arc') {
    const mid = start + sweep / 2;
    return { p: polar(center, radius + ARC_OUT + 0.25, mid), along: mid + Math.PI / 2 };
  }
  return { p: polar(center, radius * (at.type === 'radius' ? 0.5 : 0.5), at.at), along: at.at };
}

const isArcFace = (x: unknown): x is ArcFace => (ARC_FACES as readonly unknown[]).includes(x);

export const measureKind: ElementKind<Measure, MeasureSolid> = {
  key: 'measures',
  prefix: MEASURE_PREFIX,
  category: null,
  layer: 'top',
  icon: 'dimension',
  one: 'meas.title',
  many: 'meas.titleMany',
  title: (items) => ({ icon: 'dimension', text: items.length === 1 ? t(`meas.type.${items[0]!.m.type}` as MessageKey) : t('meas.titleMany') }),
  dropped: 'fix.droppedMeasures',
  valid: (m): m is Measure =>
    isObject(m) &&
    typeof m.id === 'string' &&
    typeof m.levelId === 'string' &&
    ((m.type === 'angle' && isPoint(m.vertex) && isPoint(m.a) && isPoint(m.b) && finite(m.radius) && m.radius > 0) ||
      ((ARC_MEASURES as readonly unknown[]).includes(m.type) && typeof m.wallId === 'string' && isArcFace(m.face) && finite(m.t)) ||
      (m.type === 'coord' && isPoint(m.at) && isPoint(m.label))),
  derive: (doc, m) => ({ m, at: placeMeasure(doc, m) }),
  element: (s) => s.m,
  // An arc wall's goes with its wall.
  holders: (m) => (isArcMeasure(m) ? [m.wallId] : []),
  transformed: (m, c) => {
    if (!isArcMeasure(m) || !c.going(m.wallId)) return null;
    // Mirrored, the wall's ends trade places (edit.ts: swap): the leader is counted from the other one.
    const t1 = c.t.mirror ? 1 - m.t : m.t;
    if (c.copy) return { ...m, id: c.id, wallId: c.to(m.wallId), t: t1 };
    return t1 === m.t ? null : { ...m, t: t1 };
  },
  outlines: (s) => (s.at ? linesOf(s.at) : []),
  hit: (s, p, near, scale) => {
    if (!s.at) return false;
    // On its text: a coordinate's runs right from its point, the others' are centred (about 6.5 px a letter).
    const text = textPlace(s.at).p;
    const half = (measureText(s.at).length * 6.5) / 2 / scale;
    const mid = s.at.type === 'coord' ? { x: text.x + half, y: text.y } : text;
    if (Math.abs(p.x - mid.x) <= half + near && Math.abs(p.y - mid.y) <= near + 9 / scale) return true;
    return linesOf(s.at).some((line) => line.some((q, i) => i > 0 && segmentDistance(p, line[i - 1]!, q) <= near));
  },
  pick: 'first',
  // An angle and a coordinate go where they are taken; an arc wall's stays with its wall.
  moved: (m, d) => {
    const by = (q: Point2) => ({ x: q.x + d.x, y: q.y + d.y });
    return m.type === 'angle' ? { ...m, vertex: by(m.vertex), a: by(m.a), b: by(m.b) } : m.type === 'coord' ? { ...m, at: by(m.at), label: by(m.label) } : m;
  },
  mapped: (m, tr, id) =>
    m.type === 'angle'
      ? { ...m, id, vertex: tr.map(m.vertex), a: tr.map(m.a), b: tr.map(m.b), radius: m.radius * tr.factor }
      : m.type === 'coord'
        ? { ...m, id, at: tr.map(m.at), label: tr.map(m.label) }
        : { ...m, id },
  similar: (a, b) => a.type === b.type,
  plan: (p, s, lit) => {
    if (s.at) drawMeasure(p, s.at, lit ? p.color('--wall-sel') : p.color('--text-2'));
  },
  fields: (items, { dispatch }) => {
    const ids = items.map((s) => s.m.id);
    const arcs = items.every((s) => isArcMeasure(s.m));
    const angles = items.every((s) => s.m.type === 'angle');
    return [
      ...(arcs
        ? ([
            {
              id: 'measType',
              label: 'meas.says',
              kind: 'select',
              options: ARC_MEASURES.map((v) => ({ value: v, label: t(`meas.type.${v}` as MessageKey) })),
              get: (s: MeasureSolid) => s.m.type,
              set: (v: string) => dispatch(updateMeasures(ids, { type: v as ArcMeasure })),
            },
            {
              id: 'measFace',
              label: 'meas.face',
              kind: 'select',
              options: ARC_FACES.map((v) => ({ value: v, label: t(`meas.face.${v}` as MessageKey) })),
              get: (s: MeasureSolid) => (isArcMeasure(s.m) ? s.m.face : 'reference'),
              set: (v: string) => dispatch(updateMeasures(ids, { face: v as ArcFace })),
            },
          ] as const)
        : []),
      ...(angles
        ? ([{ id: 'measRadius', label: 'meas.arcRadius', kind: 'number', min: 0.05, get: (s: MeasureSolid) => (s.m.type === 'angle' ? s.m.radius : 0), set: (v: number) => dispatch(updateMeasures(ids, { radius: v })) }] as const)
        : []),
      { id: 'measValue', label: 'meas.value', kind: 'readout', text: (xs: readonly MeasureSolid[]) => (xs.length === 1 && xs[0]!.at ? measureText(xs[0]!.at) : xs.every((x) => x.at) ? '—' : t('meas.gone')) },
    ];
  },
};

/** A measure in plan. */
export function drawMeasure(p: PlanPaint, at: Placed, colour: string): void {
  const { ctx } = p;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = p.pen('annotation');
  ctx.beginPath();
  for (const line of linesOf(at)) {
    line.forEach((q, i) => {
      const s = p.toScreen(q);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
  }
  // The ends: ticks across an angle's or an arc's ends, an arrow on a radius's or a diameter's.
  const tick = (q: Point2, dir: number) => {
    const s = p.toScreen(q);
    // Screen y is plan's down: the tick leans 45° to the line, as a dimension's do.
    const a = -dir + Math.PI / 4;
    ctx.moveTo(s.x - Math.cos(a) * 4, s.y - Math.sin(a) * 4);
    ctx.lineTo(s.x + Math.cos(a) * 4, s.y + Math.sin(a) * 4);
  };
  if (at.type === 'angle') {
    tick(polar(at.vertex, at.radius, at.start), at.start + Math.PI / 2);
    tick(polar(at.vertex, at.radius, at.start + at.sweep), at.start + at.sweep + Math.PI / 2);
    // Arms shorter than the arc: carried out to it, as extension lines.
    for (const [k, ang] of [
      [0, at.start],
      [1, at.start + at.sweep],
    ] as const) {
      if (at.arms[k] < at.radius) {
        const a = p.toScreen(polar(at.vertex, at.arms[k], ang));
        const b = p.toScreen(polar(at.vertex, at.radius, ang));
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
  } else if (at.type === 'arc') {
    const { center, radius, start, sweep } = at.arc;
    for (const ang of [start, start + sweep]) {
      tick(polar(center, radius + ARC_OUT, ang), ang + Math.PI / 2);
      const a = p.toScreen(polar(center, radius, ang));
      const b = p.toScreen(polar(center, radius + ARC_OUT + 0.08, ang));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  } else if (at.type === 'coord') {
    const s = p.toScreen(at.at);
    ctx.moveTo(s.x - 4, s.y - 4);
    ctx.lineTo(s.x + 4, s.y + 4);
    ctx.moveTo(s.x - 4, s.y + 4);
    ctx.lineTo(s.x + 4, s.y - 4);
  }
  ctx.stroke();
  if (at.type === 'radius' || at.type === 'diameter') {
    // Arrowheads on the arc (and, for a diameter, on the opposite side), the centre marked.
    const { center, radius } = at.arc;
    const ends = at.type === 'radius' ? [at.at] : [at.at, at.at + Math.PI];
    for (const ang of ends) {
      const tip = p.toScreen(polar(center, radius, ang));
      const back = p.toScreen(polar(center, radius - 1, ang));
      const len = Math.hypot(back.x - tip.x, back.y - tip.y) || 1;
      const u = { x: (back.x - tip.x) / len, y: (back.y - tip.y) / len };
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + u.x * 8 - u.y * 3, tip.y + u.y * 8 + u.x * 3);
      ctx.lineTo(tip.x + u.x * 8 + u.y * 3, tip.y + u.y * 8 - u.x * 3);
      ctx.closePath();
      ctx.fill();
    }
    const c = p.toScreen(center);
    ctx.beginPath();
    ctx.moveTo(c.x - 4, c.y);
    ctx.lineTo(c.x + 4, c.y);
    ctx.moveTo(c.x, c.y - 4);
    ctx.lineTo(c.x, c.y + 4);
    ctx.stroke();
  }
  // The value: upright, on a backing so lines under it do not cross it.
  const text = measureText(at);
  const { p: tp, along } = textPlace(at);
  const s = p.toScreen(tp);
  let angle = -along;
  while (angle > Math.PI / 2) angle -= Math.PI;
  while (angle <= -Math.PI / 2) angle += Math.PI;
  ctx.font = p.font('500', '--fs-xs');
  const tw = ctx.measureText(text).width;
  ctx.translate(s.x, s.y);
  ctx.rotate(angle);
  ctx.fillStyle = p.color('--canvas');
  ctx.globalAlpha = 0.85;
  ctx.fillRect(at.type === 'coord' ? -3 : -tw / 2 - 3, -8, tw + 6, 15);
  ctx.globalAlpha = 1;
  ctx.fillStyle = colour;
  ctx.textAlign = at.type === 'coord' ? 'left' : 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
