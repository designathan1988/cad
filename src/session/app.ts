// Application state and rendering. The project changes only through the store; selection, tool,
// view, camera, language and theme are interface state, outside the document and outside undo.

import type { NextSlot } from './next';
import { onReferenceLoaded } from '../elements/kinds/reference';
import { lengthText, setUnits } from '../i18n/units';
import { setVariables } from '../core/measure';
import type { KeyMap } from './keymap';
import { type Box as ArrangeBox, boxOf } from '../tools/arrange';
import { objectHandles, type ScreenHandle } from './object-handles';
import type { Action } from './actions';
import { frameFirst } from './view-ui';
import * as chrome from '../ui/chrome';
import * as frame from '../ui/frame';
import { createStore, type Store } from '../core/store';
import type { Point2 } from '../model/vector';
import type { OpeningKind } from '../elements/opening/schema';
import { PlanView } from '../render/plan-view';
import { Scene3D } from '../render/scene-3d';
import { Overlay3D, type Overlay3DState } from '../render/overlay-3d';
import { ViewCube } from '../render/view-cube';
import { getLang, htmlLang, markPrefix, setLang, t } from '../i18n/messages';
import { buildShell, type Shell } from '../ui/shell';
import type { UiState } from './state';
import { type Doc, type LevelId } from '../project/doc';
import { toast } from '../ui/toast';
import { eachSolid } from '../elements/registry';
import { type DerivedGeometry, deriveGeometry } from '../project/derive';
import type { TemporaryView } from '../project/derived-filters';
import { boundsOf } from '../project/derived-queries';
import { markPoint, openingMarks } from '../elements/opening/marks';
import { loadPrefs, wireSaving } from '../project/persist';
import type { Boot } from '../project/boot';
import type { BoxFace } from '../model/section-box';
import { insideRing } from '../elements/room/derive';
import { PREVIEW_ID } from '../elements/preview';
import { placeFloatBar } from '../ui/float-bar';
import * as sceneCamera from '../render/scene-camera';
import { placesLeaf } from './app-placing';
import { applyTheme } from './app-settings';
import { handles, height } from './app-view';
import * as toolEvents from './tool-events';
import * as modelView from './model-view';
import { initialUi } from './ui-initial';
import { keepingStore } from './app-store';
import type { WallTypeId } from '../elements/wall/schema';
import { fromOf } from '../elements/tool-draft';
import type { Tail } from '../model/tuple';
import { actionsNow, keyName, renderSharing } from './action-list';
import { afterChange } from './app-store';
import { wireTraceNotes } from './scene-frame';

export type { UiState } from './state';

