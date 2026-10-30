// What lies on each side of an opening: the room a door opens into, named in the panel instead of
// "left" and "right" of the wall's drawing direction, which the user never sees.

import { add, scale } from '../../model/vector';
import { insidePolygon, type OpeningSolid } from '../../project/derive';
import type { RoomSolid } from '../room/derive';

/** How far past the wall's faces the side is looked at (m): clear of the wall, inside a small room. */
const PROBE = 0.3;

/** The enclosed room on each side of the opening, at its middle (left: along its frame's normal). */
export function openingSides(one: OpeningSolid, rooms: Iterable<RoomSolid>): { readonly left: RoomSolid | null; readonly right: RoomSolid | null } {
  const f = one.frame;
  if (!f) return { left: null, right: null };
  const middle = scale(add(f.start, f.end), 0.5);
  const list = [...rooms].filter((r) => r.enclosed);
  const at = (offset: number) => {
    const p = add(middle, scale(f.normal, offset));
    return list.find((r) => insidePolygon(r.outline, p)) ?? null;
  };
  const [o0, o1] = f.faces;
  return { left: at(Math.max(o0, o1) + PROBE), right: at(Math.min(o0, o1) - PROBE) };
}
