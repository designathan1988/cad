// Layer combinations, graphic overrides and views that keep what they show (phase 9): the commands,
// the checks, and what the project file keeps.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/project/doc';
import { deleteLayerSet, isLayerSet, isRoomOverride, nextName, overrideColours, roomOverrideColours, saveLayerSet, setOverrides, setRoomOverrides, wallPhases } from '../../src/project/layer-sets';
import { isSavedView } from '../../src/project/saved-views';
import { readProject, writeProject } from '../../src/project/file';

describe('layer combinations', () => {
  it('saved and deleted, one step each; none left, none kept', () => {
    const doc = newDocument();
    const one = saveLayerSet({ id: 'layers_a', name: 'Camadas 1', hidden: ['rooms', 'guides'] }).apply(doc);
    expect(one.layerSets).toEqual([{ id: 'layers_a', name: 'Camadas 1', hidden: ['rooms', 'guides'] }]);
    expect('layerSets' in deleteLayerSet('layers_a').apply(one)).toBe(false);
    expect(deleteLayerSet('nope').apply(one)).toBe(one);
  });

  it('a set needs a name and categories that are ones', () => {
    expect(isLayerSet({ id: 'l', name: 'A', hidden: [] })).toBe(true);
    expect(isLayerSet({ id: 'l', name: ' ', hidden: [] })).toBe(false);
    expect(isLayerSet({ id: 'l', name: 'A', hidden: ['roofs'] })).toBe(false);
    expect(saveLayerSet({ id: 'l', name: 'A', hidden: ['roofs' as never] }).apply(newDocument()).layerSets).toBeUndefined();
  });

  it('the next free name', () => {
    expect(nextName(['Camadas 1', 'Camadas 3'], 'Camadas')).toBe('Camadas 2');
  });
});

describe('graphic overrides', () => {
  it("set, changed, taken off; a colour that is not one is refused", () => {
    const doc = newDocument();
    const type = doc.wallTypes[0]!.id;
    const on = setOverrides([{ id: 'override_a', wallTypeId: type, color: '#d64545' }]).apply(doc);
    expect(overrideColours(on).get(type)).toBe('#d64545');
    expect(setOverrides([{ id: 'override_a', wallTypeId: type, color: 'red' }]).apply(on)).toBe(on);
    expect('overrides' in setOverrides([]).apply(on)).toBe(false);
  });
});

describe('in the file', () => {
  it('combinations, overrides and what a view shows are kept; bad ones left out', () => {
    const base = newDocument();
    const view = { id: 'view_a', name: 'Térreo 1', kind: 'plan' as const, levelId: base.levels[0]!.id, scale: 60, center: { x: 0, y: 0 }, hidden: ['rooms' as const], overrides: false };
    const doc = {
      ...base,
      layerSets: [{ id: 'layers_a', name: 'Sem cômodos', hidden: ['rooms' as const] }],
      overrides: [{ id: 'override_a', wallTypeId: base.wallTypes[0]!.id, color: '#d64545' }],
      views: [view],
    };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.layerSets).toEqual(doc.layerSets);
    expect(r.ok && r.doc.overrides).toEqual(doc.overrides);
    expect(r.ok && r.doc.views[0]).toEqual(view);
    expect(isSavedView({ ...view, hidden: ['nothing'] })).toBe(false);
    expect(isSavedView({ ...view, overrides: 'yes' })).toBe(false);
    // A view saved before these has neither, and is still one.
    const { hidden: _h, overrides: _o, ...old } = view;
    expect(isSavedView(old)).toBe(true);
  });
});

describe('room overrides', () => {
  it('rooms of a use in a colour: set, kept in the file, a use that is not one refused; none left, none kept', () => {
    const doc = setRoomOverrides([{ id: 'override_a', use: 'bathroom', color: '#3b82f6' }]).apply(newDocument());
    expect(roomOverrideColours(doc).get('bathroom')).toBe('#3b82f6');
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.roomOverrides).toEqual([{ id: 'override_a', use: 'bathroom', color: '#3b82f6' }]);
    expect(isRoomOverride({ id: 'x', use: 'castle', color: '#000000' })).toBe(false);
    expect(setRoomOverrides([{ id: 'x', use: 'castle', color: '#000000' }]).apply(doc)).toBe(doc);
    expect('roomOverrides' in setRoomOverrides([]).apply(doc)).toBe(false);
  });

  it('walls by their phase in a renovation: none until one has a phase, then every wall by its own; the file keeps it', () => {
    const wall = (id: string, phase?: 'existing' | 'demolish') => ({ id, levelId: 'lvl_ground', wallTypeId: 'wt_masonry15', start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, referenceLine: 'centerline' as const, ...(phase ? { phase } : {}) });
    const plain = { ...newDocument(), walls: [wall('wall_a'), wall('wall_b')] };
    expect(wallPhases(plain).size).toBe(0);
    const reform = { ...plain, walls: [wall('wall_a', 'demolish'), wall('wall_b'), wall('wall_c', 'existing')] };
    expect([...wallPhases(reform)]).toEqual([
      ['wall_a', 'demolish'],
      ['wall_b', 'new'],
      ['wall_c', 'existing'],
    ]);
    const r = readProject(writeProject(reform));
    expect(r.ok && r.doc.walls.map((w) => w.phase ?? 'new')).toEqual(['demolish', 'new', 'existing']);
    // A phase the app does not know leaves the wall out, said.
    const bad = readProject(writeProject({ ...reform, walls: [...reform.walls, { ...wall('wall_d'), phase: 'moved' as never }] }));
    expect(bad.ok && bad.doc.walls.length).toBe(3);
  });
});
