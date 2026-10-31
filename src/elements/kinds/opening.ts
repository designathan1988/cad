// Doors and windows in the registry (contract.ts): elements/opening holds the element, its rules and
// groups. They are placed with their walls (geometry.ts: the wall system cuts them in), and moved,
// copied and deleted with them (contract.ts: walled); the kind reads where they are and takes them in
// the selection, the views' filters, picking, framing and select similar. The plan, the 3D
// and the panel draw them with their walls.

import { type OpeningSolid } from '../../project/derive';
import { openingOutline } from '../../project/derived-queries';
import { isObject } from '../../core/guards';
import type { Point2 } from '../../model/vector';
import type { ElementKind } from '../contract';
import { type Opening, OPENING_PREFIX } from '../opening/schema';
import { symbolLines } from '../opening/symbol';
import { insideRing } from '../room/derive';
import { nearSegment } from './paint';
import type { LevelId } from '../../project/doc';

/** A door or window as placed, with its wall's level. */
export type OpeningItem = OpeningSolid & { readonly levelId: LevelId };

/** Distance from p to a closed outline's sides, or to an open line's. */
const toLines = (lines: readonly (readonly Point2[])[], p: Point2, closed: boolean): number => {
  let d = Infinity;
  for (const l of lines)
    for (let i = 0; i < l.length - (closed ? 0 : 1); i++) {
      const a = l[i]!;
      const b = l[(i + 1) % l.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
      d = Math.min(d, Math.hypot(p.x - (a.x + dx * k), p.y - (a.y + dy * k)));
    }
  return d;
};

export const openingKind: ElementKind<Opening, OpeningItem> = {
  key: 'openings',
  prefix: OPENING_PREFIX,
  category: 'openings',
  walled: true,
  icon: 'door',
  one: 'panel.door',
  many: 'panel.door',
  dropped: 'fix.droppedOpenings',


  // Checked in full by the file reader with its rules and groups (io/project-file.ts: isOpening).
  valid: (o): o is Opening => isObject(o) && typeof o.id === 'string' && typeof o.wallId === 'string',
  derive: (doc, o, g) => {
    const placed = g.openings.get(o.id);
    const wall = doc.walls.find((w) => w.id === o.wallId);
    return placed && wall ? { ...placed, levelId: wall.levelId } : null;
  },
  element: (s) => s.opening,
  levelOf: (s) => s.levelId,
  levelIn: (o, doc) => doc.walls.find((w) => w.id === o.wallId)?.levelId ?? null,
  holders: (o) => [o.wallId],
  outlines: (s) => {
    const outline = openingOutline(s);
    return outline.length > 0 ? [outline] : [];
  },
  // With its symbol (a door's leaf and swing, a window's panes): what the plan shows of it.
  extent: (s) => [...openingOutline(s), ...symbolLines(s, s.frame).flat()],
  // Inside it in the wall, or near it or its symbol: a click on a door's leaf took the room behind it.
  hit: (s, p, near) => {
    const outline = openingOutline(s);
    if (outline.length >= 3 && insideRing(outline, p)) return true;
    return outline.some((v, i) => nearSegment(p, v, outline[(i + 1) % outline.length]!, near)) || toLines(symbolLines(s, s.frame), p, false) <= near;
  },
  distance: (s, p) => {
    const outline = openingOutline(s);
    if (outline.length >= 3 && insideRing(outline, p)) return 0;
    return Math.min(toLines([outline], p, true), toLines(symbolLines(s, s.frame), p, false));
  },
  // Before the wall that hosts it.
  pick: 'beforeWalls',
  // The wall system moves and maps it (nudge.ts, transform.ts); these are its own when asked alone.
  moved: (o) => o,
  mapped: (o, _t, id) => ({ ...o, id }),
  similar: (a, b) =>
    a.kind === b.kind && Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.height - b.height) < 1e-6 && Math.abs(a.sill - b.sill) < 1e-6 && JSON.stringify(a.style) === JSON.stringify(b.style),
  // Drawn with its wall (plan-view.ts: drawOpenings), in the cut.
  plan: () => {},
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  // Its panel is the doors' and windows' own (ui/panel.ts: openingPanel), with its rules and groups.
  fields: () => [],
};
