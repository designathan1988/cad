// The element contract (docs/plano-de-escopo.md, phase 1): what each kind of element tells the app about
// itself, so selection, moving, copying, deleting, saving, the plan, the 3D, the exports and the panel
// go through the registry (registry.ts) instead of a list written by hand in each of them. A new kind
// is its own file implementing this, and one line in the registry.

import type * as THREE from 'three';
import type { Doc } from '../project/doc';
import type { Material } from './material/schema';
import type { Detail, PenRole } from './drawing/schema';
import type { Category, DerivedGeometry } from '../project/derive';
import type { UprightPrism } from '../app/section-box';
import type { Command } from '../core/store';
import type { Point2 } from '../model/vector';
import type { Transform } from '../tools/transform';
import type { Field } from './fields';
import type { MessageKey } from '../i18n/messages';
import type { IconName } from '../i18n/icons';

/** The document's lists the registry's kinds keep. */
export type KindKey = 'measures' | 'references' | 'sections' | 'separators' | 'curtains' | 'zones' | 'columns' | 'beams' | 'roofs' | 'stairs' | 'railings' | 'objects' | 'notes' | 'grids' | 'guides' | 'dimensions' | 'floors' | 'rooms' | 'openings' | 'walls';

/** The derived geometry before the registry's kinds: what a kind held by walls and doors reads. */
export type BaseGeometry = Omit<DerivedGeometry, 'kinds'>;

/** What the plan view lends a kind to draw itself with. */
export interface PlanPaint {
  readonly ctx: CanvasRenderingContext2D;
  readonly toScreen: (p: Point2) => Point2;
  readonly color: (token: string) => string;
  /** Pixels a metre. */
  readonly scale: number;
  /** The interface's font family, and a font of its own sizes (`--fs-sm`) at a weight. */
  readonly family: string;
  readonly font: (weight: string, size: string) => string;
  /** A line through `point` along `dir` across the whole view, dashed. */
  readonly line: (point: Point2, dir: Point2, colour: string, width: number, dash: readonly number[]) => void;
  /** A pen's width in the plan's units (elements/drawing/schema.ts: a pixel on screen). */
  readonly pen: (role: PenRole) => number;
  /** How much the drawing's scale shows: layers at fine, outlines at medium, no furniture at coarse. */
  readonly detail: Detail;
}

/** What the DXF writer lends a kind. */
export interface DxfOut {
  readonly line: (layer: string, a: Point2, b: Point2) => void;
  readonly polyline: (layer: string, points: readonly Point2[], closed: boolean) => void;
  /** A TEXT of `height` (m) centred on `at`, turned `angle` degrees. */
  readonly text: (layer: string, at: Point2, height: number, text: string, angle?: number) => void;
  /**
   * An aligned DIMENSION measuring `a` to `b`, its line through `la`–`lb` and its text `value` at `textAt`:
   * what `draw` writes is its drawing (its anonymous block, as a CAD program shows it).
   */
  readonly dimension?: (layer: string, d: { readonly a: Point2; readonly b: Point2; readonly la: Point2; readonly lb: Point2; readonly textAt: Point2; readonly value: string }, draw: () => void) => void;
}

/** A kind's 3D: a geometry in three.js coordinates, standing `y` up, in one of the scene's materials or
 * in a material of the project (a parametric object's part). */
export interface KindSolid {
  readonly geometry: THREE.BufferGeometry;
  readonly y: number;
  readonly material: 'side' | 'floor' | 'roof' | Material;
  /** Its edges drawn, as walls' are. */
  readonly edges: boolean;
  /** Lights it gives (a luminaire's), in plan coordinates and height above its `y`. */
  readonly lights?: readonly { readonly x: number; readonly y: number; readonly z: number; readonly lumens: number; readonly color: string }[];
}

/** Where a click finds it among the rest: first (a dimension's line, over what it measures), before the
 * walls (inside them), after them, or last of all. */