export { PREVIEW_ID };

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

  constructor(root: HTMLElement, boot: Boot) {
    const prefs = loadPrefs();
    setLang(prefs.lang ?? (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'));
    document.documentElement.lang = htmlLang(getLang());
    // Every change to the walls, however it is made, keeps the doors and windows to what they are
    // measured from (keep-openings.ts), and the rooms it moves the walls past in their space.
    const store = createStore(boot.doc);
    onReferenceLoaded(() => this.render());
    this.store = keepingStore(store, (dim) => this.toast(t(dim.eq ? 'dim.refusedEqual' : 'dim.refusedLocked', { length: lengthText(dim.locked ?? 0) })));
    const doc = this.store.get();
    this.ui = initialUi(doc, prefs);
    const pv = prefs.planView;
    if (pv && Number.isFinite(pv.scale) && pv.scale >= 2 && pv.scale <= 4000 && Number.isFinite(pv.center?.x) && Number.isFinite(pv.center?.y)) {
      this.savedPlanView = { scale: pv.scale, center: { x: pv.center.x, y: pv.center.y } };
    }
    this.shell = buildShell(root);
    this.plan = new PlanView(this.shell.planCanvas);
    this.scene = new Scene3D(this.shell.glCanvas);
    wireTraceNotes(this);
    this.overlay3d = new Overlay3D(this.shell.overlay3d);
    this.cube = new ViewCube(
      (dir) => sceneCamera.frame(this.scene, boundsOf(this.geometry), height(this), dir),
      () => sceneCamera.frame(this.scene, boundsOf(this.geometry), height(this)),
    );
    this.shell.viewCorner.prepend(this.cube.root);
    this.scene.onChange = () => {
      this.cube.update(this.scene.camera);
      placeFloatBar(this);
      // The handles found again where the camera now shows them (screen points: kept, they stayed behind).
      if (this.ui.view === '3d' && this.overlayState) this.overlay3d.draw({ ...this.overlayState, objectHandles: objectHandles(this), handles: handles(this) });
    };
    this.geometry = deriveGeometry(doc);
    wireSaving();
    this.store.subscribe((d) => afterChange(this, d));
    // The first framing waits until the viewport has a size: framing a 0 × 0 canvas sets a useless scale.
    new ResizeObserver(() => {
      const r = this.shell.viewport.getBoundingClientRect();
      if (!this.framed[this.ui.view] && r.width > 0 && r.height > 0) frameFirst(this);
      else this.render();
    }).observe(this.shell.viewport);
    applyTheme(this);
    this.shell.relabel();
    this.cube.relabel();
    // The last project open could not be read: said, with why, before anything is done in this one.
    if (boot.notOpened) this.ui.error = t('boot.notOpened', { name: boot.notOpened.name || t('app.untitled'), why: t(`open.${boot.notOpened.error}`) });
    // The browser's database failed while starting: this project is not kept until it is saved.
    else if (boot.failed) this.ui.error = t('boot.failed');
    this.refresh();
    // Elements of it that reading repaired or left out: said, as opening a file says it.
    if (boot.repaired) this.toast(boot.repaired === 1 ? t('boot.repairedOne') : t('boot.repaired', { n: boot.repaired }));
  }

  /** The box face whose handle is under the pointer or being dragged: drawn larger and filled. */
  boxHot: BoxFace | null = null;

  /** Recomputes the derived geometry (with the wall being drawn) and redraws. */
  refresh(...a: Tail<Parameters<typeof modelView.refresh>>): ReturnType<typeof modelView.refresh> {
    return modelView.refresh(this, ...a);
  }

  /** The door or window tool's kind, or null for the other tools. */
  openingKind(): OpeningKind | null {
    return this.ui.tool === 'door' || this.ui.tool === 'window' ? this.ui.tool : null;
  }

  /** The leaf's side and hinge of the opening about to be placed: toward the pointer, unless flipped (Space, H). */
  placedSides(kind: OpeningKind, side: 'left' | 'right'): { swing: 'left' | 'right'; hinge: 'start' | 'end' } {
    const f = placesLeaf(this, kind) ? this.ui.doorFlip : { swing: false, hinge: false };
    return { swing: f.swing ? (side === 'left' ? 'right' : 'left') : side, hinge: f.hinge ? 'end' : 'start' };
  }

  openingEvent(...a: Tail<Parameters<typeof toolEvents.openingEvent>>): ReturnType<typeof toolEvents.openingEvent> {
    return toolEvents.openingEvent(this, ...a);
  }

  /** The room tool: a click inside closed walls makes a room there, unless one is there already. */
  roomClick(...a: Tail<Parameters<typeof toolEvents.roomClick>>): ReturnType<typeof toolEvents.roomClick> {
    return toolEvents.roomClick(this, ...a);
  }

  /**
   * The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. A typed
   * point is always a corner, as the footer says: typing inside a room draws an outline there.
   */
  floorClick(...a: Tail<Parameters<typeof toolEvents.floorClick>>): ReturnType<typeof toolEvents.floorClick> {
    return toolEvents.floorClick(this, ...a);
  }

  selectedOpenings(...a: Tail<Parameters<typeof modelView.selectedOpenings>>): ReturnType<typeof modelView.selectedOpenings> {
    return modelView.selectedOpenings(this, ...a);
  }

  /**
   * The wall drawn from `start` to `end`, turned round when Space flipped the side: the same line, the
   * body on its other side (its exterior is on the right of its direction, so the direction is what flips).
   */
  oriented(...a: Tail<Parameters<typeof modelView.oriented>>): ReturnType<typeof modelView.oriented> {
    return modelView.oriented(this, ...a);
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

  /** The reference lines to show: every wall's when asked for, the selected ones' and the one being drawn. */
  refLines(): { start: Point2; end: Point2; bulge?: number }[] {
    const ids = new Set(this.ui.selection);
    const shown = [...this.visibleGeometry().solids.values()].map((s) => s.wall).filter((w) => this.ui.refLines || ids.has(w.id) || w.id.startsWith(PREVIEW_ID));
    return shown.map((w) => ({ start: w.start, end: w.end, ...(w.bulge ? { bulge: w.bulge } : {}) }));
  }

  makeWall(...a: Tail<Parameters<typeof modelView.makeWall>>): ReturnType<typeof modelView.makeWall> {
    return modelView.makeWall(this, ...a);
  }

  // ---- actions -------------------------------------------------------------------------------

  setTool(...a: Tail<Parameters<typeof toolEvents.setTool>>): ReturnType<typeof toolEvents.setTool> {
    return toolEvents.setTool(this, ...a);
  }

  /** Where the right-click menu was opened (plan point), while its entries are made (input.ts). */
  contextPoint: Point2 | null = null;
  /** Opens the projects kept in the browser; set by the input layer. */
  openProjects: () => void = () => {};

  /** Places the guide being set, as one undo step; the drawing tool goes on as it was. */
  placeGuide(...a: Tail<Parameters<typeof toolEvents.placeGuide>>): ReturnType<typeof toolEvents.placeGuide> {
    return toolEvents.placeGuide(this, ...a);
  }

  /** The geometry before a Modify tool started: which rooms go with the walls (transform.ts). */
  modifyBefore: DerivedGeometry | null = null;

  /** A click, a typed value or Esc in a Modify tool (modify-tool.ts); the transform, when done, is one undo step. */
  modifyEvent(...a: Tail<Parameters<typeof toolEvents.modifyEvent>>): ReturnType<typeof toolEvents.modifyEvent> {
    return toolEvents.modifyEvent(this, ...a);
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
   * The last copy made a series, as SketchUp's Move-copy and Revit's Array: `n` copies one after
   * another at its step ("3x"), or, `divide`, `n` copies spread evenly from the original to where the
   * copy went ("/3"). It replaces the copy: one undo step, the last copy of the series selected.
   */
  copySeries(...a: Tail<Parameters<typeof toolEvents.copySeries>>): ReturnType<typeof toolEvents.copySeries> {
    return toolEvents.copySeries(this, ...a);
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

  /** The measure tool: a click, Enter or Esc (measure-tool.ts). Nothing is added to the drawing. */
  measureEvent(...a: Tail<Parameters<typeof toolEvents.measureEvent>>): ReturnType<typeof toolEvents.measureEvent> {
    return toolEvents.measureEvent(this, ...a);
  }

  /** The callout being placed: its arrow's point and the pointer; plan only. */
  calloutDraft(): { from: Point2; to: Point2 } | null {
    const from = this.ui.view === 'plan' && this.ui.tool === 'callout' ? fromOf(this.ui.draft, 'callout') : null;
    const to = this.ui.snap?.point ?? this.ui.cursor;
    return from && to ? { from, to } : null;
  }

  /** The dimension tool: a click or Esc (dimension-tool.ts). The third click makes the dimension. */
  dimensionEvent(...a: Tail<Parameters<typeof toolEvents.dimensionEvent>>): ReturnType<typeof toolEvents.dimensionEvent> {
    return toolEvents.dimensionEvent(this, ...a);
  }

  /** What Ctrl+C took: the project as it was then, and the elements, for Ctrl+V on another level. */
  clipboard: { readonly doc: Doc; readonly geometry: DerivedGeometry; readonly ids: readonly string[]; readonly levelId: LevelId } | null = null;

  seenSelection = '';
  /** The 3D view's: the selection and what covered it when last brought into sight (view-ui.ts). */
  seenSelection3d = '';
  /** The viewport's size at the last check: a change is a resize, which keeps the selection in view. */
  seenSize = '';
  /** The selection and its extent at the last check: the same selection grown is an edit, which does too. */
  seenIds = '';
  seenShape = '';

  frameAll(...a: Tail<Parameters<typeof modelView.frameAll>>): ReturnType<typeof modelView.frameAll> {
    return modelView.frameAll(this, ...a);
  }

  /** Opens the sections and elevations (ui/sections-dialog.ts), on one if given; set by the input layer. */
  openSections: (id?: string) => void = () => {};

  toast(text: string, action?: { readonly label: string; readonly run: () => void }): void {
    return toast(this.shell.toast, text, action);
  }

  selectedWalls(...a: Tail<Parameters<typeof modelView.selectedWalls>>): ReturnType<typeof modelView.selectedWalls> {
    return modelView.selectedWalls(this, ...a);
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
  /** The last render's phases (ms); logged with ?perf. */
  lastFrame: { total: number; steps: [string, number][] } | null = null;

  render(): void {
    // Lengths written and typed in the open project's units, from the first thing drawn.
    setUnits(this.store.get().units);
    setVariables(this.store.get().variables ?? {});
    toolEvents.keepPlanView(this);
    this.marks = [['start', performance.now()]];
    renderSharing(this, () => this.renderFrame());
    this.mark('end');
    const steps = this.marks.slice(1).map(([name, at], i): [string, number] => [name, at - this.marks[i]![1]]);
    this.lastFrame = { total: this.marks.at(-1)![1] - this.marks[0]![1], steps };
    if (this.perf) console.info(`[cad2 perf] ${this.ui.view} ${this.lastFrame.total.toFixed(1)} ms: ${steps.map(([n, ms]) => `${n} ${ms.toFixed(1)}`).join(', ')}`);
  }

  /** Where the pointer is over the drawing (client pixels), set by the input layer; null off it. */
  pointer: Point2 | null = null;

  private renderFrame(): void {
    return frame.renderFrame(this);
  }

  /**
   * With walls hidden or isolated for a while, the walls that show joined among themselves only: kept
   * cut for a hidden wall, their ends showed a slot where it stood (a dark strip down a corner in 3D).
   * Rooms and floors stay as the whole document makes them. Computed again only when the walls change.
   */
  joinedCache: { from: DerivedGeometry; temp: TemporaryView; g: DerivedGeometry } | null = null;

  /** In plan, only the current level's walls and openings; in 3D, the levels the view shows (view-3d.ts). */
  visibleGeometry(...a: Tail<Parameters<typeof modelView.visibleGeometry>>): ReturnType<typeof modelView.visibleGeometry> {
    return modelView.visibleGeometry(this, ...a);
  }

  browserKey = '';
  /** Opens the levels dialog; set by the input layer, which owns the dialogs. */
  openLevels: () => void = () => {};
  /** Opens the wall types dialog, on a type if given; set by the input layer too. */
  openWallTypes: (typeId?: WallTypeId) => void = () => {};
  openMaterials: () => void = () => {};
  openUnits: () => void = () => {};
  openObjects: () => void = () => {};
  /** The graphic overrides (ui/overrides-dialog.ts), set by the input layer. */
  openOverrides: () => void = () => {};
  /** The shortcuts the user remapped or turned off (app/keymap.ts), kept with the preferences. */
  keymap: KeyMap = loadPrefs().keymap ?? {};

  /** Builds every action by name (actions.ts), set by the input layer: the ribbon and the File menu run them. */
  buildActions: () => Action[] = () => [];
  /** The actions built for the frame being rendered, shared by its readers (action-list.ts); null outside a render. */
  readonly actionCache: { rendering: boolean; frame: Action[] | null } = { rendering: false, frame: null };
  actionList(): Action[] {
    return actionsNow(this);
  }
  keyName(id: string): string {
    return keyName(this, id);
  }
  /** The ribbon's tab shown, kept between visits, and what it was last drawn from (chrome.ts). */
  ribbonTab = loadPrefs().ribbonTab ?? 'home';
  ribbonKey = '';
  /** The next element each placing tool makes, as the user set it (next-element.ts); unset, the last one made. */
  next: Partial<Record<NextSlot, unknown>> = {};
  /** The selection's tab is not shown: it opens only when the user picks it, until the selection changes (chrome.ts, renderRibbon). */
  ribbonAway = false;
  /** The selection the contextual tab was last shown for: a new one brings it forward again. */
  ribbonSelected = '';

  renderChrome(): void {
    return chrome.renderChrome(this);
  }

  /** The selection's quick actions, above the selection and never over it. */
  /** Opens the command palette; set by the input layer, which owns the dialogs. */
  openCommands: () => void = () => {};
  floatKey = '';
}
