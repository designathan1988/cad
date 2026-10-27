// The project document: only what the user decided. Thickness, heights, joins and geometry are
// always derived from it.

import type { Site } from './sun';
import type { LayerSet, RoomOverride, WallOverride } from './layer-sets';
import type { Separator } from '../elements/separator/schema';
import type { Cloud } from '../elements/cloud/schema';
import type { Measure } from '../elements/measure/schema';
import type { Tag } from '../elements/tag/schema';
import type { Curtain } from '../elements/curtain/schema';
import type { Zone } from '../elements/zone/schema';
import type { SectionMark } from '../elements/section/schema';
import type { Reference } from '../elements/reference/schema';
import type { Terrain } from '../elements/terrain/schema';
import type { SimSettings } from '../sim/settings';
import type { Sheet } from '../elements/sheet/schema';
import type { Rule, RulePack } from '../rules/schema';
import type { Lot } from './lot';
import type { Costs } from '../costs/schema';
import type { Approval } from '../approval/schema';
import type { MepPoint, MepRun, MepSystem } from '../elements/mep/schema';
import { DEFAULT_DRAWING, type DrawingSettings } from '../elements/drawing/schema';
import { LIBRARY } from '../elements/object/library';
import type { ObjectDefinition, ObjectInstance } from '../elements/object/schema';
import { DEFAULT_UNITS, type Units } from '../ui/units';
import { BUILT_IN_MATERIALS, type Material } from '../elements/material/schema';
import { KINDS, listOf } from '../elements/registry';
import type { Railing } from '../elements/railing/schema';
import type { Stair } from '../elements/stair/schema';
import type { Roof } from '../elements/roof/schema';
import type { Beam } from '../elements/beam/schema';
import type { Column } from '../elements/column/schema';
import type { PointOfInterest } from './points';
import type { SavedView } from './saved-views';
import type { Point2 } from '../core/vector';
import type { Guide } from '../elements/guide/schema';
import type { Note } from '../elements/note/schema';
import type { Dimension } from '../elements/dimension/schema';
import type { Grid } from '../elements/grid/schema';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import type { Floor, Room } from '../elements/room/schema';
import type { HeightRule, ReferenceLine, Wall, WallType, WallTypeId } from '../elements/wall/schema';
import { highestUnder, type RoofCover, roofCovers } from '../elements/wall/geometry/under-roof';
import { roofSolid } from '../elements/roof/geometry';
import { toCounterClockwise } from '../elements/wall/geometry/convex';

export type LevelId = string;

export interface Level {
  readonly id: LevelId;
  readonly name: string;
  /** Height of the floor above the project zero (m). */
  readonly elevation: number;
  /** Floor to floor height (m): a wall topped at its level reaches this. */
  readonly height: number;
  /** Where its plan cuts the walls, above its floor (m); CUT_HEIGHT when not set. */
  readonly cutHeight?: number;
}

/** A plan's cut height above its level when the level sets none (m), as Revit's view range default. */
export const CUT_HEIGHT = 1.2;
export const cutHeightOf = (level: Level): number => level.cutHeight ?? CUT_HEIGHT;

/**
 * A wall as the user placed it: the engine's wall plus where it stands and how high it goes. Its base
 * offset and top are its own only when set; otherwise its type's (wallBase, wallTop).
 */
/** A wall's phase in a renovation: already there, or there to be demolished; none: new, to be built. */
export type WallPhase = 'existing' | 'demolish';

export interface DocWall extends Wall {
  readonly levelId: LevelId;
  readonly phase?: WallPhase;
  readonly baseOffset?: number;
  /** Top tied to the level height plus an offset, or a fixed height. */
  readonly top?: HeightRule;
}

