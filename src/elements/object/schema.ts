// Parametric objects as data (docs/plano-de-escopo.md, phase 3: "the family"): a definition lists its
// parameters, the parts it is made of (boxes and cylinders, repeated and conditional by formula, each in
// a material), the handles that drag a parameter, its types (ready values) and its rules. An instance in
// the project points to a definition and a type, and keeps only the values it overrides. Nothing here is
// code for one object: a table, a bookcase and a cabinet are the same machine with other data.

import type { MaterialId } from '../material/schema';

export const OBJECT_PREFIX = 'object';
export const DEFINITION_PREFIX = 'def';

export type DefinitionId = string;
export type ObjectId = string;

/** Words in the interface's two languages: a definition is data, so it carries its own names. */
export interface Words {
  readonly pt: string;
  readonly en: string;
}

export type ParamKind = 'length' | 'number' | 'integer' | 'bool' | 'choice' | 'material';

export interface ParamDef {
  /** Its name in formulas: letters, digits and _ (largura, prateleiras). */
  readonly name: string;
  readonly label: Words;
  readonly kind: ParamKind;
  /** Its value when neither the type nor the instance gives one (a material: its id; a choice: its index). */
  readonly default: number | string;
  readonly min?: number;
  readonly max?: number;
  /** Lengths and numbers round to it (a shelf to the centimetre). */
  readonly step?: number;
  /** A choice's options, in order (the value is the index). */
  readonly options?: readonly Words[];
  /** Calculated, not chosen: shown, never edited (the number of shelves from the height). */
  readonly formula?: string;
  /** In the panel's group under this name (Dimensions, Materials). */
  readonly group?: Words;
  /** Shown only when this formula is true. */
  readonly when?: string;
}

/** Where a part's corner or centre is, its size: numbers or formulas, in the object's own axes (x along
 * its width, y along its depth, z up from its base; x and y from its centre). */
export type Expr = number | string;

interface PartCommon {
  /** Exists only when this formula is not 0. */
  readonly when?: string;
  /** Repeated `count` times (a formula), each copy moved by (dx, dy, dz) more; formulas see `i` (0, 1, …). */
  readonly repeat?: { readonly count: Expr; readonly dx?: Expr; readonly dy?: Expr; readonly dz?: Expr };
  /** A material parameter's name, or a material's id. */
  readonly material?: string;
  /** Its name, for the GLB and the panel (Tampo, Pé). */
  readonly name?: Words;
  /** A void: taken out of the object's other parts (a sink's bowl in its counter, a hole), not drawn itself. */
  readonly cut?: boolean;
}

export type Part =
  /** A box from its lower corner (x, y, z), w along x, d along y, h up. */
  | (PartCommon & { readonly kind: 'box'; readonly x: Expr; readonly y: Expr; readonly z: Expr; readonly w: Expr; readonly d: Expr; readonly h: Expr; /** Its edges' radius: a cushion, a mattress, an appliance's corners (square when not set). */ readonly round?: Expr })
  /** An upright cylinder from the centre of its base. */
  | (PartCommon & { readonly kind: 'cylinder'; readonly x: Expr; readonly y: Expr; readonly z: Expr; readonly r: Expr; readonly h: Expr; /** Its top's radius: a cone, a lampshade (its base's when not set). */ readonly r2?: Expr })
  /**
   * A 2D profile extruded upward: its corners as formulas (x; y from the part's x, y), h up from z. The
   * formulas hold its shape as the parameters change (a counter's L, a gable, a chamfered top).
   */
  | (PartCommon & { readonly kind: 'profile'; readonly x: Expr; readonly y: Expr; readonly z: Expr; readonly points: readonly (readonly [Expr, Expr])[]; readonly h: Expr })
  /** A rounded mass from the centre of its base: r across, h up (a sphere when h is 2r; a tree's crown, a shrub, a lamp's globe). */
  | (PartCommon & { readonly kind: 'sphere'; readonly x: Expr; readonly y: Expr; readonly z: Expr; readonly r: Expr; readonly h: Expr })
  /** A mesh of the definition's (a model imported from glTF or OBJ), stretched to fill the box from its
   * lower corner (x, y, z), w along x, d along y, h up: its proportions are its parameters. */
  | (PartCommon & { readonly kind: 'mesh'; readonly mesh: string; readonly x: Expr; readonly y: Expr; readonly z: Expr; readonly w: Expr; readonly d: Expr; readonly h: Expr })
  /** Another definition inside this one (the handle in the door, the chair at the table), at (x, y, z),
   * turned `angle` degrees, its parameters given by formulas of this one's. */
  | (PartCommon & {
      readonly kind: 'object';
      readonly definition: DefinitionId;
      readonly x: Expr;
      readonly y: Expr;
      readonly z: Expr;
      readonly angle?: Expr;
      readonly values?: Readonly<Record<string, Expr>>;
    });

