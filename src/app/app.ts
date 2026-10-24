// Application state and rendering. The project changes only through the store; selection, tool,
// view, camera, language and theme are interface state, outside the document and outside undo.

import * as THREE from 'three';
import { parseLength, parseLengthAngle, parsePoint } from '../core/measure';
import { createStore, type Store } from '../core/store';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { arcOf } from '../elements/wall/geometry/arc';
import { addWalls, resetWallsToType, updateWalls } from '../elements/wall/commands';
import {
  addOpening,
  alignHeads,
  placementProblem,
  alignOpenings,
  deleteElements,
  distributeOpenings,
  ruleKeepingPosition,
  setGroupSpacing,
  ungroupOpenings,
  updateOpening,
} from '../elements/opening/commands';
import type { OpeningSize } from '../elements/opening/panel';
import { GROUP_PREFIX, hasDistance, isOpeningId, newOpening, OPENING_DEFAULTS, OPENING_PREFIX, type Opening, type OpeningKind } from '../elements/opening/schema';
import { OPENING_IDLE, openingTransition, type OpeningToolEvent, type OpeningToolState } from '../tools/opening-tool';
import { OPENING_PREVIEW_ID, ruleGuide, ruleText } from './opening-ui';
import type { WallId } from '../elements/wall/schema';
import { type Insets, NO_INSETS, PlanView } from '../render/plan-view';
import { Scene3D } from '../render/scene-3d';
import { ViewCube } from '../render/view-cube';
import { defaultName, getLang, htmlLang, name, num, setLang, t, type Lang, type MessageKey } from '../ui/i18n';
import { icon } from '../ui/icons';
import { renderPanel } from '../ui/panel';
import { buildShell, keyHint, type Shell, type ToolId, type ViewId } from '../ui/shell';
import { snapLabel, type Snap } from '../tools/snap';
import { bulgeThrough, IDLE, typedEnd, wallTransition, type WallToolEvent, type WallToolState } from '../tools/wall-tool';
import { type Drag, hull } from './select-drag';
import { type Doc, type DocWall, elementIds, newDocument, type WallDefaults, wallOverrides } from './document';
import { boundsOf, type Category, deriveGeometry, type DerivedGeometry, hideCategories, type OpeningSolid, openingOutline } from './geometry';
import { renderBrowser } from '../ui/browser';
import { loadDocument, loadPrefs, saveDocument, savePrefs } from './persist';
import { readProject, writeProject } from '../io/project-file';
import { type TempDim, tempDims } from './temp-dims';
import { contextEntries } from './context-menu';
import { type Handles, handlesFor } from './handles';
import { placeBarY } from '../ui/bar-place';
import { newId } from '../core/id';
import { addFloor, addRoom, updateFloor, updateRoom } from '../elements/room/commands';
import { insideRing, type FloorSolid, type RoomSolid } from '../elements/room/derive';
import { FLOOR_DEFAULTS } from '../elements/room/schema';

export interface UiState {
  view: ViewId;
  tool: ToolId;
  selection: Set<WallId>;
  hover: WallId | null;
  levelId: string;
  theme: 'light' | 'dark';
  panelOpen: boolean;
  browserOpen: boolean;
  /** Categories hidden from view by the project browser (the document keeps them). */
  hidden: Set<Category>;
  snaps: boolean;
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
  /** The temporary dimension whose value is being typed. */
  dimEdit: string | null;
}

const PREVIEW_ID = '__preview__';
/** The level list's last entry: opens the levels dialog. */
export const EDIT_LEVELS = '__edit_levels__';

export class App {
  readonly store: Store<Doc>;
  readonly shell: Shell;
  readonly plan: PlanView;
  readonly scene: Scene3D;
  readonly cube: ViewCube;
  readonly ui: UiState;
  geometry: DerivedGeometry;
  /** Each view is framed on its first show; after that the camera is the user's. */
  private readonly framed = { plan: false, '3d': false };
  private panelDoc: Doc | null = null;
  private panelKey = '';
  private toastTimer = 0;

  constructor(root: HTMLElement) {
    const prefs = loadPrefs();
    setLang(prefs.lang ?? (navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en'));
    document.documentElement.lang = htmlLang(getLang());
    this.store = createStore(loadDocument() ?? newDocument());
    const doc = this.store.get();
    this.ui = {
      view: prefs.view ?? 'plan',
      tool: 'select',
      selection: new Set(),
      hover: null,
      levelId: doc.levels[0]!.id,
      theme: prefs.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
      panelOpen: prefs.panelOpen ?? true,
      browserOpen: prefs.browserOpen ?? false,
      hidden: new Set(),
      snaps: true,
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
      dimEdit: null,
    };
    this.shell = buildShell(root);
    this.plan = new PlanView(this.shell.planCanvas);
    this.scene = new Scene3D(this.shell.glCanvas);
    this.cube = new ViewCube(
      (dir) => this.scene.frame(boundsOf(this.geometry), this.height(), dir),
      () => this.scene.frame(boundsOf(this.geometry), this.height()),
    );
    this.shell.viewport.append(this.cube.root);
    this.scene.onChange = () => {
      this.cube.update(this.scene.camera);
      this.placeFloatBar();
    };
    this.geometry = deriveGeometry(doc);
    this.store.subscribe((d) => {
      saveDocument(d);
      this.ui.info = null;
      // Only what no longer exists leaves the selection: editing a room or a floor keeps it selected.
      const live = elementIds(d);
      for (const id of [...this.ui.selection]) if (!live.has(id)) this.ui.selection.delete(id);
      this.refresh();
    });
    // The first framing waits until the viewport has a size: framing a 0 × 0 canvas sets a useless scale.
    new ResizeObserver(() => {
      const r = this.shell.viewport.getBoundingClientRect();
      if (!this.framed[this.ui.view] && r.width > 0 && r.height > 0) this.frameAll();
      else this.render();
    }).observe(this.shell.viewport);
    this.applyTheme();
    this.shell.relabel();
    this.cube.relabel();
    this.refresh();
  }

  height(): number {
    return Math.max(2.8, ...[...this.geometry.solids.values()].map((s) => s.top));
  }

  /** Recomputes the derived geometry (with the wall being drawn) and redraws. */
  refresh(): void {
    const doc = this.store.get();
    const d = this.ui.drag;
    const shown = d && d.kind !== 'marquee' ? { ...doc, walls: d.walls } : doc;
    this.geometry = deriveGeometry(shown, this.previewWall(), this.previewOpening());
    this.render();
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
        this.ui.error = t('hint.openingRefused', { reason: t(`warn.${problem}`) });
        return this.refresh();
      }
      this.ui.error = null;
      this.store.dispatch(addOpening(opening));
    } else this.refresh();
  }