export type PickOrder = 'first' | 'beforeWalls' | 'walls' | 'afterWalls' | 'last';

/** What a Modify tool tells a kind whose elements are held by others (a dimension by walls and doors). */
export interface TransformContext {
  readonly t: Transform;
  /** Its id after: its own in place, its copy's. */
  readonly id: string;
  /** Selected (taken whole), or only there while what holds it goes. */
  readonly selected: boolean;
  readonly copy: boolean;
  /** Whether a wall, or a door or window, goes along. */
  readonly going: (id: string) => boolean;
  /** The id a copied element got (its own when not copied). */
  readonly to: (id: string) => string;
  /** The document and its geometry before the tool. */
  readonly doc: Doc;
  readonly geometry: DerivedGeometry;
}

/** What a kind's fields in the panel can do: change the document, read it, or start a tool on one. */
export interface KindFieldContext {
  readonly dispatch: (c: Command<Doc>) => void;
  readonly doc: Doc;
  /** Draw a hole through a floor (the floor tool on it); not offered where there is no tool. */
  readonly startFloorHole?: (id: string) => void;
  /** Show a section's or an elevation's drawing (ui/sections-dialog.ts). */
  readonly openSection?: (id: string) => void;
  /** Make the rooms' four interior elevations (app/kind-tools.ts). */
  readonly interiorElevations?: (roomIds: readonly string[]) => void;
  /** Calibrate a reference by two points of it (app/reference-ui.ts). */
  readonly calibrate?: (id: string) => void;
  /** The model's derived geometry, for a readout measured on it (a dimension's ends). */
  readonly geometry?: DerivedGeometry;
}

/** Where a kind's text sits on screen, and its lines: what the room tags keep off. */
export interface KeepOut {
  readonly boxes: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly lines: readonly { readonly a: Point2; readonly b: Point2 }[];
}

