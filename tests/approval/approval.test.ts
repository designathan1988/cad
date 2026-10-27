// Phase 12: the approval journey (its São Paulo steps, their states and estimates), the project's folder
// as a ZIP, the descriptive memorial.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { memorialHtml } from '../../src/app/documents';
import { deriveGeometry } from '../../src/app/geometry';
import { addDoc, deleteStep, updateDoc, updateStep } from '../../src/approval/commands';
import { approvalOf, isApproval, progressOf, SAO_PAULO } from '../../src/approval/schema';
import { newOpening } from '../../src/elements/opening/schema';
import { readProject, writeProject } from '../../src/io/project-file';
import { unzipText } from '../../src/io/xlsx';
import { crc32, zipFiles } from '../../src/io/zip';

describe('the approval journey', () => {
  it('São Paulo\'s eight steps, from the survey to the delivery, what cad2 makes marked', () => {
    expect(isApproval(SAO_PAULO)).toBe(true);
    expect(SAO_PAULO.steps.map((s) => s.name)).toEqual(['Levantamento', 'Viabilidade', 'Projeto legal', 'Aprovação', 'Antes da obra', 'Obra', 'Conclusão', 'Entrega']);
    const made = SAO_PAULO.steps.flatMap((s) => s.docs.flatMap((d) => (d.generated ? [d.generated] : [])));
    expect(made.sort()).toEqual(['areas', 'budget', 'compliance', 'cub', 'memorial', 'model', 'schedule', 'sheets']);
    // Nothing guessed: no time or cost until the office gives one.
    expect(SAO_PAULO.steps.every((s) => s.days === undefined && s.cost === undefined)).toBe(true);
  });

  it('documents done, estimates summed; kept in the file', () => {
    let doc: Doc = newDocument();
    doc = updateDoc('step_legal', 'doc_rrt', { state: 'done', note: 'RRT 12345' }).apply(doc);
    doc = updateDoc('step_permit', 'doc_bombeiros', { state: 'na' }).apply(doc);
    doc = updateStep('step_permit', { days: 60, cost: 1200 }).apply(doc);
    doc = addDoc('step_works', 'Licença de caçamba').apply(doc);
    const p = progressOf(approvalOf(doc));
    expect([p.done, p.all, p.days, p.cost]).toEqual([2, 26, 60, 1200]);
    // An estimate cleared goes; a step deleted goes.
    doc = updateStep('step_permit', { cost: undefined }).apply(doc);
    expect(approvalOf(doc).steps.find((s) => s.id === 'step_permit')!.cost).toBeUndefined();
    doc = deleteStep('step_delivery').apply(doc);
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.approval).toEqual(doc.approval);
  });
});

describe('the project\'s folder', () => {
  it('a ZIP of files that reads back, its CRC-32 right', async () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    const zip = await zipFiles([
      { name: 'Memorial descritivo.html', data: '<p>Memorial</p>'.repeat(50) },
      { name: 'a.csv', data: 'x' },
    ]);
    const back = await unzipText(zip, () => true);
    expect(back.get('Memorial descritivo.html')).toBe('<p>Memorial</p>'.repeat(50));
    expect(back.get('a.csv')).toBe('x');
  });
});

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

describe('the descriptive memorial', () => {
  it('the wall systems with their layers, the doors and windows by size, the rooms with their finishes', () => {
    const doc: Doc = {
      ...newDocument(),
      name: 'Casa',
      walls: [wall('s', [0, 0], [6, 0]), wall('e', [6, 0], [6, 4]), wall('n', [6, 4], [0, 4]), wall('w', [0, 4], [0, 0])],
      openings: [newOpening('d', 's', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 }), newOpening('j', 'n', 'window', { kind: 'centered' }, { width: 1.2, height: 1, sill: 1 })],
      rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 3, y: 2 }, name: 'Sala', number: '1', use: 'living', finishes: { floor: 'tile' } }],
    };
    const html = memorialHtml(doc, deriveGeometry(doc), '27/10/2026');
    expect(html).toContain('<title>');
    expect(html).toContain('Casa');
    // Its four walls of one type, 20 m along their lines.
    expect(html).toMatch(/4 (walls|paredes), 20(,|\.)00 m/);
    expect(html).toMatch(/0[,.]80 × 2[,.]10 m/);
    expect(html).toContain('1 · Sala');
  });
});
