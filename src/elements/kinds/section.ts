// Sections and elevations in the registry (contract.ts): elements/section holds the mark itself. A mark
// has no level: it is drawn on every level's plan, as the views it stands for cut through all of them;
// a room's interior elevation keeps to its room's level.

import { isObject } from '../../core/guards';
import { distance, type Point2 } from '../../model/vector';
import { lengthText } from '../../i18n/units';
import { t } from '../../i18n/messages';
import type { ElementKind, PlanPaint } from '../contract';
import { flipSections, renameSection, setSectionDepth } from '../section/commands';
import { DEPTH_MIN, isSectionMark, lookOf, SECTION_PREFIX, type SectionMark } from '../section/schema';
import { nearSegment } from './paint';

/** A mark's bubble's radius on screen (px). */
export const SECTION_BUBBLE_PX = 11;

/** A bubble's radius in the DXF (m). */
const BUBBLE_R = 0.3;

/** Where its bubbles are, on screen: past each end of a section, at the middle of an elevation. */
function bubbles(p: Pick<PlanPaint, 'toScreen'>, m: SectionMark): Point2[] {
  const a = p.toScreen(m.start);
  const b = p.toScreen(m.end);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  const r = SECTION_BUBBLE_PX;
  if (m.kind === 'elevation') return [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }];
  return [
    { x: a.x - u.x * r * 1.2, y: a.y - u.y * r * 1.2 },
    { x: b.x + u.x * r * 1.2, y: b.y + u.y * r * 1.2 },
  ];
}

export const sectionKind: ElementKind<SectionMark, SectionMark> = {
  key: 'sections',
  prefix: SECTION_PREFIX,
  category: null,
  everyLevel: true,
  layer: 'over',
  icon: 'cut',
  one: 'section.title',
  many: 'section.titleMany',
  title: (items) => ({
    icon: 'cut',
    text: items.length === 1 ? t(items[0]!.kind === 'section' ? 'section.titleOne' : 'section.elevationOne', { name: items[0]!.name }) : t('section.titleMany', { n: items.length }),
  }),
  hint: 'section.held',
  dropped: 'fix.droppedSections',
  exportName: 'section.title',
  exportColour: 'structure',
  valid: (m): m is SectionMark => isObject(m) && isSectionMark(m),
  memo: 'element',
  derive: (_doc, m) => m,
  element: (m) => m,
  outlines: (m) => [[m.start, m.end]],
  hit: (m, p, near) => nearSegment(p, m.start, m.end, near),
  // A click in a bubble takes the mark before the walls under it.
  grab: (m, p, scale) => {
    const r = SECTION_BUBBLE_PX / scale;
    const a = m.start;
    const b = m.end;
    const len = distance(a, b) || 1;
    const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    const at = m.kind === 'elevation' ? [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] : [{ x: a.x - u.x * r * 1.2, y: a.y - u.y * r * 1.2 }, { x: b.x + u.x * r * 1.2, y: b.y + u.y * r * 1.2 }];
    return at.some((c) => distance(p, c) <= r);
  },
  pick: 'afterWalls',
  moved: (m, d) => ({ ...m, start: { x: m.start.x + d.x, y: m.start.y + d.y }, end: { x: m.end.x + d.x, y: m.end.y + d.y } }),
  // Mirrored, it still looks the mirrored way: its ends trade places.
  mapped: (m, tr, id) => (tr.mirror ? { ...m, id, start: tr.map(m.end), end: tr.map(m.start), depth: m.depth * tr.factor } : { ...m, id, start: tr.map(m.start), end: tr.map(m.end), depth: Math.max(DEPTH_MIN, m.depth * tr.factor) }),
  plan: (p, m, lit) => drawSectionMark(p, m, lit ? p.color('--wall-sel') : p.color('--text')),
  dxfLayers: [{ name: 'A-ANNO-SECT', colour: 1 }],
  dxf: (m, out) => {
    out.line('A-ANNO-SECT', m.start, m.end);
    const len = distance(m.start, m.end) || 1;
    const u = { x: (m.end.x - m.start.x) / len, y: (m.end.y - m.start.y) / len };
    const look = lookOf(m);
    const centres = m.kind === 'elevation' ? [{ x: (m.start.x + m.end.x) / 2, y: (m.start.y + m.end.y) / 2 }] : [{ x: m.start.x - u.x * BUBBLE_R, y: m.start.y - u.y * BUBBLE_R }, { x: m.end.x + u.x * BUBBLE_R, y: m.end.y + u.y * BUBBLE_R }];
    for (const c of centres) {
      out.polyline('A-ANNO-SECT', Array.from({ length: 16 }, (_, i) => ({ x: c.x + BUBBLE_R * Math.cos((i * Math.PI) / 8), y: c.y + BUBBLE_R * Math.sin((i * Math.PI) / 8) })), true);
      out.line('A-ANNO-SECT', c, { x: c.x + look.x * BUBBLE_R * 2, y: c.y + look.y * BUBBLE_R * 2 });
      out.text('A-ANNO-SECT', c, BUBBLE_R, m.name);
    }
  },
  fields: (items, { dispatch, openSection }) => {
    const one = items.length === 1 ? items[0]! : null;
    const ids = items.map((m) => m.id);
    return [
      ...(one ? [{ id: 'name', label: 'section.name', kind: 'text', get: (m: SectionMark) => m.name, set: (v: string) => dispatch(renameSection(one.id, v)) } as const] : []),
      {
        id: 'kind',
        label: 'section.kind',
        kind: 'readout',
        text: (ms) => {
          const kind = (m: SectionMark) => (m.kind === 'section' ? 'section.kindSection' : m.levelId === undefined ? 'section.kindElevation' : 'section.kindInterior');
          return ms.every((m) => kind(m) === kind(ms[0]!)) ? t(kind(ms[0]!)) : '—';
        },
      },
      {
        id: 'width',
        label: 'section.width',
        kind: 'readout',
        text: (ms) => {
          const l = ms.map((m) => distance(m.start, m.end));
          return l.every((x) => Math.abs(x - l[0]!) < 1e-9) ? lengthText(l[0]!) : '—';
        },
      },
      { id: 'depth', label: 'section.depth', kind: 'number', min: DEPTH_MIN, get: (m) => m.depth, set: (v) => dispatch(setSectionDepth(ids, v)) },
      { id: 'flip', label: 'section.flip', kind: 'action', run: () => dispatch(flipSections(ids)) },
      ...(one && openSection ? [{ id: 'open', label: 'section.open', kind: 'action', run: () => openSection(one.id) } as const] : []),
    ];
  },
};

