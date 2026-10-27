// References in the registry (contract.ts): elements/reference holds the element. Drawn under the floors
// and walls, faint; picked only on its own outline's inside when nothing else is there (last of all),
// so tracing over it takes the walls first.

import type { Point2 } from '../../core/vector';
import { num, t } from '../../ui/i18n';
import { updateReferences } from '../reference/commands';
import type { ElementKind, PlanPaint } from '../contract';
import { isReference, type Reference, referenceCorners, referencePoint } from '../reference/schema';
import { REFERENCE_PREFIX } from '../reference/schema';

/** Pictures by their data, loaded once. */
const pictures = new Map<string, HTMLImageElement>();
/** Called when a picture has loaded, to draw the plan again (set by the app). */
let loaded: () => void = () => {};
export const onReferenceLoaded = (f: () => void): void => {
  loaded = f;
};

function picture(data: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = pictures.get(data);
  if (!img) {
    img = new Image();
    img.onload = () => loaded();
    img.src = data;
    pictures.set(data, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

const inside = (ring: readonly Point2[], p: Point2): boolean => {
  let k = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) k = !k;
  }
  return k;
};

export const referenceKind: ElementKind<Reference, Reference> = {
  key: 'references',
  prefix: REFERENCE_PREFIX,
  category: null,
  layer: 'under',
  icon: 'map',
  one: 'ref.title',
  many: 'ref.titleMany',
  title: (items) => ({ icon: 'map', text: items.length === 1 ? items[0]!.name || t('ref.title') : t('ref.titleMany', { n: items.length }) }),
  hint: 'ref.held',
  dropped: 'fix.droppedReferences',
  exportName: 'ref.title',
  exportColour: 'structure',
  valid: (r): r is Reference => isReference(r),
  memo: 'element',
  derive: (_doc, r) => r,
  element: (r) => r,
  outlines: (r) => [referenceCorners(r)],
  hit: (r, p) => inside(referenceCorners(r), p),
  pick: 'last',
  moved: (r, d) => ({ ...r, at: { x: r.at.x + d.x, y: r.at.y + d.y } }),
  // Taken by a turn or a scale: its corner where the corner goes, its turn and scale as its side's.
  // A mirror turns it (a picture is not drawn mirrored).
  mapped: (r, tr, id) => {
    const a = tr.map(r.at);
    const b = tr.map(referencePoint(r, 1 / r.scale, 0));
    return { ...r, id, at: a, angle: Math.atan2(b.y - a.y, b.x - a.x), scale: r.scale * tr.factor };
  },
  plan: (p, r, lit) => drawReference(p, r, lit),
  fields: (items, { dispatch, calibrate }) => {
    const ids = items.map((r) => r.id);
    const one = items.length === 1 ? items[0]! : null;
    return [
      { id: 'opacity', label: 'ref.opacity', kind: 'number', min: 0.05, decimals: 2, unit: '', get: (r) => r.opacity, set: (v) => dispatch(updateReferences(ids, { opacity: Math.min(1, v) })) },
      { id: 'angle', label: 'ref.angle', kind: 'number', unit: '°', decimals: 1, get: (r) => (r.angle * 180) / Math.PI, set: (v) => dispatch(updateReferences(ids, { angle: (v * Math.PI) / 180 })) },
      {
        id: 'scale',
        label: 'ref.scale',
        kind: 'readout',
        text: (rs) => {
          const r = rs[0]!;
          if (!rs.every((x) => x.scale === r.scale && x.source.kind === r.source.kind)) return '—';
          // A picture: what a pixel is on the ground; a DXF: how many times its own size.
          return r.source.kind === 'image' ? t('ref.perPixel', { cm: num(r.scale * 100, 2) }) : t('ref.times', { k: num(r.scale, 3) });
        },
      },
      ...(one && calibrate ? [{ id: 'calibrate', label: 'ref.calibrate', kind: 'action', run: () => calibrate(one.id) } as const] : []),
    ];
  },
};

/** A reference in plan: its picture or its lines, faint; its outline when selected. */
export function drawReference(p: PlanPaint, r: Reference, lit: boolean): void {
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha = r.opacity;
  if (r.source.kind === 'image') {
    const img = picture(r.source.data);
    if (img) {
      // The picture's pixel (0, 0) is its top left: its corner (0, h) in its own units, y up.
      const o = p.toScreen(referencePoint(r, 0, r.source.h));
      const x = p.toScreen(referencePoint(r, r.source.w, r.source.h));
      const y = p.toScreen(referencePoint(r, 0, 0));
      ctx.transform((x.x - o.x) / r.source.w, (x.y - o.y) / r.source.w, (y.x - o.x) / r.source.h, (y.y - o.y) / r.source.h, o.x, o.y);
      ctx.drawImage(img, 0, 0);
    }
  } else {
    const ls = r.source.lines;
    ctx.strokeStyle = p.color('--text');
    ctx.lineWidth = p.pen('seen');
    ctx.beginPath();
    for (let i = 0; i + 3 < ls.length; i += 4) {
      const a = p.toScreen(referencePoint(r, ls[i]!, ls[i + 1]!));
      const b = p.toScreen(referencePoint(r, ls[i + 2]!, ls[i + 3]!));
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.restore();
  if (lit) {
    ctx.save();
    ctx.strokeStyle = p.color('--wall-sel');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    referenceCorners(r).forEach((c, i) => {
      const s = p.toScreen(c);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
