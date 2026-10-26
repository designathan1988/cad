// Roofs in the registry (contract.ts): elements/roof holds the element and its faces.

import { finite, isObject, isPoint } from '../../core/guards';
import { roofGeometry } from '../../render/prisms';
import type { ElementKind } from '../contract';
import { updateRoofs } from '../roof/commands';
import { roofFields } from '../roof/fields';
import { type RoofSolid, roofSolid } from '../roof/geometry';
import { type Roof, ROOF_PREFIX } from '../roof/schema';
import { insideRing } from '../room/derive';
import { trace } from './paint';

export const roofKind: ElementKind<Roof, RoofSolid> = {
  key: 'roofs',
  prefix: ROOF_PREFIX,
  category: 'walls',
  icon: 'roof',
  one: 'roof.title',
  many: 'roof.titleMany',
  dropped: 'fix.droppedRoofs',
  exportName: 'export.roof',
  exportColour: 'roof',
  valid: (r): r is Roof =>
    isObject(r) &&
    typeof r.id === 'string' &&
    typeof r.levelId === 'string' &&
    Array.isArray(r.outline) &&
    r.outline.length >= 3 &&
    r.outline.every(isPoint) &&
    Array.isArray(r.edges) &&
    r.edges.length === r.outline.length &&
    r.edges.every((e) => isObject(e) && (e.grade === null || finite(e.grade)) && finite(e.overhang)) &&
    (r.kind === 'flat' || r.kind === 'shed' || r.kind === 'gable' || r.kind === 'hip') &&
    finite(r.thickness) &&
    r.thickness > 0 &&
    finite(r.baseOffset) &&
    (r.parapet === undefined || finite(r.parapet)),
  // On its level's top.
  derive: (doc, r) => {
    const level = doc.levels.find((l) => l.id === r.levelId) ?? { elevation: 0, height: 2.8 };
    return roofSolid(r, level.elevation + level.height);
  },
  element: (s) => s.roof,
  outlines: (s) => [s.outline],
  hit: (s, p) => insideRing(s.outline, p),
  // Over everything: its overhang, outside the walls, is where it is taken first.
  pick: 'last',
  moved: (r, d) => ({ ...r, outline: r.outline.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }),
  // Mirrored, turned back to counter-clockwise, its sides following.
  mapped: (r, t, id) => {
    const pts = r.outline.map(t.map);
    const scaled = (e: Roof['edges'][number]) => ({ ...e, overhang: e.overhang * t.factor });
    if (!t.mirror) return { ...r, id, outline: pts, edges: r.edges.map(scaled) };
    const n = pts.length;
    return { ...r, id, outline: [...pts].reverse(), edges: pts.map((_, i) => r.edges[(2 * n - 2 - i) % n]!).map(scaled) };
  },
  // Above the cut: the eaves dashed, the ridges and hips (the faces' sides) thin.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    trace(p, s.outline);
    if (lit) {
      ctx.fillStyle = p.color('--accent-soft');
      ctx.globalAlpha = 0.5;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.setLineDash([8, 4]);
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--text-2');
    ctx.lineWidth = lit ? 2 : 1;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    if (s.faces.length > 1)
      for (const f of s.faces) {
        trace(p, f.polygon);
        ctx.stroke();
      }
    ctx.restore();
  },
  solid: (s) => ({ geometry: roofGeometry(s.faces, s.gables, s.parapets, s.roof.thickness), y: 0, material: 'roof', edges: true }),
  dxfLayers: [{ name: 'A-ROOF', colour: 6 }],
  dxf: (s, out) => {
    out.polyline('A-ROOF', s.outline, true);
    if (s.faces.length > 1) for (const f of s.faces) out.polyline('A-ROOF', f.polygon, true);
  },
  fields: (items, { dispatch }) => roofFields(items, { updateRoofs: (ids, patch) => dispatch(updateRoofs(ids, patch)) }),
};
