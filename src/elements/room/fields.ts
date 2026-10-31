// The fields rooms and floors show in the panel (ui/fields.ts builds the rows).

import { areaText, lengthText, volumeText } from '../../i18n/units';
import type { Field } from '../fields';
import { materialLabel, type MessageKey, name, t } from '../../i18n/messages';
import type { Material } from '../material/schema';
import type { RoomPatch } from './commands';
import type { FloorSolid, RoomSolid } from './derive';
import { type Floor, FLOOR_BUILDUPS, type FloorId, type FloorLayer, ROOM_USES, type RoomId, type RoomUse, TILE_PATTERNS, type TilePattern, type Tiling } from './schema';
import type { LevelId } from '../../project/doc';

export interface RoomFieldActions {
  readonly updateRoom: (id: RoomId, patch: RoomPatch) => void;
  /** The same change to all the selected rooms, one undo step. */
  readonly updateRooms: (ids: readonly RoomId[], patch: RoomPatch) => void;
  /** A level's height: a room's ceiling when it has none of its own. */
  readonly levelHeight: (levelId: LevelId) => number;
  readonly updateFloor: (ids: readonly FloorId[], patch: Partial<Pick<Floor, 'thickness' | 'offset' | 'slope'>>) => void;
  /** Draws a hole in the one floor selected (the floor tool, for its outline). */
  readonly startFloorHole?: (id: FloorId) => void;
  readonly clearFloorHoles?: (ids: readonly FloorId[]) => void;
  /** A guardrail all round the one floor's edge; null when it has one already, or is a ceiling. */
  readonly edgeRailing?: (f: FloorSolid) => (() => void) | null;
  /** The project's materials: what finishes and layers are chosen from. */
  readonly materials: () => readonly Material[];
  readonly setFloorLayers: (ids: readonly FloorId[], layers: readonly FloorLayer[] | null) => void;
  readonly setFloorTiling: (ids: readonly FloorId[], tiling: Tiling | null) => void;
  /** The rooms' four interior elevations each; not offered where there is none to make. */
  readonly interiorElevations?: (ids: readonly RoomId[]) => void;
}

const one = <T>(xs: readonly T[]) => xs.length === 1;

/** A room's own actions (the panel's room actions have the floor's too). */
export type RoomOwnActions = Pick<RoomFieldActions, 'updateRoom' | 'updateRooms' | 'levelHeight' | 'materials' | 'interiorElevations'>;

export function roomFields(rooms: readonly RoomSolid[], act: RoomOwnActions): Field<RoomSolid>[] {
  const id = rooms[0]?.room.id;
  const ids = rooms.map((r) => r.room.id);
  const height = (r: RoomSolid) => r.room.height ?? act.levelHeight(r.room.levelId);
  return [
    { id: 'name', label: 'room.name', kind: 'text', when: one, get: (r) => name(r.room.name), set: (v) => id && act.updateRoom(id, { name: v }) },
    { id: 'number', label: 'room.number', kind: 'text', when: one, get: (r) => r.room.number, set: (v) => id && act.updateRoom(id, { number: v }) },
    {
      id: 'use',
      label: 'room.use',
      kind: 'select',
      options: [{ value: '', label: t('use.none') }, ...ROOM_USES.map((u) => ({ value: u, label: t(`use.${u}`) }))],
      get: (r) => r.room.use ?? '',
      set: (v) => act.updateRooms(ids, { use: v === '' ? null : (v as RoomUse) }),
    },
    {
      id: 'height',
      label: 'room.height',
      kind: 'number',
      min: 0.1,
      get: height,
      set: (v) => act.updateRooms(ids, { height: v }),
      own: (rs) => rs.some((r) => r.room.height !== undefined),
      reset: () => act.updateRooms(ids, { height: null }),
      ownWords: { reset: 'room.heightBack', note: 'room.heightOwn' },
    },
    // Several rooms: their total area.
    { id: 'area', label: 'room.area', kind: 'readout', text: (rs) => (rs.every((r) => r.enclosed) ? areaText(rs.reduce((s, r) => s + r.area, 0)) : '—') },
    { id: 'perimeter', label: 'room.perimeter', kind: 'readout', when: one, text: (rs) => (rs[0]!.enclosed ? `${lengthText(rs[0]!.perimeter)}` : '—') },
    // Floor area times ceiling height: the air a room holds (a schedule's column too).
    { id: 'volume', label: 'room.volume', kind: 'readout', text: (rs) => (rs.every((r) => r.enclosed) ? volumeText(rs.reduce((s, r) => s + r.area * height(r), 0)) : '—') },
    // Its finishes: floor, walls, ceiling from the project's materials, and the skirting's height.
    { id: 'finishes', label: 'room.finishes', kind: 'note', text: () => t('room.finishes') },
    ...(['floor', 'wall', 'ceiling'] as const).map(
      (part): Field<RoomSolid> => ({
        id: `finish.${part}`,
        label: `room.finish.${part}`,
        kind: 'select',
        icon: part === 'floor' ? 'slab' : part === 'wall' ? 'wall' : 'arrowUp',
        options: [{ value: '', label: t('room.finish.none') }, ...act.materials().map((m) => ({ value: m.id, label: materialLabel(m) }))],
        get: (r) => r.room.finishes?.[part] ?? '',
        set: (v) => act.updateRooms(ids, { finishes: { [part]: v === '' ? null : v } }),
      }),
    ),
    {
      id: 'finish.base',
      label: 'room.finish.base',
      kind: 'number',
      icon: 'height',
      min: 0,
      get: (r) => r.room.finishes?.base ?? 0,
      set: (v) => act.updateRooms(ids, { finishes: { base: v > 0 ? v : null } }),
    },
    // Each wall seen from inside, on the room's level (a sheet's interior elevations).
    ...(act.interiorElevations
      ? [{ id: 'interiorElevations', label: 'room.interiorElevations', kind: 'action', enabled: (rs: readonly RoomSolid[]) => rs.some((r) => r.enclosed), run: () => act.interiorElevations!(ids) } as const]
      : []),
  ];
}