export interface ElementKind<E extends { readonly id: string; readonly levelId?: string }, S> {
  readonly key: KindKey;
  /** Its ids start with this and an underscore. */
  readonly prefix: string;
  /** The browser category that hides it; null for one that is always shown. */
  readonly category: Category | null;
  /** On every level (it has no level of its own, but one may keep to its `levelId`): a grid axis. Not pasted onto another level. */
  readonly everyLevel?: true;
  /** Placed, moved, copied and deleted with its wall by the wall system (a door, a window: their rules
   * and groups): the registry's moving, copying and deleting leave it to the walls. */
  readonly walled?: true;
  /** Its level, for one whose element has none of its own (a door: its wall's). */
  readonly levelOf?: (s: S) => string;
  readonly levelIn?: (e: E, doc: Doc) => string | null;
  /** Drawn in plan under the walls (a floor), over the walls, the doors and the other kinds (a guide, a
   * text), or over the room tags too (`top`: a dimension, whose value under a room's name was lost). */
  readonly layer?: 'under' | 'over' | 'top';
  /** A line without ends (a guide): its outline is two points of it; framing counts the first only,
   * and only a crossing window takes it. */
  readonly endless?: true;
  readonly icon: IconName;
  /** The panel's title for one and for several ({n}). */
  readonly one: MessageKey;
  readonly many: MessageKey;
  /** The panel's icon and title, when they depend on what is selected (an axis's name, a level mark). */
  readonly title?: (items: readonly S[]) => { readonly icon: IconName; readonly text: string };
  /** A line under its fields in the panel. */
  readonly hint?: MessageKey;
  /** A problem with what is selected, said under its fields (a room not closed in). */
  readonly warning?: (items: readonly S[], doc: Doc) => string | null;
  /** The file reader's word for the ones it dropped ({count}). */
  readonly dropped: MessageKey;
  /** A node's name in the GLB ({n}) and its material's name. */
  readonly exportName: MessageKey;
  readonly exportColour: 'structure' | 'floor' | 'roof';
  /** A valid one, read from a file. */
  readonly valid: (x: unknown) => x is E;
  /** As built, from the document (and the walls and doors, for one held by them); null for one that is
   * nowhere (a door whose wall is gone). */
  readonly derive: (doc: Doc, e: E, g: BaseGeometry) => S | null;
  /** What its derivation depends on, when that is all (registry.ts: kept from one derivation to the
   * next while it is the same): the element itself, or the element and its level. Absent: derived each time. */
  readonly memo?: 'element' | 'level';
  /** The walls, doors and windows holding it: deleting one deletes it; one missing from a file drops it. */
  readonly holders?: (e: E) => readonly string[];
  /** Taken by a Modify tool when what holds it may go too: in place (every one, null keeps it as it
   * is), or copied (the selected ones, null leaves the copy out). Instead of `mapped`. */
  readonly transformed?: (e: E, c: TransformContext) => E | null;
  /** On screen, what the room tags keep off. */
  readonly keepOut?: (p: PlanPaint, s: S) => KeepOut | null;
  /** The element it follows (a room's floor its room): copied with it; deleted, it stands alone (`released`). */
  readonly follows?: (e: E) => string | null;
  /** On its own when what it follows is deleted (a room's floor keeps the outline it had). */
  readonly released?: (e: E, g: DerivedGeometry) => E;
  /** Its bottom and top (m): framed in 3D, under the ground. */
  readonly span?: (s: S) => { readonly bottom: number; readonly top: number };
  /** A surface the 3D pointer aims at (a floor), as at the walls. */
  readonly surface?: true;
  /** What a section's or a box's cut fills of it. */
  readonly caps?: (s: S) => readonly UprightPrism[];
  readonly element: (s: S) => E;
  /** Its outlines in plan at `scale` px a metre (a text's letters keep a size on screen): for a window
   * or crossing selection, framing, and bounds. */
  readonly outlines: (s: S, scale?: number) => readonly (readonly Point2[])[];
  /** Under the point p, within `near` (m), at `scale` px a metre. */
  readonly hit: (s: S, p: Point2, near: number, scale: number) => boolean;
  /** How far p is from it (0 inside): of those hit, the nearest is taken first. */
  readonly distance?: (s: S, p: Point2) => number;
  /** All it shows in plan, for framing (a door with its swing); its outlines when not given. */
  readonly extent?: (s: S) => readonly Point2[];
  /** A handle taken before everything else under the point (an axis's bubble). */
  readonly grab?: (s: S, p: Point2, scale: number) => boolean;
  readonly pick: PickOrder;
  /** Moved by d (arrows, a drag). */
  readonly moved: (e: E, d: Point2) => E;
  /** Taken by a Modify tool's transform, under `id` (its own, or its copy's). */
  readonly mapped: (e: E, t: Transform, id: string) => E;
  /** A copy as added after `all` (an axis named on from the last). */
  readonly copied?: (all: readonly E[], e: E) => E;
  /** Lying on a grid axis's line, so it goes with the axis. */
  readonly onGrid?: (e: E, onLine: (p: Point2) => boolean) => boolean;
  /** "Select similar": the same as `b`. */
  readonly similar?: (a: E, b: E) => boolean;
  readonly plan: (p: PlanPaint, s: S, lit: boolean) => void;
  /** Its 3D: one solid, or several (an object's parts, each in its material). */
  readonly solid?: (s: S) => KindSolid | readonly KindSolid[] | null;
  /** Its DXF layers ({name, colour}) and what it writes on them for its level. */
  readonly dxfLayers?: readonly { readonly name: string; readonly colour: number }[];
  readonly dxf?: (s: S, out: DxfOut) => void;
  readonly fields: (items: readonly S[], c: KindFieldContext) => Field<S>[];
}

/** A kind of any element: what the registry holds. */
// biome-ignore lint: the registry holds kinds of different element types.
export type AnyKind = ElementKind<any, any>;