  /** While aiming: why the opening cannot go there, said before the click. */
  private previewProblem(): string | null {
    const p = this.geometry.openings.get(OPENING_PREVIEW_ID);
    const k = p?.warnings.find((w) => w === 'openingOverlap' || w === 'openingOutside');
    return k ? t('hint.openingRefused', { reason: t(`warn.${k}`) }) : null;
  }

  selectedRooms(): RoomSolid[] {
    return [...this.ui.selection].flatMap((id) => this.geometry.rooms.get(id) ?? []);
  }

  selectedFloors(): FloorSolid[] {
    return [...this.ui.selection].flatMap((id) => this.geometry.floors.get(id) ?? []);
  }

  /** The room tool: a click inside closed walls makes a room there, unless one is there already. */
  roomClick(p: Point2): void {
    const doc = this.store.get();
    const existing = [...this.visibleGeometry().rooms.values()].find((r) => r.enclosed && insideRing(r.outline, p));
    if (existing) {
      this.ui.selection = new Set([existing.room.id]);
      this.ui.error = null;
      this.ui.info = t('hint.roomExists');
      return this.refresh();
    }
    const n = doc.rooms.filter((r) => r.levelId === this.ui.levelId).length + 1;
    const room = { id: newId('room'), levelId: this.ui.levelId, seed: p, name: defaultName.room(n), number: String(n) };
    const probe = deriveGeometry({ ...doc, rooms: [room] }).rooms.get(room.id);
    if (!probe?.enclosed) {
      this.ui.error = t('hint.roomNotEnclosed');
      return this.renderChrome();
    }
    this.ui.error = null;
    this.store.dispatch(addRoom(room));
  }

  /** The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. */
  floorClick(p: Point2, mpp: number): void {
    const draft = this.ui.floorDraft;
    if (draft.length === 0) {
      const room = [...this.visibleGeometry().rooms.values()].find((r) => r.enclosed && insideRing(r.outline, p));
      if (room) {
        const has = this.store.get().floors.find((f) => f.source.kind === 'room' && f.source.roomId === room.room.id);
        if (has) {
          this.ui.selection = new Set([has.id]);
          this.ui.error = null;
          this.ui.info = t('hint.floorExists');
          return this.refresh();
        }
        this.ui.error = null;
        return this.addFloorToRoom(room.room.id);
      }
    }
    // Clicking the first corner again (within 10 px) closes the outline.
    if (draft.length >= 3 && distance(p, draft[0]!) <= 10 * mpp) return this.floorFinish();
    this.ui.floorDraft = [...draft, p];
    this.render();
  }

  /** A floor following a room's outline; said and selected at once, so it is seen without another click. */
  addFloorToRoom(roomId: string): void {
    const room = this.store.get().rooms.find((r) => r.id === roomId);
    if (!room || this.store.get().floors.some((f) => f.source.kind === 'room' && f.source.roomId === roomId)) return;
    const id = newId('floor');
    this.store.dispatch(addFloor({ id, levelId: room.levelId, source: { kind: 'room', roomId }, ...FLOOR_DEFAULTS }));
    this.ui.selection = new Set([id]);
    this.ui.info = t('hint.floorAdded', { room: name(room.name) });
    this.refresh();
  }

  /** Opens the properties panel and puts the keyboard in it. */
  showProperties(): void {
    if (!this.ui.panelOpen) this.togglePanel(true);
    this.render();
    const first = this.shell.panel.querySelector<HTMLElement>('input, select, button:not([disabled])');
    (first ?? this.shell.panel).focus();
  }

  floorFinish(): void {
    const points = this.ui.floorDraft;
    this.ui.floorDraft = [];
    if (points.length < 3) return this.render();
    this.store.dispatch(addFloor({ id: newId('floor'), levelId: this.ui.levelId, source: { kind: 'outline', points }, ...FLOOR_DEFAULTS }));
  }

  selectedOpenings(): OpeningSolid[] {
    return [...this.ui.selection].filter(isOpeningId).flatMap((id) => this.geometry.openings.get(id) ?? []);
  }

  previewWall(): DocWall[] {
    const w = this.ui.wall;
    if (this.ui.tool !== 'wall') return [];
    if (w.kind === 'bend') {
      const b = bulgeThrough(w.last, w.end, w.cursor);
      return [this.makeWall(w.last, w.end, PREVIEW_ID, b ?? 0)];
    }
    if (w.kind !== 'drawing') return [];
    const end = this.drawingEnd();
    if (distance(w.last, end) < MIN_WALL_LENGTH) return [];
    return [this.makeWall(w.last, end, PREVIEW_ID)];
  }

  /** While turning the selection: the angle, at the point it turns about. */
  private turnMeasure(): { at: Point2; text: string } | null {
    const d = this.ui.drag;
    if (d?.kind !== 'rotate') return null;
    const deg = (d.angle * 180) / Math.PI;
    return { at: d.pivot, text: `${num(deg, 1)}°` };
  }

  /** While bending an arc: its radius, at the middle of the arc, set off outward. Null for a straight bend. */
  private bendMeasure(): { at: Point2; text: string; normal: Point2; clear: number } | null {
    const w = this.ui.wall;
    if (this.ui.tool !== 'wall' || w.kind !== 'bend') return null;
    const b = bulgeThrough(w.last, w.end, w.cursor);
    const arc = b === null ? null : arcOf({ start: w.last, end: w.end, bulge: b });
    if (!arc) return null;
    const mid = arc.startAngle + arc.sweep / 2;
    const out = { x: Math.cos(mid), y: Math.sin(mid) };
    const at = { x: arc.center.x + out.x * arc.radius, y: arc.center.y + out.y * arc.radius };
    const length = arc.radius * Math.abs(arc.sweep);
    return { at, text: `R ${num(arc.radius)} m · ${num(length)} m`, normal: out, clear: 0.2 };
  }

