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
    expect(r.doc.openingGroups).toEqual([]);
    expect(r.doc.version).toBe(CURRENT_VERSION);
  });

  it('a version 1 file is read as the current version, with no opening groups', () => {
    const { openingGroups: _g, ...v1 } = { ...newDocument(), version: 1 };
    const r = readProject(JSON.stringify(v1));
    expect(r.ok && r.doc.openingGroups).toEqual([]);
    expect(r.ok && r.doc.version).toBe(2);
    expect(r.ok && r.fixes).toEqual([]);
  });

  it('opening groups and the new rules read back; a bad group is dropped and reported', () => {
    const opening = (id: string, rule: unknown) => ({ id, wallId: 'a', kind: 'window', width: 1, height: 1, sill: 1, hinge: 'start', swing: 'left', rule });
    const group = { id: 'g', wallId: 'a', members: ['o1', 'o2'], spacing: { kind: 'fixed', gap: 0.5, anchor: 'centered', distance: 0 } };
    const doc = {
      ...newDocument(),
      walls: [wall('a', 0)],
      openings: [opening('o1', { kind: 'inGroup', groupId: 'g' }), opening('o2', { kind: 'inGroup', groupId: 'g' }), opening('o3', { kind: 'aligned', openingId: 'o1', edge: 'center' })],
      openingGroups: [group, { id: 'bad', wallId: 'a', members: 'o1', spacing: { kind: 'equal' } }],
    };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok && r.doc.openings.map((o) => o.id)).toEqual(['o1', 'o2', 'o3']);
    expect(r.ok && r.doc.openingGroups).toEqual([group]);
    expect(r.ok && r.fixes).toEqual([{ kind: 'droppedGroups', count: 1 }]);
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

  it('refuses what is not a project, saying why: not JSON, no version, no levels, no wall types, a newer version', () => {
    expect(readProject('not json')).toEqual({ ok: false, error: 'notJson' });
    expect(readProject('[1, 2]')).toEqual({ ok: false, error: 'notProject' });
    expect(readProject('{"levels":[]}')).toEqual({ ok: false, error: 'notProject' });
    expect(readProject('{"version":1,"levels":[],"walls":[]}')).toEqual({ ok: false, error: 'noLevels' });
    expect(readProject(JSON.stringify({ ...newDocument(), wallTypes: [] }))).toEqual({ ok: false, error: 'noWallTypes' });
    expect(readProject(JSON.stringify({ ...newDocument(), version: CURRENT_VERSION + 1 }))).toEqual({ ok: false, error: 'newerVersion' });
  });
});
