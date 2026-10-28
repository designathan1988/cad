import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { CURRENT_VERSION, isLevel, readProject, writeProject } from '../../src/io/project-file';
import { BEFORE_65 } from '../../src/elements/object/library-before65';
import { BEFORE_66 } from '../../src/elements/object/library-before66';

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
    const doc = { ...newDocument(), name: 'House', walls: [wall('wall_a', 0)] as never };
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
    const opening = (id: string, rule: unknown) => ({ id, wallId: 'wall_a', kind: 'window', width: 1, height: 1, sill: 1, hinge: 'start', swing: 'left', rule });
    const group = { id: 'group_g', wallId: 'wall_a', members: ['opening_o1', 'opening_o2'], spacing: { kind: 'fixed', gap: 0.5, anchor: 'centered', distance: 0 } };
    const doc = {
      ...newDocument(),
      walls: [wall('wall_a', 0)],
      openings: [opening('opening_o1', { kind: 'inGroup', groupId: 'group_g' }), opening('opening_o2', { kind: 'inGroup', groupId: 'group_g' }), opening('opening_o3', { kind: 'aligned', openingId: 'opening_o1', edge: 'center' })],
      openingGroups: [group, { id: 'group_bad', wallId: 'wall_a', members: 'opening_o1', spacing: { kind: 'equal' } }],
    };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok && r.doc.openings.map((o) => o.id)).toEqual(['opening_o1', 'opening_o2', 'opening_o3']);
    expect(r.ok && r.doc.openingGroups).toEqual([group]);
    expect(r.ok && r.fixes).toEqual([{ kind: 'droppedGroups', count: 1 }]);
  });

  it('bad elements are dropped and reported, the rest of the project is kept', () => {
    const doc = { ...newDocument(), walls: [wall('wall_a', 0), { id: 'b', start: { x: 'oops' } }, wall('wall_c', 2)] };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.walls.map((w) => w.id)).toEqual(['wall_a', 'wall_c']);
    expect(r.fixes).toEqual([{ kind: 'droppedWalls', count: 1 }]);
  });

  it('a wall on a level that does not exist moves to the first level, and says so', () => {
    const doc = { ...newDocument(), walls: [{ ...wall('wall_a', 0), levelId: 'nowhere' }] };
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
      walls: [{ id: 'wall_p', wallTypeId: 'wt_p', start: { x: 0, y: 0 }, end: { x: 2, y: 0 }, referenceLine: 'centerline', levelId: 'lvl_ground' }],
    };
    const r = readProject(writeProject(doc as never));
    expect(r.ok && r.doc).toEqual({ ...doc, version: CURRENT_VERSION });
  });

  it("a wall with a malformed top is kept without it (its type's top), and reported", () => {
    const doc = { ...newDocument(), walls: [{ ...wall('wall_a', 0), top: { kind: 'level' } }, wall('wall_b', 2)] };
    const r = readProject(JSON.stringify(doc));
    expect(r.ok && r.doc.walls.map((w) => w.id)).toEqual(['wall_a', 'wall_b']);
    expect(r.ok && r.doc.walls[0]).not.toHaveProperty('top');
    expect(r.ok && r.fixes).toEqual([{ kind: 'repairedFields', count: 1 }]);
  });
});