  /** The end of the segment being drawn: the typed length (and angle) when there is one, else the cursor. */
  drawingEnd(): Point2 {
    const w = this.ui.wall;
    if (w.kind !== 'drawing') return w.kind === 'bend' ? w.end : { x: 0, y: 0 };
    const typed = parseLengthAngle(this.shell.measure.value);
    return typed.ok && typed.value.length >= MIN_WALL_LENGTH ? typedEnd(w, typed.value.length, typed.value.angle) : w.cursor;
  }

  makeWall(start: Point2, end: Point2, id = newId('wall'), bulge = 0): DocWall {
    const d = this.ui.defaults;
    const wall: DocWall = {
      id,
      wallTypeId: d.wallTypeId,
      referenceLine: d.referenceLine,
      start,
      end,
      ...(bulge !== 0 ? { bulge } : {}),
      levelId: this.ui.levelId,
      baseOffset: d.baseOffset,
      top: d.top,
    };
    // Values equal to the type's are not kept on the wall: it follows its type for them.
    const own = wallOverrides(this.store.get(), wall);
    const { top, baseOffset, ...rest } = wall;
    return { ...rest, ...(own.top ? { top: top! } : {}), ...(own.baseOffset ? { baseOffset: baseOffset! } : {}) };
  }

  /** A world point on the current level, on the screen (viewport pixels); null when behind the camera. */
  toScreen(p: Point2): Point2 | null {
    if (this.ui.view === 'plan') return this.plan.toScreen(p);
    const z = this.store.get().levels.find((l) => l.id === this.ui.levelId)?.elevation ?? 0;
    const v = new THREE.Vector3(p.x, z, -p.y).project(this.scene.camera);
    if (v.z > 1) return null;
    const r = this.shell.viewport.getBoundingClientRect();
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
  }

  /** A piece's outline on the screen: the polygon in plan, the hull of its prism in 3D. */
  outlineOnScreen(poly: readonly Point2[], bottom: number, top: number): Point2[] {
    if (this.ui.view === 'plan') return poly.map((p) => this.plan.toScreen(p));
    const r = this.shell.viewport.getBoundingClientRect();
    const pts: Point2[] = [];
    for (const p of poly) {
      for (const z of [bottom, top]) {
        const v = new THREE.Vector3(p.x, z, -p.y).project(this.scene.camera);
        if (v.z <= 1) pts.push({ x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height });
      }
    }
    return hull(pts);
  }

  // ---- actions -------------------------------------------------------------------------------

  setTool(tool: ToolId): void {
    this.ui.tool = tool;
    this.ui.wall = IDLE;
    this.ui.opening = OPENING_IDLE;
    this.ui.floorDraft = [];
    this.ui.snap = null;
    this.ui.hover = null;
    this.ui.error = null;
    this.ui.info = null;
    this.shell.measure.value = '';
    if (tool !== 'select') this.ui.selection.clear();
    this.refresh();
  }

  setView(view: ViewId): void {
    if (this.ui.view === view) return;
    this.ui.view = view;
    savePrefs({ view });
    this.render();
    if (!this.framed[view]) this.frameAll();
  }

  wallEvent(event: WallToolEvent): void {
    const r = wallTransition(this.ui.wall, event);
    // A value typed for one step (a length, a radius) never carries over to the next.
    if (r.state.kind !== this.ui.wall.kind || r.segment) this.shell.measure.value = '';
    this.ui.wall = r.state;
    if (r.segment) this.store.dispatch(addWalls([this.makeWall(r.segment.start, r.segment.end, newId('wall'), r.segment.bulge ?? 0)]));
    else this.refresh();
  }

  /** The footer field: a length (and angle) while drawing; a new length for one selected wall. */
  submitMeasure(text: string): boolean {
    if (text.trim() === '') return false;
    if (this.ui.tool === 'wall' && this.ui.wall.kind === 'bend') {
      const radius = parseLength(text);
      if (!radius.ok || radius.value <= 0) {
        this.ui.error = t('hint.badMeasure', { text });
        this.renderChrome();
        return false;
      }
      this.ui.error = null;
      this.wallEvent({ kind: 'typedRadius', radius: radius.value });
      return true;
    }
    // "x;y": a point, as a click there would be: the start or the next point of a wall, a floor's
    // corner, a room's point. So drawing needs no mouse (ref/chat.txt:207, 242).
    const point = parsePoint(text);
    if (point.ok) {
      const wall = this.ui.tool === 'wall' && this.ui.wall.kind !== 'bend';
      if (!wall && this.ui.tool !== 'floor' && this.ui.tool !== 'room') {
        this.ui.error = t('hint.pointHere', { text });
        this.renderChrome();
        return false;
      }
      this.ui.error = null;
      if (wall) this.wallEvent({ kind: 'click', point: point.value });
      else if (this.ui.tool === 'floor') this.floorClick(point.value, 0);
      else this.roomClick(point.value);
      return true;
    }
    const r = parseLengthAngle(text);
    if (!r.ok || r.value.length < MIN_WALL_LENGTH) {
      this.ui.error = t('hint.badMeasure', { text });
      this.renderChrome();
      return false;
    }
    this.ui.error = null;
    if (this.ui.tool === 'wall' && this.ui.wall.kind === 'drawing') {
      this.wallEvent({ kind: 'typed', length: r.value.length, angle: r.value.angle });
      return true;
    }
    if (this.openingKind() && this.ui.opening.kind === 'aiming') {
      this.openingEvent({ kind: 'typed', distance: r.value.length });
      return true;
    }
    // One opening selected: the typed value is its rule's new distance.
    const openings = this.selectedOpenings();
    if (openings.length === 1 && this.ui.selection.size === 1) {
      const o = openings[0]!.opening;
      const rule = hasDistance(o.rule) ? o.rule : ruleKeepingPosition(this.store.get(), o.id, 'fromStart');
      if (rule && hasDistance(rule)) this.store.dispatch(updateOpening(o.id, { rule: { ...rule, distance: r.value.length } }));
      return true;
    }
    const sel = this.selectedWalls();
    if (sel.length === 1) {
      const w = sel[0]!;
      const len = distance(w.start, w.end);
      const k = r.value.length / len;
      this.store.dispatch(updateWalls([w.id], { end: { x: w.start.x + (w.end.x - w.start.x) * k, y: w.start.y + (w.end.y - w.start.y) * k } }));
      return true;
    }
    return false;
  }

