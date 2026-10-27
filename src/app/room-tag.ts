// What a room's tag says in plan and on paper (phase 10, "etiquetas"): as the drawing sets it
// (elements/drawing/schema.ts, roomTag), its number and name, its name, its number, or its number and
// name with its ceiling height; its area under it but for the number alone.

import type { RoomTagContent } from '../elements/drawing/schema';
import type { Room } from '../elements/room/schema';
import { name, t } from '../ui/i18n';
import { areaText, lengthText } from '../ui/units';

/** Its two lines, and what is left of the first when the room is narrow: its number. */
export function roomTagText(room: Room, area: number, levelHeight: number, content: RoomTagContent = 'numberName'): { name: string; short: string; area: string } {
  const both = `${room.number} · ${name(room.name)}`;
  switch (content) {
    case 'name':
      return { name: name(room.name), short: room.number, area: areaText(area) };
    case 'number':
      return { name: room.number, short: room.number, area: '' };
    case 'numberNameHeight':
      return { name: both, short: room.number, area: `${areaText(area)} · ${t('room.tagHeight', { h: lengthText(room.height ?? levelHeight) })}` };
    default:
      return { name: both, short: room.number, area: areaText(area) };
  }
}
