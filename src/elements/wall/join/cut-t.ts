// A wall end against another wall's flank (T): the end stops exactly at the host's near face.

import { add, dot, scale } from '../../../core/vector';
import { halfPlaneThrough } from '../geometry/convex';
import { faceOffsets, intoBody, wallNormal } from '../geometry/offset';
import type { WallEnd } from '../schema';
import type { WallShape } from '../geometry/shape';
import { joinExtension } from './cut-l';
import type { EndCut } from './types';

export function resolveAbutment(abutting: WallShape, end: WallEnd, host: WallShape): EndCut {
  const n = wallNormal(host);
  const [o0, o1] = faceOffsets(host);
  const towardPositive = dot(n, intoBody(abutting, end)) > 0;
  const face = add(host.start, scale(n, towardPositive ? o1 : o0));
  const inward = towardPositive ? n : scale(n, -1);
  return { extension: joinExtension(abutting, host), cuts: [halfPlaneThrough(face, inward)] };
}