  /** Every wall of the current level, with the select tool. */
  selectAllWalls(): void {
    this.setTool('select');
    for (const w of this.store.get().walls) if (w.levelId === this.ui.levelId) this.ui.selection.add(w.id);
    this.refresh();
  }

  clearSelection(): void {
    this.ui.selection.clear();
    this.refresh();
  }

  toggleSnaps(): void {
    this.ui.snaps = !this.ui.snaps;
    this.render();
  }

  otherLanguage(): Lang {
    return getLang() === 'en' ? 'pt' : 'en';
  }

  /** Shows another level in plan; the selection, which belonged to the old one, is cleared. */
  setLevel(id: string): void {
    if (!this.store.get().levels.some((l) => l.id === id)) return;
    this.ui.levelId = id;
    this.ui.selection.clear();
    this.refresh();
  }

  deleteSelection(): void {
    if (this.ui.selection.size === 0) return;
    this.store.dispatch(deleteElements([...this.ui.selection]));
  }

  undo(): void {
    if (this.store.undo()) this.toast(t('toast.undo'));
  }

  redo(): void {
    if (this.store.redo()) this.toast(t('toast.redo'));
  }

  private seenSelection = '';

  /**
   * When the selection changes and the panel lying over the drawing would hide it (the sheet on a
   * phone, the drawer on a tablet), the plan slides just enough to show it beside the panel.
   */
  private keepSelectionInView(): boolean {
    const key = [...this.ui.selection].join(',');
    if (key === this.seenSelection) return false;
    this.seenSelection = key;
    const covered = this.covered();
    if (key === '' || (covered.right === 0 && covered.bottom === 0)) return false;
    const box = boundsOf(this.geometry, this.ui.selection);
    if (!box) return false;
    const vp = this.shell.viewport.getBoundingClientRect();
    const a = this.plan.toScreen({ x: box.min.x, y: box.max.y });
    const b = this.plan.toScreen({ x: box.max.x, y: box.min.y });
    const margin = 16;
    const dy = Math.max(0, b.y - (vp.height - covered.bottom - margin));
    const dx = Math.max(0, b.x - (vp.width - covered.right - margin));
    // Never past the top or left edge: a selection taller than the free part keeps its top in view.
    const up = Math.min(dy, Math.max(0, a.y - margin));
    const left = Math.min(dx, Math.max(0, a.x - margin));
    if (up <= 0 && left <= 0) return false;
    this.plan.panBy(-left, -up);
    return true;
  }

  /** How much the panel covers of the viewport, at its right (drawer) or bottom (phone sheet). */
  covered(): Insets {
    if (this.shell.panel.hidden) return NO_INSETS;
    const vp = this.shell.viewport.getBoundingClientRect();
    const p = this.shell.panel.getBoundingClientRect();
    if (p.width === 0 || p.height === 0) return NO_INSETS;
    if (p.top > vp.top + 8 && p.top < vp.bottom) return { right: 0, bottom: vp.bottom - p.top };
    if (p.left > vp.left && p.left < vp.right) return { right: vp.right - p.left, bottom: 0 };
    return NO_INSETS;
  }

  frameAll(): void {
    const r = this.shell.viewport.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.framed[this.ui.view] = true;
    const box = boundsOf(this.visibleGeometry());
    this.scene.setCovered(this.covered());
    if (this.ui.view === 'plan') this.plan.frame(box, this.covered());
    else this.scene.frame(box, this.height());
    this.render();
  }

