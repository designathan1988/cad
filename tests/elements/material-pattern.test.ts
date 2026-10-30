// Materials' surface patterns (phase 8): one period of each layout is covered by its pieces once, no
// piece over another; a pattern out of range is refused by the file and by the command; an older
// file's built-in tiles, wood and brick get the patterns they have now.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { updateMaterial } from '../../src/elements/material/commands';
import { isPattern, PATTERN_DEFAULTS, PATTERN_LAYOUTS, patternPieces, type SurfacePattern } from '../../src/elements/material/pattern';
import { isMaterial, readProject } from '../../src/project/file';

/**
 * How many pieces cover each of a grid of points over one period (pieces across its edge wrapped
 * round). The points are off the middle of their cells: in the middle, some fell on a piece's edge.
 */
function coverage(p: SurfacePattern, steps = 97): number[] {
  const { period, pieces } = patternPieces(p);
  const counts: number[] = [];
  for (let a = 0; a < steps; a++) {
    for (let b = 0; b < steps; b++) {
      const u = ((a + 0.37) / steps) * period.u;
      const v = ((b + 0.41) / steps) * period.v;
      let n = 0;
      for (const q of pieces) {
        const du = (((u - q.u) % period.u) + period.u) % period.u;
        const dv = (((v - q.v) % period.v) + period.v) % period.v;
        if (du < q.w && dv < q.h) n++;
      }
      counts.push(n);
    }
  }
  return counts;
}

describe('surface patterns', () => {
  for (const layout of PATTERN_LAYOUTS) {
    for (const kind of ['tiles', 'wood', 'brick'] as const) {
      it(`${kind} laid ${layout} with no joint cover the period once, no piece over another`, () => {
        const p: SurfacePattern = { ...PATTERN_DEFAULTS[kind], layout, joint: 0 };
        expect(new Set(coverage(p))).toEqual(new Set([1]));
      });
    }
  }

  it('with a joint, the pieces leave it uncovered and still never overlap', () => {
    for (const layout of PATTERN_LAYOUTS) {
      const counts = coverage({ ...PATTERN_DEFAULTS.tiles, layout, length: 0.3, width: 0.1, joint: 0.02 });
      expect(Math.max(...counts)).toBe(1);
      expect(counts.filter((n) => n === 0).length).toBeGreaterThan(0);
    }
  });

  it("a herringbone's pieces are a whole number of widths long, and it repeats every two lengths", () => {
    const { period, pieces } = patternPieces({ ...PATTERN_DEFAULTS.wood, layout: 'herringbone', length: 0.5, width: 0.1, joint: 0 });
    expect(period).toEqual({ u: 1, v: 1 });
    expect(pieces).toHaveLength(20);
    expect(new Set(pieces.map((q) => `${Math.round(q.w * 100)}x${Math.round(q.h * 100)}`))).toEqual(new Set(['50x10', '10x50']));
  });

  it('a chequerboard alternates its colours, the others never', () => {
    expect(patternPieces({ ...PATTERN_DEFAULTS.tiles, layout: 'checker' }).pieces.filter((q) => q.alt)).toHaveLength(8);
    expect(patternPieces(PATTERN_DEFAULTS.tiles).pieces.some((q) => q.alt)).toBe(false);
  });

  it('a pattern out of range is refused', () => {
    expect(isPattern(PATTERN_DEFAULTS.brick)).toBe(true);
    expect(isPattern({ ...PATTERN_DEFAULTS.brick, length: 0 })).toBe(false);
    expect(isPattern({ ...PATTERN_DEFAULTS.brick, joint: 0.2 })).toBe(false);
    expect(isPattern({ ...PATTERN_DEFAULTS.brick, layout: 'diagonal' })).toBe(false);
    expect(isPattern({ ...PATTERN_DEFAULTS.brick, jointColor: 'grey' })).toBe(false);
    expect(isPattern({ ...PATTERN_DEFAULTS.brick, variation: 2 })).toBe(false);
    const tile = newDocument().materials.find((m) => m.id === 'tile')!;
    expect(isMaterial(tile)).toBe(true);
    expect(isMaterial({ ...tile, pattern: { ...tile.pattern, width: -1 } })).toBe(false);
  });

  it('the command sets, changes and takes off a pattern, and refuses one out of range', () => {
    const doc = newDocument();
    const plaster = () => (d: typeof doc) => d.materials.find((m) => m.id === 'plaster')!;
    const set = updateMaterial('plaster', { pattern: PATTERN_DEFAULTS.tiles }).apply(doc);
    expect(plaster()(set).pattern).toEqual(PATTERN_DEFAULTS.tiles);
    const turned = updateMaterial('plaster', { pattern: { ...PATTERN_DEFAULTS.tiles, angle: 45 } }).apply(set);
    expect(plaster()(turned).pattern?.angle).toBe(45);
    expect(updateMaterial('plaster', { pattern: { ...PATTERN_DEFAULTS.tiles, joint: 1 } }).apply(set)).toBe(set);
    const off = updateMaterial('plaster', { pattern: null }).apply(turned);
    expect('pattern' in plaster()(off)).toBe(false);
    // Other changes leave the pattern as it is.
    expect(plaster()(updateMaterial('plaster', { roughness: 0.5 }).apply(set)).pattern).toEqual(PATTERN_DEFAULTS.tiles);
  });

  it("an older file's built-in tiles, wood and brick get their patterns; one it made keeps none", () => {
    const doc = newDocument();
    const plain = doc.materials.map(({ pattern: _p, ...m }) => m);
    const mine = { id: 'mat_mine', name: 'Mine', color: '#123456', roughness: 0.5, metalness: 0, cut: 'solid' as const };
    const r = readProject(JSON.stringify({ ...doc, version: 29, materials: [...plain, mine] }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const of = (id: string) => r.doc.materials.find((m) => m.id === id)?.pattern;
    expect(of('tile')).toEqual(PATTERN_DEFAULTS.tiles);
    expect(of('wood')).toEqual(PATTERN_DEFAULTS.wood);
    expect(of('brick')).toEqual(PATTERN_DEFAULTS.brick);
    expect(of('plaster')).toBeUndefined();
    expect(of('mat_mine')).toBeUndefined();
    // A current file keeps a built-in one's pattern taken off.
    const now = readProject(JSON.stringify({ ...doc, materials: plain }));
    expect(now.ok && now.doc.materials.find((m) => m.id === 'tile')?.pattern).toBeUndefined();
  });
});
