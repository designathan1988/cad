// Tags by elements (phase 10): their text with the element's values filled in, the leader's end on the
// element, gone with it, and the file.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { newOpening } from '../../src/elements/opening/schema';
import { defaultTagText, type TagSolid } from '../../src/elements/kinds/tag';
import { dropKinds } from '../../src/elements/registry';
import { fillTag, type Tag } from '../../src/elements/tag/schema';
import { readProject, writeProject } from '../../src/io/project-file';
import { setLang } from '../../src/ui/i18n';

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({ id, wallTypeId: 'wt_masonry15', start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, referenceLine: 'centerline', levelId: 'lvl_ground', baseOffset: 0, top: { kind: 'level', offset: 0 } });
// A 4 × 3 m box of 15 cm walls on their centrelines (room 3.85 × 2.85 inside), a window in the south wall.
const doc: Doc = {
  ...newDocument(),
  walls: [wall('wall_s', [0, 0], [4, 0]), wall('wall_e', [4, 0], [4, 3]), wall('wall_n', [4, 3], [0, 3]), wall('wall_w', [0, 3], [0, 0])],
  openings: [{ ...newOpening('opening_1', 'wall_s', 'window', { kind: 'centered' }, { width: 1.2, height: 1 }), sill: 1 }],
  rooms: [{ id: 'room_1', levelId: 'lvl_ground', seed: { x: 2, y: 1.5 }, name: 'Sala', number: '1', use: 'living' }],
};
const tag = (id: string, target: string, at: { x: number; y: number }, text: string): Tag => ({ id, levelId: 'lvl_ground', target, at, text });
const shown = (d: Doc, id: string) => deriveGeometry(d).kinds.get('tags')!.get(id) as TagSolid;

describe('tags', () => {
  it('values in braces, in either language; one the element has not reads "—"; an unknown word stays', () => {
    expect(fillTag('{nome} · {AREA}', { name: 'Sala', area: '12,00 m²' })).toBe('Sala · 12,00 m²');
    expect(fillTag('{largura} {cor}', {})).toBe('— {cor}');
  });

  it('a room, a wall and a window, each with its own values', () => {
    setLang('pt');
    const d: Doc = {
      ...doc,
      tags: [tag('tag_r', 'room_1', { x: 2, y: 1 }, defaultTagText('room_1')), tag('tag_w', 'wall_n', { x: 2, y: 4 }, defaultTagText('wall_n')), tag('tag_o', 'opening_1', { x: 2, y: -1 }, defaultTagText('opening_1'))],
    };
    expect(shown(d, 'tag_r').text).toBe('1 Sala · 10,97 m²');
    expect(shown(d, 'tag_w').text).toBe('Alvenaria 15 cm · 4,00');
    expect(shown(d, 'tag_o').text).toBe('1,20 × 1,00');
    // The wall's leader ends on its line, under the text; the window's at its middle.
    expect(shown(d, 'tag_w').anchor).toEqual({ x: expect.closeTo(2, 9), y: expect.closeTo(3, 9) });
    expect(shown(d, 'tag_o').anchor).toEqual({ x: expect.closeTo(2, 9), y: expect.closeTo(0, 9) });
  });

  it('any other element: its name, the leader to the nearest of the lines its kind draws', () => {
    setLang('pt');
    const d: Doc = {
      ...doc,
      floors: [{ id: 'floor_x', levelId: 'lvl_ground', source: { kind: 'outline', points: [{ x: 6, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 2 }, { x: 6, y: 2 }] }, thickness: 0.1, offset: 0 }],
      tags: [tag('tag_f', 'floor_x', { x: 9, y: 3 }, '{nome}')],
    };
    expect(shown(d, 'tag_f').text).toBe('Piso');
    expect(shown(d, 'tag_f').anchor).toEqual({ x: expect.closeTo(8, 9), y: expect.closeTo(2, 9) });
  });

  it('it follows its element and goes with it; the file keeps it', () => {
    const d: Doc = { ...doc, tags: [tag('tag_w', 'wall_n', { x: 2, y: 4 }, '{comprimento}')] };
    const longer: Doc = { ...d, walls: d.walls.map((w) => (w.id === 'wall_n' ? { ...w, start: { x: 5, y: 3 } } : w)) };
    expect(shown(longer, 'tag_w').text).toBe('5,00');
    expect(dropKinds(d, new Set(['wall_n']), deriveGeometry(d)).tags).toEqual([]);
    const r = readProject(writeProject(d));
    expect(r.ok && r.doc.tags).toEqual(d.tags);
  });
});
