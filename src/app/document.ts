// The project document: only what the user decided. Thickness, heights, joins and geometry are
// always derived from it.

import type { Point2 } from '../core/vector';
import type { Opening, OpeningGroup } from '../elements/opening/schema';
import type { Floor, Room } from '../elements/room/schema';
import type { ReferenceLine, Wall, WallType, WallTypeId } from '../elements/wall/schema';

export type LevelId = string;

export interface Level {
  readonly id: LevelId;
  readonly name: string;
  /** Height of the floor above the project zero (m). */
  readonly elevation: number;
  /** Floor to floor height (m): a wall topped at its level reaches this. */
  readonly height: number;
}

/** A wall as the user placed it: the engine's wall plus where it stands and how high it goes. */
export interface DocWall extends Wall {
  readonly levelId: LevelId;
  readonly baseOffset: number;
  /** Top tied to the level height plus an offset, or a fixed height. */
  readonly top: { readonly kind: 'level'; readonly offset: number } | { readonly kind: 'fixed'; readonly height: number };
}

export interface Doc {
  readonly version: 2;
  readonly name: string;
  readonly levels: readonly Level[];
  readonly wallTypes: readonly WallType[];
  readonly walls: readonly DocWall[];
  /** Doors and windows, each hosted by a wall and placed by a rule. */
  readonly openings: readonly Opening[];
  /** Openings distributed together along one wall. */
  readonly openingGroups: readonly OpeningGroup[];
  /** Rooms: a point inside walls, a name and a number. */
  readonly rooms: readonly Room[];
  readonly floors: readonly Floor[];
}

/** Settings for the next walls the tool draws: interface state, kept out of the document. */
export interface WallDefaults {
  readonly wallTypeId: WallTypeId;
  readonly referenceLine: ReferenceLine;
  readonly baseOffset: number;
  readonly top: DocWall['top'];
}

export function newDocument(): Doc {
  return {
    version: 2,
    name: '',
    levels: [{ id: 'lvl_ground', name: 'Ground floor', elevation: 0, height: 2.8 }],
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
  };
}

export const levelOf = (doc: Doc, id: LevelId): Level | undefined => doc.levels.find((l) => l.id === id);

/** Bottom and top of a wall, derived from its level and constraints. */
export function wallHeights(doc: Doc, wall: DocWall): { bottom: number; top: number } {
  const level = levelOf(doc, wall.levelId) ?? { elevation: 0, height: 2.8 };
  const bottom = level.elevation + wall.baseOffset;
  const top = wall.top.kind === 'level' ? level.elevation + level.height + wall.top.offset : bottom + wall.top.height;
  return { bottom, top };
}

export const wallThickness = (doc: Doc, wall: Wall): number =>
  (doc.wallTypes.find((t) => t.id === wall.wallTypeId)?.layers ?? []).reduce((s, l) => s + l.thickness, 0);

export type { Point2 };
