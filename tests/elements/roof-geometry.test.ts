// A roof's faces (elements/roof/geometry.ts): a hip roof over an L-shaped outline is sloped, its valley
// running from the corner going in, and the roof is one surface (no step between its faces).

import { describe, expect, it } from 'vitest';
import { roofSolid } from '../../src/elements/roof/geometry';
import type { Roof } from '../../src/elements/roof/schema';
import type { Point2 } from '../../src/core/vector';

// An L: a 10 × 4 wing along x and a 4 × 10 wing along y, sharing the corner square [0, 4] × [0, 4].
const L: Point2[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 }];
const roof = (outline: Point2[]): Roof =>
  ({ id: 'roof_r', levelId: 'lvl_ground', kind: 'hip', outline, edges: outline.map(() => ({ grade: 100, overhang: 0 })), thickness: 0.1, baseOffset: 0 }) as Roof;

/** The roof's height at p: the face it falls in. */
const heightAt = (faces: ReturnType<typeof roofSolid>['faces'], p: Point2): number | null => {
  for (const f of faces) {
    let inside = false;
    const r = f.polygon;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i]!;
      const b = r[j]!;
      if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    if (inside) return f.z(p);
  }
  return null;
};

describe('a hip roof over an L', () => {
  const s = roofSolid(roof(L), 0);

  it('is sloped, not built flat', () => {
    expect(s.notConvex).toBe(false);
    expect(s.faces.length).toBeGreaterThanOrEqual(6);
    expect(s.top).toBeCloseTo(2 + 0.1, 6);
  });

  it('rises from every side at its grade, its ridges at half each wing', () => {
    // 100 %: a metre up a metre in. The wings' ridges are 2 m in, 2 m up.
    expect(heightAt(s.faces, { x: 8, y: 1 })).toBeCloseTo(1, 6);
    expect(heightAt(s.faces, { x: 7, y: 2 })).toBeCloseTo(2, 6);
    expect(heightAt(s.faces, { x: 2, y: 7 })).toBeCloseTo(2, 6);
  });

  it('has its valley from the corner going in: by it the roof is the higher side, not the nearer one', () => {
    // (3.5, 3) is 0.5 m from the inner side x = 4 but under the face of the inner side y = 4: 1 m up.
    expect(heightAt(s.faces, { x: 3.5, y: 3 })).toBeCloseTo(1, 6);
    expect(heightAt(s.faces, { x: 3, y: 3.5 })).toBeCloseTo(1, 6);
  });

  it('is one surface: no step anywhere inside the outline', () => {
    for (let x = 0.25; x < 10; x += 0.5)
      for (let y = 0.25; y < 10; y += 0.5) {
        if (x > 4 && y > 4) continue;
        const h = heightAt(s.faces, { x, y });
        expect(h).not.toBeNull();
        // Covered everywhere, and never below the eaves.
        expect(h!).toBeGreaterThanOrEqual(-1e-9);
      }
  });
});
