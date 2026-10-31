import type { HandleDrag } from './object-handles';
import type { OpeningSize } from '../ui/panels/opening';
import type { GuideMode } from '../elements/guide/tool-ui';
import type { Category, TemporaryView } from '../project/derived-filters';
import type { DimensionToolState } from '../tools/dimension-tool';
import type { Drag } from './drag';
import type { GuideDraft } from '../elements/guide/tool';
import type { MeasureMode, MeasureState } from '../elements/measure/tool';
import type { MessageKey } from '../i18n/messages';
import type { ModifyKind, ModifyState, OffsetLine } from './modify-tool';
import type { OpeningKind } from '../elements/opening/schema';
import type { OpeningToolState } from '../elements/opening/tool';
import type { Point2 } from '../model/vector';
import type { Snap } from './snap-types';
import type { ToolId, ViewId } from '../ui/shell';
import type { View3D } from '../project/view-prefs';
import type { WallDefaults } from '../project/doc';
import type { WallToolState } from '../elements/wall/tool';
import type { ElementId } from '../core/id';
import type { FloorId } from '../elements/room/schema';


export interface UiState {
  view: ViewId;
  tool: ToolId;
  selection: Set<ElementId>;
  hover: ElementId | null;
  /** With the room tool: the space with no room under the pointer, where a click makes one. */
  roomSpace: readonly Point2[] | null;
  /** That space was shown by a tap (a finger has no hover): a second tap in it makes the room. */
  tapToConfirm: boolean;
  levelId: string;
  theme: 'light' | 'dark';
  panelOpen: boolean;
  /** On a narrow screen, the panel shown by its button while it would wait hidden (renderFrame). */
  panelPeek: boolean;
  browserOpen: boolean;
  /** Categories hidden from view by the project browser (the document keeps them). */
  hidden: Set<Category>;
  /** Elements hidden or isolated for a while (Shift+H, Shift+I): in the views only, never saved. */
  temp: TemporaryView | null;
  snaps: boolean;
  /** What is moved or placed is stopped by what it would go into, nothing below the floor (app/collision.ts). */
  collisions: boolean;
  /** Into how many parts segments are divided for snapping (snap.ts, division points). */
  snapParts: number;
  /** Snap points Tab has passed over under the pointer (snap.ts, skip); emptied once it moves on. */
  snapSkip: Point2[];
  /** A direction the next point is held to (an arrow key, Shift: snap.ts, lock), from the point it was set at. */
  lock: { readonly dir: Point2; readonly label: MessageKey; readonly vars: Record<string, string | number>; readonly at: Point2; readonly by: 'arrow' | 'shift' } | null;
  /** Points the pointer rested on, to align with (snap.ts, acquired): three at most, until the tool changes. */
  acquired: Point2[];
  /** Where the point being drawn goes from, as last snapped; null when nothing is being drawn. */
  drawFrom: Point2 | null;
  /** Graphic overrides shown in plan (app/layer-sets.ts): on unless turned off. */
  overridesOn: boolean;
  /** The guide tool's mode, and its first point (a line's, a circle's centre). */
  guideMode: GuideMode;
  guideFrom: Point2 | null;
  /** A move's smart guides (tools/smart-guides.ts): alignments and equal gaps, while it is dragged. */
  smart: { readonly lines: readonly { a: Point2; b: Point2 }[]; readonly gaps: readonly { a: Point2; b: Point2 }[] } | null;
  defaults: WallDefaults;
  wall: WallToolState;
  opening: OpeningToolState;
  openingDefaults: Record<OpeningKind, OpeningSize>;
  snap: Snap | null;
  cursor: Point2 | null;
  error: string | null;
  /** A message that is not an error (what just happened, or why nothing did): shown in the footer's normal colour. */
  info: string | null;
  /** A move, stretch or window selection in progress: a preview until release. */
  drag: Drag | null;
  /** Corners of a floor outline being drawn. */
  floorDraft: Point2[];
  /** The measure tool's tape (measure-tool.ts). */
  measure: MeasureState;
  /** Two points, or a chain of stretches with its sum, angles and area (C switches). */
  measureMode: MeasureMode;
  /** The dimension tool's ends, before the dimension is made (dimension-tool.ts). */
  dimension: DimensionToolState;
  /** The grid tool's first point, before the axis is made. */
  gridFrom: Point2 | null;
  /** The section tool's first point (kind-tools.ts: sectionClick). */
  sectionFrom: Point2 | null;
  /** The callout tool's arrow point (kind-tools.ts: calloutClick). */
  calloutFrom: Point2 | null;
  /** A reference being calibrated: which, and its first point once clicked (reference-ui.ts). */
  calibrate: { readonly id: string; readonly a: Point2 | null } | null;
  /** The beam tool's first point, before the beam is made. */
  beamFrom: Point2 | null;
  /** The object tool's definition (elements/object), and the turn the next object is placed at (radians). */
  objectDef: string;
  objectAngle: number;
  /** The door tool's next door: its leaf to the side away from the pointer (Space), its hinge on the far jamb (H). */
  doorFlip: { readonly swing: boolean; readonly hinge: boolean };
  /** An object's handle being dragged (object-handles.ts): its preview until let go. */
  handleDrag: HandleDrag | null;
  /** Doors and windows shown open in 3D (a double click, the selection's Open): the view's, not saved. */
  opened: ReadonlySet<string>;
  /** The floor the floor tool's outline goes through as a hole (startFloorHole), or null for a new floor. */
  holeFor: FloorId | null;
  /** The floor tool making ceilings (a ceiling by a room or by an outline drawn), not floors. */
  ceilingTool: boolean;
  /** Corners of a roof's outline being drawn. */
  roofDraft: Point2[];
  /** The stair tool's first point (the first step's front), before its direction is clicked. */
  stairFrom: Point2 | null;
  /** Points of a guardrail's path being drawn. */
  railingDraft: Point2[];
  /** The measure tool (kind-tools.ts: markClick): what it measures, and its points so far. */
  markMode: MarkMode;
  markDraft: Point2[];
  /** The drawing scale of the saved plan view gone to (views-ui.ts), shown instead of the project's until another level or scale is chosen. */
  viewDen: number | null;
  /** A guide being placed (guide-tool.ts): Alt over a wall or a guide in a drawing tool. */
  guide: GuideDraft | null;
  /** How the 3D view shows the levels: which, exploded, cut (view-3d.ts). */
  view3d: View3D;
  /** Every wall's reference line shown in plan (the selected ones' always are). */
  refLines: boolean;
  /** Doors' and windows' type marks in plan (marks.ts). */
  openingTags: boolean;
  /** Space while drawing walls: their bodies go to the other side of the line drawn (Revit's flip). */
  wallFlip: boolean;
  /** The Modify tool in use (Move, Copy, Rotate, Scale, Mirror): its points so far; `copy` keeps the originals. */
  /** `disjoin` (Move, U): the walls go alone, the walls joined to them keeping their ends. */
  /** `line` (Offset): the selected straight wall the offset is measured across. */
  modify: { readonly kind: ModifyKind; readonly copy: boolean; readonly disjoin: boolean; readonly state: ModifyState; readonly line?: OffsetLine } | null;
  /** The temporary dimension whose value is being typed. */
  dimEdit: string | null;
}

/** What the measure tool measures (elements/measure). */
export type MarkMode = 'angle' | 'radius' | 'coord';

/** A name as a file name: what one cannot hold (\ / : * ? " < > |) becomes "-". */
/** The level list's last entry: opens the levels dialog. */
export const EDIT_LEVELS = '__edit_levels__';
