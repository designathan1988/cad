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

describe('room tags and the temporary dimensions', () => {
  it('a tag that would cover a dimension value moves just below it; with no room there, above it', () => {
    const value = { x: 380, y: 290, w: 40, h: 20 };
    const [t] = layoutRoomTags([tag(400, 300, 200)], measure, view, [value]);
    expect(t!.box.y).toBeGreaterThanOrEqual(value.y + value.h);
    const nearBottom = layoutRoomTags([tag(400, 590, 200)], measure, view, [{ x: 380, y: 580, w: 40, h: 20 }]);
    expect(nearBottom[0]!.box.y + nearBottom[0]!.box.h).toBeLessThanOrEqual(580);
  });

  // A room 60 px wide and 50 px deep on screen (a 0.75 m closet): the tag, number and area, is 57 × 32.
  // Below the value (y 312 to 344) it would pass the room's bottom at 330, above it (256 to 288) its top
  // at 280: it sat on the wall.
  const value = { x: 380, y: 290, w: 40, h: 20 };
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];

  it('a tag moved off a value stays inside its room: in a closet with no room for it, it is left out', () => {
    const closet = { ...tag(400, 300, 60), outline: rect(370, 280, 430, 330) };
    expect(layoutRoomTags([closet], measure, view, [value])).toEqual([]);
  });

  it('in a room deep enough, the tag goes below the value, inside the room', () => {
    const deep = { ...tag(400, 300, 80), outline: rect(360, 250, 440, 400) };
    const [t] = layoutRoomTags([deep], measure, view, [value]);
    expect(t!.box.y).toBeGreaterThanOrEqual(value.y + value.h);
    expect(t!.box.y + t!.box.h).toBeLessThanOrEqual(400);
  });

  it('with the room only above the value, the tag goes above', () => {
    const shallow = { ...tag(400, 300, 80), outline: rect(360, 240, 440, 320) };
    const [t] = layoutRoomTags([shallow], measure, view, [value]);
    expect(t!.box.y + t!.box.h).toBeLessThanOrEqual(value.y);
    expect(t!.box.y).toBeGreaterThanOrEqual(240);
  });
});
