// Points of interest (points.ts): made, edited, deleted, read from the file.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { addPoint, deletePoint, isPointOfInterest, type PointOfInterest, updatePoint } from '../../src/app/points';
import { readProject, writeProject } from '../../src/io/project-file';

const p: PointOfInterest = { id: 'poi_a', levelId: 'lvl_ground', point: { x: 2, y: 1.5 }, title: 'Ponto 1' };

describe('points of interest', () => {
  it('added, retitled, given a text, the text cleared, deleted: one step each', () => {
    const one = addPoint(p).apply(newDocument());
    expect(one.points).toEqual([p]);
    const titled = updatePoint('poi_a', { title: ' Lareira ', text: ' Tijolo aparente ' }).apply(one);
    expect(titled.points[0]).toMatchObject({ title: 'Lareira', text: 'Tijolo aparente' });
    const cleared = updatePoint('poi_a', { text: '', title: '  ' }).apply(titled);
    expect(cleared.points[0]!.title).toBe('Lareira');
    expect(cleared.points[0]).not.toHaveProperty('text');
    expect(updatePoint('poi_a', { title: 'Lareira' }).apply(cleared)).toBe(cleared);
    expect(deletePoint('poi_a').apply(cleared).points).toEqual([]);
    expect(deletePoint('nope').apply(cleared)).toBe(cleared);
  });

  it('read back from the file; an older file has none; one on a gone level or malformed is dropped and said', () => {
    const back = readProject(writeProject({ ...newDocument(), points: [{ ...p, text: 'x' }] }));
    expect(back.ok && back.doc.points).toEqual([{ ...p, text: 'x' }]);
    const v7 = readProject(JSON.stringify({ ...newDocument(), version: 7, points: undefined }));
    expect(v7.ok && v7.doc.points).toEqual([]);
    expect(isPointOfInterest({ ...p, point: { x: 'a', y: 0 } })).toBe(false);
    const r = readProject(JSON.stringify({ ...newDocument(), points: [p, { ...p, id: 'poi_b', title: 3 }, { ...p, id: 'poi_c', levelId: 'gone' }] }));
    expect(r.ok && r.doc.points.map((x) => x.id)).toEqual(['poi_a']);
    expect(r.ok && r.fixes).toEqual([
      { kind: 'droppedPoints', count: 1 },
      { kind: 'droppedPoints', count: 1 },
    ]);
  });
});
