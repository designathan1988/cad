// Revision clouds (phase 10, "nuvem de revisão"): the next mark, the panel's changes, moving, the file.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import { updateClouds } from '../../src/elements/cloud/commands';
import { type Cloud, cloudRing, nextRevision } from '../../src/elements/cloud/schema';
import { cloudKind } from '../../src/elements/kinds/cloud';
import { readProject, writeProject } from '../../src/io/project-file';

const cloud = (id: string, revision: string): Cloud => ({ id, levelId: 'lvl_ground', a: { x: 3, y: 2 }, b: { x: 1, y: 4 }, revision });

describe('revision clouds', () => {
  it('the next mark: A, then the letter after the highest; numbers go on as numbers', () => {
    expect(nextRevision([])).toBe('A');
    expect(nextRevision([cloud('cloud_1', 'A'), cloud('cloud_2', 'C')])).toBe('D');
    expect(nextRevision([cloud('cloud_1', '1'), cloud('cloud_2', '2')])).toBe('3');
  });

  it('its rectangle from any two corners, counter-clockwise; a click on its edge takes it', () => {
    expect(cloudRing(cloud('cloud_1', 'A'))).toEqual([
      { x: 1, y: 2 },
      { x: 3, y: 2 },
      { x: 3, y: 4 },
      { x: 1, y: 4 },
    ]);
    expect(cloudKind.hit(cloud('cloud_1', 'A'), { x: 2, y: 2.05 }, 0.02, 50)).toBe(true);
    expect(cloudKind.hit(cloud('cloud_1', 'A'), { x: 2, y: 3 }, 0.02, 50)).toBe(false);
  });

  it('the panel: a new mark, a note; an empty mark keeps the old one, an empty note is none', () => {
    const doc: Doc = { ...newDocument(), clouds: [cloud('cloud_1', 'A')] };
    const a = updateClouds(['cloud_1'], { revision: 'B', note: 'Janela maior' }).apply(doc);
    expect(a.clouds[0]).toMatchObject({ revision: 'B', note: 'Janela maior' });
    const b = updateClouds(['cloud_1'], { revision: '  ', note: '' }).apply(a);
    expect(b.clouds[0]!.revision).toBe('B');
    expect('note' in b.clouds[0]!).toBe(false);
  });

  it('kept in the file; a flat one is not a cloud', () => {
    const doc: Doc = { ...newDocument(), clouds: [{ ...cloud('cloud_1', 'A'), note: 'Porta' }] };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.clouds).toEqual(doc.clouds);
    expect(cloudKind.valid({ ...cloud('cloud_2', 'A'), b: { x: 1, y: 2 } })).toBe(false);
  });
});