describe('version 4', () => {
  const group = { id: 'group_g', wallId: 'wall_a', members: ['x', 'y'], spacing: { kind: 'equal' } };
  it("a group's stretch reads back as it is; a version 3 group has none and keeps the whole wall", () => {
    expect(CURRENT_VERSION).toBeGreaterThanOrEqual(4);
    const doc = { ...newDocument(), openingGroups: [{ ...group, between: [null, 'c'] }] };
    const back = readProject(writeProject(doc as never));
    expect(back.ok && back.doc.openingGroups).toEqual([{ ...group, between: [null, 'c'] }]);
    const v3 = readProject(JSON.stringify({ ...newDocument(), version: 3, openingGroups: [group] }));
    expect(v3.ok && v3.doc.version).toBe(CURRENT_VERSION);
    expect(v3.ok && v3.doc.openingGroups).toEqual([group]);
  });

  it('a malformed stretch is left out, the group kept over the whole wall, reported', () => {
    for (const between of [['c'], [1, null], 'c']) {
      const r = readProject(JSON.stringify({ ...newDocument(), openingGroups: [{ ...group, between }] }));
      expect(r.ok && r.doc.openingGroups).toEqual([group]);
      expect(r.ok && r.fixes).toEqual([{ kind: 'repairedFields', count: 1 }]);
    }
  });
});