/** A handle: a point on the object (formulas) dragged along one of its axes changes a parameter. */
export interface HandleDef {
  readonly param: string;
  readonly axis: 'x' | 'y' | 'z';
  readonly at: readonly [Expr, Expr, Expr];
  /** How much of the change the object's position follows along the axis: 0.5 keeps the opposite face where
   * it was for a parameter measured across the centre (a width), 0 for one measured from the base. */
  readonly shift?: number;
  /** -1 for a handle on the negative side (dragging it outward makes the parameter grow). */
  readonly sign?: 1 | -1;
}

/** A rule: when the formula is true, the object says the message (a shelf too long to hold its load). */
export interface RuleDef {
  readonly when: string;
  readonly message: Words;
}

export interface ObjectType {
  readonly id: string;
  readonly name: Words;
  readonly values: Readonly<Record<string, number | string>>;
}

export type DefinitionCategory = 'furniture' | 'casework' | 'fixture' | 'equipment' | 'lighting' | 'plant' | 'generic';

export interface ObjectDefinition {
  readonly id: DefinitionId;
  readonly name: Words;
  readonly category: DefinitionCategory;
  /** The library's folder it is kept in (none: its category's). */
  readonly folder?: string;
  readonly params: readonly ParamDef[];
  readonly parts: readonly Part[];
  readonly handles: readonly HandleDef[];
  readonly types: readonly ObjectType[];
  readonly rules?: readonly RuleDef[];
  /** A light it gives (a luminaire): where, how strong (watts of LED, about 100 lm each) and how warm (K). */
  readonly light?: LightDef;
  /** Meshes its mesh parts draw (io/import-mesh.ts). */
  readonly meshes?: readonly MeshData[];
}

/**
 * A triangle mesh in a unit box: every vertex's x, y and z from 0 to 1 (x along the width, y the depth,
 * z up), the triangles' corners by index; and its outline in plan (its convex hull, x, y pairs in the
 * unit square) for the plan to draw.
 */
export interface MeshData {
  readonly id: string;
  readonly positions: readonly number[];
  readonly indices: readonly number[];
  readonly outline: readonly number[];
}

export interface LightDef {
  readonly x: Expr;
  readonly y: Expr;
  readonly z: Expr;
  readonly watts: Expr;
  readonly kelvin?: Expr;
}

export interface ObjectInstance {
  readonly id: ObjectId;
  readonly levelId: string;
  readonly definitionId: DefinitionId;
  /** One of its definition's types: what its values start from. */
  readonly typeId: string;
  /** Its centre in plan, and its turn (radians, counter-clockwise from +x). */
  readonly at: { readonly x: number; readonly y: number };
  readonly angle: number;
  /** Above its level's floor (m). */
  readonly elevation: number;
  /** The values it sets itself, over its type's. */
  readonly values: Readonly<Record<string, number | string>>;
}

export type MaterialRef = MaterialId;
