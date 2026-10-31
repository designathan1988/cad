// Annotations and tags (phase 10): a callout's leader, where it leaves its text and how it goes with it;
// and what a room's tag says, as the drawing sets it.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { roomTagText } from '../../src/app/room-tag';
import { DEFAULT_DRAWING, isDrawingSettings } from '../../src/elements/drawing/schema';
import { noteKind } from '../../src/elements/kinds/note';
import { dropLeaders } from '../../src/elements/note/commands';
import { leaderStart, type Note } from '../../src/elements/note/schema';
import { layoutRoomTags } from '../../src/render/room-tags';
import { setLang } from '../../src/i18n/messages';
import { rid } from '../ids';

const callout: Note = { id: 'note_c', levelId: 'lvl_ground', at: { x: 0, y: 0 }, text: 'Ver detalhe', height: 0.25, leader: { x: 3, y: 1 } };

describe('callouts', () => {
  it("the leader leaves the text's box on the way to its point", () => {
    const box = { x0: -1, y0: -0.2, x1: 1, y1: 0.2 };
    // Toward (3, 1): the top (y = 0.2) is reached a fifth of the way there, before the right side (a third).
    const p = leaderStart(box, { x: 3, y: 1 });
    expect(p.x).toBeCloseTo(0.6, 9);
    expect(p.y).toBeCloseTo(0.2, 9);
    // Toward (3, 0.3): the right side first, at x = 1.
    expect(leaderStart(box, { x: 3, y: 0.3 }).x).toBeCloseTo(1, 9);
    // Straight up: the top.
    expect(leaderStart(box, { x: 0, y: 5 })).toEqual({ x: 0, y: 0.2 });
    // A point inside the box: the point itself.
    expect(leaderStart(box, { x: 0.5, y: 0 })).toEqual({ x: 0.5, y: 0 });
  });

  it('moved or turned, its arrow goes along; read from a file, a bad arrow drops the note', () => {
    expect(noteKind.moved(callout, { x: 1, y: 2 }).leader).toEqual({ x: 4, y: 3 });
    const mirrored = noteKind.mapped(callout, { map: (p: { x: number; y: number }) => ({ x: -p.x, y: p.y }), factor: 1, mirror: true } as never, 'note_d');
    expect(mirrored.leader).toEqual({ x: -3, y: 1 });
    expect(noteKind.valid(callout)).toBe(true);
    expect(noteKind.valid({ ...callout, leader: { x: 'a', y: 1 } })).toBe(false);
  });

  it('clicked on its arrow, it is picked; the arrow taken off leaves a plain text', () => {
    expect(noteKind.hit(callout, { x: 2.5, y: 0.85 }, 0.05, 100)).toBe(true);
    expect(noteKind.hit({ ...callout, leader: undefined } as never, { x: 2.5, y: 0.85 }, 0.05, 100)).toBe(false);
    const doc = { ...newDocument(), notes: [callout] };
    const plain = dropLeaders(['note_c']).apply(doc).notes[0]!;
    expect(plain.leader).toBeUndefined();
    expect(plain.text).toBe('Ver detalhe');
    expect(dropLeaders(['note_c']).apply({ ...doc, notes: [plain] }).notes[0]).toBe(plain);
  });
});

describe('room tags', () => {
  const room = { id: rid('room_a'), levelId: 'lvl_ground', seed: { x: 1, y: 1 }, name: 'Sala', number: '3' };
  setLang('pt');

  it('say what the drawing sets: number and name by default, the name, the number, or with the ceiling height', () => {
    expect(roomTagText(room, 30.35, 2.8)).toEqual({ name: '3 · Sala', short: '3', area: '30,35 m²' });
    expect(roomTagText(room, 30.35, 2.8, 'name').name).toBe('Sala');
    expect(roomTagText(room, 30.35, 2.8, 'number')).toEqual({ name: '3', short: '3', area: '' });
    expect(roomTagText(room, 30.35, 2.8, 'numberNameHeight').area).toBe('30,35 m² · pé-direito 2,80 m');
    // A room's own height wins over its level's.
    expect(roomTagText({ ...room, height: 2.6 }, 30.35, 2.8, 'numberNameHeight').area).toContain('2,60');
  });

  it('a tag with nothing on its area line has one line', () => {
    const tags = layoutRoomTags([{ x: 100, y: 100, width: 200, name: '3', short: '3', area: '' }], (s) => s.length * 7, { w: 400, h: 400 });
    expect(tags[0]!.lines).toEqual(['3']);
  });

  it('kept with the drawing settings, checked when read', () => {
    expect(isDrawingSettings({ ...DEFAULT_DRAWING, roomTag: 'name' })).toBe(true);
    expect(isDrawingSettings({ ...DEFAULT_DRAWING, roomTag: 'everything' })).toBe(false);
  });
});
