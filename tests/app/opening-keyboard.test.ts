// A door or window without the pointer (the tester's K2): with a wall selected, the tool aims at its
// middle (aimAlong); a typed distance then places the opening that far from the nearer end, Enter
// places it centred.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { aimAlong, OPENING_PREVIEW_ID } from '../../src/elements/opening/aim';
import { openingTransition, ruleAt } from '../../src/elements/opening/tool';

const wall: DocWall = { id: 'w', wallTypeId: 'wt_concrete20', start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground' };
const doc: Doc = { ...newDocument(), walls: [wall] };

describe('placing an opening by keyboard', () => {
  const aim = aimAlong(doc, deriveGeometry(doc), 'w', 2.5, 0.01, OPENING_PREVIEW_ID)!;

  it('aims at the middle of the selected wall: centred', () => {
    expect(aim).toMatchObject({ wallId: 'w', length: 5, station: 2.5 });
    expect(ruleAt(aim, 0.9)).toEqual({ kind: 'centered' });
  });

  it('a typed 1 places it 1 m from the start; Enter (a click there) places it centred', () => {
    const state = { kind: 'aiming' as const, aim, rule: ruleAt(aim, 0.9) };
    expect(openingTransition(state, { kind: 'typed', distance: 1 }, 0.9).place?.rule).toEqual({ kind: 'fromStart', distance: 1 });
    expect(openingTransition(state, { kind: 'click' }, 0.9).place?.rule).toEqual({ kind: 'centered' });
  });

  it('a wall that is not there gives no aim', () => {
    expect(aimAlong(doc, deriveGeometry(doc), 'gone', 1, 0.01, OPENING_PREVIEW_ID)).toBeNull();
  });
});
