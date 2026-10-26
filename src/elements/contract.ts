// The element contract (docs/plano-de-escopo.md, phase 1): what each kind of element tells the app about
// itself, so selection, moving, copying, deleting, saving, the plan, the 3D, the exports and the panel
// go through the registry (registry.ts) instead of a list written by hand in each of them. A new kind
// is its own file implementing this, and one line in the registry.

import type * as THREE from 'three';
import type { Doc } from '../app/document';
import type { Category } from '../app/geometry';
import type { Command } from '../core/store';
import type { Point2 } from '../core/vector';
import type { Transform } from '../tools/transform';
import type { Field } from '../ui/fields';
import type { MessageKey } from '../ui/i18n';
import type { IconName } from '../ui/icons';

/** The document's lists the registry's kinds keep. */
export type KindKey = 'columns' | 'beams' | 'roofs' | 'stairs' | 'railings' | 'notes' | 'grids';

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
}

/** What the DXF writer lends a kind. */
export interface DxfOut {
  readonly line: (layer: string, a: Point2, b: Point2) => void;
  readonly polyline: (layer: string, points: readonly Point2[], closed: boolean) => void;
  /** A TEXT of `height` (m) centred on `at`. */
  readonly text: (layer: string, at: Point2, height: number, text: string) => void;
}

/** A kind's 3D: a geometry in three.js coordinates, standing `y` up, in one of the scene's materials. */
export interface KindSolid {
  readonly geometry: THREE.BufferGeometry;
  readonly y: number;
  readonly material: 'side' | 'floor' | 'roof';
  /** Its edges drawn, as walls' are. */
  readonly edges: boolean;
}

/** Where a click finds it among the rest: before the walls (inside them), after them, or last of all. */
export type PickOrder = 'beforeWalls' | 'afterWalls' | 'last';

export interface ElementKind<E extends { readonly id: string; readonly levelId?: string }, S> {
  readonly key: KindKey;
  /** Its ids start with this and an underscore. */
  readonly prefix: string;
  /** The browser category that hides it; null for one that is always shown. */
  readonly category: Category | null;
  /** On every level (it has no level of its own): a grid axis. Not pasted onto another level. */
  readonly everyLevel?: true;
  /** Drawn in plan over the guides and the other kinds (a text). */
  readonly over?: true;
  readonly icon: IconName;
  /** The panel's title for one and for several ({n}). */
  readonly one: MessageKey;
  readonly many: MessageKey;
  /** The panel's icon and title, when they depend on what is selected (an axis's name, a level mark). */
  readonly title?: (items: readonly S[]) => { readonly icon: IconName; readonly text: string };
  /** A line under its fields in the panel. */
  readonly hint?: MessageKey;
  /** The file reader's word for the ones it dropped ({count}). */
  readonly dropped: MessageKey;
  /** A node's name in the GLB ({n}) and its material's name. */
  readonly exportName: MessageKey;
  readonly exportColour: 'structure' | 'floor' | 'roof';
  /** A valid one, read from a file. */
  readonly valid: (x: unknown) => x is E;
  /** As built, from the document. */
  readonly derive: (doc: Doc, e: E) => S;
  readonly element: (s: S) => E;
  /** Its outlines in plan at `scale` px a metre (a text's letters keep a size on screen): for a window
   * or crossing selection, framing, and bounds. */
  readonly outlines: (s: S, scale?: number) => readonly (readonly Point2[])[];
  /** Under the point p, within `near` (m), at `scale` px a metre. */
  readonly hit: (s: S, p: Point2, near: number, scale: number) => boolean;
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
  readonly solid?: (s: S) => KindSolid | null;
  /** Its DXF layers ({name, colour}) and what it writes on them for its level. */
  readonly dxfLayers?: readonly { readonly name: string; readonly colour: number }[];
  readonly dxf?: (s: S, out: DxfOut) => void;
  readonly fields: (items: readonly S[], dispatch: (c: Command<Doc>) => void) => Field<S>[];
}

/** A kind of any element: what the registry holds. */
// biome-ignore lint: the registry holds kinds of different element types.
export type AnyKind = ElementKind<any, any>;
