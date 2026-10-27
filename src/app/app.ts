// Application state and rendering. The project changes only through the store; selection, tool,
// view, camera, language and theme are interface state, outside the document and outside undo.

import * as terrains from './terrain-ui';
import * as mepUi from './mep-ui';
import { type PointKind, systemIn } from '../elements/mep/schema';
import type { SimMap } from './sim-map';
import { pickModel } from './model-import';
import * as refs from './reference-ui';
import { onReferenceLoaded } from '../elements/kinds/reference';
import { autoDimensions } from '../elements/dimension/auto';
import { addDimensions } from '../elements/dimension/commands';
import { lengthText } from '../ui/units';
import { settleDimensions } from '../elements/dimension/constraints';
import type { Dimension } from '../elements/dimension/schema';
import type { SectionMark } from '../elements/section/schema';
import { deleteLayerSet, nextName, saveLayerSet } from './layer-sets';
import type { GuideMode } from './guide-ui';
import { setVariables } from '../core/measure';
import type { KeyMap } from './keymap';
import { arrangeNeeds, arrangeSteps, type ArrangeHow, type Box as ArrangeBox, boxOf } from '../tools/arrange';
import type { ScreenHandle } from './object-handles';
import type { HandleDrag } from './object-handles';
import { OBJECT_PREVIEW } from './kind-tools';
import type { ObjectInstance } from '../elements/object/schema';
import type { Action } from './actions';
import { lengthNum, setUnits } from '../ui/units';
import * as viewing from './view-ui';
import * as selecting from './selection-ui';
import * as walls from './wall-ui';
import * as chrome from './chrome';
import * as frame from './frame';
import * as modify from './modify-ui';
import * as roomsUi from './room-ui';
import * as guides from './guide-ui';
import * as kindTools from './kind-tools';
import * as walking from './walk-ui';
import * as pointsUi from './points-ui';
import * as views from './views-ui';
import * as files from './app-files';
import * as THREE from 'three';
import { createStore, type Store } from '../core/store';
import { distance, type Point2 } from '../core/vector';
import { addOpening, placementProblem, updateOpening } from '../elements/opening/commands';
import type { OpeningSize } from '../elements/opening/panel';
import { isOpeningId, newOpening, OPENING_DEFAULTS, OPENING_PREFIX, type Opening, type OpeningKind } from '../elements/opening/schema';
import { OPENING_IDLE, openingTransition, type OpeningToolEvent, type OpeningToolState } from '../tools/opening-tool';
import { MEASURE_IDLE, type MeasureEvent, type MeasureMode, type MeasureState, measureTransition } from '../tools/measure-tool';
import { type GuideBase, type GuideDraft } from '../tools/guide-tool';
import { type Guide } from '../elements/guide/schema';
import { aimAlong, OPENING_PREVIEW_ID } from './opening-ui';
import type { WallId } from '../elements/wall/schema';
import { type Insets, type PlanOverlay, PlanView } from '../render/plan-view';
import { Scene3D } from '../render/scene-3d';
import { Overlay3D, type Overlay3DState } from '../render/overlay-3d';
import { ViewCube } from '../render/view-cube';
import { getLang, htmlLang, markPrefix, name as wordsOf, setLang, t, type Lang, type MessageKey } from '../ui/i18n';
import { buildShell, type Shell, type ToolId, type ViewId } from '../ui/shell';
import { type Snap } from '../tools/snap';
import { IDLE, type WallToolEvent, type WallToolState } from '../tools/wall-tool';
import { type Drag, dragTransform, hull } from './select-drag';
import { filterKinds, hasSolid, kindLists, kindOfId, levelOfElement, levelOfSolid, listOf, moveKinds, eachSolid } from '../elements/registry';
import { type Grid } from '../elements/grid/schema';
import { DIMENSION_IDLE, type DimensionToolEvent, type DimensionToolState } from '../tools/dimension-tool';
import { geometryOf, keepRooms, moveRooms } from './carry';
import { keepOpenings } from './keep-openings';
import { type Doc, type DocWall, drawingOf, elementIds, levelOf, startLevel, type WallDefaults, wallNumber } from './document';
import type { DrawingSettings } from '../elements/drawing/schema';

/** The snap labels that name their wall. */
export const SNAP_OF = {
  endpoint: 'snap.endpointOf',
  midpoint: 'snap.midpointOf',
  onWall: 'snap.onWallOf',
  aligned: 'snap.alignedOf',
  perpendicular: 'snap.perpendicularOf',
  extension: 'snap.extensionOf',
  parallel: 'snap.parallelOf',
  intersection: 'snap.intersectionOf',
} as const;
import { applyTemporary, boundsOf, type Category, deriveGeometry, type DerivedGeometry, hideCategories, type OpeningSolid, type TemporaryView } from './geometry';
import { type Diagnostic, diagnose } from './diagnostics';
import { checkRules, type Finding, LOT_ELEMENT } from '../rules/check';
import { complianceHtml, simulationHtml } from './documents';
import { energyPlusIdf, fdsInput, radianceScene } from '../io/export-sim';
import type { SimSettings } from '../sim/settings';
import { showSimulations } from '../ui/simulation-dialog';
import { showLot } from '../ui/lot-dialog';
import { showBudget } from '../ui/budget-dialog';
import { showApproval } from '../ui/approval-dialog';
import { showServices } from '../ui/services-dialog';
import { type Rule, rulesOf } from '../rules/schema';
import { showRules } from '../ui/rules-dialog';
import { renderDebugPanel } from '../ui/debug-panel';
import { markPoint, openingMarks } from '../elements/opening/marks';
import { loadPrefs, savePrefs, scheduleSave, wireSaving } from './persist';
import type { Boot } from './boot';
import type { ViewKey } from './view-keys';
import { EYE_HEIGHT, EYE_MAX, EYE_MIN, obstaclesOf, type Walker } from './walk';
import { type BoxFace, type SectionBox } from './section-box';
import { type TempDim } from './temp-dims';
import { exploding, liftOf, readView3D, shownLevels, type View3D } from './view-3d';
import { type ModifyEvent, type ModifyKind, type ModifyState, type OffsetLine, previewTransform } from '../tools/modify-tool';
import { transformSelection } from '../tools/transform';
import { referenceLength } from '../elements/opening/derive';
import { doorFlips, type Handles, handlesFor } from './handles';
import { newId } from '../core/id';
import { insideRing } from '../elements/room/derive';

/** What the measure tool measures (elements/measure). */
export type MarkMode = 'angle' | 'radius' | 'coord';

