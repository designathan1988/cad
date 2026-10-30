// Guides as elements: added, deleted with the selection, cleared per level, moved by the arrows.

import { describe, expect, it } from 'vitest';
import { elementIds, newDocument, type Doc } from '../../../src/project/doc';
import { deriveGeometry } from '../../../src/project/derive';
import { deleteElements } from '../../../src/elements/opening/commands';
import { addGuide, clearGuides } from '../../../src/elements/guide/commands';
import { isGuideId } from '../../../src/elements/guide/schema';
import { nudge } from '../../../src/tools/nudge';

const g = (id: string, levelId = 'lvl_ground') => ({ id, levelId, point: { x: 0, y: 1 }, dir: { x: 1, y: 0 } });
const doc: Doc = { ...newDocument(), levels: [...newDocument().levels, { id: 'up', name: 'Up', elevation: 3, height: 3 }], guides: [g('guide_a'), g('guide_b'), g('guide_c', 'up')] };

describe('guides', () => {
  it('are elements: selectable by id, named by their prefix', () => {
    expect([...elementIds(doc)].filter(isGuideId)).toEqual(['guide_a', 'guide_b', 'guide_c']);
    expect(isGuideId('wall_a')).toBe(false);
  });

  it('one is added as one undo step', () => {
    const next = addGuide(g('guide_d')).apply(doc);
    expect(next.guides.map((x) => x.id)).toEqual(['guide_a', 'guide_b', 'guide_c', 'guide_d']);
    expect(addGuide(g('guide_d')).label).toBe('cmd.addGuide');
  });

  it('deleting the selection takes the selected ones; clearing a level takes all of its own and no other', () => {
    expect(deleteElements(['guide_a']).apply(doc).guides.map((x) => x.id)).toEqual(['guide_b', 'guide_c']);
    expect(clearGuides('lvl_ground').apply(doc).guides.map((x) => x.id)).toEqual(['guide_c']);
    // Nothing to clear: the same document, so no undo step is made of it.
    expect(clearGuides('none').apply(doc)).toBe(doc);
  });

  it('the arrows move a selected guide by the step', () => {
    const next = nudge(doc, deriveGeometry(doc), ['guide_b'], { x: 0, y: 0.05 });
    expect(next.guides.find((x) => x.id === 'guide_b')!.point).toEqual({ x: 0, y: 1.05 });
    expect(next.guides.find((x) => x.id === 'guide_a')).toBe(doc.guides[0]);
  });
});
