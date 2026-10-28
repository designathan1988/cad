// Rooms in the registry (contract.ts): elements/room holds the element. A room's outline comes from the
// walls of its whole level (room/derive.ts: deriveRooms, in the base geometry); the kind reads it there.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { name, t } from '../../ui/i18n';
import type { ElementKind } from '../contract';
import { updateRooms } from '../room/commands';
import { insideRing, type RoomSolid } from '../room/derive';
import { roomFields } from '../room/fields';
import { type Room, ROOM_USES } from '../room/schema';

export const ROOM_PREFIX = 'room';

/** A room as built, at its level's floor (where the 3D window takes it). */
export type RoomItem = RoomSolid & { readonly elevation: number };

/** The next number on a level, after those in `all` (the highest + 1: a count repeated one after a deletion). */
export const nextNumber =(all: readonly Room[], levelId: string): string =>
  String(all.filter((r) => r.levelId === levelId).reduce((n, r) => Math.max(n, Number.parseInt(r.number, 10) || 0), 0) + 1);

export const roomKind: ElementKind<Room, RoomItem> = {
  key: 'rooms',
  prefix: ROOM_PREFIX,
  category: 'rooms',
  // Lit under the walls; its tag is the plan's (room tags keep off the rest).
  layer: 'under',
  icon: 'room',
  one: 'room.title',
  many: 'room.titleMany',
  title: (items) => ({ icon: 'room', text: items.length === 1 ? t('room.title', { name: name(items[0]!.room.name) }) : t('room.titleMany', { n: items.length }) }),
  // One room not closed in, or sharing its space: said under its fields.
  warning: (items, doc) => {
    const one = items.length === 1 ? items[0]! : null;
    if (!one) return null;
    if (!one.enclosed) return t('warn.roomNotEnclosed');
    const tag = (id: string) => {
      const r = doc.rooms.find((x) => x.id === id);
      return r ? `${r.number} · ${name(r.name)}` : '—';
    };
    return one.sharing.length > 0 ? t('warn.roomShared', { rooms: one.sharing.map(tag).join(', ') }) : null;
  },
  dropped: 'fix.droppedRooms',


  valid: (r): r is Room =>
    isObject(r) &&
    typeof r.id === 'string' &&
    typeof r.levelId === 'string' &&
    isPoint(r.seed) &&
    typeof r.name === 'string' &&
    typeof r.number === 'string' &&
    (r.use === undefined || (ROOM_USES as readonly unknown[]).includes(r.use)) &&
    (r.height === undefined || (finite(r.height) && r.height > 0)) &&
    (r.finishes === undefined || (isObject(r.finishes) && (r.finishes.base === undefined || (finite(r.finishes.base) && r.finishes.base >= 0)))),
  derive: (doc, r, g) => {
    const elevation = doc.levels.find((l) => l.id === r.levelId)?.elevation ?? 0;
    const solid = g.rooms.get(r.id) ?? { room: r, enclosed: false, outline: [], area: 0, perimeter: 0, label: r.seed, sharing: [] };
    return { ...solid, elevation };
  },
  element: (s) => s.room,
  outlines: (s) => (s.enclosed ? [s.outline] : []),
  hit: (s, p) => s.enclosed && insideRing(s.outline, p),
  // After the walls and what is on them, before its floor.
  pick: 'last',
  moved: (r, d) => ({ ...r, seed: { x: r.seed.x + d.x, y: r.seed.y + d.y } }),
  mapped: (r, tr, id) => ({ ...r, id, seed: tr.map(r.seed) }),
  // Selected, or going with all its walls (carry.ts: roomsGoingWith): its point goes.
  transformed: (r, c) => (c.selected || c.going(r.id) ? { ...r, id: c.id, seed: c.t.map(r.seed) } : null),
  // A copy numbered on from its level's last, as a new room is.
  copied: (all, r) => ({ ...r, number: nextNumber(all, r.levelId) }),
  similar: (a, b) => a.use === undefined || a.use === b.use,
  plan: (p, s, lit) => {
    if (!s.enclosed || !lit) return;
    const { ctx } = p;
    ctx.beginPath();
    s.outline.forEach((v: Point2, i) => {
      const q = p.toScreen(v);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = p.color('--accent-soft');
    ctx.fill();
  },
  span: (s) => ({ bottom: s.elevation, top: s.elevation }),
  fields: (items, c) =>
    roomFields(items, {
      updateRoom: (id, patch) => c.dispatch(updateRooms([id], patch)),
      updateRooms: (ids, patch) => c.dispatch(updateRooms(ids, patch)),
      levelHeight: (levelId) => c.doc.levels.find((l) => l.id === levelId)?.height ?? 0,
      materials: () => c.doc.materials,
      ...(c.interiorElevations ? { interiorElevations: c.interiorElevations } : {}),
    }),
};
