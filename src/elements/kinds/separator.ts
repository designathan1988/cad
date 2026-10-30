// Room separators in the registry (contract.ts): elements/separator holds the element itself. Drawn
// as a thin dashed line in plan; no solid. Rooms read them in app/geometry.ts.

import { isObject, isPoint } from '../../core/guards';
import { distance } from '../../model/vector';
import { lengthText } from '../../ui/units';
import type { ElementKind } from '../contract';
import { SEPARATOR_PREFIX, type Separator } from '../separator/schema';
import { nearSegment } from './paint';

export const separatorKind: ElementKind<Separator, Separator> = {
  key: 'separators',
  prefix: SEPARATOR_PREFIX,
  category: 'rooms',
  layer: 'over',
  icon: 'split',
  one: 'separator.title',
  many: 'separator.titleMany',
  dropped: 'fix.droppedSeparators',
  exportName: 'separator.title',
  exportColour: 'structure',
  valid: (s): s is Separator =>
    isObject(s) && typeof s.id === 'string' && typeof s.levelId === 'string' && isPoint(s.start) && isPoint(s.end) && JSON.stringify(s.start) !== JSON.stringify(s.end),
  memo: 'element',
  derive: (_doc, s) => s,
  element: (s) => s,
  outlines: (s) => [[s.start, s.end]],
  hit: (s, p, near) => nearSegment(p, s.start, s.end, near),
  pick: 'afterWalls',
  moved: (s, d) => ({ ...s, start: { x: s.start.x + d.x, y: s.start.y + d.y }, end: { x: s.end.x + d.x, y: s.end.y + d.y } }),
  mapped: (s, t, id) => ({ ...s, id, start: t.map(s.start), end: t.map(s.end) }),
  similar: () => true,
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const a = p.toScreen(s.start);
    const b = p.toScreen(s.end);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--text-2');
    ctx.lineWidth = p.pen('fine') * (lit ? 2 : 1);
    ctx.stroke();
    ctx.restore();
  },
  dxfLayers: [{ name: 'A-AREA-BNDY', colour: 8 }],
  dxf: (s, out) => out.polyline('A-AREA-BNDY', [s.start, s.end], false),
  fields: () => [{ id: 'length', label: 'panel.length', kind: 'readout', text: (xs) => (xs.length === 1 ? lengthText(distance(xs[0]!.start, xs[0]!.end)) : '') }],
};
