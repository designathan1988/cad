// Angular, radius, diameter, arc length and coordinate dimensions (phase 10): the values against hand
// sums, an arc wall's held measure following the wall, the tool's pick of an arc wall, the file.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/project/doc';
import { measureDxfText, measureKind, type MeasureSolid, measureText } from '../../src/elements/kinds/measure';
import { deriveGeometry } from '../../src/project/derive';
import { dropKinds } from '../../src/elements/registry';
import { arcWallAt, placeMeasure } from '../../src/elements/measure/place';
import { angleBetween, type Measure } from '../../src/elements/measure/schema';
import { readProject, writeProject } from '../../src/project/file';
import { setLang } from '../../src/i18n/messages';

// A half circle of 2 m radius on its reference line (the centreline), from (0, 0) to (4, 0): bulge tan(π/4).
const arcWall: DocWall = { id: 'w_arc', levelId: 'lvl_ground', wallTypeId: 'wt_masonry15', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline', bulge: 1 };
const doc: Doc = { ...newDocument(), walls: [arcWall] };
const held = (type: 'radius' | 'diameter' | 'arc', face: 'exterior' | 'reference' | 'interior' = 'reference'): Measure => ({ id: 'meas_1', levelId: 'lvl_ground', type, wallId: 'w_arc', face, t: 0.5 });

describe('measures', () => {
  it('an angle between two arms, the smaller, in degrees', () => {
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 2 })).toBeCloseTo(90, 9);
    expect(angleBetween({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: -1 })).toBeCloseTo(135, 9);
    const at = placeMeasure(doc, { id: 'meas_a', levelId: 'lvl_ground', type: 'angle', vertex: { x: 0, y: 0 }, a: { x: 1, y: 0 }, b: { x: 1, y: -1 }, radius: 0.5 })!;
    // From the first arm to the second the short way: clockwise, 45°.
    expect(at.type === 'angle' && [at.value, at.sweep]).toEqual([expect.closeTo(45, 9), expect.closeTo(-Math.PI / 4, 9)]);
  });

  it('an arc wall: radius, diameter and length at its reference line and its faces', () => {
    const r = placeMeasure(doc, held('radius'))!;
    expect(r.type === 'radius' && r.value).toBeCloseTo(2, 9);
    expect(placeMeasure(doc, held('diameter'))!.type === 'diameter' && (placeMeasure(doc, held('diameter')) as { value: number }).value).toBeCloseTo(4, 9);
    expect((placeMeasure(doc, held('arc')) as { value: number }).value).toBeCloseTo(2 * Math.PI, 9);
    // The faces 7.5 cm either side of the centreline.
    const faces = [held('radius', 'exterior'), held('radius', 'interior')].map((m) => (placeMeasure(doc, m) as { value: number }).value).sort();
    expect(faces[0]).toBeCloseTo(1.925, 9);
    expect(faces[1]).toBeCloseTo(2.075, 9);
  });

  it('held by the wall: it follows a new bulge, and is gone with the wall or when it is straight', () => {
    // A quarter circle on the same chord: radius 4 / (2·sin 45°) = 2.828.
    const quarter: Doc = { ...doc, walls: [{ ...arcWall, bulge: Math.tan(Math.PI / 8) }] };
    expect((placeMeasure(quarter, held('radius')) as { value: number }).value).toBeCloseTo(4 / (2 * Math.sin(Math.PI / 4)), 9);
    expect(placeMeasure({ ...doc, walls: [{ ...arcWall, bulge: 0 }] }, held('radius'))).toBeNull();
    expect(placeMeasure({ ...doc, walls: [] }, held('radius'))).toBeNull();
  });

  it('deleting its wall deletes it; an angle stays', () => {
    const angle: Measure = { id: 'meas_a', levelId: 'lvl_ground', type: 'angle', vertex: { x: 0, y: 0 }, a: { x: 1, y: 0 }, b: { x: 0, y: 1 }, radius: 0.5 };
    const before: Doc = { ...doc, measures: [held('radius'), angle] };
    const after = dropKinds(before, new Set(['w_arc']), deriveGeometry(before));
    expect(after.measures.map((m) => m.id)).toEqual(['meas_a']);
  });

  it('derived again when only its wall changes (no cache by the measure alone)', () => {
    const value = (d: Doc) => ((deriveGeometry(d).kinds.get('measures')!.get('meas_1') as MeasureSolid).at as { value: number }).value;
    const withMeasure: Doc = { ...doc, measures: [held('radius')] };
    expect(value(withMeasure)).toBeCloseTo(2, 9);
    expect(value({ ...withMeasure, walls: [{ ...arcWall, bulge: Math.tan(Math.PI / 8) }] })).toBeCloseTo(4 / (2 * Math.sin(Math.PI / 4)), 9);
  });

  it('the tool finds the arc wall under a click, at the line nearest it, and how far along', () => {
    // The top of the half circle: (2, -2) or (2, 2) depending on the side it bulges to; one of them is on it.
    const top = [{ x: 2, y: -2 }, { x: 2, y: 2 }].find((p) => arcWallAt(doc, 'lvl_ground', p, 0.05))!;
    const hit = arcWallAt(doc, 'lvl_ground', top, 0.05)!;
    expect(hit.wallId).toBe('w_arc');
    expect(hit.face).toBe('reference');
    expect(hit.t).toBeCloseTo(0.5, 9);
    // On the outer face, 7 cm out: that face.
    const out = { x: top.x, y: top.y * (2.07 / 2) };
    expect(arcWallAt(doc, 'lvl_ground', out, 0.05)!.face).not.toBe('reference');
    expect(arcWallAt(doc, 'lvl_ground', { x: 2, y: 0 }, 0.05)).toBeNull();
  });

  it('what each says, and the file keeps them', () => {
    setLang('pt');
    expect(measureText(placeMeasure(doc, held('radius'))!)).toBe('R 2,00');
    expect(measureText(placeMeasure(doc, held('diameter'))!)).toBe('Ø 4,00');
    expect(measureText({ type: 'coord', at: { x: 3.25, y: -1.5 }, label: { x: 4, y: 0 } })).toBe('x 3,25 · y -1,50');
    // A coordinate is picked anywhere along its text, which runs right from where it was put.
    const c0: MeasureSolid = { m: { id: 'meas_c', levelId: 'lvl_ground', type: 'coord', at: { x: 0, y: 0 }, label: { x: 1, y: 0 } }, at: { type: 'coord', at: { x: 0, y: 0 }, label: { x: 1, y: 0 } } };
    expect(measureKind.hit(c0, { x: 1.8, y: 0.02 }, 0.05, 100)).toBe(true);
    expect(measureKind.hit(c0, { x: 2.5, y: 0 }, 0.05, 100)).toBe(false);
    // In the DXF (code page 1252): AutoCAD's codes for ° and Ø, the arc's length in words.
    expect(measureDxfText(placeMeasure(doc, held('diameter'))!)).toBe('%%c 4,00');
    expect(measureDxfText(placeMeasure(doc, held('arc'))!)).toBe('Arco 6,28');
    expect(measureDxfText({ type: 'angle', vertex: { x: 0, y: 0 }, radius: 1, start: 0, sweep: 1, value: 45, arms: [1, 1] })).toBe('45,0%%d');
    const coord: Measure = { id: 'meas_c', levelId: 'lvl_ground', type: 'coord', at: { x: 3.25, y: -1.5 }, label: { x: 4, y: 0 } };
    const withAll: Doc = { ...doc, measures: [held('arc'), coord, { id: 'meas_a', levelId: 'lvl_ground', type: 'angle', vertex: { x: 0, y: 0 }, a: { x: 1, y: 0 }, b: { x: 0, y: 1 }, radius: 0.5 }] };
    const r = readProject(writeProject(withAll));
    expect(r.ok && r.doc.measures).toEqual(withAll.measures);
    // A bad one is left out and said.
    const bad = readProject(writeProject({ ...withAll, measures: [...withAll.measures, { ...coord, id: 'meas_x', at: { x: 'a' } } as unknown as Measure] }));
    expect(bad.ok && bad.doc.measures.length).toBe(3);
  });
});
