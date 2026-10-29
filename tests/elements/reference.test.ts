// References under the plan (phase 11): placed, turned and scaled; calibrated by two points; a DXF's
// lines read in metres by its units; kept in the file.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import { referenceKind } from '../../src/elements/kinds/reference';
import { addReference, updateReferences } from '../../src/elements/reference/commands';
import { calibrated, isReference, type Reference, referenceCorners, referencePoint } from '../../src/elements/reference/schema';
import { readDxfLines } from '../../src/io/import-dxf';
import { readProject, writeProject } from '../../src/io/project-file';
import { rotation } from '../../src/tools/transform';

const pic: Reference = {
  id: 'ref_1',
  levelId: 'lvl_ground',
  name: 'planta.png',
  source: { kind: 'image', data: 'data:image/png;base64,AAAA', w: 1000, h: 500 },
  at: { x: 2, y: 1 },
  scale: 0.01,
  angle: 0,
  opacity: 0.5,
};

describe('a reference placed', () => {
  it('its points: from its corner, a unit a scale, turned', () => {
    expect(referencePoint(pic, 1000, 500)).toEqual({ x: 12, y: 6 });
    const turned = { ...pic, angle: Math.PI / 2 };
    const p = referencePoint(turned, 100, 0);
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.y).toBeCloseTo(2, 9);
    expect(referenceCorners(pic)).toEqual([
      { x: 2, y: 1 },
      { x: 12, y: 1 },
      { x: 12, y: 6 },
      { x: 2, y: 6 },
    ]);
  });

  it('calibrated: two points 2 m apart as it is, really 5 m: scaled about the first, which stays', () => {
    const a = referencePoint(pic, 100, 100);
    const b = referencePoint(pic, 300, 100);
    const c = calibrated(pic, a, b, 5)!;
    expect(c.scale).toBeCloseTo(0.025, 12);
    const a2 = referencePoint(c, 100, 100);
    const b2 = referencePoint(c, 300, 100);
    expect(a2.x).toBeCloseTo(a.x, 9);
    expect(a2.y).toBeCloseTo(a.y, 9);
    expect(Math.hypot(b2.x - a2.x, b2.y - a2.y)).toBeCloseTo(5, 9);
    expect(calibrated(pic, a, a, 5)).toBeNull();
    expect(calibrated(pic, a, b, 0)).toBeNull();
  });

  it('turned a quarter about a point: its corner goes round, its turn is a quarter', () => {
    const r = referenceKind.mapped(pic, rotation({ x: 0, y: 0 }, Math.PI / 2), 'ref_1');
    expect(r.at.x).toBeCloseTo(-1, 9);
    expect(r.at.y).toBeCloseTo(2, 9);
    expect(r.angle).toBeCloseTo(Math.PI / 2, 9);
    expect(r.scale).toBe(0.01);
  });

  it('clicked inside it, it is picked; outside, not', () => {
    expect(referenceKind.hit(pic, { x: 5, y: 3 }, 0, 100)).toBe(true);
    expect(referenceKind.hit(pic, { x: 13, y: 3 }, 0, 100)).toBe(false);
  });

  it('checked when read, and changed by its commands only into what is one', () => {
    expect(isReference(pic)).toBe(true);
    expect(isReference({ ...pic, source: { ...pic.source, data: 'javascript:alert(1)' } })).toBe(false);
    expect(isReference({ ...pic, opacity: 0 })).toBe(false);
    expect(isReference({ ...pic, source: { kind: 'dxf', lines: [0, 0, 1], w: 1, h: 1 } })).toBe(false);
    const doc: Doc = addReference(pic).apply(newDocument());
    expect(updateReferences(['ref_1'], { opacity: 2 }).apply(doc)).toBe(doc);
    expect(updateReferences(['ref_1'], { opacity: 0.8 }).apply(doc).references[0]!.opacity).toBe(0.8);
  });

  it('kept in the file; an older file has none', () => {
    const doc: Doc = { ...newDocument(), references: [pic] };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.references).toEqual([pic]);
    const old = readProject(JSON.stringify({ ...newDocument(), version: 31, references: undefined }));
    expect(old.ok && old.doc.references).toEqual([]);
  });
});

