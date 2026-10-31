// Zones in the registry (contract.ts): elements/zone holds the element. Derived from its rooms as they
// are: their outlines, their area. Drawn under everything as a tint of its colour over its rooms, its
// name and area under the first room's name; picked by that tag only, so a click on a room is the room's.

import { isObject } from '../../core/guards';
import type { Point2 } from '../../model/vector';
import { name as said, t } from '../../i18n/messages';
import { areaText } from '../../i18n/units';
import type { ElementKind } from '../contract';
import { isColor } from '../material/schema';
import { updateZones } from '../zone/commands';
import { ZONE_CATEGORIES, ZONE_COLOURS, ZONE_PREFIX, type Zone, type ZoneCategory } from '../zone/schema';
import type { RoomSolid } from '../room/derive';
import { trace } from './paint';

export interface ZoneSolid {
  readonly zone: Zone;
  readonly outlines: readonly (readonly Point2[])[];
  readonly area: number;
  /** Where its tag goes: under its first room's name. */
  readonly label: Point2;
}

/** How near its tag a click takes it (m). */
const TAG = 0.35;

export const zoneKind: ElementKind<Zone, ZoneSolid> = {
  key: 'zones',
  prefix: ZONE_PREFIX,
  category: 'rooms',
  layer: 'under',
  icon: 'room',
  one: 'zone.title',
  many: 'zone.titleMany',
  dropped: 'fix.droppedZones',


  valid: (z): z is Zone =>
    isObject(z) &&
    typeof z.id === 'string' &&
    typeof z.levelId === 'string' &&
    typeof z.name === 'string' &&
    typeof z.category === 'string' &&
    (ZONE_CATEGORIES as readonly string[]).includes(z.category) &&
    isColor(z.color) &&
    Array.isArray(z.rooms) &&
    z.rooms.every((r: unknown) => typeof r === 'string'),
  derive: (_doc, z, g) => {
    const rooms = z.rooms.map((id) => g.rooms.get(id)).filter((r): r is RoomSolid => r !== undefined && r.enclosed);
    if (rooms.length === 0) return null;
    const first = rooms[0]!;
    return { zone: z, outlines: rooms.map((r) => r.outline), area: rooms.reduce((s, r) => s + r.area, 0), label: { x: first.label.x, y: first.label.y - 0.55 } };
  },
  element: (s) => s.zone,
  outlines: (s) => s.outlines,
  hit: (s, p) => Math.abs(p.x - s.label.x) <= TAG * 2 && Math.abs(p.y - s.label.y) <= TAG / 2,
  pick: 'afterWalls',
  // It goes with its rooms; alone it has nothing of its own to move.
  moved: (z) => z,
  mapped: (z, _t, id) => ({ ...z, id }),
  // Its rooms deleted leave it; the last one takes it along. Kept with them, a zone of no room stayed in the
  // file, drawn nowhere and impossible to pick or delete.
  shed: (z, deleted) => {
    const rooms = z.rooms.filter((r) => !deleted.has(r));
    return rooms.length === 0 ? null : rooms.length === z.rooms.length ? z : { ...z, rooms };
  },
  similar: (a, b) => a.category === b.category,
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.globalAlpha = lit ? 0.35 : 0.18;
    ctx.fillStyle = s.zone.color;
    for (const o of s.outlines) {
      trace(p, o);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const at = p.toScreen(s.label);
    ctx.font = `${lit ? 'bold ' : ''}11px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = lit ? p.color('--wall-sel') : p.color('--text-2');
    ctx.fillText(`${said(s.zone.name)} · ${areaText(s.area)}`, at.x, at.y);
    ctx.restore();
  },
  fields: (items, { dispatch }) => {
    const ids = items.map((s) => s.zone.id);
    const one = items.length === 1;
    return [
      { id: 'name', label: 'zone.name', kind: 'text', when: () => one, get: (s) => said(s.zone.name), set: (v) => dispatch(updateZones(ids, { name: v })) },
      {
        id: 'zoneCategory',
        label: 'zone.category',
        kind: 'select',
        icon: 'tag',
        options: ZONE_CATEGORIES.map((c) => ({ value: c, label: t(`zone.cat.${c}`) })),
        get: (s) => s.zone.category,
        // A category brings its colour.
        set: (v) => dispatch(updateZones(ids, { category: v as ZoneCategory, color: ZONE_COLOURS[v as ZoneCategory] })),
      },
      { id: 'zoneRooms', label: 'zone.rooms', kind: 'readout', icon: 'room', text: (xs) => String(xs.reduce((n, s) => n + s.outlines.length, 0)) },
      { id: 'area', label: 'room.area', kind: 'readout', text: (xs) => areaText(xs.reduce((a, s) => a + s.area, 0)) },
    ];
  },
};

