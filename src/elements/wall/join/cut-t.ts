// A wall end against another wall's flank (T): the end stops exactly at the host's near face.

import { add, dot, scale } from '../../../core/vector';
import { halfPlaneThrough } from '../geometry/convex';
import { faceOffsets, intoBody, wallNormal } from '../geometry/offset';
import type { Wall, WallEnd } from '../schema';
import { joinExtension } from './cut-l';
import type { EndCut } from './types';

export function resolveAbutment(abutting: Wall, end: WallEnd, host: Wall): EndCut {
  const n = wallNormal(host);
  const [o0, o1] = faceOffsets(host);
  const towardPositive = dot(n, intoBody(abutting, end)) > 0;
  const face = add(host.start, scale(n, towardPositive ? o1 : o0));
  const inward = towardPositive ? n : scale(n, -1);
  return { extension: joinExtension(abutting, host), cuts: [halfPlaneThrough(face, inward)] };
}