describe('walls from before version 3', () => {
  it('keep only the heights that differ from their type: the rest follow the type from now on', () => {
    const old = (id: string, x: number) => ({ ...wall(id, x), baseOffset: 0, top: { kind: 'level', offset: 0 } });
    const own = { ...old('wall_own', 0), baseOffset: 0.1 };
    const doc = { ...newDocument(), version: 2, walls: [old('wall_a', 0), own] };
    const r = readProject(JSON.stringify(doc));
    if (!r.ok) throw new Error('not read');
    expect(r.doc.walls[0]).not.toHaveProperty('top');
    expect(r.doc.walls[0]).not.toHaveProperty('baseOffset');
    expect(r.doc.walls[1]).toMatchObject({ baseOffset: 0.1 });
    expect(r.doc.walls[1]).not.toHaveProperty('top');
    expect(r.fixes).toEqual([]);
  });

  it('in a version 3 file too, a value equal to the type is not kept: the wall follows the type', () => {
    const doc = { ...newDocument(), walls: [{ ...wall('wall_a', 0), baseOffset: 0, top: { kind: 'level', offset: 0 } }, { ...wall('wall_b', 2), top: { kind: 'fixed', height: 2.5 } }] };
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

  it("a version 45 file's library sofa, as it came, gets the rounded edges; one changed by hand is kept", () => {
    const doc = newDocument();
    const sofa = doc.definitions.find((d) => d.id === 'def_sofa')!;
    const bed = doc.definitions.find((d) => d.id === 'def_bed')!;
    // As a version 45 file has them: square, and the furniture in the floor's wood (before version 47).
    const square = (d: typeof sofa) => ({
      ...d,
      params: d.params.map((p) => (p.kind === 'material' && p.default === 'woodVeneer' ? { ...p, default: 'wood' } : p)),
      parts: d.parts.map((p) => (p.kind === 'box' ? (({ round: _, ...rest }) => rest)(p) : p)),
    });
    expect(sofa.parts.some((p) => p.kind === 'box' && p.round !== undefined)).toBe(true);
    const changedBed = { ...square(bed), name: { pt: 'Minha cama', en: 'My bed' } };
    const old = { ...doc, version: 45, definitions: doc.definitions.map((d) => (d.id === sofa.id ? square(d) : d.id === bed.id ? changedBed : d)) };
    const r = readProject(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.definitions.find((d) => d.id === sofa.id)).toEqual(sofa);
    expect(r.doc.definitions.find((d) => d.id === bed.id)).toEqual(changedBed);
  });

  it("a version 46 file's furniture, as it came, gets the furniture wood; its chair of one board gets the open back", () => {
    const doc = newDocument();
    const table = doc.definitions.find((d) => d.id === 'def_table')!;
    const chair = doc.definitions.find((d) => d.id === 'def_chair')!;
    const woodOf = (d: typeof table) => ({ ...d, params: d.params.map((p) => (p.kind === 'material' && p.default === 'woodVeneer' ? { ...p, default: 'wood' } : p)) });
    expect(table.params.some((p) => p.kind === 'material' && p.default === 'woodVeneer')).toBe(true);
    // The chair as it was: seat, a back of one board from the seat up, four legs to the seat.
    const oneBoard = {
      ...woodOf(chair),
      parts: [
        { kind: 'box', name: { pt: 'Assento', en: 'Seat' }, x: '-largura/2', y: '-profundidade/2', z: 'assento - 0.03', w: 'largura', d: 'profundidade', h: 0.03, material: 'matAssento' },
        { kind: 'box', name: { pt: 'Encosto', en: 'Back' }, x: '-largura/2', y: 'profundidade/2 - 0.025', z: 'assento', w: 'largura', d: 0.025, h: 'encosto - assento', material: 'matAssento' },
        { kind: 'box', name: { pt: 'Pé', en: 'Leg' }, repeat: { count: 4 }, x: 0, y: 0, z: 0, w: 'pe', d: 'pe', h: 'assento - 0.03', material: 'matPes' },
      ],
    };
    const old = { ...doc, version: 46, definitions: doc.definitions.map((d) => (d.id === table.id ? woodOf(d) : d.id === chair.id ? oneBoard : d)) };
    const r = readProject(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.definitions.find((d) => d.id === table.id)).toEqual(table);
    expect(r.doc.definitions.find((d) => d.id === chair.id)).toEqual(chair);
    expect(r.doc.materials.some((m) => m.id === 'woodVeneer')).toBe(true);
  });

  it("a version 48 file's kitchen and washbasin, as they came, get their handles; one changed by hand is kept", () => {
    const doc = newDocument();
    const kitchen = doc.definitions.find((d) => d.id === 'def_kitchen')!;
    const basin = doc.definitions.find((d) => d.id === 'def_washbasin')!;
    const bare = (d: typeof kitchen) => ({ ...d, params: d.params.filter((p) => p.name !== 'matPuxador'), parts: d.parts.filter((p) => !['Puxador', 'Puxador do aéreo'].includes(p.name?.pt ?? '')) });
    expect(kitchen.parts.filter((p) => p.name?.pt === 'Puxador')).toHaveLength(1);
    const changed = { ...bare(basin), name: { pt: 'Minha pia', en: 'My basin' } };
    const old = { ...doc, version: 48, definitions: doc.definitions.map((d) => (d.id === kitchen.id ? bare(d) : d.id === basin.id ? changed : d)) };
    const r = readProject(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.definitions.find((d) => d.id === kitchen.id)).toEqual(kitchen);
    expect(r.doc.definitions.find((d) => d.id === basin.id)).toEqual(changed);
  });

  it("a version 47 file's point of light, a cylinder, becomes the bulb and its socket", () => {
    const doc = newDocument();
    const point = doc.definitions.find((d) => d.id === 'def_point_light')!;
    expect(point.parts.map((p) => p.kind)).toEqual(['sphere', 'cylinder']);
    const cylinder = { ...point, parts: [{ kind: 'cylinder', name: { pt: 'Bulbo', en: 'Bulb' }, x: 0, y: 0, z: 'altura - 0.03', r: 0.03, h: 0.06, material: 'matBulbo' }] };
    const r = readProject(JSON.stringify({ ...doc, version: 47, definitions: doc.definitions.map((d) => (d.id === point.id ? cylinder : d)) }));
    expect(r.ok && r.doc.definitions.find((d) => d.id === point.id)).toEqual(point);
  });

  it('a file before version 65 gets the cooker, potted plant and carved basin redrawn, unless the user changed them', () => {
    const doc = newDocument();
    const cooker = doc.definitions.find((d) => d.id === 'def_cooker')!;
    const plant = doc.definitions.find((d) => d.id === 'def_pot_plant')!;
    const oldCooker = BEFORE_65.find((d) => d.id === cooker.id)!;
    const oldPlant = BEFORE_65.find((d) => d.id === plant.id)!;
    const mine = { ...oldPlant, name: { pt: 'Minha planta', en: 'My plant' } };
    const old = { ...doc, version: 64, definitions: doc.definitions.map((d) => (d.id === cooker.id ? oldCooker : d.id === plant.id ? mine : d)) };
    const r = readProject(JSON.stringify(old));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.doc.definitions.find((d) => d.id === cooker.id)).toEqual(cooker);
    expect(r.doc.definitions.find((d) => d.id === plant.id)).toEqual(mine);
  });

  it('a file before version 66 gets the bookcase, fridge, tree and oven tower redrawn', () => {
    const doc = newDocument();
    const bookcase = doc.definitions.find((d) => d.id === 'def_bookcase')!;
    const old = { ...doc, version: 65, definitions: doc.definitions.map((d) => (d.id === bookcase.id ? BEFORE_66.find((b) => b.id === d.id)! : d)) };
    const r = readProject(JSON.stringify(old));
    expect(r.ok && r.doc.definitions.find((d) => d.id === bookcase.id)).toEqual(bookcase);
  });
});

describe('the areas taken out of the app (version 67)', () => {
  // Services, rules, sheets and the rest as an older file has them: carried as read, written back the same.
  const areas = {
    mepPoints: [{ id: 'mpt_1', levelId: 'lvl_ground', at: { x: 1, y: 0 }, height: 0.3, kind: 'socket', systemId: 'sys_power' }],
    rules: [{ id: 'r1', subject: 'stairRiser', max: 0.18, on: true }],
    sheets: [{ id: 'sheet_1', number: 'A-01', name: 'Planta', paper: 'A3', landscape: true, viewports: [] }],
    site: { latitude: -23.55, longitude: -46.63, north: 0, date: '2026-06-21', time: '10:00', utcOffset: -3, shadows: true },
    costs: { bdi: 22 },
  };

  it('an older file keeps them, unread, and gives them back at the top, twice over', () => {
    const old = { ...newDocument(), version: 66, ...areas };
    const once = JSON.parse(writeProject((readProject(JSON.stringify(old)) as { doc: ReturnType<typeof newDocument> }).doc));
    const twice = JSON.parse(writeProject((readProject(JSON.stringify(once)) as { doc: ReturnType<typeof newDocument> }).doc));
    for (const [k, v] of Object.entries(areas)) {
      expect(once[k]).toEqual(v);
      expect(twice[k]).toEqual(v);
    }
    expect(once.kept).toBeUndefined();
  });

  it('a layer set hiding the services keeps its other categories', () => {
    const r = readProject(JSON.stringify({ ...newDocument(), version: 66, layerSets: [{ id: 'l1', name: 'A', hidden: ['services', 'walls'] }] }));
    expect(r.ok && r.doc.layerSets).toEqual([{ id: 'l1', name: 'A', hidden: ['walls'] }]);
  });
});

describe('version 68', () => {
  // A window measured from the door beside it, as the tool used to place it: held by its wall where it is.
  const opening = (id: string, rule: unknown) => ({ id, wallId: 'wall_a', kind: 'window', width: 1, height: 1, sill: 1, hinge: 'start', swing: 'left', rule });
  const old = (version: number) => ({
    ...newDocument(),
    version,
    walls: [{ ...wall('wall_a', 0), end: { x: 10, y: 0 } }],
    openings: [opening('opening_d', { kind: 'fromStart', distance: 1 }), opening('opening_w', { kind: 'fromOpening', openingId: 'opening_d', distance: 0.5, toward: 'end' })],
  });

  it('an older file: an opening measured from another is measured from its wall, in the same place', () => {
    const r = readProject(JSON.stringify(old(67)));
    expect(r.ok && r.doc.openings.map((o) => o.rule)).toEqual([
      { kind: 'fromStart', distance: 1 },
      { kind: 'fromStart', distance: 2.5 },
    ]);
  });

  it('a file of this version keeps a link the user chose', () => {
    const r = readProject(JSON.stringify(old(68)));
    expect(r.ok && r.doc.openings[1]!.rule.kind).toBe('fromOpening');
  });
});