/**
 * A mark in plan. A section: its line dash-dotted, heavy at its ends, a bubble with its name past each
 * end and an arrow from it the way it looks. An elevation: its line dashed and thin, one bubble at its
 * middle with the arrow.
 */
export function drawSectionMark(p: PlanPaint, m: SectionMark, colour: string): void {
  const { ctx } = p;
  const a = p.toScreen(m.start);
  const b = p.toScreen(m.end);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return;
  const u = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
  // The look on screen: the plan's y runs up, the screen's down.
  const lk = lookOf(m);
  const look = { x: lk.x, y: -lk.y };
  const r = SECTION_BUBBLE_PX;
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.fillStyle = colour;
  ctx.lineWidth = p.pen('annotation');
  ctx.setLineDash(m.kind === 'section' ? [14, 4, 2, 4] : [6, 4]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (m.kind === 'section') {
    const end = Math.min(18, len / 3);
    ctx.lineWidth = p.pen('cut') * 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x + u.x * end, a.y + u.y * end);
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - u.x * end, b.y - u.y * end);
    ctx.stroke();
  }
  ctx.lineWidth = p.pen('annotation');
  ctx.font = p.font('700', '--fs-sm');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const c of bubbles(p, m)) {
    // The arrow: a filled triangle from the bubble the way the view looks.
    ctx.beginPath();
    ctx.moveTo(c.x + look.x * r * 1.9, c.y + look.y * r * 1.9);
    ctx.lineTo(c.x + u.x * r * 0.95, c.y + u.y * r * 0.95);
    ctx.lineTo(c.x - u.x * r * 0.95, c.y - u.y * r * 0.95);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fillStyle = p.color('--canvas');
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colour;
    const label = m.name.length > 3 ? m.name.slice(0, 1).toUpperCase() : m.name;
    // Narrowed to the bubble when wider ("3-N", a room's elevation).
    const fit = Math.min(1, (r * 1.6) / (ctx.measureText(label).width || 1));
    ctx.save();
    ctx.translate(c.x, c.y + 0.5);
    ctx.scale(fit, fit);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
