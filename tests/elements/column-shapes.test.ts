// A column's section by its shape, and its top up to another level.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { updateColumns } from '../../src/elements/column/commands';
import { type Column, columnOutline } from '../../src/elements/column/schema';
import type { ColumnSolid } from '../../src/elements/kinds/column';
import { signedArea } from '../../src/elements/wall/geometry/convex';
import { lid, xid } from '../ids';

const column = (extra: Partial<Column> = {}): Column => ({ id: xid('column_c'), levelId: lid('lvl_ground'), at: { x: 0, y: 0 }, width: 0.4, depth: 0.25, angle: 0, ...extra });

describe('column sections', () => {
  it('each is counter-clockwise, with its area: rectangle, ellipse, I, H and L', () => {
    const area = (c: Column) => signedArea(columnOutline(c));
    expect(area(column())).toBeCloseTo(0.1, 9);
    expect(area(column({ shape: 'round' }))).toBeCloseTo(Math.PI * 0.2 * 0.125, 2);
    const t = 0.015;
    // Two flanges across the width, a web along the depth between them.
    expect(area(column({ shape: 'I' }))).toBeCloseTo(2 * 0.4 * t + t * (0.25 - 2 * t), 9);
    expect(area(column({ shape: 'H' }))).toBeCloseTo(2 * 0.25 * t + t * (0.4 - 2 * t), 9);
    expect(area(column({ shape: 'L' }))).toBeCloseTo(0.4 * t + t * (0.25 - t), 9);
  });

  it('goes up to another level and its offset; back to its own level, the field goes', () => {
    const doc = { ...newDocument(), levels: [...newDocument().levels, { id: lid('lvl_up'), name: 'Up', elevation: 3, height: 2.8 }], columns: [column({ topLevelId: 'lvl_up', topOffset: 1 })] };
    const s = deriveGeometry(doc).kinds.get('columns')!.get('column_c') as ColumnSolid;
    expect(s.top).toBeCloseTo(4, 9);
    const back = updateColumns(['column_c'], { topLevelId: null }).apply(doc);
    expect(back.columns[0]).not.toHaveProperty('topLevelId');
    expect(updateColumns(['column_c'], { plate: 0 }).apply(doc)).toBe(doc);
  });
});
