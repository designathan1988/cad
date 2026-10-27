// Curtain walls: the grid's lines by each way of dividing, the frame and panels built from them, and the
// element read back from a file.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { curtainSolid } from '../../src/elements/curtain/geometry';
import { type Curtain, CURTAIN_DEFAULTS, gridLines } from '../../src/elements/curtain/schema';
import { updateCurtains } from '../../src/elements/curtain/commands';
import { readProject, writeProject } from '../../src/io/project-file';

const curtain: Curtain = { id: 'curtain_c', levelId: 'lvl_ground', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, ...CURTAIN_DEFAULTS };

describe('a curtain wall grid', () => {
  it('divides by a fixed distance (the rest at the end), a number, or a largest spacing', () => {
    expect(gridLines({ mode: 'spacing', value: 1.5 }, 4)).toEqual([0, 1.5, 3, 4]);
    expect(gridLines({ mode: 'count', value: 4 }, 4)).toEqual([0, 1, 2, 3, 4]);
    expect(gridLines({ mode: 'max', value: 1.5 }, 4).length - 1).toBe(3);
    // A remainder under 1 cm is no panel.
    expect(gridLines({ mode: 'spacing', value: 1 }, 3.005)).toEqual([0, 1, 2, 3.005]);
  });

  it('builds a mullion on each vertical line, a transom on each horizontal one, a panel in each cell', () => {
    const s = curtainSolid(curtain, 2.8, 0);
    // 4 m at 1.50 at most: 3 panels across; 2 up.
    expect(s.verticals).toHaveLength(4);
    expect(s.horizontals).toHaveLength(3);
    expect(s.panels).toHaveLength(6);
    expect(s.frame).toHaveLength(4 + 3 * 3);
    expect(s.top - s.bottom).toBeCloseTo(2.8, 9);
    // Nothing of it outside its line's length or its height.
    for (const b of [...s.frame, ...s.panels]) {
      for (const p of b.polygon) expect(p.x).toBeGreaterThanOrEqual(-1e-9), expect(p.x).toBeLessThanOrEqual(4 + 1e-9);
      expect(b.bottom).toBeGreaterThanOrEqual(-1e-9);
      expect(b.top).toBeLessThanOrEqual(2.8 + 1e-9);
    }
  });

  it('changes by command, refusing a grid that divides by nothing; reads back from a file', () => {
    const doc = { ...newDocument(), curtains: [curtain] };
    expect(updateCurtains(['curtain_c'], { vertical: { mode: 'count', value: 0 } }).apply(doc)).toBe(doc);
    const next = updateCurtains(['curtain_c'], { horizontal: { mode: 'count', value: 3 }, panel: 'opaque' }).apply(doc);
    expect(next.curtains[0]).toMatchObject({ horizontal: { mode: 'count', value: 3 }, panel: 'opaque' });
    const back = readProject(writeProject(next));
    expect(back.ok && back.doc.curtains).toEqual(next.curtains);
    const bad = readProject(JSON.stringify({ ...doc, curtains: [{ ...curtain, vertical: { mode: 'odd', value: 1 } }] }));
    expect(bad.ok && bad.fixes).toEqual([{ kind: 'droppedCurtains', count: 1 }]);
  });
});
