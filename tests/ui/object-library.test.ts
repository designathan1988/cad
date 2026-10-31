// The objects' library (phase 4): searched by name or folder, kept in folders (its own, or its
// category's), each shown by a thumbnail of its plan.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { isDefinition } from '../../src/elements/object/valid';
import { answers, blankDefinition, folderOf, thumbnailSvg } from '../../src/ui/objects-dialog';
import { setLang } from '../../src/i18n/messages';

describe('the objects library', () => {
  const doc = newDocument();

  it('a folder of its own, or its category\'s; the field checked as the file is read', () => {
    setLang('pt');
    const box = blankDefinition(1);
    expect(folderOf(box)).toBe('Genérico');
    const kept = { ...box, folder: 'Cozinha' };
    expect(folderOf(kept)).toBe('Cozinha');
    expect(isDefinition(kept)).toBe(true);
    expect(isDefinition({ ...box, folder: 3 })).toBe(false);
  });

  it('the search: either language\'s name or the folder, accents and case aside', () => {
    setLang('pt');
    const box = { ...blankDefinition(1), name: { pt: 'Mesa de jantar', en: 'Dining table' }, folder: 'Sala' };
    expect(answers(box, '')).toBe(true);
    expect(answers(box, 'MESA')).toBe(true);
    expect(answers(box, 'dining')).toBe(true);
    expect(answers(box, 'sala')).toBe(true);
    expect(answers(box, 'cadeira')).toBe(false);
    expect(answers({ ...box, name: { pt: 'Armário', en: 'Cupboard' } }, 'armario')).toBe(true);
  });

  it('the thumbnail: a 0.6 m box is one square, filled in its material\'s colour, in a square view', () => {
    const svg = thumbnailSvg(blankDefinition(1), doc)!;
    const view = /viewBox="([^"]+)"/.exec(svg)![1]!.split(' ').map(Number);
    // 0.6 m and 8 % on each side.
    expect(view[2]).toBeCloseTo(0.6 * 1.16, 4);
    expect(view[3]).toBeCloseTo(0.6 * 1.16, 4);
    expect((svg.match(/<polygon /g) ?? []).length).toBe(1);
    const wood = doc.materials.find((m) => m.id === 'wood')!;
    expect(svg).toContain(`fill="${wood.color}"`);
    // Every definition the project starts with has one.
    expect(doc.definitions.every((d) => thumbnailSvg(d, doc) !== null)).toBe(true);
  });
});
