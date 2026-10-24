// A wall end against another wall's flank (T), by Revit's layer priority. The abutting core runs to
// the host's core face. Every other abutting layer walks into the host from its near face through
// host layers of strictly lower priority, and stops on the first of equal or higher priority (the
// host core at the latest). Each host layer it passes is notched exactly where it passes.

import { add, dot, scale } from '../../../core/vector';
import { type HalfPlane, halfPlaneThrough } from '../geometry/convex';
import { endPoint, intoBody, wallNormal } from '../geometry/offset';
import type { WallShape } from '../geometry/shape';
import { LAYER_PRIORITY, type WallEnd } from '../schema';
import { joinExtension } from './cut-l';
import type { EndCut, Notch } from './types';

export interface AbutmentResult {
  readonly cut: EndCut;
  readonly notches: readonly Notch[];
}

export function resolveAbutment(abutting: WallShape, end: WallEnd, host: WallShape): AbutmentResult {
  const n = wallNormal(host);
  const towardPositive = dot(n, intoBody(abutting, end)) > 0;
  const inward = towardPositive ? n : scale(n, -1);
  const along = (offset: number) => add(host.start, scale(n, offset));
  const coreFace = towardPositive ? host.core[1] : host.core[0];

  // Host layers outside its core on the near side, from the near face inward, each with the face it
  // shows toward the abutting wall.
  const walk: { layer: number; face: number }[] = [];
  if (towardPositive) {
    for (let i = host.layers.length - 1; i > host.coreLayers[1]; i--) walk.push({ layer: i, face: host.layerOffsets[i + 1]! });
  } else {
    for (let i = 0; i < host.coreLayers[0]; i++) walk.push({ layer: i, face: host.layerOffsets[i]! });
  }

  // How many of those host layers each abutting layer passes.
  const depth = abutting.layers.map((l, k) => {
    if (k >= abutting.coreLayers[0] && k <= abutting.coreLayers[1]) return walk.length;
    const stop = walk.findIndex((h) => LAYER_PRIORITY[host.layers[h.layer]!.function] <= LAYER_PRIORITY[l.function]);
    return stop === -1 ? walk.length : stop;
  });
  const faceAt = (d: number) => (d === walk.length ? coreFace : walk[d]!.face);
  const cut: EndCut = {
    extension: joinExtension(abutting, host),
    cuts: [],
    layerCuts: depth.map((d) => [halfPlaneThrough(along(faceAt(d)), inward)]),
  };
  // Each passing run of abutting layers, exactly where it is: its band, short of the free end (which
  // can reach into the host's finishes when the wall is short, thick and shallow).
  const m = wallNormal(abutting);
  const side = (offset: number) => add(abutting.start, scale(m, offset));
  const freeEnd = end === 'start' ? 'end' : 'start';
  const shortOfFreeEnd = halfPlaneThrough(endPoint(abutting, freeEnd), intoBody(abutting, freeEnd));
  const notches: Notch[] = [];
  walk.forEach((h, j) => {
    for (const [k0, k1] of runs(depth.map((d) => d > j))) {
      const region: HalfPlane[] = [
        halfPlaneThrough(side(abutting.layerOffsets[k0]!), m),
        halfPlaneThrough(side(abutting.layerOffsets[k1 + 1]!), scale(m, -1)),
        shortOfFreeEnd,
      ];
      notches.push({ wallId: host.id, region, layers: [h.layer, h.layer] });
    }
  });
  return { cut, notches };
}

/** Maximal runs of consecutive true entries, as inclusive index pairs. */
function runs(flags: readonly boolean[]): [number, number][] {
  const out: [number, number][] = [];
  flags.forEach((f, i) => {
    if (!f) return;
    const last = out[out.length - 1];
    if (last && last[1] === i - 1) last[1] = i;
    else out.push([i, i]);
  });
  return out;
}
