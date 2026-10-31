// An opening that does not fit in its wall is shown with its warning but cuts nothing: the wall and
// its joins stay as they are, and no dimension reads negative.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { tempDims } from '../../src/session/temp-dims';
import { newOpening } from '../../src/elements/opening/schema';
import { lid, oid, tid, wid } from '../ids';
import type { WallId } from '../../src/elements/wall/schema';

const wall = (id: WallId, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: tid('wt_concrete20'),
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: lid('lvl_ground'),
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

describe('an opening wider than its wall', () => {
  const walls = [wall(wid('b'), [0, 0], [4, 0]), wall(wid('r'), [4, 0], [4, 3])];
  const plain: Doc = { ...newDocument(), walls };
  const wide: Doc = { ...plain, openings: [{ ...newOpening(oid('o'), wid('b'), 'door', { kind: 'fromStart', distance: 1 }), width: 5 }] };

  it('is flagged, and the walls are exactly as without it, in plan and in 3D', () => {
    const g = deriveGeometry(wide);
    expect(g.openings.get(oid('o'))!.warnings).toContain('openingOutside');
    const p = deriveGeometry(plain);
    for (const id of [wid('b'), wid('r')]) {
      expect(g.solids.get(id)!.pieces).toEqual(p.solids.get(id)!.pieces);
      expect(g.solids.get(id)!.blocks).toEqual(p.solids.get(id)!.blocks);
    }
  });

  it('shows no negative temporary dimension', () => {
    const dims = tempDims(wide, deriveGeometry(wide), new Set(['o']));
    expect(dims.every((d) => d.value >= 0)).toBe(true);
    expect(dims.map((d) => Math.round(d.value * 1e9) / 1e9)).toEqual([1]);
  });
});