/** A DXF as a CAD program writes it: pairs of a group code and a value, a line each. */
const dxf = (units: number | null, entities: string[][]) =>
  [
    ...(units === null ? [] : ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', String(units), '0', 'ENDSEC']),
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    ...entities.flat(),
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\r\n');

describe('a DXF read as lines', () => {
  it('a line, a closed polyline and a circle, in millimetres as its header says, from its lowest corner', () => {
    const d = readDxfLines(
      dxf(4, [
        ['0', 'LINE', '8', '0', '10', '1000', '20', '2000', '11', '5000', '21', '2000'],
        ['0', 'LWPOLYLINE', '90', '3', '70', '1', '10', '1000', '20', '1000', '10', '2000', '20', '1000', '10', '2000', '20', '1500'],
        ['0', 'CIRCLE', '10', '3000', '20', '3000', '40', '500'],
        ['0', 'TEXT', '10', '0', '20', '0', '1', 'Sala'],
      ]),
    );
    expect(d.unit).toBe(0.001);
    // 1 line, 3 sides of the closed polyline, 36 segments of the circle.
    expect(d.lines.length / 4).toBe(1 + 3 + 36);
    expect(d.origin).toEqual({ x: 1, y: 1 });
    expect(d.w).toBeCloseTo(4, 9);
    expect(d.h).toBeCloseTo(2.5, 9);
    expect(d.lines.slice(0, 4)).toEqual([0, 1, 4, 1]);
    expect(d.skipped).toEqual({ TEXT: 1 });
  });

  it("a polyline's bulge is an arc, an ellipse is drawn, and an arc seen from below is mirrored", () => {
    // From (0, 0) to (2, 0) with bulge 1: a half circle of radius 1 round (1, 0), counter-clockwise, below.
    const bulged = readDxfLines(dxf(6, [['0', 'LWPOLYLINE', '90', '2', '70', '0', '10', '0', '20', '0', '42', '1', '10', '2', '20', '0']]));
    expect(bulged.lines.length / 4).toBe(18);
    expect(bulged.h).toBeCloseTo(1, 6);
    expect(bulged.w).toBeCloseTo(2, 6);
    // An ellipse 4 across and 2 up round (0, 0): its whole turn.
    const ellipse = readDxfLines(dxf(6, [['0', 'ELLIPSE', '10', '0', '20', '0', '11', '2', '21', '0', '40', '0.5', '41', '0', '42', String(Math.PI * 2)]]));
    expect(ellipse.skipped).toEqual({});
    expect(ellipse.w).toBeCloseTo(4, 6);
    expect(ellipse.h).toBeCloseTo(2, 6);
    // An arc round (5, 0) from 0° to 90°, seen from below (extrusion 0, 0, −1): round (−5, 0), to the left.
    const mirrored = readDxfLines(dxf(6, [['0', 'ARC', '10', '5', '20', '0', '40', '1', '50', '0', '51', '90', '230', '-1']]));
    expect(mirrored.origin.x).toBeCloseTo(-6, 6);
  });

  it('no units said: metres for a drawing of house size, millimetres for one a kilometre would be too small for', () => {
    expect(readDxfLines(dxf(null, [['0', 'LINE', '10', '0', '20', '0', '11', '12', '21', '0']])).unit).toBe(1);
    expect(readDxfLines(dxf(null, [['0', 'LINE', '10', '0', '20', '0', '11', '12000', '21', '0']])).unit).toBe(0.001);
  });

  it('an arc from 0° to 90° of radius 1: nine segments of 10°, on the circle', () => {
    const d = readDxfLines(dxf(6, [['0', 'ARC', '10', '0', '20', '0', '40', '1', '50', '0', '51', '90']]));
    expect(d.lines.length / 4).toBe(9);
    for (let i = 0; i < d.lines.length; i += 2) expect(Math.hypot(d.lines[i]! + d.origin.x, d.lines[i + 1]! + d.origin.y)).toBeCloseTo(1, 9);
  });
});