export interface UiState {
  view: ViewId;
  tool: ToolId;
  selection: Set<WallId>;
  hover: WallId | null;
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
  /** The terrain the spot tool puts spot heights on (terrain-ui.ts). */
  spotFor: string | null;
  /** The beam tool's first point, before the beam is made. */
  beamFrom: Point2 | null;
  /** The object tool's definition (elements/object), and the turn the next object is placed at (radians). */
  objectDef: string;
  objectAngle: number;
  /** An object's handle being dragged (object-handles.ts): its preview until let go. */
  handleDrag: HandleDrag | null;
  /** Doors and windows shown open in 3D (a double click, the selection's Open): the view's, not saved. */
  opened: ReadonlySet<string>;
  /** The floor the floor tool's outline goes through as a hole (startFloorHole), or null for a new floor. */
  holeFor: string | null;
  /** The floor tool making ceilings (a ceiling by a room or by an outline drawn), not floors. */
  ceilingTool: boolean;
  /** The floor tool drawing a terrain's new outline (app/room-ui.ts). */
  terrainFor: string | null;
  /** Corners of a roof's outline being drawn. */
  roofDraft: Point2[];
  /** The stair tool's first point (the first step's front), before its direction is clicked. */
  stairFrom: Point2 | null;
  /** Points of a guardrail's path being drawn. */
  railingDraft: Point2[];
  /** The services' tools (app/mep-ui.ts): the kind of point placed, the system a run is drawn in, its points so far. */
  mepKind: PointKind;
  mepSystem: string;
  mepDraft: Point2[];
  /** The measure tool (kind-tools.ts: markClick): what it measures, and its points so far. */
  markMode: MarkMode;
  markDraft: Point2[];
  /** The drawing scale of the saved plan view gone to (views-ui.ts), shown instead of the project's until another level or scale is chosen. */
  viewDen: number | null;
  /** The tag tool's element, once clicked; then the click that places its text (kind-tools.ts: tagClick). */
  tagFor: string | null;
  /** A simulation's map over the plan (app/sim-map.ts): the Wi-Fi signal, the rooms' daylight or sun; none. */
  simMap: SimMap;
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

export const PREVIEW_ID = '__preview__';
/** A message going after a colon in another ("Cannot place it here: overlaps…"): lower case first. */
const afterColon = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
/** A name as a file name: what one cannot hold (\ / : * ? " < > |) becomes "-". */
export const safeFileName = (text: string): string => text.replace(/[\\/:*?"<>|]+/g, '-');
/** The level list's last entry: opens the levels dialog. */
export const EDIT_LEVELS = '__edit_levels__';

export class App {
  readonly store: Store<Doc>;
  readonly shell: Shell;
  readonly plan: PlanView;
  readonly scene: Scene3D;
  readonly cube: ViewCube;
  readonly overlay3d: Overlay3D;
  /** What the overlay showed last: drawn again as the camera turns, without a whole render. */
  overlayState: Overlay3DState | null = null;
  /** The object handle under the pointer (object-handles.ts), drawn lit. */
  hotHandle: ScreenHandle | null = null;
  readonly ui: UiState;
  geometry: DerivedGeometry;
  /** Each view is framed on its first show; after that the camera is the user's. */
  readonly framed = { plan: false, '3d': false };
  /** Where the plan was looking when the page was last left: its first show goes back there. */
  savedPlanView: { scale: number; center: Point2 } | null = null;
  planViewKept = '';
  planViewTimer = 0;
  panelDoc: Doc | null = null;
  panelKey = '';
  private toastTimer = 0;

  /** The browser's database and the open project's id there (boot.ts); null without a database. */
  db: IDBDatabase | null;
  projectId: string | null;

  constructor(root: HTMLElement, boot: Boot) {
    this.db = boot.db;
    this.projectId = boot.projectId;
    const prefs = loadPrefs();
    setLang(prefs.lang ?? (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'));
    document.documentElement.lang = htmlLang(getLang());
    // Every change to the walls, however it is made, keeps the doors and windows to what they are
    // measured from (keep-openings.ts), and the rooms it moves the walls past in their space.
    const store = createStore(boot.doc);
    onReferenceLoaded(() => this.render());
    this.store = {
      ...store,
      // Locked and equal dimensions are kept too (elements/dimension/constraints.ts): what holds them
      // follows, or the change is refused and said.
      dispatch: (c) => {
        let refused: Dimension | null = null;
        store.dispatch({
          label: c.label,
          apply: (before) => {
            const changed = c.apply(before);
            if (changed === before) return changed;
            const settled = settleDimensions(before, changed);
            if (!settled.ok) {
              refused = settled.dim;
              return before;
            }
            const next = settled.doc;
            return next.walls === before.walls ? next : keepRooms(before, keepOpenings(before, next)).doc;
          },
        });
        if (refused) this.toast(t((refused as Dimension).eq ? 'dim.refusedEqual' : 'dim.refusedLocked', { length: lengthText((refused as Dimension).locked ?? 0) }));
      },
    };
    const doc = this.store.get();
    this.ui = {
      view: prefs.view ?? 'plan',
      tool: 'select',
      selection: new Set(),
      hover: null,
      roomSpace: null,
      tapToConfirm: false,
      levelId: startLevel(doc, prefs.levelId),
      theme: prefs.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      panelOpen: prefs.panelOpen ?? true,
      panelPeek: false,
      browserOpen: prefs.browserOpen ?? false,
      hidden: new Set(),
      temp: null,
      snaps: prefs.snaps !== false,
      snapParts: prefs.snapParts ?? 3,
      snapSkip: [],
      lock: null,
      acquired: [],
      drawFrom: null,
      smart: null,
      overridesOn: true,
      guideMode: 'line',
      guideFrom: null,
      defaults: { wallTypeId: doc.wallTypes[0]!.id, referenceLine: 'centerline', baseOffset: 0, top: { kind: 'level', offset: 0 } },
      wall: IDLE,
      opening: OPENING_IDLE,
      openingDefaults: { door: { ...OPENING_DEFAULTS.door }, window: { ...OPENING_DEFAULTS.window } },
      snap: null,
      cursor: null,
      error: null,
      info: null,
      drag: null,
      floorDraft: [],
      measure: MEASURE_IDLE,
      measureMode: 'distance',
      dimension: DIMENSION_IDLE,
      gridFrom: null,
      sectionFrom: null,
      calloutFrom: null,
      calibrate: null,
      spotFor: null,
      beamFrom: null,
      objectDef: 'def_table',
      objectAngle: 0,
      handleDrag: null,
      opened: new Set(),
      holeFor: null,
      ceilingTool: false,
      terrainFor: null,
      roofDraft: [],
      stairFrom: null,
      railingDraft: [],
      mepKind: 'socket',
      mepSystem: 'sys_power',
      mepDraft: [],
      markMode: 'angle',
      markDraft: [],
      tagFor: null,
      viewDen: null,
      simMap: 'none',
      guide: null,
      view3d: readView3D(prefs.view3d),
      modify: null,
      refLines: prefs.refLines ?? false,
      openingTags: prefs.openingTags ?? true,
      wallFlip: false,
      dimEdit: null,
    };
    const pv = prefs.planView;
    if (pv && Number.isFinite(pv.scale) && pv.scale >= 2 && pv.scale <= 4000 && Number.isFinite(pv.center?.x) && Number.isFinite(pv.center?.y)) {
      this.savedPlanView = { scale: pv.scale, center: { x: pv.center.x, y: pv.center.y } };
    }
    this.shell = buildShell(root);
    this.plan = new PlanView(this.shell.planCanvas);
    this.scene = new Scene3D(this.shell.glCanvas);
    this.overlay3d = new Overlay3D(this.shell.overlay3d);
    this.cube = new ViewCube(
      (dir) => this.scene.frame(boundsOf(this.geometry), this.height(), dir),
      () => this.scene.frame(boundsOf(this.geometry), this.height()),
    );
    this.shell.viewport.append(this.cube.root);
    this.scene.onChange = () => {
      this.cube.update(this.scene.camera);
      this.placeFloatBar();
      // An open point's card follows its disc as the camera moves (orbit, flights, framing).
      if (this.ui.view === '3d') this.placePointCard();
      if (this.ui.view === '3d' && this.overlayState) this.overlay3d.draw(this.overlayState);
    };
    this.geometry = deriveGeometry(doc);
    wireSaving();
    this.store.subscribe((d) => {
      scheduleSave(d);
      this.ui.info = null;
      // Only what no longer exists leaves the selection: editing a room or a floor keeps it selected.
      const live = elementIds(d);
      for (const id of [...this.ui.selection]) if (!live.has(id)) this.ui.selection.delete(id);
      this.refresh();
    });
    // The first framing waits until the viewport has a size: framing a 0 × 0 canvas sets a useless scale.
    new ResizeObserver(() => {
      const r = this.shell.viewport.getBoundingClientRect();
      if (!this.framed[this.ui.view] && r.width > 0 && r.height > 0) this.frameFirst();
      else this.render();
    }).observe(this.shell.viewport);
    this.applyTheme();
    this.shell.relabel();
    this.cube.relabel();
    // The last project open could not be read: said, with why, before anything is done in this one.
    if (boot.notOpened) this.ui.error = t('boot.notOpened', { name: boot.notOpened.name || t('app.untitled'), why: t(`open.${boot.notOpened.error}`) });
    this.refresh();
  }

  height(): number {
    return Math.max(2.8, ...[...this.geometry.solids.values()].map((s) => s.top + this.lift(s.wall.levelId)));
  }

  /** How far up a level is drawn in 3D: exploded, each level above the one below; else not at all. */
  lift(levelId: string): number {
    const levels = this.store.get().levels;
    return this.ui.view === '3d' ? liftOf(levels, levelId, exploding(levels, this.ui.levelId, this.ui.view3d)) : 0;
  }

  /** The section box on, around what the 3D shows, or off. */
  toggleBox(): void {
    return viewing.toggleBox(this);
  }

  /** The box face whose handle is under the pointer or being dragged: drawn larger and filled. */
  boxHot: BoxFace | null = null;

  /** The box face whose handle is at a screen point (client coordinates), nearest first; null when none. */
  boxHandleAt(clientX: number, clientY: number): BoxFace | null {
    return viewing.boxHandleAt(this, clientX, clientY);
  }

  /** Pixels a face's handle moves on screen for 1 m out (its drag direction). */
  boxFaceOnScreen(face: BoxFace): Point2 {
    return viewing.boxFaceOnScreen(this, face);
  }

  /** The box as dragged: drawn now, kept with the view when `keep` (the drag's end). */
  setBox(box: SectionBox, keep: boolean): void {
    return viewing.setBox(this, box, keep);
  }

  /** Explode on or off; with one level shown, said why it does nothing instead. */
  toggleExplode(): void {
    return viewing.toggleExplode(this);
  }

  /** How the 3D view shows the levels; kept with the preferences, as the view is. */
  setView3D(patch: Partial<View3D>): void {
    return viewing.setView3D(this, patch);
  }

  /** Recomputes the derived geometry (with the wall being drawn) and redraws. */
  refresh(): void {
    const doc = this.store.get();
    const d = this.ui.drag;
    // The Modify tool's result as it would be with the pointer where it is, copies included.
    const m = this.ui.tool === 'modify' ? this.ui.modify : null;
    const t = m ? previewTransform(m.kind, m.state, this.ui.snap?.point ?? this.ui.cursor, m.line) : null;
    if (m && t) {
      let n = 0;
      const previewId = (prefix: string) => `${prefix}_preview${++n}`;
      const shownDoc = transformSelection(doc, this.modifyBefore ?? this.geometry, [...this.ui.selection], t, m.copy, previewId, m.disjoin).doc;
      // Doors and windows, and a room the walls would be moved past, as they will be when the move is made.
      this.geometry = keepRooms(doc, keepOpenings(doc, shownDoc)).geometry;
      return this.render();
    }
    // While dragging, the walls as dragged; the rooms going with a move or a turn go in the preview too,
    // so they never show as open mid-drag. The object tool shows the object under the pointer.
    const placed = this.previewObject(doc);
    const shown = placed ? placed :
      d?.kind === 'move' || d?.kind === 'rotate'
        ? {
            ...doc,
            walls: d.walls,
            rooms: moveRooms(doc.rooms, d.rooms, dragTransform(d)),
                ...(d.kind === 'move' ? kindLists(moveKinds(doc, d.kinds, d.delta)) : {}),
          }
        : d?.kind === 'slide'
          ? { ...doc, openings: d.openings }
          : d?.kind === 'dimLine'
            ? // A dimension's line where it is dragged.
              { ...doc, dimensions: doc.dimensions.map((x) => (x.id === d.id ? { ...x, offset: d.offset } : x)) }
            : d && d.kind !== 'marquee'
              ? { ...doc, walls: d.walls }
              : doc;
    // Walls being dragged: doors and windows keep to their faces and a room they pass over keeps its
    // space, as they will when the walls are dropped.
    const drawing = this.previewWall();
    const placing = this.previewOpening();
    this.geometry =
      shown.walls !== doc.walls
        ? keepRooms(doc, keepOpenings(doc, shown)).geometry
        : drawing.length === 0 && placing.length === 0
          ? geometryOf(shown)
          : deriveGeometry(shown, drawing, placing);
    this.render();
  }

  /** The object tool's object where the pointer is (snapped), as it would be placed; null otherwise. */
  previewObject(doc: Doc): Doc | null {
    // An object's handle dragged: the object as it would be with the value and position so far.
    const h = this.ui.handleDrag;
    if (h?.handle.opening) return { ...doc, openings: doc.openings.map((o) => (o.id === h.handle.id ? { ...o, ...h.patch } : o)) };
    if (h) return { ...doc, objects: doc.objects.map((o) => (o.id === h.handle.id ? { ...o, at: h.at, values: { ...o.values, [h.handle.param]: h.value } } : o)) };
    const at = this.ui.tool === 'object' && this.ui.view === 'plan' ? (this.ui.snap?.point ?? this.ui.cursor) : null;
    const def = doc.definitions.find((d) => d.id === this.ui.objectDef);
    if (!at || !def) return null;
    const preview: ObjectInstance = { id: OBJECT_PREVIEW, levelId: this.ui.levelId, definitionId: def.id, typeId: def.types[0]!.id, at: { x: at.x, y: at.y }, angle: this.ui.objectAngle, elevation: 0, values: {} };
    return { ...doc, objects: [...doc.objects, preview] };
  }

  /** The object tool with a definition (the ribbon's and the palette's Place table, Place bookcase…). */
  placeObject(definitionId: string): void {
    this.ui.objectDef = definitionId;
    this.setTool('object');
  }

  /** Space with the object tool: the next object a quarter turn on. */
  turnObject(): void {
    this.ui.objectAngle = (this.ui.objectAngle + Math.PI / 2) % (2 * Math.PI);
    this.refresh();
  }

  /** The door or window tool's kind, or null for the other tools. */
  openingKind(): OpeningKind | null {
    return this.ui.tool === 'door' || this.ui.tool === 'window' ? this.ui.tool : null;
  }

  previewOpening(): Opening[] {
    const kind = this.openingKind();
    const o = this.ui.opening;
    if (!kind || o.kind !== 'aiming') return [];
    return [newOpening(OPENING_PREVIEW_ID, o.aim.wallId, kind, o.rule, { ...this.ui.openingDefaults[kind], swing: o.aim.side })];
  }

  openingEvent(event: OpeningToolEvent): void {
    const kind = this.openingKind();
    if (!kind) return;
    const r = openingTransition(this.ui.opening, event, this.ui.openingDefaults[kind].width);
    this.ui.opening = r.state;
    if (r.place) {
      const size = this.ui.openingDefaults[kind];
      const opening = newOpening(newId(OPENING_PREFIX), r.place.wallId, kind, r.place.rule, { ...size, swing: r.place.swing });
      const problem = placementProblem(this.store.get(), opening);
      if (problem) {
        this.ui.error = t('hint.openingRefused', { reason: afterColon(t(`warn.${problem}`)) });
        return this.refresh();
      }
      this.ui.error = null;
      // Placed: no preview until the pointer aims again. Left aiming at the same spot, the preview lay
      // over the opening just placed, red, with "overlaps another opening", as if it had been refused.
      this.ui.opening = OPENING_IDLE;
      this.store.dispatch(addOpening(opening));
    } else this.refresh();
  }

  /** While aiming: why the opening cannot go there, said before the click. */
  previewProblem(): string | null {
    const p = this.geometry.openings.get(OPENING_PREVIEW_ID);
    const k = p?.warnings.find((w) => w === 'openingOverlap' || w === 'openingOutside');
    return k ? t('hint.openingRefused', { reason: afterColon(t(`warn.${k}`)) }) : null;
  }

  /** The smallest space the level's walls close in around p, when no room is in it: where the room tool would make one. */
  roomSpaceAt(p: Point2): readonly Point2[] | null {
    return roomsUi.roomSpaceAt(this, p);
  }

  /** The room tool: a click inside closed walls makes a room there, unless one is there already. */
  roomClick(p: Point2): void {
    return roomsUi.roomClick(this, p);
  }

  /**
   * The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. A typed
   * point is always a corner, as the footer says: typing inside a room draws an outline there.
   */
  floorClick(p: Point2, mpp: number, typed = false, corner = p): void {
    return roomsUi.floorClick(this, p, mpp, typed, corner);
  }

  /** Draws a hole in a floor: the floor tool, its outline then going through that floor. */
  startFloorHole(floorId: string): void {
    return roomsUi.startFloorHole(this, floorId);
  }

  /** A ceiling following a room's outline, at the room's ceiling height (its own, or its level's). */
  addCeilingToRoom(roomId: string): void {
    return roomsUi.addCeilingToRoom(this, roomId);
  }

  /** A floor following a room's outline; said and selected at once, so it is seen without another click. */
  addFloorToRoom(roomId: string): void {
    return roomsUi.addFloorToRoom(this, roomId);
  }

  /** Opens the properties panel and puts the keyboard in it. */
  showProperties(): void {
    if (!this.ui.panelOpen) this.togglePanel(true);
    this.render();
    const first = this.shell.panel.querySelector<HTMLElement>('input, select, button:not([disabled])');
    (first ?? this.shell.panel).focus();
  }

  floorFinish(): void {
    return roomsUi.floorFinish(this);
  }

  startCeiling(): void {
    return roomsUi.startCeiling(this);
  }

  startTerrainOutline(id: string): void {
    return roomsUi.startTerrainOutline(this, id);
  }

  selectedOpenings(): OpeningSolid[] {
    return [...this.ui.selection].filter(isOpeningId).flatMap((id) => this.geometry.openings.get(id) ?? []);
  }

  previewWall(): DocWall[] {
    return walls.previewWall(this);
  }

  /** The numbers of the walls selected (a few) or under the pointer, or snapped to while drawing. */
  wallTags(): { at: Point2; text: string }[] {
    return walls.wallTags(this);
  }

  /** While turning the selection: the angle, at the point it turns about. */
  turnMeasure(): { at: Point2; text: string } | null {
    return walls.turnMeasure(this);
  }

  /** While bending an arc: its radius, at the middle of the arc, set off outward. Null for a straight bend. */
  bendMeasure(): { at: Point2; text: string; normal: Point2; clear: number } | null {
    return walls.bendMeasure(this);
  }

  /** The rectangle's opposite corner: its typed sides ("w;d", toward the cursor) when typed, else the cursor. */
  rectCorner(): Point2 {
    return walls.rectCorner(this);
  }

  /** The end of the segment being drawn: the typed length (and angle) when there is one, else the cursor. */
  drawingEnd(): Point2 {
    return walls.drawingEnd(this);
  }

  /**
   * The wall drawn from `start` to `end`, turned round when Space flipped the side: the same line, the
   * body on its other side (its exterior is on the right of its direction, so the direction is what flips).
   */
  oriented(start: Point2, end: Point2, id: string, bulge = 0): DocWall {
    return walls.oriented(this, start, end, id, bulge);
  }

  /** Space while drawing walls. */
  toggleWallFlip(): void {
    return walls.toggleWallFlip(this);
  }

  /** Doors' and windows' type marks in plan, on or off; kept with the preferences. */
  toggleOpeningTags(): void {
    this.ui.openingTags = !this.ui.openingTags;
    savePrefs({ openingTags: this.ui.openingTags });
    this.render();
  }

  /** The type marks of the openings shown, where their tags go (marks.ts), when shown at all. */
  openingTags(): { at: Point2; text: string; width: number }[] {
    if (!this.ui.openingTags || this.ui.hidden.has('openings')) return [];
    const marks = openingMarks(this.store.get().openings, markPrefix());
    const g = this.visibleGeometry();
    const rooms = [...g.rooms.values()].filter((r) => r.enclosed && r.room.levelId === this.ui.levelId);
    const inRoom = (p: Point2) => rooms.some((r) => insideRing(r.outline, p));
    return [...g.openings.values()].flatMap((o) =>
      o.frame ? [{ at: markPoint(o.frame, o.opening, 0.25, inRoom), text: marks.get(o.opening.id) ?? '', width: o.opening.width }] : [],
    );
  }

  /** Every wall's reference line in plan, or only the selected ones'; kept with the preferences. */
  toggleRefLines(): void {
    this.ui.refLines = !this.ui.refLines;
    savePrefs({ refLines: this.ui.refLines });
    this.render();
  }

  /** The reference lines to show: every wall's when asked for, the selected ones' and the one being drawn. */
  refLines(): { start: Point2; end: Point2; bulge?: number }[] {
    const ids = new Set(this.ui.selection);
    const shown = [...this.visibleGeometry().solids.values()].map((s) => s.wall).filter((w) => this.ui.refLines || ids.has(w.id) || w.id.startsWith(PREVIEW_ID));
    return shown.map((w) => ({ start: w.start, end: w.end, ...(w.bulge ? { bulge: w.bulge } : {}) }));
  }

  makeWall(start: Point2, end: Point2, id = newId('wall'), bulge = 0): DocWall {
    return walls.makeWall(this, start, end, id, bulge);
  }

  /** A world point on the current level, on the screen (viewport pixels); null when behind the camera. */
  toScreen(p: Point2): Point2 | null {
    if (this.ui.view === 'plan') return this.plan.toScreen(p);
    return this.projectAt(p, (this.store.get().levels.find((l) => l.id === this.ui.levelId)?.elevation ?? 0) + this.lift(this.ui.levelId));
  }

  /** A world point at a height, on the screen of the 3D view (viewport pixels); null when behind the camera. */
  projectAt(p: Point2, z: number): Point2 | null {
    const v = new THREE.Vector3(p.x, z, -p.y).project(this.scene.camera);
    if (v.z > 1) return null;
    const r = this.shell.viewport.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  /** A piece's outline on the screen: the polygon in plan, the hull of its prism in 3D (lifted with its level). */
  outlineOnScreen(poly: readonly Point2[], bottom: number, top: number, lift = 0): Point2[] {
    if (this.ui.view === 'plan') return poly.map((p) => this.plan.toScreen(p));
    const r = this.shell.viewport.getBoundingClientRect();
    const pts: Point2[] = [];
    for (const p of poly) {
      for (const z of [bottom + lift, top + lift]) {
        const v = new THREE.Vector3(p.x, z, -p.y).project(this.scene.camera);
        if (v.z <= 1) pts.push({ x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height });
      }
    }
    return hull(pts);
  }

  // ---- actions -------------------------------------------------------------------------------

  setTool(tool: ToolId): void {
    // The floor tool with one room selected floors that room at once: the keyboard's way to it, as a
    // click inside the room is the mouse's (the tester's K3).
    const room = tool === 'floor' && this.ui.selection.size === 1 ? this.store.get().rooms.find((r) => this.ui.selection.has(r.id)) : undefined;
    // The door and window tools with one wall selected aim at its middle: a typed distance or Enter
    // places the opening there without the pointer (the tester's K2).
    const host = (tool === 'door' || tool === 'window') && this.ui.selection.size === 1 ? this.store.get().walls.find((w) => this.ui.selection.has(w.id)) : undefined;
    this.ui.tool = tool;
    this.ui.wall = IDLE;
    // A lock and the points rested on belong to what was being drawn.
    this.ui.lock = null;
    this.ui.guideFrom = null;
    this.ui.acquired = [];
    this.ui.roomSpace = null;
    this.ui.tapToConfirm = false;
    // A side flipped for some walls is not left for later ones, drawn another time.
    this.ui.wallFlip = false;
    this.ui.opening = OPENING_IDLE;
    this.ui.floorDraft = [];
    this.ui.measure = MEASURE_IDLE;
    this.ui.dimension = DIMENSION_IDLE;
    this.ui.gridFrom = null;
    this.ui.sectionFrom = null;
    this.ui.calloutFrom = null;
    this.ui.beamFrom = null;
    this.ui.holeFor = null;
    this.ui.ceilingTool = false;
    this.ui.terrainFor = null;
    this.ui.roofDraft = [];
    this.ui.stairFrom = null;
    this.ui.railingDraft = [];
    this.ui.mepDraft = [];
    this.ui.markDraft = [];
    this.ui.tagFor = null;
    this.ui.guide = null;
    this.ui.modify = null;
    this.modifyBefore = null;
    this.ui.snap = null;
    this.ui.hover = null;
    this.ui.error = null;
    this.ui.info = null;
    this.shell.measure.value = '';
    if (tool !== 'select') this.ui.selection.clear();
    if (room) {
      const has = this.store.get().floors.find((f) => f.source.kind === 'room' && f.source.roomId === room.id);
      if (!has) return this.addFloorToRoom(room.id);
      this.ui.selection = new Set([has.id]);
      this.ui.info = t('hint.floorExists');
    }
    if (host) {
      const aim = aimAlong(this.store.get(), this.geometry, host.id, referenceLength(host) / 2, 1 / this.plan.scale, OPENING_PREVIEW_ID);
      if (aim) return this.openingEvent({ kind: 'hover', aim });
    }
    this.refresh();
  }

  setView(view: ViewId): void {
    return viewing.setView(this, view);
  }

  /** A view's first show: the plan where it was left before a reload, else everything framed. */
  frameFirst(): void {
    return viewing.frameFirst(this);
  }

  /** The plan's zoom and position, kept for the next visit once they have been still for a moment. */
  private keepPlanView(): void {
    return viewing.keepPlanView(this);
  }

  /**
   * The view as it is now, saved in the project under the next free name ("3D 1", "Térreo 1"): the 3D
   * camera and what the 3D shows, or the plan's level, zoom and position.
   */
  saveCurrentView(): void {
    return views.saveCurrentView(this);
  }

  /** Back to a saved view: its level, and its camera or its plan framing. Not an undo step. */
  goToView(id: string): void {
    return views.goToView(this, id);
  }

  deleteSavedView(id: string): void {
    return views.deleteSavedView(this, id);
  }

  /** Where the right-click menu was opened (plan point), while its entries are made (input.ts). */
  contextPoint: Point2 | null = null;
  /** The guided tour being played (tour-dialog.ts): which stop, and whether it goes on by itself. */
  tour: { index: number; playing: boolean } | null = null;
  tourTimer = 0;
  /** How long each stop of the tour lasts when it plays by itself (s), kept with the preferences. */
  tourSeconds = (() => {
    const s = loadPrefs().tourSeconds;
    return typeof s === 'number' && s >= 1 ? s : 5;
  })();

  setTourSeconds(s: number): void {
    return views.setTourSeconds(this, s);
  }

  /** The tour from a stop (the first by default), going on by itself. */
  playTour(from = 0): void {
    return views.playTour(this, from);
  }

  /** The next (+1) or the previous (−1) stop; past the last, the tour ends; it keeps playing or paused. */
  tourStep(step: 1 | -1): void {
    return views.tourStep(this, step);
  }

  tourPause(): void {
    return views.tourPause(this);
  }

  stopTour(): void {
    return views.stopTour(this);
  }

  /** The stop the tour is at: flown to in 3D, gone to in plan; the next one after its time. */
  showStop(): void {
    return views.showStop(this);
  }

  /** The point of interest whose card is open, or null. */
  openPointId: string | null = null;

  /** A point of interest where the menu was opened (or the middle of the view), its card open to edit. */
  addPointHere(at?: Point2): void {
    return pointsUi.addPointHere(this, at);
  }

  /** The points of the level shown (all levels in 3D), numbered as in the document, where they are drawn. */
  pointsShown(): { id: string; n: number; at: Point2; z: number; open: boolean }[] {
    return pointsUi.pointsShown(this);
  }

  /** The point of interest whose disc is at a screen point (client coordinates), or null. */
  pointAt(clientX: number, clientY: number): string | null {
    return pointsUi.pointAtHere(this, clientX, clientY);
  }

  /** A point's card opened (or closed with null). */
  showPoint(id: string | null): void {
    return pointsUi.showPoint(this, id);
  }

  /** The open point's card: its title and text, beside its disc; hidden when none is open or it is off screen. */
  placePointCard(): void {
    return pointsUi.placePointCard(this);
  }

  /** Opens the points dialog; set by the input layer. */
  openPoints: () => void = () => {};
  /** Opens the projects kept in the browser; set by the input layer. */
  openProjects: () => void = () => {};

  /** Walking through the model (walk.ts), or null. Interface state: never saved. */
  walker: Walker | null = null;
  /** The walker's eyes above the floor (m), kept with the preferences. */
  eyeHeight = (() => {
    const h = loadPrefs().eyeHeight;
    return typeof h === 'number' && h >= EYE_MIN && h <= EYE_MAX ? h : EYE_HEIGHT;
  })();
  /** The on-screen stick (touch, or a mouse): forward and sideways, −1..1, while it is held. */
  walkStick: { forward: number; side: number } | null = null;
  /** Keys held while walking: what the next frames move by. */
  readonly walkKeys = new Set<string>();
  walkFrame = 0;
  walkLast = 0;
  walkObstacles: { from: DerivedGeometry; levelId: string; list: ReturnType<typeof obstaclesOf> } | null = null;

  /**
   * Walk mode on, at a point (where the user asked) or the middle of the level's largest room: in the 3D
   * view, at eye height, looking up the plan. Off again with Esc, the camera as it was.
   */
  enterWalk(at?: Point2): void {
    return walking.enterWalk(this, at);
  }

  exitWalk(): void {
    return walking.exitWalk(this);
  }

  toggleWalk(): void {
    return walking.toggleWalk(this);
  }

  /** The eyes higher or lower by `step` (m), within EYE_MIN..EYE_MAX; said in the footer. */
  walkEye(step: number): void {
    return walking.walkEye(this, step);
  }

  /** Turns the view: a drag of dx, dy pixels. */
  walkLook(dx: number, dy: number): void {
    return walking.walkLook(this, dx, dy);
  }

  /** To the level above (+1) or below (−1), at the same point of the plan. */
  walkLevel(step: 1 | -1): void {
    return walking.walkLevel(this, step);
  }

  walkTick(now: number): void {
    return walking.walkTick(this, now);
  }

  /** The walls that stop the walker on a level, again only when the walls change. */
  obstaclesHere(levelId: string): ReturnType<typeof obstaclesOf> {
    return walking.obstaclesHere(this, levelId);
  }

  /** The camera at the walker's eyes. */
  placeWalker(): void {
    return walking.placeWalker(this);
  }

  /** The guides of the level shown, unless hidden, as a move being dragged takes them. Plan only: they
   * are neither drawn nor snapped to in 3D. */
  levelGuides(): Guide[] {
    return guides.levelGuides(this);
  }

  guideShapes(): ReturnType<typeof guides.guideShapes> {
    return guides.guideShapes(this);
  }

  setGuideTool(mode: GuideMode): void {
    return guides.setGuideTool(this, mode);
  }

  guideClick(p: Point2): void {
    return guides.guideClick(this, p);
  }

  guideRadius(radius: number): boolean {
    return guides.guideRadius(this, radius);
  }

  /** A level mark where the menu was opened (or the middle of the view), selected: it says the level's height. */
  addLevelMarkHere(at?: Point2): void {
    return kindTools.addLevelMarkHere(this, at);
  }

  /** A text note where the menu was opened (or the middle of the view), selected, its text ready to type in the panel. */
  addNoteHere(at?: Point2): void {
    return kindTools.addNoteHere(this, at);
  }

  /** Starts a guide off a wall's face or a guide, at the distance the pointer at p sets (guide-tool.ts). */
  startGuide(base: GuideBase, p: Point2): void {
    return guides.startGuide(this, base, p);
  }

  moveGuide(p: Point2): void {
    return guides.moveGuide(this, p);
  }

  /** The guide's distance: the one being typed, while it reads as one, else the pointer's. */
  guideOffset(): number | null {
    return guides.guideOffset(this);
  }

  /** Places the guide being set, as one undo step; the drawing tool goes on as it was. */
  placeGuide(offset = this.guideOffset()): void {
    return guides.placeGuide(this, offset);
  }

  cancelGuide(): void {
    return guides.cancelGuide(this);
  }

  /** Every guide of the level shown, as one undo step. */
  clearGuides(): void {
    return guides.clearGuidesHere(this);
  }

  /** The geometry before a Modify tool started: which rooms go with the walls (transform.ts). */
  modifyBefore: DerivedGeometry | null = null;

  /** Starts Move, Copy, Rotate, Scale or Mirror on the selection; said why not when there is nothing they take. */
  startModify(kind: ModifyKind): void {
    return modify.startModify(this, kind);
  }

  /** C in a Modify tool: copy, or take the originals. */
  toggleModifyCopy(): void {
    return modify.toggleModifyCopy(this);
  }

  /** U in Move: the walls alone, leaving their joins (Revit's Disjoin), or with them. */
  toggleModifyDisjoin(): void {
    return modify.toggleModifyDisjoin(this);
  }

  /** A click, a typed value or Esc in a Modify tool (modify-tool.ts); the transform, when done, is one undo step. */
  modifyEvent(event: ModifyEvent): void {
    return modify.modifyEvent(this, event);
  }

  /** The last copy made by a step (Move or Copy with C), while nothing has changed since: a series can replace it. */
  lastCopy: {
    readonly before: Doc;
    readonly geometry: DerivedGeometry;
    readonly ids: readonly string[];
    readonly delta: Point2;
    readonly after: Doc;
    readonly selected: readonly string[];
  } | null = null;

  /**
   * Whether "3x" or "/3" typed now would make a series of the last copy: nothing changed since, and the
   * copy still the selection (another click gives the digits back to the view keys).
   */
  seriesReady(): boolean {
    return modify.seriesReady(this);
  }

  /**
   * The last copy made a series, as SketchUp's Move-copy and Revit's Array: `n` copies one after
   * another at its step ("3x"), or, `divide`, `n` copies spread evenly from the original to where the
   * copy went ("/3"). It replaces the copy: one undo step, the last copy of the series selected.
   */
  copySeries(n: number, divide: boolean): boolean {
    return modify.copySeries(this, n, divide);
  }

  /** The Split tool: the wall under the point divided there (tools/split.ts), as one undo step. */
  splitAt(point: Point2, wallId: string | undefined): void {
    return modify.splitAt(this, point, wallId);
  }

  /** The Corner tool: the first wall clicked, then the second, met at the corner of their lines. */
  cornerClick(wallId: string | null): void {
    return modify.cornerClick(this, wallId);
  }

  /** Two walls in line, end to end, of one type, joined into one (tools/split.ts). */
  mergeSelection(): void {
    return modify.mergeSelection(this);
  }

  /** Whether the selection is two walls that can be joined into one. */
  canMergeSelection(): boolean {
    return modify.canMergeSelection(this);
  }

  /** The middle of the selection's extent: the centre a turn, a scale or a mirror takes on Enter. */
  selectionCentre(): Point2 | null {
    return modify.selectionCentre(this);
  }

  /**
   * What a Modify tool shows: its base, the line to the pointer, the reference of an angle or a scale,
   * a mirror's axis, and the value it would apply.
   */
  modifyMarks(): { base: Point2; to: Point2 | null; ref: Point2 | null; axis: { point: Point2; dir: Point2 } | null; text: string | null } | null {
    return modify.modifyMarks(this);
  }

  /**
   * The selected elements align and distribute moves (tools/arrange.ts): those of the registry that move
   * on their own (furniture, columns, texts, stairs, guardrails…), each with the box around it in plan.
   * Walls (their own align keeps them joined), doors and windows (they slide on their wall) and guides
   * (no ends) are left out.
   */
  arrangeItems(): { id: string; box: ArrangeBox }[] {
    const out: { id: string; box: ArrangeBox }[] = [];
    for (const x of eachSolid(this.geometry.kinds)) {
      if (!this.ui.selection.has(x.id) || x.kind.walled || x.kind.endless || x.kind.key === 'walls') continue;
      const box = boxOf(x.kind.outlines(x.solid).flat());
      if (box) out.push({ id: x.id, box });
    }
    return out;
  }

  /** Align or distribute the selection, one step to undo; said when there are too few to. */
  arrange(how: ArrangeHow): void {
    const items = this.arrangeItems();
    if (items.length < arrangeNeeds(how)) return this.toast(t('arrange.needs', { n: arrangeNeeds(how) }));
    const steps = arrangeSteps(
      items.map((i) => i.box),
      how,
    );
    const before = this.store.get();
    const next = items.reduce((d, it, i) => moveKinds(d, new Set([it.id]), steps[i]!), before);
    if (next !== before) this.store.dispatch({ label: 'cmd.arrange', apply: () => next });
  }

  /** The measure tool between two points and a chain (C): the tape so far is dropped. */
  toggleMeasureMode(): void {
    this.ui.measureMode = this.ui.measureMode === 'chain' ? 'distance' : 'chain';
    this.ui.measure = MEASURE_IDLE;
    this.toast(t(this.ui.measureMode === 'chain' ? 'toast.measureChain' : 'toast.measureDistance'));
    this.render();
  }

  /** The measure tool: a click, Enter or Esc (measure-tool.ts). Nothing is added to the drawing. */
  measureEvent(event: MeasureEvent): void {
    this.ui.measure = measureTransition(this.ui.measure, event, this.ui.measureMode);
    if (event.kind === 'escape') this.ui.snap = null;
    this.shell.measure.value = '';
    this.render();
  }

  /** The guardrail tool: a click adds a point of its path; Enter, Esc or a click on the last point ends it. */
  railingClick(p: Point2, mpp: number): void {
    return kindTools.railingClick(this, p, mpp);
  }

  railingFinish(): void {
    return kindTools.railingFinish(this);
  }

  /** The services' tools (app/mep-ui.ts): a point of a kind, a run of a system. */
  startMepPoint(kind: PointKind): void {
    return mepUi.startMepPoint(this, kind);
  }

  startMepRun(systemId: string): void {
    return mepUi.startMepRun(this, systemId);
  }

  mepPointClick(p: Point2): void {
    return mepUi.mepPointClick(this, p);
  }

  mepRunClick(p: Point2, mpp: number): void {
    return mepUi.mepRunClick(this, p, mpp);
  }

  mepRunFinish(): void {
    return mepUi.mepRunFinish(this);
  }

  /**
   * The stair tool: a click on where its first step's front is (its middle), the next on the way it
   * climbs. Straight, of the last stair's width and step; its kind and turn are in the panel.
   */
  stairClick(p: Point2): void {
    return kindTools.stairClick(this, p);
  }

  /**
   * The roof tool: a click adds a corner of its outline; on the first corner again (10 px), or Enter, the
   * roof is made: four slopes on a convex outline, flat with a parapet otherwise.
   */
  roofClick(p: Point2, mpp: number): void {
    return kindTools.roofClick(this, p, mpp);
  }

  roofFinish(): void {
    return kindTools.roofFinish(this);
  }

  /** The beam tool: a click starts a beam, the next ends it (the section of the last one made); Esc drops it. */
  beamClick(p: Point2): void {
    return kindTools.beamClick(this, p);
  }

  /** The doors and windows among `ids` opened, or closed when all of them are open. */
  toggleOpen(ids: readonly string[]): void {
    const doc = this.store.get();
    const mine = ids.filter((id) => doc.openings.some((o) => o.id === id));
    if (mine.length === 0) return;
    const allOpen = mine.every((id) => this.ui.opened.has(id));
    const next = new Set(this.ui.opened);
    for (const id of mine) if (allOpen) next.delete(id);
    else next.add(id);
    this.ui.opened = next;
    this.ui.info = t(allOpen ? 'hint.closedOpenings' : 'hint.openedOpenings', { n: mine.length });
    this.refresh();
  }

  curtainClick(p: Point2): void {
    return kindTools.curtainClick(this, p);
  }

  separatorClick(p: Point2): void {
    return kindTools.separatorClick(this, p);
  }

  cloudClick(p: Point2): void {
    return kindTools.cloudClick(this, p);
  }

  /** The drawing settings the plan is drawn with now: the project's, at a saved view's own scale while it is shown. */
  drawingNow(): DrawingSettings {
    const d = drawingOf(this.store.get());
    return this.ui.viewDen === null ? d : { ...d, scale: this.ui.viewDen };
  }

  /** The measure tool, measuring an angle, an arc wall or a point's coordinates. */
  setMarkMode(mode: MarkMode): void {
    this.setTool('mark');
    this.ui.markMode = mode;
    this.render();
  }

  markClick(p: Point2): void {
    return kindTools.markClick(this, p);
  }

  tagClick(p: Point2, under: string | null): void {
    return kindTools.tagClick(this, p, under);
  }

  /** The column tool: a click stands a column there, the section of the last one made. */
  columnClick(p: Point2): void {
    return kindTools.columnClick(this, p);
  }

  /** The grid tool: a click starts an axis, the next ends it (named on from the last of its kind). */
  gridClick(p: Point2): void {
    return kindTools.gridClick(this, p);
  }

  /** Esc in the grid tool: the axis begun is dropped; none begun, the tool is left. */
  gridEscape(): void {
    return kindTools.gridEscape(this);
  }

  /** The axis being drawn with the grid tool, and the name it will get; plan only. */
  gridDraft(): { name: string; start: Point2; end: Point2 } | null {
    return kindTools.gridDraft(this);
  }

  /** The section tool: a click starts its line, the next ends it (lettered on from the last). */
  sectionClick(p: Point2): void {
    return kindTools.sectionClick(this, p);
  }

  /** Esc in the section tool: the line begun is dropped; none begun, the tool is left. */
  sectionEscape(): void {
    return kindTools.sectionEscape(this);
  }

  /** A glTF or OBJ model brought in as a library object (model-import.ts). */
  pickModel(): void {
    return pickModel(this);
  }

  /** A picture, a PDF or a DXF put under the plan (reference-ui.ts). */
  pickReference(): void {
    return refs.pickReference(this);
  }

  /** A terrain round the model (terrain-ui.ts). */
  addTerrain(): void {
    return terrains.addTerrain(this);
  }

  /** The spot tool on a terrain: each click a spot height, its height typed. */
  startSpot(id: string): void {
    return terrains.startSpot(this, id);
  }

  spotClick(p: Point2): void {
    return terrains.spotClick(this, p);
  }

  /** Calibrating a reference: two points of it, then the distance between them. */
  startCalibration(id: string): void {
    return refs.startCalibration(this, id);
  }

  calibrateClick(p: Point2): void {
    return refs.calibrateClick(this, p);
  }

  /** The callout tool: a click puts the arrow's point, the next the text, ready to type. */
  calloutClick(p: Point2): void {
    return kindTools.calloutClick(this, p);
  }

  /** The callout being placed: its arrow's point and the pointer; plan only. */
  calloutDraft(): { from: Point2; to: Point2 } | null {
    const from = this.ui.view === 'plan' && this.ui.tool === 'callout' ? this.ui.calloutFrom : null;
    const to = this.ui.snap?.point ?? this.ui.cursor;
    return from && to ? { from, to } : null;
  }

  /** The section being drawn with its tool; plan only. */
  sectionDraft(): SectionMark | null {
    return kindTools.sectionDraft(this);
  }

  /** The four elevations round the building, those not made yet (elements/section). */
  addElevations(): void {
    return kindTools.addElevations(this);
  }

  /** The rooms' four interior elevations each (kind-tools.ts). */
  addInteriorElevations(roomIds: readonly string[]): void {
    return kindTools.addInteriorElevations(this, roomIds);
  }

  /**
   * Automatic dimensioning (elements/dimension/auto.ts): chains along the selected walls' outer faces,
   * or along every outer wall of the level when no wall is selected.
   */
  autoDimension(): void {
    const doc = this.store.get();
    const ids = [...this.ui.selection].filter((id) => doc.walls.some((w) => w.id === id && w.levelId === this.ui.levelId));
    const dims = autoDimensions(doc, deriveGeometry(doc), this.ui.levelId, ids.length > 0 ? ids : null, newId);
    if (dims.length === 0) return this.toast(t('dim.autoNone'));
    this.store.dispatch(addDimensions(dims));
    this.toast(t('dim.autoMade', { n: dims.length }));
  }

  /** The axes as drawn now (a move being dragged or the Modify tool taking them): what snapping sees; plan only. */
  shownGrids(): readonly Grid[] {
    return kindTools.shownGrids(this);
  }

  /** The dimension tool: a click or Esc (dimension-tool.ts). The third click makes the dimension. */
  dimensionEvent(event: DimensionToolEvent): void {
    return kindTools.dimensionEvent(this, event);
  }

  /** The dimension being made with the dimension tool, placed, with its value; plan only. */
  dimensionDraft(): (NonNullable<PlanOverlay['dimensionDraft']>) | null {
    return kindTools.dimensionDraft(this);
  }

  wallEvent(event: WallToolEvent): void {
    return walls.wallEvent(this, event);
  }

  /**
   * An outline just closed turning clockwise has each wall's exterior face (the right of its
   * direction) inside it: said, with the way back, since a house drawn that way showed its outer
   * finish on the room side and nothing told why.
   */
  checkLoop(n: number): void {
    return walls.checkLoop(this, n);
  }

  /** The footer field: a length (and angle) while drawing; a new length for one selected wall. */
  submitMeasure(text: string): boolean {
    return walls.submitMeasure(this, text);
  }

  /** Every wall of the current level, with the select tool. */
  selectAllWalls(): void {
    return selecting.selectAllWalls(this);
  }

  /**
   * The next (or previous) element of the level shown, as the selection: walls by number, then doors
   * and windows, rooms, floors (ref/chat.txt:242). In plan the view slides to show it.
   */
  stepSelection(dir: 1 | -1): void {
    return selecting.stepSelectionHere(this, dir);
  }

  /** Moves the selection by a step from the keyboard (tools/nudge.ts): one undo step. */
  nudgeSelection(step: Point2): void {
    return selecting.nudgeSelection(this, step);
  }

  clearSelection(): void {
    return selecting.clearSelection(this);
  }

  /**
   * Hides the selection for a while (Revit's HH), or isolates it (HI): the views leave out the rest.
   * Hiding again adds to what is hidden; with nothing selected, everything shows again (HR).
   */
  hideTemporarily(mode: 'hide' | 'isolate'): void {
    return selecting.hideTemporarily(this, mode);
  }

  /** Everything hidden or isolated for a while shows again. */
  resetTemporary(): void {
    return selecting.resetTemporary(this);
  }

  /** Division points cut segments into n parts (2 to 10): kept with the preferences. */
  setSnapParts(n: number): void {
    this.ui.snapParts = Math.min(10, Math.max(2, Math.round(n)));
    savePrefs({ snapParts: this.ui.snapParts });
    this.toast(t('toast.snapParts', { n: this.ui.snapParts }));
    this.render();
  }

  toggleSnaps(): void {
    this.ui.snaps = !this.ui.snaps;
    // Kept, as the other view choices are: turned off, they came back on with every reload.
    savePrefs({ snaps: this.ui.snaps });
    // Said, not only shown by the magnet's state: S is one key, easy to press by mistake, and drawing
    // then stops snapping with nothing else to tell why.
    this.toast(t(this.ui.snaps ? 'toast.snapsOn' : 'toast.snapsOff'));
    this.render();
  }

  otherLanguage(): Lang {
    return getLang() === 'en' ? 'pt' : 'en';
  }

  /** Shows another level in plan; the selection, which belonged to the old one, is cleared. */
  setLevel(id: string): void {
    if (!this.store.get().levels.some((l) => l.id === id)) return;
    // A saved view's own scale was its level's: another level is drawn at the project's.
    if (id !== this.ui.levelId) this.ui.viewDen = null;
    this.ui.levelId = id;
    savePrefs({ levelId: id });
    this.ui.selection.clear();
    this.ui.guide = null;
    // A message about the level left ("already on this level") would be read as about this one.
    this.ui.info = null;
    this.ui.error = null;
    this.refresh();
  }

  /** What Ctrl+C took: the project as it was then, and the elements, for Ctrl+V on another level. */
  clipboard: { readonly doc: Doc; readonly geometry: DerivedGeometry; readonly ids: readonly string[]; readonly levelId: string } | null = null;

  /** Ctrl+C: the selection kept for Ctrl+V, which pastes it on another level in the same place. */
  copySelection(): void {
    return selecting.copySelection(this);
  }

  /**
   * Ctrl+V: what Ctrl+C took, on the level shown, in the same place (copyToLevel), as one undo step.
   * On the level it came from it would lie over itself: said, with the Copy tool to put it beside.
   */
  paste(): void {
    return selecting.paste(this);
  }

  deleteSelection(): void {
    return selecting.deleteSelection(this);
  }

  /**
   * Drawing a chain, the last step to undo is its last wall: undone, the chain goes on from where that
   * wall began (ArchiCAD's Backspace), instead of from the end of a wall that is gone. False otherwise.
   */
  private chainStepBack(): boolean {
    const w = this.ui.wall;
    const last = this.store.get().walls.at(-1);
    if (this.ui.tool !== 'wall' || w.kind !== 'drawing' || w.count === 0 || this.store.undoLabel() !== 'cmd.addWalls' || !last) return false;
    if (distance(last.end, w.last) > 1e-9) return false;
    if (!this.store.undo()) return false;
    this.ui.wall = { ...w, last: last.start, cursor: last.start, count: w.count - 1 };
    this.shell.measure.value = '';
    this.refresh();
    this.toast(`${t('toast.undo')}: ${t('cmd.addWalls')}`);
    return true;
  }

  /** Backspace while drawing a chain: its last wall undone, the chain going on from its start. */
  undoChainStep(): boolean {
    return this.chainStepBack();
  }

  // Said with what was undone or redone ("Undone: Delete"): "Undone" alone left the user to look for it.
  undo(): void {
    if (this.chainStepBack()) return;
    const what = this.store.undoLabel();
    if (this.store.undo()) this.toast(what ? `${t('toast.undo')}: ${t(what as MessageKey)}` : t('toast.undo'));
  }

  redo(): void {
    const what = this.store.redoLabel();
    if (this.store.redo()) this.toast(what ? `${t('toast.redo')}: ${t(what as MessageKey)}` : t('toast.redo'));
  }

  seenSelection = '';
  /** The 3D view's: the selection and what covered it when last brought into sight (view-ui.ts). */
  seenSelection3d = '';
  /** The viewport's size at the last check: a change is a resize, which keeps the selection in view. */
  seenSize = '';
  /** The selection and its extent at the last check: the same selection grown is an edit, which does too. */
  seenIds = '';
  seenShape = '';

  /**
   * When the selection changes and the panel lying over the drawing would hide it (the sheet on a
   * phone, the drawer on a tablet), the plan slides just enough to show it beside the panel.
   */
  keepSelectionInView(): boolean {
    return viewing.keepSelectionInView(this);
  }

  /** How much the panel covers of the viewport, at its right (drawer) or bottom (phone sheet). */
  covered(): Insets {
    return viewing.covered(this);
  }

  frameAll(): void {
    return viewing.frameAll(this);
  }

  /**
   * An elevation (Revit's North, South, East and West): the model seen square from that side, parallel.
   * North is up the plan (+y).
   */
  elevation(side: 'north' | 'south' | 'east' | 'west'): void {
    return viewing.elevation(this, side);
  }

  /**
   * A vertical section through the selected guide (Revit's Section): the 3D keeps what lies on one side
   * of it, its cut filled, seen square and parallel from the other. `flip`: the other side.
   */
  sectionAtGuide(flip = false): void {
    return viewing.sectionAtGuide(this, flip);
  }

  /** The vertical section off: the whole model again. */
  clearSection(): void {
    return viewing.clearSection(this);
  }

  frameSelection(): void {
    return viewing.frameSelection(this);
  }

  setLanguage(lang: Lang): void {
    setLang(lang);
    document.documentElement.lang = htmlLang(lang);
    savePrefs({ lang });
    this.shell.relabel();
    this.cube.relabel();
    this.render();
  }

  toggleTheme(): void {
    this.ui.theme = this.ui.theme === 'dark' ? 'light' : 'dark';
    savePrefs({ theme: this.ui.theme });
    this.applyTheme();
    this.render();
  }

  private applyTheme(): void {
    document.documentElement.dataset.theme = this.ui.theme;
    const css = getComputedStyle(document.documentElement);
    this.scene.setTheme(this.ui.theme === 'dark', (name) => css.getPropertyValue(name).trim());
  }

  /** The project's name, as one undo step; an empty name is "Untitled project" again. */
  renameProject(next: string): void {
    return files.renameProject(this, next);
  }

  saveFile(): void {
    return files.saveFile(this);
  }

  /** A file given to the browser to save: the project, a schedule's CSV, an export. */
  download(file: string, content: string | Blob, type: string): void {
    return files.download(this, file, content, type);
  }

  /** Opens the quantity schedules; set by the input layer. */
  openSchedules: () => void = () => {};
  /** Opens the sections and elevations (ui/sections-dialog.ts), on one if given; set by the input layer. */
  openSections: (id?: string) => void = () => {};
  /** Opens the site and its sun (ui/site-dialog.ts); set by the input layer. */
  openSite: () => void = () => {};
  /** Opens the sheets (ui/sheets-dialog.ts), on one if given; set by the input layer. */
  openSheets: (id?: string) => void = () => {};

  /** The project's file name: its name without what a file name cannot hold. */
  fileBase(): string {
    return files.fileBase(this);
  }

  /**
   * The model as GLB (render/export-gltf.ts), for a viewer or a renderer: loaded when first asked for,
   * so the exporter does not weigh on every start. A failure is said, not swallowed.
   */
  async exportGlb(): Promise<void> {
    return files.exportGlb(this);
  }

  /** The 3D view as a PNG picture, larger than the screen, with its sun and shadows. */
  saveImage3d(): Promise<void> {
    return files.saveImage3d(this);
  }

  /** The model as OBJ, for a renderer or another modeller. */
  exportObj(): Promise<void> {
    return files.exportObj(this);
  }

  /** The whole model as IFC4 (io/export-ifc.ts), for a BIM program. */
  exportIfc(): void {
    return files.exportIfc(this);
  }

  /** The plan of the level shown as DXF R12 (io/export-dxf.ts), for a CAD program. */
  exportDxf(): void {
    return files.exportDxf(this);
  }

  /**
   * The view by keyboard (view-keys.ts): in plan, zoom about the middle of the free part and move by
   * pixels; in 3D, zoom toward the target and turn about it (80 px a press is about 10°).
   */
  keyView(action: ViewKey): void {
    return viewing.keyView(this, action);
  }

  /**
   * A new, empty project in place of the current one, as one undo step: like opening a file, nothing is
   * lost (Ctrl+Z gives the previous project back), so it asks nothing.
   */
  newProject(): void {
    return files.newProject(this);
  }

  /** Opens a project file in place of the current project, as one undo step. */
  async openFile(file: File): Promise<void> {
    return files.openFile(this, file);
  }

  toast(text: string): void {
    const el = this.shell.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    // Long enough to be read: 1.6 s took away "Project opened; 1 bad element was left out. Ctrl+Z goes
    // back" before its end. Short ones ("Undone") still go quickly.
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), Math.max(2500, 1500 + text.length * 50));
  }

  /** The level just below the one shown, if any: its plan is drawn faint under this one, and snapped to. */
  levelBelow(): string | null {
    const levels = this.store.get().levels;
    const here = levels.find((l) => l.id === this.ui.levelId);
    return (here ? levels.filter((l) => l.elevation < here.elevation).sort((a, b) => b.elevation - a.elevation)[0]?.id : undefined) ?? null;
  }

  /** The wall pieces of the level below (none for the lowest, or with walls hidden). */
  underlay(): Point2[][] {
    const below = this.levelBelow();
    if (!below || this.ui.hidden.has('walls')) return [];
    return [...this.geometry.solids.values()].filter((s) => s.wall.levelId === below).flatMap((s) => s.pieces.map((p) => [...p.polygon]));
  }

  /** How many kinds of element (walls, doors and windows, rooms, floors, guides, notes) the selection holds. */
  selectionKinds(): number {
    const ids = [...this.ui.selection];
    return new Set(ids.flatMap((id) => kindOfId(id)?.key ?? [])).size;
  }

  selectedWalls(): DocWall[] {
    return this.store.get().walls.filter((w) => this.ui.selection.has(w.id));
  }

  // ---- rendering -----------------------------------------------------------------------------

  /**
   * With ?perf in the address, each render logs how long its phases took (the tester's D1: switching
   * between 3D and plan cost about 500 ms more than other gestures). Nothing is done otherwise.
   */
  private readonly perf = new URLSearchParams(location.search).has('perf');
  private marks: [string, number][] = [];
  mark(name: string): void {
    this.marks.push([name, performance.now()]);
  }
  /** The last render's phases (ms), for the diagnostics panel (F7); logged too with ?perf. */
  lastFrame: { total: number; steps: [string, number][] } | null = null;

  render(): void {
    // Lengths written and typed in the open project's units, from the first thing drawn.
    setUnits(this.store.get().units);
    setVariables(this.store.get().variables ?? {});
    this.keepPlanView();
    this.marks = [['start', performance.now()]];
    this.renderFrame();
    this.mark('end');
    const steps = this.marks.slice(1).map(([name, at], i): [string, number] => [name, at - this.marks[i]![1]]);
    this.lastFrame = { total: this.marks.at(-1)![1] - this.marks[0]![1], steps };
    if (this.perf) console.info(`[cad2 perf] ${this.ui.view} ${this.lastFrame.total.toFixed(1)} ms: ${steps.map(([n, ms]) => `${n} ${ms.toFixed(1)}`).join(', ')}`);
    if (this.debugOpen) renderDebugPanel(this, this.debugBox);
  }

  // ---- diagnostics (F7) --------------------------------------------------------------------------

  /** The diagnostics panel is open (ui/debug-panel.ts). */
  debugOpen = false;
  readonly debugBox: HTMLElement = (() => {
    const box = document.createElement('aside');
    box.className = 'debug-panel';
    box.hidden = true;
    box.setAttribute('aria-label', 'Diagnostics');
    document.body.append(box);
    return box;
  })();
  private diagnosed: { g: DerivedGeometry; list: Diagnostic[] } | null = null;

  /** What is wrong with the model (diagnostics.ts), once per geometry. */
  diagnostics(): Diagnostic[] {
    if (this.diagnosed?.g !== this.geometry) this.diagnosed = { g: this.geometry, list: diagnose(this.geometry) };
    return this.diagnosed.list;
  }

  // ---- norms (rules/) -----------------------------------------------------------------------------

  private normed: { g: DerivedGeometry; rules: readonly Rule[]; lot: unknown; list: Finding[] } | null = null;

  /** What is outside the project's norm rules (rules/check.ts), the rooms and the lot too, once per geometry, rules and lot. */
  normFindings(): Finding[] {
    const doc = this.store.get();
    const rules = rulesOf(doc);
    if (this.normed?.g !== this.geometry || this.normed.rules !== rules || this.normed.lot !== doc.lot || this.normed.lot !== doc.lot)
      this.normed = { g: this.geometry, rules, lot: doc.lot, list: checkRules(this.geometry, rules, doc) };
    return this.normed.list;
  }

  openRules(): void {
    showRules(this);
  }

  /** The lot and its table of areas (ui/lot-dialog.ts). */
  openLot(): void {
    showLot(this);
  }

  /** The CUB estimate, the budget, its ABC curve and schedule (ui/budget-dialog.ts). */
  openBudget(): void {
    showBudget(this);
  }

  /** The approval journey and the project's documents (ui/approval-dialog.ts). */
  openApproval(): void {
    showApproval(this);
  }

  /** The services' systems, load table, pressures, falls, clashes and drawings (ui/services-dialog.ts). */
  openServices(): void {
    showServices(this);
  }

  /** The simulations: sun, daylight, thermal, condensation, acoustic, Wi-Fi, risks (ui/simulation-dialog.ts). */
  openSimulations(): void {
    showSimulations(this);
  }

  /** What the simulations assume, kept in the project (a step to undo). */
  setSimulation(next: SimSettings): void {
    this.store.dispatch({ label: 'cmd.setSimulation', apply: (d) => ({ ...d, simulation: next }) });
    this.render();
  }

  /** A simulation's file: the report as a page, or the input of a detailed engine. */
  downloadSimulation(kind: 'idf' | 'rad' | 'fds' | 'report'): void {
    const doc = this.store.get();
    const title = doc.name || t('app.untitled');
    const today = new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-GB');
    // A room as the interface names it, with its level's name when there is more than one.
    const roomName = (r: { name: string; levelId: string }) => (doc.levels.length > 1 ? `${wordsOf(r.name)} ${wordsOf(doc.levels.find((l) => l.id === r.levelId)?.name ?? '')}` : wordsOf(r.name));
    const [ext, type, content] =
      kind === 'idf'
        ? ['idf', 'text/plain', energyPlusIdf(doc, this.geometry, title, roomName)]
        : kind === 'rad'
          ? ['rad', 'text/plain', radianceScene(doc, this.geometry, title, roomName)]
          : kind === 'fds'
            ? ['fds', 'text/plain', fdsInput(doc, this.geometry, title)]
            : ['html', 'text/html', simulationHtml(doc, this.geometry, (id) => this.reportTitle(id), today)];
    const file = `${this.fileBase()} - ${t(kind === 'report' ? 'sim.title' : (`sim.${kind}` as MessageKey))}.${ext}`;
    this.download(file, new Blob([content], { type }), type);
    this.toast(t(kind === 'report' ? 'report.saved' : 'image.saved', { file }));
  }

  /**
   * An element as a report names it, with its level: the same number on two levels read as one. A room
   * by its number and name, a wall by its number, a door or window by its mark and its wall, the lot.
   */
  reportTitle(id: string): string {
    if (id === LOT_ELEMENT) return t('lot.title');
    const doc = this.store.get();
    const level = (levelId: string) => wordsOf(levelOf(doc, levelId)?.name ?? '');
    const room = doc.rooms.find((r) => r.id === id);
    if (room) return `${room.number} · ${wordsOf(room.name)} (${level(room.levelId)})`;
    const wall = doc.walls.find((w) => w.id === id);
    const n = wallNumber(doc, id);
    if (wall && n !== null) return `${t('wall.tag', { n })} (${level(wall.levelId)})`;
    const o = doc.openings.find((x) => x.id === id);
    const host = o && doc.walls.find((w) => w.id === o.wallId);
    if (o && host) {
      const mark = openingMarks(doc.openings, markPrefix()).get(o.id) ?? this.elementTitle(id);
      return `${mark} · ${t('wall.tag', { n: wallNumber(doc, host.id) ?? 0 })} (${level(host.levelId)})`;
    }
    // A services' point by what it is: "Chuveiro 1 (Térreo)", not "Ponto de instalação 12".
    const point = doc.mepPoints.find((p) => p.id === id);
    if (point) return `${t(`mep.kind.${point.kind}` as MessageKey)} ${doc.mepPoints.filter((p) => p.kind === point.kind).indexOf(point) + 1} (${level(point.levelId)})`;
    // A run by its system: "Trecho 2 de Iluminação (Térreo)".
    const run = doc.mepRuns.find((r) => r.id === id);
    if (run) return `${t('mep.runTitle', { n: doc.mepRuns.filter((r) => r.systemId === run.systemId).indexOf(run) + 1, system: systemIn(doc, run.systemId)?.name ?? t('mep.run') })} (${level(run.levelId)})`;
    // Anything else by its kind, its place among its kind and its level: "Pilar 2 (Térreo)", not "Pilar".
    const k = kindOfId(id);
    const list = k ? listOf(doc, k) : [];
    const i = list.findIndex((x) => x.id === id);
    if (k && i >= 0) {
      const on = levelOfElement(k, list[i]!, doc);
      return `${t(k.one)} ${i + 1}${on ? ` (${level(on)})` : ''}`;
    }
    return this.elementTitle(id);
  }

  /** The compliance report as a page to print or keep (app/documents.ts). */
  downloadCompliance(): void {
    const today = new Date().toLocaleDateString(getLang() === 'pt' ? 'pt-BR' : 'en-GB');
    const html = complianceHtml(this.store.get(), this.geometry, (id) => this.reportTitle(id), today);
    const file = `${this.fileBase()} - ${t('report.title')}.html`;
    this.download(file, new Blob([html], { type: 'text/html' }), 'text/html');
    this.toast(t('report.saved', { file }));
  }

  /** Where the plan signs what is outside the norms on the level shown: a door's middle, else the element's corner. */
  normMarks(): Point2[] {
    const ids = new Set(this.normFindings().map((f) => f.elementId));
    const out: Point2[] = [];
    for (const id of ids) {
      const o = this.geometry.openings.get(id);
      if (o?.frame) {
        const wall = this.store.get().walls.find((w) => w.id === o.opening.wallId);
        if (wall?.levelId === this.ui.levelId) out.push({ x: (o.frame.start.x + o.frame.end.x) / 2, y: (o.frame.start.y + o.frame.end.y) / 2 });
        continue;
      }
      const k = kindOfId(id);
      const solid = k ? this.geometry.kinds.get(k.key)?.get(id) : undefined;
      if (!k || !solid || levelOfSolid(k, solid) !== this.ui.levelId) continue;
      const pts = k.outlines(solid).flat();
      if (pts.length > 0) out.push({ x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) });
    }
    return out;
  }

  /** An element's name as the panel titles it: its kind's (Escada, Porta). */
  elementTitle(id: string): string {
    const k = kindOfId(id);
    return k ? t(k.one) : id;
  }

  /** The plan or the 3D on the level an element is on (chosen from a list, it may be on another). */
  showElementLevel(id: string): void {
    const k = kindOfId(id);
    const doc = this.store.get();
    const e = k ? listOf(doc, k).find((x) => x.id === id) : undefined;
    const level = k && e ? levelOfElement(k, e, doc) : null;
    if (level && level !== this.ui.levelId) this.ui.levelId = level;
    this.refresh();
  }

  toggleDebug(open = !this.debugOpen): void {
    this.debugOpen = open;
    this.debugBox.hidden = !open;
    if (open) renderDebugPanel(this, this.debugBox);
  }

  /** The elements of a problem selected and framed, on their level. */
  showElements(ids: readonly string[]): void {
    return selecting.showElements(this, ids);
  }

  /** Where the pointer is over the drawing (client pixels), set by the input layer; null off it. */
  pointer: Point2 | null = null;

  /** The world point under the pointer, on the level shown, for the view as it is now. */
  pointerWorld(): Point2 | null {
    if (!this.pointer) return null;
    if (this.ui.view === 'plan') {
      const r = this.shell.planCanvas.getBoundingClientRect();
      return this.plan.toWorld({ x: this.pointer.x - r.left, y: this.pointer.y - r.top });
    }
    const z = (levelOf(this.store.get(), this.ui.levelId)?.elevation ?? 0) + this.lift(this.ui.levelId);
    return this.scene.groundPoint(this.pointer.x, this.pointer.y, z);
  }

  private renderFrame(): void {
    return frame.renderFrame(this);
  }

  /**
   * After the panel has its content: a new selection the panel would hide (sheet or drawer over the
   * plan) brings the plan into view, and the plan is drawn again where it now is.
   */
  afterPanel(): void {
    return frame.afterPanel(this);
  }

  /**
   * Temporary dimensions of the one selected element, while selecting; while dragging only when they
   * follow the drag: a door or a window slid, or one wall moved (its length and its gaps to the walls
   * parallel to it, as they become).
   */
  currentDims(): TempDim[] {
    return frame.currentDims(this);
  }

  /**
   * The value of each temporary dimension, as a button at the middle of its line; the one being
   * edited is a field. Elements are kept between renders so a field being typed in keeps its focus.
   */
  placeDims(dims: readonly TempDim[]): void {
    return frame.placeDims(this, dims);
  }

  dimButton(d: TempDim): HTMLButtonElement {
    return frame.dimButton(this, d);
  }

  dimField(d: TempDim): HTMLInputElement {
    return frame.dimField(this, d);
  }

  /**
   * The handles of the selected walls in plan (handles.ts): while selecting, and while one of them is
   * dragged (then on the walls as they are being dragged). None in 3D, during a move or a window.
   */
  handles(): Handles {
    const d = this.ui.drag;
    if (this.ui.tool !== 'select' || this.ui.view !== 'plan' || d?.kind === 'move' || d?.kind === 'marquee' || d?.kind === 'dimLine') return handlesFor([], (p) => p);
    const walls = d ? d.walls : this.store.get().walls;
    const toScreen = (p: Point2) => this.plan.toScreen(p);
    const h = handlesFor(
      walls.filter((w) => this.ui.selection.has(w.id)),
      toScreen,
      this.plan.dimValueBoxes(this.currentDims().map((x) => ({ ...x, text: lengthNum(x.value) }))),
    );
    // One door selected, standing still: its flip controls, on the side its leaf sweeps (the side
    // `swing` names is the one its temporary dimension keeps off, opening-ui.ts).
    const one = this.ui.selection.size === 1 && !d ? [...this.ui.selection][0]! : null;
    const door = one ? this.geometry.openings.get(one) : undefined;
    if (!door || door.opening.kind !== 'door' || !door.frame) return h;
    return { ...h, flips: doorFlips(door.opening.id, door.frame, door.opening.swing === 'right' ? -1 : 1, toScreen) };
  }

  /** The one element selected, when it is a door. */
  selectedDoor(): boolean {
    const one = this.ui.selection.size === 1 ? [...this.ui.selection][0] : undefined;
    return this.store.get().openings.some((o) => o.id === one && o.kind === 'door');
  }

  /** Flips the one door selected: the side it opens to, or its hinge to the other jamb. False if none. */
  flipDoor(which: 'swing' | 'hinge', id?: string): boolean {
    const one = id ?? (this.ui.selection.size === 1 ? [...this.ui.selection][0] : undefined);
    const o = this.store.get().openings.find((x) => x.id === one && x.kind === 'door');
    if (!o) return false;
    this.store.dispatch(updateOpening(o.id, which === 'swing' ? { swing: o.swing === 'left' ? 'right' : 'left' } : { hinge: o.hinge === 'start' ? 'end' : 'start' }));
    return true;
  }

  /**
   * With walls hidden or isolated for a while, the walls that show joined among themselves only: kept
   * cut for a hidden wall, their ends showed a slot where it stood (a dark strip down a corner in 3D).
   * Rooms and floors stay as the whole document makes them. Computed again only when the walls change.
   */
  private joinedCache: { from: DerivedGeometry; temp: TemporaryView; g: DerivedGeometry } | null = null;
  private joinedAsShown(shown: DerivedGeometry): DerivedGeometry {
    const temp = this.ui.temp;
    if (!temp || shown.solids.size === this.geometry.solids.size) return shown;
    const c = this.joinedCache;
    if (c && c.from === this.geometry && c.temp === temp) return c.g;
    const doc = this.store.get();
    const walls = [...shown.solids.values()].map((s) => s.wall);
    const ids = new Set(walls.map((w) => w.id));
    const own = deriveGeometry({ ...doc, walls, openings: doc.openings.filter((o) => ids.has(o.wallId) && shown.openings.has(o.id)) });
    // Doors and windows being placed are not in the document: they stay as they were.
    const openings = new Map([...own.openings, ...[...shown.openings].filter(([id]) => !own.openings.has(id) && !doc.openings.some((o) => o.id === id))]);
    const g = { ...shown, solids: own.solids, openings };
    this.joinedCache = { from: this.geometry, temp, g };
    return g;
  }

  /** In plan, only the current level's walls and openings; in 3D, the levels the view shows (view-3d.ts). */
  visibleGeometry(): DerivedGeometry {
    const g = hideCategories(this.joinedAsShown(applyTemporary(this.geometry, this.ui.temp)), this.ui.hidden);
    if (this.ui.view !== 'plan') {
      const doc = this.store.get();
      const shown = shownLevels(doc.levels, this.ui.levelId, this.ui.view3d.levels);
      if (shown.size === doc.levels.length) return g;
      const solids = new Map([...g.solids].filter(([, s]) => shown.has(s.wall.levelId)));
      return {
        ...g,
        solids,
        openings: new Map([...g.openings].filter(([, o]) => solids.has(o.opening.wallId))),
        rooms: new Map([...g.rooms].filter(([, r]) => shown.has(r.room.levelId))),
        kinds: filterKinds(g.kinds, (k, x) => {
          const l = levelOfSolid(k, x);
          return l === null || shown.has(l);
        }),
      };
    }
    const solids = new Map([...g.solids].filter(([, s]) => s.wall.levelId === this.ui.levelId));
    const levelWalls = new Set(this.store.get().walls.filter((w) => w.levelId === this.ui.levelId).map((w) => w.id));
    const openings = new Map([...g.openings].filter(([, o]) => levelWalls.has(o.opening.wallId)));
    const rooms = new Map([...g.rooms].filter(([, r]) => r.room.levelId === this.ui.levelId));
    // An axis (on every level) on each; a text, like the rest, on its own.
    const kinds = filterKinds(g.kinds, (k, x) => {
      const l = levelOfSolid(k, x);
      return l === null || l === this.ui.levelId;
    });
    return { ...g, solids, openings, rooms, kinds };
  }

  toggleBrowser(open = !this.ui.browserOpen): void {
    const before = this.covered().left ?? 0;
    this.ui.browserOpen = open;
    savePrefs({ browserOpen: open });
    this.shell.browser.hidden = !open;
    const after = this.covered().left ?? 0;
    // The plan moves only when the drawer comes over the drawing, and only as far as it covers it:
    // sliding by half the drawer each time it opened or closed was a jump of the whole drawing.
    const box = boundsOf(this.geometry);
    if (this.ui.view === 'plan' && box && after > before) {
      const left = this.plan.toScreen({ x: box.min.x, y: box.max.y }).x;
      const need = after + 16 - left;
      if (need > 0) this.plan.panBy(need, 0);
    }
    this.render();
    if (open) this.shell.browser.querySelector<HTMLElement>('button')?.focus();
    else this.shell.sidebar.focus();
  }

  /** Shows or hides a category of elements; what is hidden leaves the selection. */
  /** Graphic overrides shown or not (a view's choice). */
  toggleOverrides(): void {
    this.ui.overridesOn = !this.ui.overridesOn;
    this.toast(t(this.ui.overridesOn ? 'ovr.toastOn' : 'ovr.toastOff'));
    this.refresh();
  }

  /** A layer combination: its categories hidden, the others shown. */
  applyLayerSet(id: string): void {
    const set = this.store.get().layerSets?.find((s) => s.id === id);
    if (!set) return;
    this.ui.hidden = new Set(set.hidden);
    const shown = this.visibleGeometry();
    for (const sid of [...this.ui.selection]) if (!hasSolid(shown.kinds, sid)) this.ui.selection.delete(sid);
    this.toast(t('layers.applied', { name: set.name }));
    this.refresh();
  }

  /** The categories hidden now, kept as a combination under the next free name. */
  saveLayerSet(): void {
    const sets = this.store.get().layerSets ?? [];
    const name = nextName(
      sets.map((s) => s.name),
      t('layers.base'),
    );
    this.store.dispatch(saveLayerSet({ id: newId('layers'), name, hidden: [...this.ui.hidden] }));
    this.toast(t('layers.saved', { name }));
  }

  deleteLayerSet(id: string): void {
    this.store.dispatch(deleteLayerSet(id));
  }

  toggleCategory(c: Category): void {
    if (this.ui.hidden.has(c)) this.ui.hidden.delete(c);
    else this.ui.hidden.add(c);
    const shown = this.visibleGeometry();
    // Each with its category (a text and a dimension have none, an axis and a guide go with the guides).
    for (const id of [...this.ui.selection]) if (!hasSolid(shown.kinds, id)) this.ui.selection.delete(id);
    this.refresh();
  }

  /** Every wall of a type on the current level, with the select tool. */
  /**
   * Everything on the level shown like what is selected (select-similar.ts), what shows only: a hidden
   * category or an element hidden for now is not taken.
   */
  selectSimilar(): void {
    return selecting.selectSimilar(this);
  }

  selectWallsOfType(typeId: string): void {
    return selecting.selectWallsOfType(this, typeId);
  }

  browserKey = '';
  /** Opens the views and tour dialog; set by the input layer too. */
  openTour: () => void = () => {};
  /** Opens the levels dialog; set by the input layer, which owns the dialogs. */
  openLevels: () => void = () => {};
  /** Opens the wall types dialog, on a type if given; set by the input layer too. */
  openWallTypes: (typeId?: string) => void = () => {};
  openMaterials: () => void = () => {};
  openUnits: () => void = () => {};
  openObjects: () => void = () => {};
  /** Printing a plan (ui/print-dialog.ts), set by the input layer. */
  openPrint: () => void = () => {};
  /** The graphic overrides (ui/overrides-dialog.ts), set by the input layer. */
  openOverrides: () => void = () => {};
  /** The shortcuts the user remapped or turned off (app/keymap.ts), kept with the preferences. */
  keymap: KeyMap = loadPrefs().keymap ?? {};

  setKeymap(map: KeyMap): void {
    this.keymap = map;
    savePrefs({ keymap: { ...map } });
    this.render();
  }
  objectClick(p: Point2): void {
    kindTools.objectClick(this, p);
  }
  /** Every action by name (app/actions.ts), set by the input layer: the ribbon and the File menu run them. */
  actionList: () => Action[] = () => [];
  /** The ribbon's tab shown, kept between visits, and what it was last drawn from (chrome.ts). */
  ribbonTab = loadPrefs().ribbonTab ?? 'home';
  ribbonKey = '';
  chooseRibbonTab(id: string): void {
    this.ribbonTab = id;
    savePrefs({ ribbonTab: id });
    this.renderChrome();
  }

  renderBrowserDrawer(): void {
    return chrome.renderBrowserDrawer(this);
  }

  /**
   * The button toggles what is on screen. On a narrow screen the panel waits hidden while it has
   * nothing to show: the button looked pressed then, and a click only switched a preference that
   * changed nothing; now it shows the panel.
   */
  togglePanel(open = this.shell.panel.hidden): void {
    this.ui.panelOpen = open;
    this.ui.panelPeek = open;
    savePrefs({ panelOpen: open });
    this.render();
  }

  renderChrome(): void {
    return chrome.renderChrome(this);
  }

  /** The footer for the measure tool: what to click, or what the tape read. */
  measureHint(): string {
    return chrome.measureHint(this);
  }

  /** The selection's quick actions, above the selection and never over it. */
  /** Opens the command palette; set by the input layer, which owns the dialogs. */
  openCommands: () => void = () => {};
  floatKey = '';

  placeFloatBar(): void {
    return chrome.placeFloatBar(this);
  }
}
