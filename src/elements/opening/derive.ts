// Rule → position, and whether the opening fits. Derived on every computation from the rules and the
// host walls as they are now; an opening moves only when its rule's own reference moves.

import { type Doc, type DocWall, wallHeights } from '../../project/doc';
import { POINT_TOLERANCE } from '../../model/tolerance';
import { add, distance, dot, normalize, type Point2, scale, sub } from '../../model/vector';
import { arcOf } from '../wall/geometry/arc';
import type { WallId } from '../wall/schema';
import type { AlignEdge, Opening, OpeningGroup, OpeningGroupId, OpeningId } from './schema';

/** What an opening needs of its wall: the reference line's length, the wall's height, and the line itself when straight. */
export interface HostInfo {
  readonly length: number;
  readonly height: number;
  readonly line?: { readonly start: Point2; readonly end: Point2 };
  /** Where each other wall meets this one inside its length (a T or an X): stations it covers. */
  readonly joints?: ReadonlyMap<WallId, { readonly lo: number; readonly hi: number }>;
  /** Its length clear of the walls met at its ends (a corner): from the inner face of the one at its start to that of the one at its end. */
  readonly clear?: { readonly from: number; readonly to: number };
}

export type OpeningWarningKind =
  | 'openingNoHost'
  | 'openingBadReference'
  | 'openingOutside'
  | 'openingOverlap'
  | 'openingTooTall'
  | 'openingAtJoint'
  /** Two doors' leaves sweep the same floor (app/geometry.ts). */
  | 'openingSwingClash';

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

/** `joints`: each host's joints inside it (app/geometry.ts: hostsIn), which bound a group's stretch. */
export function hostsOf(
  doc: Doc,
  walls: readonly DocWall[] = doc.walls,
  joints?: ReadonlyMap<WallId, ReadonlyMap<WallId, { lo: number; hi: number }>>,
  ends?: ReadonlyMap<WallId, { from: number; to: number }>,
): Map<WallId, HostInfo> {
  return new Map(
    walls.map((w) => {
      const { bottom, top } = wallHeights(doc, w);
      const straight = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 }) === null;
      const mine = joints?.get(w.id);
      const clear = ends?.get(w.id);
      return [
        w.id,
        { length: referenceLength(w), height: top - bottom, ...(straight ? { line: { start: w.start, end: w.end } } : {}), ...(mine ? { joints: mine } : {}), ...(clear ? { clear } : {}) },
      ];
    }),
  );
}

/** The part of its host a group keeps to: between its bounding joints, or the host's ends. */
export function groupStretch(g: OpeningGroup, host: HostInfo | undefined): { from: number; to: number } {
  const length = host?.length ?? 0;
  const [a, b] = g.between ?? [null, null];
  // A bounding wall that no longer meets the host gives the host's end back.
  // At a wall's end, the inner face of the wall met there: the spaces are the room's, not the axis's.
  const start = host?.clear?.from ?? 0;
  const end = host?.clear?.to ?? length;
  const from = a === null ? start : (host?.joints?.get(a)?.hi ?? start);
  const to = b === null ? end : (host?.joints?.get(b)?.lo ?? end);
  return from < to ? { from, to } : { from: 0, to: length };
}

/** Station along `onto`'s line of a point at station s along `from`'s line (both straight). */
const across = (from: HostInfo, s: number, onto: HostInfo): number => {
  const f = from.line!;
  const t = onto.line!;
  const p = add(f.start, scale(normalize(sub(f.end, f.start)), s));
  return dot(sub(p, t.start), normalize(sub(t.end, t.start)));
};

/**
 * Where an opening `width` wide starts on `onto` aligned by `edge` with one at `refStart`, `refWidth`
 * wide, on `from`: the other's jambs carried square across onto its wall.
 */
export function alignedStart(from: HostInfo, refStart: number, refWidth: number, onto: HostInfo, width: number, edge: AlignEdge): number {
  const a = across(from, refStart, onto);
  const b = across(from, refStart + refWidth, onto);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return edge === 'start' ? lo : edge === 'end' ? hi - width : (lo + hi - width) / 2;
}

export function deriveOpenings(
  openings: readonly Opening[],
  hosts: ReadonlyMap<WallId, HostInfo>,
  groups: readonly OpeningGroup[] = [],
): { placed: Map<OpeningId, PlacedOpening>; warnings: OpeningWarning[] } {
  const byId = new Map(openings.map((o) => [o.id, o]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const inGroup = (o: Opening | undefined, g: OpeningGroup): o is Opening =>
    o !== undefined && o.rule.kind === 'inGroup' && o.rule.groupId === g.id && o.wallId === g.wallId;

  // The opening this one is measured from, or undefined when its rule has no reference.
  const referenceOf = (o: Opening): Opening | undefined =>
    o.rule.kind === 'fromOpening' || o.rule.kind === 'aligned' ? byId.get(o.rule.openingId) : undefined;
  // Its own reference is wrong: missing, on the wrong wall, not straight, or a group not listing it.
  const wrongReference = (o: Opening): boolean => {
    const r = o.rule;
    if (r.kind === 'inGroup') {
      const g = groupById.get(r.groupId);
      return !g || !g.members.includes(o.id) || !inGroup(o, g) || !hosts.has(g.wallId);
    }
    if (r.kind !== 'fromOpening' && r.kind !== 'aligned') return false;
    const ref = byId.get(r.openingId);
    if (!ref) return true;
    if (r.kind === 'fromOpening') return ref.wallId !== o.wallId;
    return ref.wallId === o.wallId || !hosts.get(o.wallId)?.line || !hosts.get(ref.wallId)?.line;
  };
  // A reference is bad when it is wrong, or when following references loops.
  const badReference = (o: Opening): boolean => {
    if (wrongReference(o)) return true;
    const seen = new Set<OpeningId>();
    let at: Opening | undefined = o;
    while (at && referenceOf(at)) {
      if (seen.has(at.id)) return true;
      seen.add(at.id);
      const ref: Opening = referenceOf(at)!;
      if (wrongReference(ref)) return false;
      at = ref;
    }
    return false;
  };

  // Stations of a group's members, in its order; members not really in it are left out.
  const groupStarts = new Map<OpeningGroupId, Map<OpeningId, number>>();
  const startsInGroup = (g: OpeningGroup): Map<OpeningId, number> => {
    const known = groupStarts.get(g.id);
    if (known) return known;
    const members = g.members.map((id) => byId.get(id)).filter((o) => inGroup(o, g));
    const { from, to } = groupStretch(g, hosts.get(g.wallId));
    const length = to - from;
    const widths = members.reduce((s, o) => s + o.width, 0);
    const sp = g.spacing;
    let gap: number;
    let at: number;
    if (sp.kind === 'equal') {
      gap = (length - widths) / (members.length + 1);
      at = from + gap;
    } else {
      gap = sp.gap;
      const row = widths + gap * (members.length - 1);
      at = from + (sp.anchor === 'start' ? sp.distance : sp.anchor === 'end' ? length - sp.distance - row : (length - row) / 2);
    }
    const starts = new Map<OpeningId, number>();
    for (const o of members) {
      starts.set(o.id, at);
      at += o.width + gap;
    }
    groupStarts.set(g.id, starts);
    return starts;
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
    else if (r.kind === 'inGroup') s = startsInGroup(groupById.get(r.groupId)!).get(o.id)!;
    else if (r.kind === 'aligned') {
      const ref = byId.get(r.openingId)!;
      s = alignedStart(hosts.get(ref.wallId)!, startOf(ref), ref.width, hosts.get(o.wallId)!, o.width, r.edge);
    } else {
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
