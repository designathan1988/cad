import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { CURRENT_VERSION, readProject, writeProject } from '../../src/io/project-file';

const wall = (id: string, x: number) => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x, y: 0 },
  end: { x: x + 1, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

describe('project files', () => {
  it('a written project reads back the same', () => {
    const doc = { ...newDocument(), name: 'House', walls: [wall('a', 0)] as never };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc).toEqual(doc);
    expect(r.ok && r.fixes).toEqual([]);
  });

  it('a version 1 file without openings, rooms or floors is migrated: it gets empty lists', () => {
    const { openings: _o, rooms: _r, floors: _f, ...old } = newDocument();
    const r = readProject(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.openings).toEqual([]);
    expect(r.doc.rooms).toEqual([]);
    expect(r.doc.floors).toEqual([]);
    expect(r.doc.version).toBe(CURRENT_VERSION);
  });

  it('bad elements are dropped and reported, the rest of the project is kept', () => {
    const doc = { ...newDocument(), walls: [wall('a', 0), { id: 'b', start: { x: 'oops' } }, wall('c', 2)] };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.walls.map((w) => w.id)).toEqual(['a', 'c']);
    expect(r.fixes).toEqual([{ kind: 'droppedWalls', count: 1 }]);
  });

  it('a wall on a level that does not exist moves to the first level, and says so', () => {
    const doc = { ...newDocument(), walls: [{ ...wall('a', 0), levelId: 'nowhere' }] };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok && r.doc.walls[0]!.levelId).toBe('lvl_ground');
    expect(r.ok && r.fixes).toEqual([{ kind: 'movedToFirstLevel', count: 1 }]);
  });

  it('refuses what is not a project: not JSON, no levels, a newer version', () => {
    expect(readProject('not json')).toEqual({ ok: false, error: 'notJson' });
    expect(readProject('{"version":1,"levels":[],"walls":[]}')).toEqual({ ok: false, error: 'notProject' });
    expect(readProject(JSON.stringify({ ...newDocument(), version: CURRENT_VERSION + 1 }))).toEqual({ ok: false, error: 'newerVersion' });
  });
});
