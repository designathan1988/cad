import { finite } from '../../core/guards';
// References under the plan (docs/plano-de-escopo.md, phase 11: "importar imagem ou PDF de planta e
// calibrar a escala por dois pontos"; DXF as reference): a picture (a photo, a scan, a PDF's page drawn
// to a picture) or a DXF's lines, on a level, drawn faint under everything to be traced over. Placed by
// its corner, turned and scaled; calibrated by two points of it and the distance they really are apart.
// Nothing is built from it; it is saved with the project.

import type { Point2 } from '../../model/vector';

export const REFERENCE_PREFIX = 'ref';

export type ReferenceSource =
  /** A picture as a data URL, and its size (px). */
  | { readonly kind: 'image'; readonly data: string; readonly w: number; readonly h: number }
  /** A DXF's lines, each x1, y1, x2, y2 in its own units after its unit (m), from its lowest corner. */
  | { readonly kind: 'dxf'; readonly lines: readonly number[]; readonly w: number; readonly h: number };

export interface Reference {
  readonly id: string;
  readonly levelId: string;
  /** Its file's name. */
  readonly name: string;
  readonly source: ReferenceSource;
  /** Where its lower left corner is (m). */
  readonly at: Point2;
  /** Metres a unit of it: a pixel of a picture, a metre of a DXF (1 when its units were read). */
  readonly scale: number;
  /** Its turn about its corner (radians, counter-clockwise). */
  readonly angle: number;
  /** 0.1 to 1. */
  readonly opacity: number;
}

/** A new picture's scale: a pixel a centimetre, until calibrated. */
export const IMAGE_SCALE = 0.01;
export const DEFAULT_OPACITY = 0.5;

/** A point of the reference in its own units (x right, y up from its lower left corner) in plan. */
export function referencePoint(r: Pick<Reference, 'at' | 'scale' | 'angle'>, u: number, v: number): Point2 {
  const c = Math.cos(r.angle);
  const s = Math.sin(r.angle);
  return { x: r.at.x + (u * c - v * s) * r.scale, y: r.at.y + (u * s + v * c) * r.scale };
}

/** Its four corners in plan, counter-clockwise from the lower left. */
export const referenceCorners = (r: Reference): Point2[] => [referencePoint(r, 0, 0), referencePoint(r, r.source.w, 0), referencePoint(r, r.source.w, r.source.h), referencePoint(r, 0, r.source.h)];

/**
 * The reference calibrated: `a` and `b`, two points of it (in plan), really `real` metres apart. Scaled
 * about `a`, which stays where it is; null when the two points are one or the distance is not one.
 */
export function calibrated(r: Reference, a: Point2, b: Point2, real: number): Reference | null {
  const now = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(now > 1e-9) || !(real > 0) || !Number.isFinite(real)) return null;
  const k = real / now;
  return { ...r, scale: r.scale * k, at: { x: a.x + (r.at.x - a.x) * k, y: a.y + (r.at.y - a.y) * k } };
}

const isPoint = (p: unknown): p is Point2 => typeof p === 'object' && p !== null && finite((p as Point2).x) && finite((p as Point2).y);

export const isReference = (x: unknown): x is Reference => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const src = o.source as Record<string, unknown> | undefined;
  const sourceOk =
    typeof src === 'object' &&
    src !== null &&
    finite(src.w) &&
    finite(src.h) &&
    (src.w as number) > 0 &&
    (src.h as number) > 0 &&
    ((src.kind === 'image' && typeof src.data === 'string' && src.data.startsWith('data:image/')) ||
      (src.kind === 'dxf' && Array.isArray(src.lines) && src.lines.length % 4 === 0 && src.lines.every(finite)));
  return (
    typeof o.id === 'string' &&
    typeof o.levelId === 'string' &&
    typeof o.name === 'string' &&
    sourceOk &&
    isPoint(o.at) &&
    finite(o.scale) &&
    (o.scale as number) > 0 &&
    finite(o.angle) &&
    finite(o.opacity) &&
    (o.opacity as number) >= 0.05 &&
    (o.opacity as number) <= 1
  );
};
