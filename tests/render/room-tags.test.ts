// Room tags in plan: they follow their room (never pinned to the edge of the canvas), shrink to the
// number when the room is too narrow on screen, and are left out rather than drawn over another.

import { describe, expect, it } from 'vitest';
import { layoutRoomTags } from '../../src/render/room-tags';

const measure = (text: string) => text.length * 7;
const view = { w: 800, h: 600 };
const tag = (x: number, y: number, width: number, name = '2 · Cômodo 2', short = '2', area = '5,56 m²') => ({ x, y, width, name, short, area });

describe('room tags', () => {
  it('a room wide enough on screen shows its name and area, centred on its point', () => {
    const [t] = layoutRoomTags([tag(400, 300, 200)], measure, view);
    expect(t).toMatchObject({ lines: ['2 · Cômodo 2', '5,56 m²'], x: 400 });
  });

  it('a room narrower than its name shows the number and area; narrower still, the number only', () => {
    expect(layoutRoomTags([tag(400, 300, 70)], measure, view)[0]!.lines).toEqual(['2', '5,56 m²']);
    expect(layoutRoomTags([tag(400, 300, 30)], measure, view)[0]!.lines).toEqual(['2']);
  });

  it('a room whose point is off the canvas has no tag (not one pinned to the edge)', () => {
    expect(layoutRoomTags([tag(-40, 300, 200), tag(400, 700, 200)], measure, view)).toEqual([]);
  });

  it('a tag that would cover one already placed is left out', () => {
    const tags = layoutRoomTags([tag(400, 300, 200), tag(430, 305, 200, '5 · Sala', '5', '12,00 m²')], measure, view);
    expect(tags.map((t) => t.lines[0])).toEqual(['2 · Cômodo 2']);
  });
});