/** A floor's own actions (a room's panel has them too). */
export type FloorFieldActions = Pick<RoomFieldActions, 'updateFloor' | 'startFloorHole' | 'clearFloorHoles' | 'edgeRailing' | 'materials' | 'setFloorLayers' | 'setFloorTiling'>;

export function floorFields(floors: readonly FloorSolid[], roomName: (id: RoomId) => string, act: FloorFieldActions): Field<FloorSolid>[] {
  const ids = floors.map((f) => f.floor.id);
  return [
    { id: 'thickness', label: 'floor.thickness', kind: 'number', min: 0.01, get: (f) => f.floor.thickness, set: (v) => act.updateFloor(ids, { thickness: v }) },
    { id: 'offset', label: 'floor.offset', kind: 'number', get: (f) => f.floor.offset, set: (v) => act.updateFloor(ids, { offset: v }) },
    {
      id: 'source',
      label: 'floor.source',
      kind: 'readout',
      text: (fs) => {
        const sources = new Set(fs.map((f) => (f.floor.source.kind === 'room' ? roomName(f.floor.source.roomId) : t('floor.outline'))));
        return sources.size === 1 ? [...sources][0]! : t('panel.varies');
      },
    },
    { id: 'area', label: 'room.area', kind: 'readout', text: (fs) => areaText(fs.reduce((s, f) => s + f.area, 0)) },
    // A ramp, a terrace falling to its drain: the grade and the way it rises.
    {
      id: 'grade',
      label: 'floor.grade',
      icon: 'raise',
      kind: 'number',
      unit: '%',
      get: (f) => f.floor.slope?.grade ?? 0,
      set: (v) => act.updateFloor(ids, { slope: { grade: v, dir: floors[0]?.floor.slope?.dir ?? 0 } }),
    },
    {
      id: 'gradeDir',
      label: 'floor.gradeDir',
      icon: 'rotate',
      kind: 'number',
      unit: '°',
      when: (fs) => fs.every((f) => (f.floor.slope?.grade ?? 0) !== 0),
      get: (f) => Math.round((((f.floor.slope?.dir ?? 0) * 180) / Math.PI) * 100) / 100,
      set: (v) => act.updateFloor(ids, { slope: { grade: floors[0]?.floor.slope?.grade ?? 0, dir: (v * Math.PI) / 180 } }),
    },
    { id: 'holes', label: 'floor.holes', kind: 'readout', when: (fs) => fs.some((f) => f.holes.length > 0), text: (fs) => String(fs.reduce((s, f) => s + f.holes.length, 0)) },
    // Its build-up: one of the usual ones to start from, then each layer's thickness.
    {
      id: 'buildup',
      label: 'floor.buildup',
      kind: 'select',
      icon: 'slab',
      options: [
        { value: '', label: t('floor.buildup.none') },
        ...Object.keys(FLOOR_BUILDUPS).map((k) => ({ value: k, label: t(`floor.buildup.${k}` as MessageKey) })),
        ...(floors.some((f) => f.floor.layers && !buildupOf(f.floor.layers)) ? [{ value: 'custom', label: t('floor.buildup.custom') }] : []),
      ],
      get: (f) => (f.floor.layers ? (buildupOf(f.floor.layers) ?? 'custom') : ''),
      set: (v) => {
        if (v !== 'custom') act.setFloorLayers(ids, v === '' ? null : FLOOR_BUILDUPS[v]!);
      },
    },
    ...(floors.length === 1 && floors[0]!.floor.layers
      ? floors[0]!.floor.layers.map(
          (l, i): Field<FloorSolid> => ({
            id: `layer${i}`,
            label: 'field.raw',
            labelVars: { text: materialLabel(act.materials().find((m) => m.id === l.materialId) ?? { id: l.materialId, name: '' }) },
            kind: 'number',
            icon: 'wall',
            sub: true,
            min: 0.001,
            get: (f) => f.floor.layers?.[i]?.thickness ?? 0,
            set: (v) => act.setFloorLayers(ids, floors[0]!.floor.layers!.map((x, k) => (k === i ? { ...x, thickness: v } : x))),
          }),
        )
      : []),
    // Its finish's pieces (paginação): the size, the joint, the pattern, the angle, and how many.
    {
      id: 'tiled',
      label: 'floor.tiled',
      kind: 'segmented',
      icon: 'table',
      options: [
        { value: '1', label: t('object.yes') },
        { value: '0', label: t('object.no') },
      ],
      get: (f) => (f.floor.tiling ? '1' : '0'),
      set: (v) => act.setFloorTiling(ids, v === '1' ? DEFAULT_TILING : null),
    },
    ...tilingFields(floors, ids, act),
    ...(act.startFloorHole && floors.length === 1
      ? [{ id: 'addHole', label: 'floor.addHole', kind: 'action', run: () => act.startFloorHole!(ids[0]!) } as const]
      : []),
    ...(act.clearFloorHoles
      ? [
          {
            id: 'clearHoles',
            label: 'floor.clearHoles',
            kind: 'action',
            // Its own holes: a stair's well is the stair's, and the button did nothing to it.
            when: (fs: readonly FloorSolid[]) => fs.some((f) => (f.floor.holes?.length ?? 0) > 0),
            run: () => act.clearFloorHoles!(ids),
          } as const,
        ]
      : []),
    ...(act.edgeRailing && floors.length === 1
      ? [{ id: 'edgeRailing', label: 'floor.edgeRailing', kind: 'action', enabled: (fs: readonly FloorSolid[]) => act.edgeRailing!(fs[0]!) !== null, run: () => act.edgeRailing!(floors[0]!)?.() } as const]
      : []),
  ];
}

