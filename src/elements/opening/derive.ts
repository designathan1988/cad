// Rule → position, and whether the opening fits. Derived on every computation from the rules and the
// host walls as they are now; an opening moves only when its rule's own reference moves.

import { type Doc, type DocWall, wallHeights } from '../../app/document';
import { POINT_TOLERANCE } from '../../core/tolerance';
import { distance } from '../../core/vector';
import { arcOf } from '../wall/geometry/arc';
import type { WallId } from '../wall/schema';
import type { Opening, OpeningId } from './schema';

/** What an opening needs of its wall: the reference line's length and the wall's height. */
export interface HostInfo {
  readonly length: number;
  readonly height: number;
}

export type OpeningWarningKind = 'openingNoHost' | 'openingBadReference' | 'openingOutside' | 'openingOverlap' | 'openingTooTall';

export interface OpeningWarning {
  readonly kind: OpeningWarningKind;
  readonly openings: readonly OpeningId[];
}

export interface PlacedOpening {
  readonly opening: Opening;
  /** Stations of the two jambs along the host's reference line, from its start: start < end. */
  readonly start: number;
  readonly end: number;
  readonly valid: boolean;
  readonly warnings: readonly OpeningWarningKind[];
}

/** Length of the reference line: the chord of a straight wall, the arc of a curved one. */
export function referenceLength(wall: Pick<DocWall, 'start' | 'end' | 'bulge'>): number {
  const arc = arcOf({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });
  return arc === null ? distance(wall.start, wall.end) : arc.radius * Math.abs(arc.sweep);
}

export function hostsOf(doc: Doc, walls: readonly DocWall[] = doc.walls): Map<WallId, HostInfo> {
  return new Map(
    walls.map((w) => {
      const { bottom, top } = wallHeights(doc, w);
      return [w.id, { length: referenceLength(w), height: top - bottom }];
    }),
  );
}

export function deriveOpenings(
  openings: readonly Opening[],
  hosts: ReadonlyMap<WallId, HostInfo>,
): { placed: Map<OpeningId, PlacedOpening>; warnings: OpeningWarning[] } {
  const byId = new Map(openings.map((o) => [o.id, o]));

  // A reference is bad when it is missing, on another wall, or when following references loops.
  const badReference = (o: Opening): boolean => {
    const seen = new Set<OpeningId>();
    let at: Opening | undefined = o;
    while (at && at.rule.kind === 'fromOpening') {
      if (seen.has(at.id)) return true;
      seen.add(at.id);
      const ref = byId.get(at.rule.openingId);
      if (at === o && (!ref || ref.wallId !== o.wallId)) return true;
      if (!ref || ref.wallId !== at.wallId) return false;
      at = ref;
    }
    return false;
  };

  const starts = new Map<OpeningId, number>();
  const startOf = (o: Opening): number => {
    const known = starts.get(o.id);
    if (known !== undefined) return known;
    const length = hosts.get(o.wallId)?.length ?? 0;
    const centred = (length - o.width) / 2;
    const r = o.rule;
    let s: number;
    if (r.kind === 'fromStart') s = r.distance;
    else if (r.kind === 'fromEnd') s = length - r.distance - o.width;
    else if (r.kind === 'centered' || badReference(o)) s = centred;
    else {
      const ref = byId.get(r.openingId)!;
      const refStart = startOf(ref);
      s = r.toward === 'end' ? refStart + ref.width + r.distance : refStart - r.distance - o.width;
    }
    starts.set(o.id, s);
    return s;
  };

  const own = new Map<OpeningId, OpeningWarningKind[]>(openings.map((o) => [o.id, []]));
  const warnings: OpeningWarning[] = [];
  const warn = (kind: OpeningWarningKind, ids: OpeningId[]) => {
    warnings.push({ kind, openings: ids });
    for (const id of ids) own.get(id)!.push(kind);
  };
  for (const o of openings) {
    const host = hosts.get(o.wallId);
    if (!host) {
      warn('openingNoHost', [o.id]);
      continue;
    }
    if (badReference(o)) warn('openingBadReference', [o.id]);
    const s = startOf(o);
    if (s < -POINT_TOLERANCE || s + o.width > host.length + POINT_TOLERANCE) warn('openingOutside', [o.id]);
  }
  for (let i = 0; i < openings.length; i++) {
    const a = openings[i]!;
    if (!hosts.has(a.wallId)) continue;
    for (let j = i + 1; j < openings.length; j++) {
      const b = openings[j]!;
      if (b.wallId !== a.wallId) continue;
      const overlap = Math.min(startOf(a) + a.width, startOf(b) + b.width) - Math.max(startOf(a), startOf(b));
      if (overlap > POINT_TOLERANCE) warn('openingOverlap', [a.id, b.id]);
    }
  }
  for (const o of openings) {
    const host = hosts.get(o.wallId);
    if (host && o.sill + o.height > host.height + POINT_TOLERANCE) warn('openingTooTall', [o.id]);
  }

  const placed = new Map<OpeningId, PlacedOpening>();
  for (const o of openings) {
    const s = startOf(o);
    const ws = own.get(o.id)!;
    placed.set(o.id, { opening: o, start: s, end: s + o.width, valid: ws.length === 0, warnings: ws });
  }
  return { placed, warnings };
}