export interface Doc {
  readonly version: 46;
  readonly name: string;
  /** How lengths are shown and typed (ui/units.ts); metres with 2 decimals by default. */
  readonly units: Units;
  readonly levels: readonly Level[];
  /** What the wall layers are made of: colour, finish and cut pattern (elements/material). */
  readonly materials: readonly Material[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly DocWall[];
  /** Doors and windows, each hosted by a wall and placed by a rule. */
  readonly openings: readonly Opening[];
  /** Openings distributed together along one wall. */
  readonly openingGroups: readonly OpeningGroup[];
  /** Rooms: a point inside walls, a name and a number. */
  readonly rooms: readonly Room[];
  readonly floors: readonly Floor[];
  /** Construction lines of a level's plan: drawing snaps to them; nothing is built from them. */
  readonly guides: readonly Guide[];
  /** Views saved under a name: a 3D camera, or a plan's level and framing (saved-views.ts). */
  readonly views: readonly SavedView[];
  /** Numbered places with a title and a text, opened as a card (points.ts). */
  readonly points: readonly PointOfInterest[];
  /** Text notes on the levels' plans (elements/note). */
  readonly notes: readonly Note[];
  /** Permanent dimensions, held by the walls, doors and windows they measure (elements/dimension). */
  readonly dimensions: readonly Dimension[];
  /** Grid axes, the same on every level (elements/grid). */
  readonly grids: readonly Grid[];
  /** Columns (elements/column). */
  readonly columns: readonly Column[];
  /** Beams (elements/beam). */
  readonly beams: readonly Beam[];
  /** Roofs (elements/roof). */
  readonly roofs: readonly Roof[];
  /** Stairs (elements/stair). */
  readonly stairs: readonly Stair[];
  /** Guardrails (elements/railing). */
  readonly railings: readonly Railing[];
  /** The parametric objects' definitions this project has: its library (elements/object). */
  readonly definitions: readonly ObjectDefinition[];
  /** Parametric objects placed (elements/object): a definition, a type, the values of its own. */
  readonly objects: readonly ObjectInstance[];
  /** Lines bounding rooms where there is no wall (elements/separator). */
  readonly separators: readonly Separator[];
  /** Revision clouds round what changed (elements/cloud). */
  readonly clouds: readonly Cloud[];
  /** Angular, radius, diameter, arc length and coordinate dimensions (elements/measure). */
  readonly measures: readonly Measure[];
  /** Texts by elements with their values (elements/tag). */
  readonly tags: readonly Tag[];
  /** Curtain walls (elements/curtain). */
  readonly curtains: readonly Curtain[];
  /** Rooms taken together under a name, a category and a colour (elements/zone). */
  readonly zones: readonly Zone[];
  /** Sections and elevations drawn from the model (elements/section), the same on every level. */
  readonly sections: readonly SectionMark[];
  /** Pictures and DXF drawings under the plan, to trace over (elements/reference). */
  readonly references: readonly Reference[];
  /** The lot's ground: its outline and spot heights (elements/terrain). */
  readonly terrains: readonly Terrain[];
  /** Building services: the points where a network meets a use, and the runs between them (elements/mep). */
  readonly mepPoints: readonly MepPoint[];
  readonly mepRuns: readonly MepRun[];
  /** The services' systems (elements/mep); the defaults, one per discipline, when it sets none. */
  readonly systems?: readonly MepSystem[];
  /** The norm rules it is checked against (rules/schema.ts); the defaults when it sets none. */
  readonly rules?: readonly Rule[];
  /** The packs those rules come in (rules/schema.ts); the defaults when it sets none. */
  readonly rulePacks?: readonly RulePack[];
  /** The lot: its address, registry, zone and parameters (app/lot.ts). */
  readonly lot?: Lot;
  /** The CUB, the price base, the budget's lines, BDI, other costs and stages (costs/schema.ts). */
  readonly costs?: Costs;
  /** The approval journey: its steps, documents and their states (approval/schema.ts). */
  readonly approval?: Approval;
  /** The plan's scale and the pens (elements/drawing/schema.ts); the defaults when it sets none. */
  readonly drawing?: DrawingSettings;
  /** Named lengths (m) typed by name in any measure: the ceiling height, a module (core/measure.ts). */
  readonly variables?: Readonly<Record<string, number>>;
  /** Named sets of the categories hidden (app/layer-sets.ts). */
  readonly layerSets?: readonly LayerSet[];
  /** Walls of a type filled in plan with a colour of their own (app/layer-sets.ts). */
  readonly overrides?: readonly WallOverride[];
  /** Rooms of a use filled in plan with a colour of their own (app/layer-sets.ts). */
  readonly roomOverrides?: readonly RoomOverride[];
  /** Where it is and the sun shown (app/sun.ts); the view's fixed light when not set. */
  readonly site?: Site;
  /** Sheets: papers with a title block and views placed on them (elements/sheet, app/sheets.ts). */
  readonly sheets?: readonly Sheet[];
  /** What the simulations assume (sim/settings.ts); the defaults when it sets none. */
  readonly simulation?: SimSettings;
}

/** Settings for the next walls the tool draws: interface state, kept out of the document. */
export interface WallDefaults {
  readonly wallTypeId: WallTypeId;
  readonly referenceLine: ReferenceLine;
  readonly baseOffset: number;
  readonly top: HeightRule;
}

/** The ids of every element that can be selected: walls, openings, rooms, floors and the registry's (elements/registry.ts). */
export const elementIds = (doc: Doc): Set<string> =>
  new Set(KINDS.flatMap((k) => listOf(doc, k)).map((e) => e.id));

export function newDocument(): Doc {
  return {
    version: 46,
    name: '',
    units: DEFAULT_UNITS,
    levels: [{ id: 'lvl_ground', name: 'Ground floor', elevation: 0, height: 2.8 }],
    materials: [...BUILT_IN_MATERIALS],
    wallTypes: [
      {
        id: 'wt_masonry15',
        name: 'Masonry 15 cm',
        layers: [
          { thickness: 0.015, function: 'finish1', materialId: 'plaster' },
          { thickness: 0.12, function: 'structure', materialId: 'brick' },
          { thickness: 0.015, function: 'finish2', materialId: 'plaster' },
        ],
      },
      {
        id: 'wt_masonry20',
        name: 'Masonry 20 cm',
        layers: [
          { thickness: 0.02, function: 'finish1', materialId: 'plaster' },
          { thickness: 0.16, function: 'structure', materialId: 'brick' },
          { thickness: 0.02, function: 'finish2', materialId: 'plaster' },
        ],
      },
      { id: 'wt_concrete20', name: 'Concrete 20 cm', layers: [{ thickness: 0.2, function: 'structure', materialId: 'concrete' }] },
      {
        id: 'wt_drywall10',
        name: 'Drywall 10 cm',
        layers: [
          { thickness: 0.0125, function: 'finish1', materialId: 'gypsum' },
          { thickness: 0.075, function: 'thermal', materialId: 'insulation' },
          { thickness: 0.0125, function: 'finish2', materialId: 'gypsum' },
        ],
      },
    ],
    walls: [],
    openings: [],
    openingGroups: [],
    rooms: [],
    floors: [],
    guides: [],
    views: [],
    points: [],
    notes: [],
    dimensions: [],
    grids: [],
    columns: [],
    beams: [],
    roofs: [],
    stairs: [],
    railings: [],
    definitions: [...LIBRARY],
    objects: [],
    separators: [],
    clouds: [],
    measures: [],
    tags: [],
    curtains: [],
    zones: [],
    sections: [],
    references: [],
    terrains: [],
    mepPoints: [],
    mepRuns: [],
  };
}

export const levelOf = (doc: Doc, id: LevelId): Level | undefined => doc.levels.find((l) => l.id === id);

/** A wall's number on its level (1, 2, 3… in the order drawn): how the interface names one wall. */
/**
 * The level to show at the start: the one shown last when it still exists; otherwise the lowest that
 * has something on it, so a project never opens on an empty level when another has content.
 */
export function startLevel(doc: Doc, shownLast?: string): string {
  if (shownLast !== undefined && doc.levels.some((l) => l.id === shownLast)) return shownLast;
  const used = new Set([...doc.walls, ...doc.rooms, ...doc.floors].map((x) => x.levelId));
  const byHeight = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  return (byHeight.find((l) => used.has(l.id)) ?? byHeight[0]!).id;
}

export function wallNumber(doc: Doc, id: string): number | null {
  const wall = doc.walls.find((w) => w.id === id);
  if (!wall) return null;
  return doc.walls.filter((w) => w.levelId === wall.levelId).indexOf(wall) + 1;
}

const LEVEL_TOP: HeightRule = { kind: 'level', offset: 0 };
const typeOf = (doc: Doc, wall: DocWall): WallType | undefined => doc.wallTypes.find((t) => t.id === wall.wallTypeId);

/** The wall's top: its own, else its type's, else its level's height. */
export const wallTop = (doc: Doc, wall: DocWall): HeightRule => wall.top ?? typeOf(doc, wall)?.top ?? LEVEL_TOP;
/** The wall's base offset: its own, else its type's, else none. */
export const wallBase = (doc: Doc, wall: DocWall): number => wall.baseOffset ?? typeOf(doc, wall)?.baseOffset ?? 0;

/**
 * The wall without a top or base offset that only repeats its type's (or the defaults): a wall has
 * its own value only when it differs, so it follows its type for the rest.
 */
export function ownValuesOnly(w: DocWall, types: readonly WallType[]): DocWall {
  const type = types.find((t) => t.id === w.wallTypeId);
  const { top, baseOffset, ...rest } = w;
  const sameTop = top === undefined || JSON.stringify(top) === JSON.stringify(type?.top ?? LEVEL_TOP);
  const sameBase = baseOffset === undefined || baseOffset === (type?.baseOffset ?? 0);
  return { ...rest, ...(sameTop ? {} : { top: top! }), ...(sameBase ? {} : { baseOffset: baseOffset! }) };
}

/** Which of its values a wall sets differently from its type (ref/chat.txt:214). */
export function wallOverrides(doc: Doc, wall: DocWall): { top: boolean; baseOffset: boolean } {
  const type = typeOf(doc, wall);
  const typeTop = type?.top ?? LEVEL_TOP;
  return {
    top: wall.top !== undefined && JSON.stringify(wall.top) !== JSON.stringify(typeTop),
    baseOffset: wall.baseOffset !== undefined && wall.baseOffset !== (type?.baseOffset ?? 0),
  };
}

/**
 * Bottom and top of a wall, derived from its level and constraints. Up to a level that is gone, or
 * under no roof, its own level's height. Under a roof, the highest its underside comes over the wall
 * (the 3D follows the slope: wall/geometry/under-roof.ts).
 */
export function wallHeights(doc: Doc, wall: DocWall): { bottom: number; top: number } {
  const level = levelOf(doc, wall.levelId) ?? { elevation: 0, height: 2.8 };
  const bottom = level.elevation + wallBase(doc, wall);
  const top = wallTop(doc, wall);
  const levelTop = level.elevation + level.height;
  switch (top.kind) {
    case 'level':
      return { bottom, top: levelTop + top.offset };
    case 'fixed':
      return { bottom, top: bottom + top.height };
    case 'toLevel': {
      const to = levelOf(doc, top.levelId);
      return { bottom, top: Math.max(bottom + 0.01, to ? to.elevation + top.offset : levelTop) };
    }
    case 'roof': {
      const under = highestUnder(roofCoversOf(doc, wall.levelId), wallBand(doc, wall));
      return { bottom, top: Math.max(bottom + 0.01, under ?? levelTop) };
    }
  }
}

/** The roofs of a level, from below (under-roof.ts); worked out once per roof. */
const covers = new WeakMap<Roof, RoofCover>();
export function roofCoversOf(doc: Doc, levelId: LevelId): RoofCover[] {
  const level = levelOf(doc, levelId) ?? { elevation: 0, height: 2.8 };
  return doc.roofs
    .filter((r) => r.levelId === levelId)
    .map((r) => {
      let c = covers.get(r);
      if (!c) covers.set(r, (c = roofCovers([roofSolid(r, level.elevation + level.height)])[0]!));
      return c;
    });
}

/** Where a wall stands in plan, generously: its line widened by its thickness to both sides. */
export function wallBand(doc: Doc, wall: DocWall): Point2[] {
  const t = Math.max(0.01, wallThickness(doc, wall));
  const dx = wall.end.x - wall.start.x;
  const dy = wall.end.y - wall.start.y;
  const l = Math.hypot(dx, dy) || 1;
  const n = { x: (-dy / l) * t, y: (dx / l) * t };
  // Past its ends too: a joined corner reaches beyond the wall's line.
  const u = { x: (dx / l) * t, y: (dy / l) * t };
  const s = { x: wall.start.x - u.x, y: wall.start.y - u.y };
  const e = { x: wall.end.x + u.x, y: wall.end.y + u.y };
  const band = [
    { x: s.x - n.x, y: s.y - n.y },
    { x: e.x - n.x, y: e.y - n.y },
    { x: e.x + n.x, y: e.y + n.y },
    { x: s.x + n.x, y: s.y + n.y },
  ];
  return [...toCounterClockwise(band)];
}

export const wallThickness = (doc: Doc, wall: Wall): number =>
  (doc.wallTypes.find((t) => t.id === wall.wallTypeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);

export type { Point2 };

/** The project's drawing scale and pens, the defaults when it has set none. */
export const drawingOf = (doc: Pick<Doc, 'drawing'>): DrawingSettings => doc.drawing ?? DEFAULT_DRAWING;