  frameSelection(): void {
    if (this.ui.selection.size === 0) return this.frameAll();
    const box = boundsOf(this.geometry, this.ui.selection);
    this.scene.setCovered(this.covered());
    if (this.ui.view === 'plan') this.plan.frame(box, this.covered());
    else this.scene.frame(box, this.height());
    this.render();
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

  saveFile(): void {
    const doc = this.store.get();
    const blob = new Blob([writeProject(doc)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(t('toast.saved'));
  }

  /** Opens a project file in place of the current project, as one undo step. */
  async openFile(file: File): Promise<void> {
    const r = readProject(await file.text());
    if (!r.ok) {
      this.ui.error = t(`open.${r.error}`);
      return this.renderChrome();
    }
    this.ui.error = null;
    this.ui.selection.clear();
    this.ui.drag = null;
    this.ui.levelId = r.doc.levels[0]!.id;
    // One undo step, like any other change: opening by mistake never loses the project that was open.
    this.store.dispatch({ label: 'cmd.openProject', apply: () => r.doc });
    this.framed.plan = false;
    this.framed['3d'] = false;
    this.frameAll();
    const fixed = r.fixes.reduce((s, f) => s + f.count, 0);
    this.toast(fixed > 1 ? t('toast.openedFixed', { n: fixed }) : fixed === 1 ? t('toast.openedFixedOne') : t('toast.openedUndo'));
  }

  toast(text: string): void {
    const el = this.shell.toast;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove('show'), 1600);
  }

  selectedWalls(): DocWall[] {
    return this.store.get().walls.filter((w) => this.ui.selection.has(w.id));
  }

  // ---- rendering -----------------------------------------------------------------------------

  render(): void {
    const { ui, shell } = this;
    const plan = ui.view === 'plan';
    // On narrow screens the panel is a drawer over the drawing: it opens only when it has something
    // to show, so it never covers the model for nothing. Set first: what it covers shapes the view.
    const narrow = matchMedia('(max-width: 900px)').matches;
    shell.panel.hidden = !ui.panelOpen || (narrow && ui.selection.size === 0 && ui.tool === 'select');
    shell.planCanvas.classList.toggle('hidden', !plan);
    shell.glCanvas.classList.toggle('hidden', plan);
    this.cube.root.hidden = plan;
    // The view cube and the 3D view's centre stay in the part of the viewport the panel leaves free.
    const covered = this.covered();
    this.cube.root.style.right = `${20 + covered.right}px`;
    this.scene.setCovered(covered);
    const preview = new Set([...this.previewWall(), ...this.previewOpening()].map((w) => w.id));
    const guide = this.openingKind() ? ruleGuide(this.geometry, OPENING_PREVIEW_ID) : null;
    if (plan) {
      const w = ui.wall;
      const drawing = ui.tool === 'wall' && w.kind === 'drawing';
      const end = drawing ? this.drawingEnd() : null;
      const len = end && w.kind === 'drawing' ? distance(w.last, end) : 0;
      const ang = end && w.kind === 'drawing' ? ((Math.atan2(end.y - w.last.y, end.x - w.last.x) * 180) / Math.PI + 360) % 360 : 0;
      const along = end && w.kind === 'drawing' && len > 0 ? { x: (end.x - w.last.x) / len, y: (end.y - w.last.y) / len } : null;
      // How far the drawn preview reaches on the measure's side: its pieces as derived (reference line,
      // thickness and joins included), so the measure is set off past them.
      const side = along ? { x: -along.y, y: along.x } : null;
      const reach =
        side && w.kind === 'drawing'
          ? Math.max(0, ...(this.geometry.solids.get(PREVIEW_ID)?.pieces ?? []).flatMap((p) => p.polygon.map((v) => (v.x - w.last.x) * side.x + (v.y - w.last.y) * side.y)))
          : 0;
      const labelKey = ui.snap ? snapLabel[ui.snap.kind] : null;
      this.plan.draw(this.visibleGeometry(), {
        selected: ui.selection,
        hover: ui.hover,
        preview,
        snap:
          ui.tool === 'wall' && ui.snap
            ? { point: ui.snap.point, label: labelKey ? t(labelKey) : null, ...(ui.snap.guideFrom ? { guideFrom: ui.snap.guideFrom } : {}), ...(along ? { away: along } : {}) }
            : null,
        measure:
          end && along && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
            ? { at: { x: (w.last.x + end.x) / 2, y: (w.last.y + end.y) / 2 }, text: `${num(len)} m · ${num(ang, 1)}°`, normal: side!, clear: reach }
            : (this.bendMeasure() ?? this.turnMeasure() ?? guide?.measure ?? null),
        axis: end && len >= MIN_WALL_LENGTH && w.kind === 'drawing' ? { start: w.last, end } : (guide?.axis ?? null),
        handles: this.handles(),
        roomLabels: [...this.visibleGeometry().rooms.values()].map((r) => ({
          at: r.room.seed,
          name: `${r.room.number} · ${name(r.room.name)}`,
          short: r.room.number,
          area: r.enclosed ? `${num(r.area)} m²` : t('warn.roomNotEnclosed'),
          warn: !r.enclosed,
          outline: r.outline,
        })),
        draft: ui.tool === 'floor' && ui.floorDraft.length > 0 ? [...ui.floorDraft, ...(ui.cursor ? [ui.cursor] : [])] : null,
        openingPreview: preview.has(OPENING_PREVIEW_ID) ? OPENING_PREVIEW_ID : null,
        dims: this.currentDims(),
      });
    } else {
      this.scene.sync(this.visibleGeometry(), ui.selection, preview);
      this.cube.update(this.scene.camera);
    }
    this.placeDims(plan ? this.currentDims() : []);
    this.renderBrowserDrawer();
    this.renderChrome();
    // The panel is rebuilt only when what it shows changed: rebuilding on every mouse move would
    // close an open list and drop the focus of a field being typed in.
    const doc = this.store.get();
    const openingKey = JSON.stringify([ui.openingDefaults, this.geometry.openingWarnings, this.selectedOpenings().map((o) => [o.start, o.end])]);
    const panelKey = [ui.tool, [...ui.selection].sort().join(','), getLang(), JSON.stringify(ui.defaults), JSON.stringify(this.geometry.warnings), openingKey].join('|');
    const placing = this.openingKind();
    if (doc === this.panelDoc && panelKey === this.panelKey) return this.afterPanel();
    this.panelDoc = doc;
    this.panelKey = panelKey;
    renderPanel(
      shell.panel,
      {
        doc,
        selected: this.selectedWalls(),
        drawing: ui.tool === 'wall',
        defaults: ui.defaults,
        warnings: this.geometry.warnings,
        openings: this.selectedWalls().length === 0 ? this.selectedOpenings() : [],
        rooms: this.selectedRooms(),
        floors: this.selectedFloors(),
        placed: this.geometry.openings,
        openingWarnings: this.geometry.openingWarnings,
        openingTool: placing ? { kind: placing, size: ui.openingDefaults[placing] } : null,
      },
      {
        updateWalls: (patch) => this.store.dispatch(updateWalls([...ui.selection], patch)),
        resetToType: (fields) => this.store.dispatch(resetWallsToType([...ui.selection], fields)),
        updateDefaults: (patch) => {
          ui.defaults = { ...ui.defaults, ...patch };
          this.refresh();
        },
        close: () => this.togglePanel(false),
        room: {
          updateRoom: (id, patch) => this.store.dispatch(updateRoom(id, patch)),
          updateFloor: (ids, patch) => {
            const doc = this.store.get();
            const next = ids.reduce((d, id) => updateFloor(id, patch).apply(d), doc);
            if (next !== doc) this.store.dispatch({ label: 'cmd.updateFloor', apply: () => next });
          },
        },
        opening: {
          update: (ids, patch) => {
            // One command for the whole selection: one undo step.
            const doc = this.store.get();
            const next = ids.reduce((d, id) => updateOpening(id, patch).apply(d), doc);
            if (next !== doc) this.store.dispatch({ label: 'cmd.updateOpening', apply: () => next });
          },
          setRule: (id, kind, referenceId) => {
            const rule = ruleKeepingPosition(this.store.get(), id, kind, referenceId);
            if (rule) this.store.dispatch(updateOpening(id, { rule }));
          },
          align: (refId, ids, edge) => this.store.dispatch(alignOpenings(refId, ids, edge)),
          alignHeads: (refId, ids) => this.store.dispatch(alignHeads(refId, ids)),
          distribute: (ids, spacing) => this.store.dispatch(distributeOpenings(newId(GROUP_PREFIX), ids, spacing)),
          setSpacing: (groupId, spacing) => this.store.dispatch(setGroupSpacing(groupId, spacing)),
          ungroup: (groupId) => this.store.dispatch(ungroupOpenings(groupId)),
        },
        updateOpeningDefaults: (kind, patch) => {
          ui.openingDefaults = { ...ui.openingDefaults, [kind]: { ...ui.openingDefaults[kind], ...patch } };
          this.refresh();
        },
      },
    );
    this.afterPanel();
  }

  /**
   * After the panel has its content: a new selection the panel would hide (sheet or drawer over the
   * plan) brings the plan into view, and the plan is drawn again where it now is.
   */
  private afterPanel(): void {
    if (this.ui.view === 'plan' && this.keepSelectionInView()) this.render();
  }

  /** Temporary dimensions of the one selected element, while selecting (not while dragging). */
  private currentDims(): TempDim[] {
    if (this.ui.tool !== 'select' || this.ui.drag) return [];
    return tempDims(this.store.get(), this.geometry, this.ui.selection);
  }

  /**
   * The value of each temporary dimension, as a button at the middle of its line; the one being
   * edited is a field. Elements are kept between renders so a field being typed in keeps its focus.
   */
  private placeDims(dims: readonly TempDim[]): void {
    const box = this.shell.dims;
    if (this.ui.dimEdit && !dims.some((d) => d.id === this.ui.dimEdit)) this.ui.dimEdit = null;
    const keep = new Set(dims.map((d) => `${d.id}|${d.id === this.ui.dimEdit ? 'edit' : 'show'}`));
    for (const child of [...box.children] as HTMLElement[]) if (!keep.has(child.dataset.key ?? '')) child.remove();
    for (const d of dims) {
      const editing = d.id === this.ui.dimEdit;
      const key = `${d.id}|${editing ? 'edit' : 'show'}`;
      let node = [...box.children].find((c) => (c as HTMLElement).dataset.key === key) as HTMLElement | undefined;
      if (!node) {
        node = editing ? this.dimField(d) : this.dimButton(d);
        node.dataset.key = key;
        box.append(node);
        if (node instanceof HTMLInputElement) {
          node.focus();
          node.select();
        }
      }
      if (node instanceof HTMLButtonElement) {
        node.textContent = num(d.value);
        node.title = t('dim.edit');
        node.setAttribute('aria-label', `${num(d.value)} m. ${t('dim.edit')}`);
      }
      const l = this.plan.dimLine(d);
      node.style.left = `${(l.a.x + l.b.x) / 2}px`;
      node.style.top = `${(l.a.y + l.b.y) / 2}px`;
    }
  }

  private dimButton(d: TempDim): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.addEventListener('click', () => {
      this.ui.dimEdit = d.id;
      this.render();
    });
    return b;
  }

  private dimField(d: TempDim): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.value = num(d.value);
    input.setAttribute('aria-label', t('foot.measure'));
    const close = () => {
      if (this.ui.dimEdit !== d.id) return;
      this.ui.dimEdit = null;
      this.render();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        this.ui.error = null;
        return close();
      }
      if (e.key !== 'Enter') return;
      const text = input.value.trim();
      const v = parseLength(text);
      // The dimension as it is now: the one this field was made for may be stale.
      const dim = this.currentDims().find((x) => x.id === d.id);
      const cmd = v.ok && dim ? dim.apply(v.value) : null;
      if (!cmd) {
        this.ui.error = t(v.ok ? 'hint.dimRefused' : 'hint.badMeasure', { text });
        return this.renderChrome();
      }
      this.ui.error = null;
      this.ui.dimEdit = null;
      this.store.dispatch(cmd);
    });
    input.addEventListener('blur', close);
    return input;
  }

  /**
   * The handles of the selected walls in plan (handles.ts): while selecting, and while one of them is
   * dragged (then on the walls as they are being dragged). None in 3D, during a move or a window.
   */
  handles(): Handles {
    const d = this.ui.drag;
    if (this.ui.tool !== 'select' || this.ui.view !== 'plan' || d?.kind === 'move' || d?.kind === 'marquee') return handlesFor([], (p) => p);
    const walls = d ? d.walls : this.store.get().walls;
    return handlesFor(
      walls.filter((w) => this.ui.selection.has(w.id)),
      (p) => this.plan.toScreen(p),
    );
  }

  /** In plan, only the current level's walls and openings; in 3D, every level. */
  visibleGeometry(): DerivedGeometry {
    const g = hideCategories(this.geometry, this.ui.hidden);
    if (this.ui.view !== 'plan') return g;
    const solids = new Map([...g.solids].filter(([, s]) => s.wall.levelId === this.ui.levelId));
    const levelWalls = new Set(this.store.get().walls.filter((w) => w.levelId === this.ui.levelId).map((w) => w.id));
    const openings = new Map([...g.openings].filter(([, o]) => levelWalls.has(o.opening.wallId)));
    const rooms = new Map([...g.rooms].filter(([, r]) => r.room.levelId === this.ui.levelId));
    const floors = new Map([...g.floors].filter(([, f]) => f.floor.levelId === this.ui.levelId));
    return { ...g, solids, openings, rooms, floors };
  }

  toggleBrowser(open = !this.ui.browserOpen): void {
    this.ui.browserOpen = open;
    savePrefs({ browserOpen: open });
    this.render();
    if (open) this.shell.browser.querySelector<HTMLElement>('button')?.focus();
    else this.shell.sidebar.focus();
  }

  /** Shows or hides a category of elements; what is hidden leaves the selection. */
  toggleCategory(c: Category): void {
    if (this.ui.hidden.has(c)) this.ui.hidden.delete(c);
    else this.ui.hidden.add(c);
    const shown = this.visibleGeometry();
    for (const id of [...this.ui.selection]) {
      if (!shown.solids.has(id) && !shown.openings.has(id) && !shown.rooms.has(id) && !shown.floors.has(id)) this.ui.selection.delete(id);
    }
    this.refresh();
  }

  /** Every wall of a type on the current level, with the select tool. */
  selectWallsOfType(typeId: string): void {
    this.setTool('select');
    for (const w of this.store.get().walls) if (w.wallTypeId === typeId && w.levelId === this.ui.levelId) this.ui.selection.add(w.id);
    this.refresh();
  }

  private browserKey = '';
  /** Opens the levels dialog; set by the input layer, which owns the dialogs. */
  openLevels: () => void = () => {};

  private renderBrowserDrawer(): void {
    const { ui, shell } = this;
    shell.browser.hidden = !ui.browserOpen;
    shell.sidebar.setAttribute('aria-pressed', String(ui.browserOpen));
    if (!ui.browserOpen) return;
    const doc = this.store.get();
    const key = JSON.stringify([getLang(), ui.view, ui.levelId, [...ui.hidden], doc.levels, doc.wallTypes.map((x) => [x.id, x.name]), doc.walls.map((w) => w.wallTypeId)]);
    if (key === this.browserKey) return;
    this.browserKey = key;
    // Keep the focus on the same button across the rebuild.
    const focused = document.activeElement instanceof HTMLElement && shell.browser.contains(document.activeElement) ? [...shell.browser.querySelectorAll('button')].indexOf(document.activeElement as HTMLButtonElement) : -1;
    renderBrowser(this, shell.browser, () => this.openLevels());
    if (focused >= 0) shell.browser.querySelectorAll('button')[focused]?.focus();
  }

  togglePanel(open = !this.ui.panelOpen): void {
    this.ui.panelOpen = open;
    savePrefs({ panelOpen: open });
    this.render();
  }

  private renderChrome(): void {
    const { ui, shell, store } = this;
    const doc = store.get();
    shell.panelToggle.setAttribute('aria-pressed', String(ui.panelOpen));
    shell.projectName.textContent = doc.name || t('app.untitled');
    shell.undo.disabled = !store.canUndo();
    shell.redo.disabled = !store.canRedo();
    shell.view3d.setAttribute('aria-pressed', String(ui.view === '3d'));
    shell.viewPlan.setAttribute('aria-pressed', String(ui.view === 'plan'));
    shell.viewWalk.setAttribute('aria-pressed', 'false');
    shell.toolSelect.setAttribute('aria-pressed', String(ui.tool === 'select'));
    shell.toolWall.setAttribute('aria-pressed', String(ui.tool === 'wall'));
    shell.toolRoom.setAttribute('aria-pressed', String(ui.tool === 'room'));
    shell.toolFloor.setAttribute('aria-pressed', String(ui.tool === 'floor'));
    shell.toolDoor.setAttribute('aria-pressed', String(ui.tool === 'door'));
    shell.toolWindow.setAttribute('aria-pressed', String(ui.tool === 'window'));
    shell.lang.textContent = getLang().toUpperCase();
    // Rewritten only when it changes: replacing the icon under the pointer between press and release
    // would cancel the click.
    const themeIcon = ui.theme === 'dark' ? 'sun' : 'moon';
    if (shell.theme.dataset.icon !== themeIcon) {
      shell.theme.innerHTML = icon(themeIcon);
      shell.theme.dataset.icon = themeIcon;
    }
    shell.snapBtn.setAttribute('aria-pressed', String(ui.snaps));
    const levelKey = JSON.stringify([getLang(), doc.levels.map((l) => [l.id, l.name, l.elevation])]);
    if (shell.level.dataset.key !== levelKey) {
      const sorted = [...doc.levels].sort((a, b) => b.elevation - a.elevation);
      shell.level.replaceChildren(...sorted.map((l) => new Option(name(l.name), l.id)), new Option(t('levels.edit'), EDIT_LEVELS));
      shell.level.dataset.key = levelKey;
    }
    if (!doc.levels.some((l) => l.id === ui.levelId)) ui.levelId = doc.levels[0]!.id;
    shell.level.value = ui.levelId;
    shell.emptyHint.hidden = doc.walls.length > 0 || (ui.tool === 'wall' && ui.wall.kind === 'drawing');

    // Footer: what to do now, the keys that work now, and the measure field.
    const drawing = ui.tool === 'wall';
    const w = ui.wall;
    const arc = w.arc === true;
    const d = ui.drag;
    const hintKey: MessageKey = drawing
      ? w.kind === 'bend'
        ? 'hint.arcBend'
        : w.kind === 'idle'
          ? arc
            ? 'hint.arcStart'
            : 'hint.wallStart'
          : arc
            ? 'hint.arcEnd'
            : w.count >= 2
              ? 'hint.wallNextClose'
              : 'hint.wallNext'
      : d?.kind === 'move' || d?.kind === 'grip' || d?.kind === 'stretch' || d?.kind === 'rotate'
        ? 'hint.moving'
        : d?.kind === 'marquee'
          ? d.b.x < d.a.x
            ? 'hint.marqueeCrossing'
            : 'hint.marqueeWindow'
          : ui.selection.size > 1
            ? 'hint.selectedMany'
            : ui.selection.size === 1
              ? ui.view === 'plan'
                ? 'hint.selected'
                : 'hint.selected3d'
              : 'hint.select';
    const placing = this.openingKind();
    const aiming = placing !== null && ui.opening.kind === 'aiming';
    const openingHint = placing
      ? ui.opening.kind === 'aiming'
        ? this.previewProblem() ?? t('hint.openingAim', { rule: ruleText(ui.opening.rule) })
        : t('hint.openingPlace', { kind: t(placing === 'door' ? 'panel.door' : 'panel.window').toLowerCase() })
      : null;
    const toolHint = ui.tool === 'room' ? t('hint.roomPlace') : ui.tool === 'floor' ? t(ui.floorDraft.length > 0 ? 'hint.floorNext' : 'hint.floorPlace') : null;
    shell.instr.textContent = ui.error ?? ui.info ?? openingHint ?? toolHint ?? t(hintKey, { n: ui.selection.size });
    shell.instr.classList.toggle('error', ui.error !== null);
    const keys = placing || ui.tool === 'room'
      ? [keyHint('Esc', t('key.exit'))]
      : ui.tool === 'floor'
      ? [keyHint('Enter', t('key.finish')), keyHint('Esc', t('key.exit'))]
      : drawing
      ? w.kind !== 'idle'
        ? [keyHint('Enter', t('key.finish')), keyHint('A', t('key.arc')), keyHint('Shift', t('key.straight')), keyHint('Esc', t('key.finish'))]
        : [keyHint('A', t('key.arc')), keyHint('S', t('key.snapOff')), keyHint('Esc', t('key.exit'))]
      : ui.selection.size > 0
        ? [keyHint('Shift', t('key.addRemove')), keyHint('Del', t('key.delete')), keyHint('F', t('key.frame')), keyHint('Esc', t('key.clear'))]
        : [keyHint('Ctrl K', t('key.commands')), keyHint('Ctrl A', t('key.selectAll')), keyHint('?', t('key.shortcuts'))];
    shell.keys.replaceChildren(...keys);
    const lengthMode = drawing && w.kind === 'drawing';
    // Where a point is asked for: the wall's start, a floor's corners, a room's point.
    const pointMode = (drawing && w.kind === 'idle') || ui.tool === 'floor' || ui.tool === 'room';
    const distanceMode = aiming || (ui.selection.size === 1 && this.selectedOpenings().length === 1);
    const withAngle = lengthMode && shell.measure.value.includes('<');
    shell.measureLabel.textContent = t(
      drawing && w.kind === 'bend'
        ? 'foot.radius'
        : withAngle
          ? 'foot.lengthAngle'
          : lengthMode
            ? 'foot.length'
            : pointMode
              ? 'foot.point'
              : distanceMode
                ? 'foot.distance'
                : 'foot.measure',
    );
    shell.measure.placeholder = t(lengthMode ? 'foot.lengthHint' : pointMode ? 'foot.pointHint' : distanceMode ? 'foot.distanceHint' : 'foot.measureHint');
    shell.toolWall.classList.toggle('arc-mode', drawing && arc);
    shell.coords.textContent = ui.cursor ? `x ${num(ui.cursor.x)} m  y ${num(ui.cursor.y)} m` : '';
    this.placeFloatBar();
  }

  /** The selection's quick actions, above the selection and never over it. */
  /** Opens the command palette; set by the input layer, which owns the dialogs. */
  openCommands: () => void = () => {};
  private floatKey = '';

  private placeFloatBar(): void {
    const bar = this.shell.floatBar;
    const entries = this.ui.selection.size > 0 ? contextEntries(this, () => this.openCommands()) : [];
    const key = `${getLang()}|${entries.map((e) => e.id).join(',')}`;
    if (key !== this.floatKey) {
      this.floatKey = key;
      bar.replaceChildren(
        ...entries.map((e) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'icon-btn';
          b.innerHTML = icon(e.icon);
          b.title = e.keys ? `${e.label} (${e.keys})` : e.label;
          b.setAttribute('aria-label', b.title);
          b.addEventListener('click', () => e.run());
          return b;
        }),
      );
    }
    const box = this.ui.tool === 'select' && !this.ui.drag ? boundsOf(this.geometry, this.ui.selection) : null;
    bar.hidden = box === null;
    if (box === null) return;
    const vp = this.shell.viewport.getBoundingClientRect();
    let x: number;
    let yTop: number;
    let yBottom: number;
    if (this.ui.view === 'plan') {
      const a = this.plan.toScreen({ x: box.min.x, y: box.max.y });
      const b = this.plan.toScreen({ x: box.max.x, y: box.min.y });
      x = (a.x + b.x) / 2;
      yTop = a.y;
      yBottom = b.y;
    } else {
      // The selection's screen box: every vertex of its pieces, at the bottom and at the top.
      const xs: number[] = [];
      const ys: number[] = [];
      const project = (v: Point2, z: number) => {
        const p = new THREE.Vector3(v.x, z, -v.y).project(this.scene.camera);
        // Behind the camera a point projects mirrored: leave it out.
        if (p.z > 1) return;
        xs.push(((p.x + 1) / 2) * vp.width);
        ys.push(((1 - p.y) / 2) * vp.height);
      };
      for (const id of this.ui.selection) {
        const opening = this.geometry.openings.get(id);
        if (opening) for (const v of openingOutline(opening)) [opening.bottom, opening.top].forEach((z) => project(v, z));
        // Rooms at their level's floor, floors at both their faces.
        const room = this.geometry.rooms.get(id);
        if (room) {
          const z = this.store.get().levels.find((l) => l.id === room.room.levelId)?.elevation ?? 0;
          for (const v of room.outline) project(v, z);
        }
        const floor = this.geometry.floors.get(id);
        if (floor) for (const v of floor.outline) [floor.bottom, floor.top].forEach((z) => project(v, z));
        const solid = this.geometry.solids.get(id);
        if (!solid) continue;
        for (const piece of solid.pieces) {
          for (const v of piece.polygon) {
            for (const z of [solid.bottom, solid.top]) project(v, z);
          }
        }
      }
      // Nothing of the selection in front of the camera: no bar, rather than one at a stale place.
      if (xs.length === 0) {
        bar.hidden = true;
        return;
      }
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
      yTop = Math.min(...ys);
      yBottom = Math.max(...ys);
    }
    const w = bar.offsetWidth || 104;
    const h = bar.offsetHeight || 36;
    // Never under the panel where it lies over the drawing (the sheet on a phone, the drawer on a tablet).
    const panel = this.shell.panel.hidden ? null : this.shell.panel.getBoundingClientRect();
    const covered = panel && panel.top > vp.top + 8 && panel.top < vp.bottom ? panel.top - vp.top : vp.height;
    const right = panel && panel.left > vp.left && panel.left < vp.right && panel.top <= vp.top + 8 ? panel.left - vp.left : vp.width;
    const left = Math.min(Math.max(8, x - w / 2), right - w - 8);
    // Never over a temporary dimension's value or a room's tag that it would cover (bar-place.ts).
    const boxes = [
      ...[...this.shell.dims.children].map((c) => c.getBoundingClientRect()).map((r) => ({ top: r.top - vp.top, bottom: r.bottom - vp.top, left: r.left - vp.left, right: r.right - vp.left })),
      ...(this.ui.view === 'plan' ? this.plan.labelBoxes.map((b) => ({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w })) : []),
    ];
    const y = placeBarY({ left, w, h }, { top: yTop, bottom: yBottom }, boxes, { h: covered });
    bar.style.left = `${left}px`;
    bar.style.top = `${Math.min(Math.max(8, y), covered - h - 8)}px`;
  }
}
