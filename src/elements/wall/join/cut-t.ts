// A wall end against another wall's flank (T). The abutting core runs to the host's core face, its
// finishes stop at the host's near face, and the host's layers between the two are notched where the
// core passes: plaster meets plaster, brick meets brick.

import { add, dot, scale } from '../../../core/vector';
import { halfPlaneThrough } from '../geometry/convex';
import { endPoint, faceOffsets, intoBody, wallNormal } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import type { WallEnd } from '../schema';
import { joinExtension } from './cut-l';
import type { EndCut, Notch } from './types';

export interface AbutmentResult {
  readonly cut: EndCut;
  readonly notch: Notch | null;
}

export function resolveAbutment(abutting: WallShape, end: WallEnd, host: WallShape): AbutmentResult {
  const n = wallNormal(host);
  const [o0, o1] = faceOffsets(host);
  const towardPositive = dot(n, intoBody(abutting, end)) > 0;
  const inward = towardPositive ? n : scale(n, -1);
  const along = (offset: number) => add(host.start, scale(n, offset));
  const nearFace = towardPositive ? o1 : o0;
  const coreFace = towardPositive ? host.core[1] : host.core[0];
  const cut: EndCut = {
    extension: joinExtension(abutting, host),
    cuts: [],
    coreCuts: [halfPlaneThrough(along(coreFace), inward)],
    finishCuts: [halfPlaneThrough(along(nearFace), inward)],
  };

  const last = host.layers.length - 1;
  const layers: readonly [number, number] = towardPositive
    ? [host.coreLayers[1] + 1, last]
    : [0, host.coreLayers[0] - 1];
  if (layers[0] > layers[1]) return { cut, notch: null };

  // Exactly where the core is: its band, short of the abutting wall's free end (which can reach into
  // the host's finishes when the wall is short, thick and shallow).
  const m = wallNormal(abutting);
  const side = (offset: number) => add(abutting.start, scale(m, offset));
  const freeEnd = end === 'start' ? 'end' : 'start';
  const notch: Notch = {
    wallId: host.id,
    region: [
      halfPlaneThrough(side(abutting.core[0]), m),
      halfPlaneThrough(side(abutting.core[1]), scale(m, -1)),
      halfPlaneThrough(endPoint(abutting, freeEnd), intoBody(abutting, freeEnd)),
    ],
    layers,
  };
  return { cut, notch };
}
