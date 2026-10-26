import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { CURRENT_VERSION, isLevel, readProject, writeProject } from '../../src/io/project-file';

const wall = (id: string, x: number) => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x, y: 0 },
  end: { x: x + 1, y: 0 },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
});

describe('project files', () => {
  it('a written project reads back the same', () => {
    const doc = { ...newDocument(), name: 'House', walls: [wall('a', 0)] as never };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc).toEqual(doc);
    expect(r.ok && r.fixes).toEqual([]);
  });

  it("a level's cut height reads back; one without it reads as it was (1.20 m by default)", () => {
    const base = newDocument();
    const doc = { ...base, levels: [{ ...base.levels[0]!, cutHeight: 1.5 }] };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.levels).toEqual(doc.levels);
    expect(isLevel({ ...base.levels[0]!, cutHeight: 0 })).toBe(false);
    expect(isLevel({ ...base.levels[0]!, cutHeight: '1' })).toBe(false);
    expect(isLevel(base.levels[0]!)).toBe(true);
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
    expect(r.ok && r.doc.version).toBe(CURRENT_VERSION);
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

describe('version 3', () => {
  it('a wall without top or base offset, and a type with them, read back as they are', () => {
    const doc = {
      ...newDocument(),
      wallTypes: [...newDocument().wallTypes, { id: 'wt_p', name: 'Parapet', layers: [{ thickness: 0.15, function: 'structure', materialId: 'brick' }], top: { kind: 'fixed', height: 1.1 } }],
      walls: [{ id: 'p', wallTypeId: 'wt_p', start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground' }],
    };
    const r = readProject(writeProject(doc as never));
    expect(r.ok && r.doc).toEqual({ ...doc, version: CURRENT_VERSION });
  });

  it('a wall with a malformed top is dropped and reported, not read', () => {
    const doc = { ...newDocument(), walls: [{ ...wall('a', 0), top: { kind: 'level' } }, wall('b', 2)] };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok && r.doc.walls.map((w) => w.id)).toEqual(['b']);
    expect(r.ok && r.fixes).toEqual([{ kind: 'droppedWalls', count: 1 }]);
  });
});

describe('version 4', () => {
  const group = { id: 'g', wallId: 'a', members: ['x', 'y'], spacing: { kind: 'equal' } };
  it("a group's stretch reads back as it is; a version 3 group has none and keeps the whole wall", () => {
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(4);
    const doc = { ...newDocument(), openingGroups: [{ ...group, between: [null, 'c'] }] };
    const back = readProject(writeProject(doc as never));
    expect(back.ok && back.doc.openingGroups).toEqual([{ ...group, between: [null, 'c'] }]);
    const v3 = readProject(JSON.stringify({ ...newDocument(), version: 3, openingGroups: [group] }));
    expect(v3.ok && v3.doc.version).toBe(CURRENT_VERSION);
    expect(v3.ok && v3.doc.openingGroups).toEqual([group]);
  });

  it('a malformed stretch drops the group, reported', () => {
    for (const between of [['c'], [1, null], 'c']) {
      const r = readProject(JSON.stringify({ ...newDocument(), openingGroups: [{ ...group, between }] }));
      expect(r.ok && r.fixes).toEqual([{ kind: 'droppedGroups', count: 1 }]);
    }
  });
});

describe('walls from before version 3', () => {
  it('keep only the heights that differ from their type: the rest follow the type from now on', () => {
    const old = (id: string, x: number) => ({ ...wall(id, x), baseOffset: 0, top: { kind: 'level', offset: 0 } });
    const own = { ...old('own', 0), baseOffset: 0.1 };
    const doc = { ...newDocument(), version: 2, walls: [old('a', 0), own] };
    const r = readProject(JSON.stringify(doc));
    if (!r.ok) throw new Error('not read');
    expect(r.doc.walls[0]).not.toHaveProperty('top');
    expect(r.doc.walls[0]).not.toHaveProperty('baseOffset');
    expect(r.doc.walls[1]).toMatchObject({ baseOffset: 0.1 });
    expect(r.doc.walls[1]).not.toHaveProperty('top');
    expect(r.fixes).toEqual([]);
  });

  it('in a version 3 file too, a value equal to the type is not kept: the wall follows the type', () => {
    const doc = { ...newDocument(), walls: [{ ...wall('a', 0), baseOffset: 0, top: { kind: 'level', offset: 0 } }, { ...wall('b', 2), top: { kind: 'fixed', height: 2.5 } }] };
    const r = readProject(writeProject(doc as never));
    if (!r.ok) throw new Error('not read');
    expect(r.doc.walls[0]).not.toHaveProperty('top');
    expect(r.doc.walls[1]).toMatchObject({ top: { kind: 'fixed', height: 2.5 } });
  });
});


describe('version 5', () => {
  const guide = { id: 'guide_1', levelId: 'lvl_ground', point: { x: 0, y: 1.2 }, dir: { x: 1, y: 0 } };
  it('guides read back as they are; an older file has none', () => {
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(5);
    const back = readProject(writeProject({ ...newDocument(), guides: [guide] }));
    expect(back.ok && back.doc.guides).toEqual([guide]);
    const v4 = readProject(JSON.stringify({ ...newDocument(), version: 4, guides: undefined }));
    expect(v4.ok && v4.doc.guides).toEqual([]);
  });

  it('a malformed guide, or one on a level that is gone, is dropped and reported', () => {
    const bad = [{ ...guide, id: 'guide_2', dir: { x: 2, y: 0 } }, { ...guide, id: 'guide_3', point: { x: 'a', y: 0 } }];
    const r = readProject(JSON.stringify({ ...newDocument(), guides: [guide, ...bad, { ...guide, id: 'guide_4', levelId: 'gone' }] }));
    expect(r.ok && r.doc.guides.map((g) => g.id)).toEqual(['guide_1']);
    expect(r.ok && r.fixes).toEqual([
      { kind: 'droppedGuides', count: 2 },
      { kind: 'droppedGuides', count: 1 },
    ]);
  });
});
