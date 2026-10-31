// A beam's section (a rectangle or an I) and its top at each end: sloping when they differ.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { deriveGeometry } from '../../src/project/derive';
import { type Beam, beamSection } from '../../src/elements/beam/schema';
import { beamKind, type BeamSolid } from '../../src/elements/kinds/beam';
import { lid } from '../ids';

const beam = (extra: Partial<Beam> = {}): Beam => ({ id: 'beam_b', levelId: lid('lvl_ground'), start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, width: 0.15, depth: 0.4, ...extra });

describe('beams', () => {
  it("an I's section is its flanges and web, inside its width and depth", () => {
    const s = beamSection(beam({ shape: 'I' }));
    expect(s).toHaveLength(12);
    for (const [a, u] of s) {
      expect(Math.abs(a)).toBeLessThanOrEqual(0.075 + 1e-12);
      expect(u).toBeGreaterThanOrEqual(-0.4 - 1e-12);
      expect(u).toBeLessThanOrEqual(0);
    }
  });

  it('slopes when its end is set higher: its solid rises from the start top to the end top', () => {
    const doc = { ...newDocument(), beams: [beam({ endOffset: 0.6 })] };
    const s = deriveGeometry(doc).kinds.get('beams')!.get('beam_b') as BeamSolid;
    expect(s.startTop).toBeCloseTo(2.8, 9);
    expect(s.endTop).toBeCloseTo(3.4, 9);
    expect(s.bottom).toBeCloseTo(2.4, 9);
    const made = beamKind.solid!(s);
    const g = (Array.isArray(made) ? made[0]! : made)!.geometry;
    const pos = g.getAttribute('position');
    // At x = 0 the top is 2.8; at x = 4, 3.4 (three.js y is the height).
    const topAt = (x: number) => Math.max(...Array.from({ length: pos.count }, (_, i) => i).filter((i) => Math.abs(pos.getX(i) - x) < 1e-6).map((i) => pos.getY(i)));
    expect(topAt(0)).toBeCloseTo(2.8, 5);
    expect(topAt(4)).toBeCloseTo(3.4, 5);
  });
});