/** A build-up's name when it is one of the usual ones as they are. */
const buildupOf = (layers: readonly FloorLayer[]): string | null => Object.keys(FLOOR_BUILDUPS).find((k) => JSON.stringify(FLOOR_BUILDUPS[k]) === JSON.stringify(layers)) ?? null;

/** A new tiling: 60 × 60 porcelain, 2 mm joints, laid square. */
const DEFAULT_TILING: Tiling = { width: 0.6, length: 0.6, joint: 0.002, pattern: 'grid', angle: 0 };

/** How much more is bought than laid: cuts and breakage. */
export const TILE_WASTE = 0.1;

/** How many pieces a floor takes: its area over a piece's with its joint, and the waste. */
export const tilesFor = (area: number, x: Tiling): number => Math.ceil((area / ((x.width + x.joint) * (x.length + x.joint))) * (1 + TILE_WASTE));

function tilingFields(floors: readonly FloorSolid[], ids: readonly FloorId[], act: FloorFieldActions): Field<FloorSolid>[] {
  const tiled = (fs: readonly FloorSolid[]) => fs.every((f) => f.floor.tiling);
  const set = (patch: Partial<Tiling>) => {
    const base = floors.find((f) => f.floor.tiling)?.floor.tiling;
    if (base) act.setFloorTiling(ids, { ...base, ...patch });
  };
  const of = (f: FloorSolid) => f.floor.tiling!;
  return [
    { id: 'tileWidth', label: 'floor.tileWidth', kind: 'number', icon: 'width', sub: true, min: 0.01, when: tiled, get: (f) => of(f).width, set: (v) => set({ width: v }) },
    { id: 'tileLength', label: 'floor.tileLength', kind: 'number', icon: 'height', sub: true, min: 0.01, when: tiled, get: (f) => of(f).length, set: (v) => set({ length: v }) },
    { id: 'tileJoint', label: 'floor.tileJoint', kind: 'number', icon: 'split', sub: true, min: 0, decimals: 3, when: tiled, get: (f) => of(f).joint, set: (v) => set({ joint: v }) },
    {
      id: 'tilePattern',
      label: 'floor.tilePattern',
      kind: 'select',
      icon: 'table',
      sub: true,
      when: tiled,
      options: TILE_PATTERNS.map((p) => ({ value: p, label: t(`tile.${p}`) })),
      get: (f) => of(f).pattern,
      set: (v) => set({ pattern: v as TilePattern }),
    },
    { id: 'tileAngle', label: 'floor.tileAngle', kind: 'number', icon: 'rotate', unit: '°', sub: true, when: tiled, get: (f) => of(f).angle, set: (v) => set({ angle: v }) },
    { id: 'tiles', label: 'floor.tiles', kind: 'readout', icon: 'hash', sub: true, when: tiled, text: (fs) => t('floor.tilesN', { n: fs.reduce((n, f) => n + tilesFor(f.area, of(f)), 0) }) },
  ];
}
