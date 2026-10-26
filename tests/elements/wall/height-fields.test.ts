// A wall up to the level's ceiling shows how tall it is: the user saw "Pé-direito" and an offset, and
// had to work the height out (test run of 2026-10-25).

import { describe, expect, it } from 'vitest';
import { type DocWall, newDocument } from '../../../src/app/document';
import { wallFields } from '../../../src/elements/wall/fields';
import { fieldStates } from '../../../src/ui/fields';

const wall: DocWall = { id: 'w', wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground' };
const act = { updateWalls: () => {}, setReferenceLine: () => {}, resetToType: () => {}, editType: () => {}, arrangeWalls: () => {}, setEndJoin: () => {}, updateRadius: () => {} };

describe("a wall's height in the panel", () => {
  it("up to the level's ceiling: the level's height plus the offset, as a readout", () => {
    const doc = newDocument();
    const level = doc.levels.find((l) => l.id === 'lvl_ground')!;
    const w = { ...wall, top: { kind: 'level' as const, offset: -0.3 } };
    const state = fieldStates(wallFields({ ...doc, walls: [w] }, act).constraints, [w]).find((s) => s.field.id === 'heightNow')!;
    expect(state.field.kind).toBe('readout');
    expect((state.field as Extract<typeof state.field, { kind: 'readout' }>).text([w])).toBe(`${(level.height - 0.3).toFixed(2)} m`);
  });

  it('with a fixed height there is the height field instead, and no readout', () => {
    const doc = newDocument();
    const w = { ...wall, top: { kind: 'fixed' as const, height: 1.1 } };
    const ids = fieldStates(wallFields({ ...doc, walls: [w] }, act).constraints, [w]).map((s) => s.field.id);
    expect(ids).toContain('topHeight');
    expect(ids).not.toContain('heightNow');
  });
});
