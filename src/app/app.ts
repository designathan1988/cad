// Application state and rendering. The project changes only through the store; selection, tool,
// view, camera, language and theme are interface state, outside the document and outside undo.

import * as THREE from 'three';
import { parseLength, parseLengthAngle, parsePoint } from '../core/measure';
import { createStore, type Store } from '../core/store';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { arcOf, pointAt } from '../elements/wall/geometry/arc';
import { addWalls, resetWallsToType, setWalls, updateWalls } from '../elements/wall/commands';
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
import { OPENING_IDLE, openingTransition, ruleBase, type OpeningToolEvent, type OpeningToolState } from '../tools/opening-tool';
import { MEASURE_IDLE, type MeasureEvent, type MeasureState, measureTransition, reading } from '../tools/measure-tool';
import { alignWalls, distributeWalls } from '../tools/arrange-walls';
import { draftAt, type GuideBase, type GuideDraft, guideLine, guideMeasure, newGuide } from '../tools/guide-tool';
import { addGuide, clearGuides } from '../elements/guide/commands';
import { GUIDE_PREFIX, type Guide, isGuideId } from '../elements/guide/schema';
import { aimAlong, OPENING_PREVIEW_ID, ruleGuide, ruleText } from './opening-ui';
import type { WallId } from '../elements/wall/schema';
import { type Insets, PlanView } from '../render/plan-view';
import { Scene3D } from '../render/scene-3d';
import { Overlay3D, type Overlay3DState } from '../render/overlay-3d';
import { toolCursor } from '../ui/cursors';
import { ViewCube } from '../render/view-cube';
import { defaultName, getLang, htmlLang, name, num, setLang, t, type Lang, type MessageKey } from '../ui/i18n';
import { icon } from '../ui/icons';
import { renderPanel } from '../ui/panel';
import { buildShell, keyHint, type Shell, type ToolId, type ViewId } from '../ui/shell';
import { snapLabel, type Snap } from '../tools/snap';
import { arcMiddle, bulgeKeepingSide } from '../tools/arc-edit';
import { bulgeThrough, IDLE, typedEnd, wallTransition, type WallToolEvent, type WallToolState } from '../tools/wall-tool';
import { type Drag, dragTransform, hull, moveGuides } from './select-drag';
import { moveFloors, moveRooms } from './carry';
import { stepSelection } from './keyboard-select';
import { nudge } from '../tools/nudge';
import { type Doc, type DocWall, elementIds, levelOf, newDocument, startLevel, type WallDefaults, wallNumber, wallOverrides } from './document';

/** The snap labels that name their wall. */
const SNAP_OF = { endpoint: 'snap.endpointOf', midpoint: 'snap.midpointOf', onWall: 'snap.onWallOf', aligned: 'snap.alignedOf' } as const;
import { boundsOf, type Category, deriveGeometry, type DerivedGeometry, hideCategories, type OpeningSolid, openingOutline } from './geometry';
import { renderBrowser } from '../ui/browser';
import { loadDocument, loadPrefs, saveDocument, savePrefs } from './persist';
import { readProject, writeProject } from '../io/project-file';
import { fitFactor, keepInView } from './keep-in-view';
import type { ViewKey } from './view-keys';
import { type TempDim, tempDims } from './temp-dims';
import { contextEntries } from './context-menu';
import { referenceLength } from '../elements/opening/derive';
import { type Handles, handlesFor, ROTATE_OFFSET } from './handles';
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
  /** The measure tool's tape (measure-tool.ts). */
  measure: MeasureState;
  /** A guide being placed (guide-tool.ts): Alt over a wall or a guide in a drawing tool. */
  guide: GuideDraft | null;
  /** The temporary dimension whose value is being typed. */
  dimEdit: string | null;
}

const PREVIEW_ID = '__preview__';
/** A message going after a colon in another ("Cannot place it here: overlaps…"): lower case first. */
const afterColon = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);
/** The level list's last entry: opens the levels dialog. */
export const EDIT_LEVELS = '__edit_levels__';

export class App {
  readonly store: Store<Doc>;
  readonly shell: Shell;
  readonly plan: PlanView;
  readonly scene: Scene3D;
  readonly cube: ViewCube;
  private readonly overlay3d: Overlay3D;
  /** What the overlay showed last: drawn again as the camera turns, without a whole render. */
  private overlayState: Overlay3DState | null = null;
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
      levelId: startLevel(doc, prefs.levelId),
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
      measure: MEASURE_IDLE,
      guide: null,
      dimEdit: null,
    };
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
      if (this.ui.view === '3d' && this.overlayState) this.overlay3d.draw(this.overlayState);
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
    // While dragging, the walls as dragged; the rooms going with a move or a turn go in the preview too,
    // so they never show as open mid-drag.
    const shown =
      d?.kind === 'move' || d?.kind === 'rotate'
        ? {
            ...doc,
            walls: d.walls,
            rooms: moveRooms(doc.rooms, d.rooms, dragTransform(d)),
            floors: d.kind === 'move' ? moveFloors(doc.floors, d.floors, dragTransform(d)) : doc.floors,
          }
        : d?.kind === 'slide'
          ? { ...doc, openings: d.openings }
          : d && d.kind !== 'marquee'
            ? { ...doc, walls: d.walls }
            : doc;
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
  private previewProblem(): string | null {
    const p = this.geometry.openings.get(OPENING_PREVIEW_ID);
    const k = p?.warnings.find((w) => w === 'openingOverlap' || w === 'openingOutside');
    return k ? t('hint.openingRefused', { reason: afterColon(t(`warn.${k}`)) }) : null;
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
    // Said and selected at once, as a new floor is: its name and number are in the panel to change.
    this.ui.selection = new Set([room.id]);
    this.ui.info = t('hint.roomAdded', { room: name(room.name) });
    this.refresh();
  }

  /**
   * The floor tool: a click in a room floors it; elsewhere it adds a corner to an outline. A typed
   * point is always a corner, as the footer says: typing inside a room draws an outline there.
   */
  floorClick(p: Point2, mpp: number, typed = false, corner = p): void {
    const draft = this.ui.floorDraft;
    if (draft.length === 0 && !typed) {
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
    if (draft.length >= 3 && distance(corner, draft[0]!) <= 10 * mpp) return this.floorFinish();
    // A corner (where the pointer snapped): the outline is what the footer is about now, not a room's
    // floor said before.
    this.ui.info = null;
    this.ui.floorDraft = [...draft, corner];
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
    this.ui.snap = null;
    if (points.length < 3) return this.render();
    const id = newId('floor');
    this.store.dispatch(addFloor({ id, levelId: this.ui.levelId, source: { kind: 'outline', points }, ...FLOOR_DEFAULTS }));
    this.ui.selection = new Set([id]);
    this.ui.info = t('hint.floorOutlineAdded', { n: points.length });
    this.refresh();
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

  /** The numbers of the walls selected (a few) or under the pointer, or snapped to while drawing. */
  private wallTags(): { at: Point2; text: string }[] {
    const doc = this.store.get();
    const ids = new Set([...this.ui.selection].slice(0, 12));
    if (this.ui.hover) ids.add(this.ui.hover);
    if (this.ui.snap?.wallId) ids.add(this.ui.snap.wallId);
    return doc.walls
      .filter((w) => ids.has(w.id) && w.levelId === this.ui.levelId)
      // A third of the way along: the middle is where the temporary dimension shows its value. Along an
      // arc, on the arc: on its chord the tag sat inside the curve, across the chord and radius dimensions.
      // At 70 % of its sweep, clear of the radius dimension (30 %, temp-dims.ts) and the bend handle (50 %).
      .map((w) => {
        const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
        const at = arc ? pointAt(arc, arc.startAngle + arc.sweep * 0.7) : { x: w.start.x + (w.end.x - w.start.x) / 3, y: w.start.y + (w.end.y - w.start.y) / 3 };
        return { at, text: t('wall.tag', { n: wallNumber(doc, w.id) ?? '' }) };
      });
  }

  /** While turning the selection: the angle, at the point it turns about. */
  private turnMeasure(): { at: Point2; text: string } | null {
    const d = this.ui.drag;
    if (d?.kind === 'stretch' || d?.kind === 'grip') {
      const w = d.walls.find((x) => x.id === d.id);
      return w ? { at: { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 }, text: `${num(referenceLength(w))} m` } : null;
    }
    if (d?.kind === 'bulge') {
      // The arc's radius and length at its middle, as while drawing one; straight again, its length.
      const w = d.walls.find((x) => x.id === d.id);
      if (!w) return null;
      const arc = arcOf({ start: w.start, end: w.end, bulge: w.bulge ?? 0 });
      const at = arcMiddle(w.start, w.end, w.bulge ?? 0);
      return arc ? { at, text: `R ${num(arc.radius)} m · ${num(referenceLength(w))} m` } : { at, text: `${num(referenceLength(w))} m` };
    }
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
    const point = parsePoint(this.shell.measure.value);
    if (point.ok) return point.value;
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
    return this.projectAt(p, this.store.get().levels.find((l) => l.id === this.ui.levelId)?.elevation ?? 0);
  }

  /** A world point at a height, on the screen of the 3D view (viewport pixels); null when behind the camera. */
  private projectAt(p: Point2, z: number): Point2 | null {
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
    // The floor tool with one room selected floors that room at once: the keyboard's way to it, as a
    // click inside the room is the mouse's (the tester's K3).
    const room = tool === 'floor' && this.ui.selection.size === 1 ? this.store.get().rooms.find((r) => this.ui.selection.has(r.id)) : undefined;
    // The door and window tools with one wall selected aim at its middle: a typed distance or Enter
    // places the opening there without the pointer (the tester's K2).
    const host = (tool === 'door' || tool === 'window') && this.ui.selection.size === 1 ? this.store.get().walls.find((w) => this.ui.selection.has(w.id)) : undefined;
    this.ui.tool = tool;
    this.ui.wall = IDLE;
    this.ui.opening = OPENING_IDLE;
    this.ui.floorDraft = [];
    this.ui.measure = MEASURE_IDLE;
    this.ui.guide = null;
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
    if (this.ui.view === view) return;
    this.ui.view = view;
    // Guides are the plan's: one being placed is dropped.
    this.ui.guide = null;
    savePrefs({ view });
    this.render();
    if (!this.framed[view]) this.frameAll();
  }

  /** The guides, as a move being dragged takes them. */
  private shownGuides(): readonly Guide[] {
    const d = this.ui.drag;
    const guides = this.store.get().guides;
    return d?.kind === 'move' ? moveGuides(guides, d) : guides;
  }

  /** The guides of the level shown, unless hidden. Plan only: they are neither drawn nor snapped to in 3D. */
  levelGuides(): Guide[] {
    if (this.ui.view !== 'plan' || this.ui.hidden.has('guides')) return [];
    return this.shownGuides().filter((g) => g.levelId === this.ui.levelId);
  }

  /** Starts a guide off a wall's face or a guide, at the distance the pointer at p sets (guide-tool.ts). */
  startGuide(base: GuideBase, p: Point2): void {
    this.ui.guide = draftAt(base, p, this.ui.snaps);
    // The point the tool snapped to before is not what a click does now: it places the guide.
    this.ui.snap = null;
    this.ui.error = null;
    this.ui.info = null;
    this.shell.measure.value = '';
    this.render();
  }

  moveGuide(p: Point2): void {
    if (!this.ui.guide) return;
    this.ui.guide = draftAt(this.ui.guide.base, p, this.ui.snaps);
    this.render();
  }

  /** The guide's distance: the one being typed, while it reads as one, else the pointer's. */
  guideOffset(): number | null {
    const g = this.ui.guide;
    if (!g) return null;
    const typed = parseLength(this.shell.measure.value);
    return typed.ok && typed.value >= 0 ? typed.value : g.offset;
  }

  /** Places the guide being set, as one undo step; the drawing tool goes on as it was. */
  placeGuide(offset = this.guideOffset()): void {
    const g = this.ui.guide;
    if (!g || offset === null) return;
    this.ui.guide = null;
    this.shell.measure.value = '';
    this.store.dispatch(addGuide(newGuide(newId(GUIDE_PREFIX), this.ui.levelId, g, offset)));
  }

  cancelGuide(): void {
    this.ui.guide = null;
    this.shell.measure.value = '';
    this.ui.error = null;
    this.render();
  }

  /** Every guide of the level shown, as one undo step. */
  clearGuides(): void {
    this.store.dispatch(clearGuides(this.ui.levelId));
  }

  /** The measure tool: a click or Esc (measure-tool.ts). Nothing is added to the drawing. */
  measureEvent(event: MeasureEvent): void {
    this.ui.measure = measureTransition(this.ui.measure, event);
    if (event.kind === 'escape') this.ui.snap = null;
    this.shell.measure.value = '';
    this.render();
  }

  wallEvent(event: WallToolEvent): void {
    const r = wallTransition(this.ui.wall, event);
    // A value typed for one step (a length, a radius) never carries over to the next.
    if (r.state.kind !== this.ui.wall.kind || r.segment) this.shell.measure.value = '';
    // A chain just ended (closed on its start, Enter, Esc): the snap it showed is the old chain's, as
    // "Start · closes" left under the pointer until it moved. The next move snaps afresh.
    if (r.state.kind === 'idle' && this.ui.wall.kind !== 'idle') this.ui.snap = null;
    this.ui.wall = r.state;
    if (r.segment) this.store.dispatch(addWalls([this.makeWall(r.segment.start, r.segment.end, newId('wall'), r.segment.bulge ?? 0)]));
    else this.refresh();
  }

  /** The footer field: a length (and angle) while drawing; a new length for one selected wall. */
  submitMeasure(text: string): boolean {
    if (text.trim() === '') return false;
    if (this.ui.guide) {
      const d = parseLength(text);
      if (!d.ok || d.value < 0) {
        this.ui.error = t('hint.badMeasure', { text });
        this.renderChrome();
        return false;
      }
      this.ui.error = null;
      this.placeGuide(d.value);
      return true;
    }
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
      if (!wall && this.ui.tool !== 'floor' && this.ui.tool !== 'room' && this.ui.tool !== 'measure') {
        this.ui.error = t('hint.pointHere', { text });
        this.renderChrome();
        return false;
      }
      this.ui.error = null;
      if (wall) this.wallEvent({ kind: 'click', point: point.value });
      else if (this.ui.tool === 'measure') this.measureEvent({ kind: 'click', point: point.value });
      else if (this.ui.tool === 'floor') this.floorClick(point.value, 0, true);
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
    if (this.openingKind()) {
      // A measure with nothing to measure along: say how to choose a wall without the pointer.
      this.ui.error = t('hint.openingNoWall');
      this.renderChrome();
      return false;
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
    // Hidden walls are not selected: nothing unseen can be deleted.
    if (this.ui.hidden.has('walls')) this.ui.info = t('hint.wallsHidden');
    else for (const w of this.store.get().walls) if (w.levelId === this.ui.levelId) this.ui.selection.add(w.id);
    this.refresh();
  }

  /**
   * The next (or previous) element of the level shown, as the selection: walls by number, then doors
   * and windows, rooms, floors (ref/chat.txt:242). In plan the view slides to show it.
   */
  stepSelection(dir: 1 | -1): void {
    this.setTool('select');
    const g = this.visibleGeometry();
    const order = [...g.solids.keys(), ...g.openings.keys(), ...g.rooms.keys(), ...g.floors.keys()];
    const next = stepSelection(order, [...this.ui.selection], dir);
    if (!next) return;
    this.ui.selection = new Set([next]);
    if (this.ui.view === 'plan') {
      const box = boundsOf(this.geometry, this.ui.selection);
      const vp = this.shell.viewport.getBoundingClientRect();
      if (box) {
        const a = this.plan.toScreen({ x: box.min.x, y: box.max.y });
        const b = this.plan.toScreen({ x: box.max.x, y: box.min.y });
        const off = a.x < 0 || a.y < 0 || b.x > vp.width || b.y > vp.height;
        if (off) this.plan.panBy(vp.width / 2 - (a.x + b.x) / 2, vp.height / 2 - (a.y + b.y) / 2);
      }
    }
    this.refresh();
  }

  /** Moves the selection by a step from the keyboard (tools/nudge.ts): one undo step. */
  nudgeSelection(step: Point2): void {
    const doc = this.store.get();
    const next = nudge(doc, this.geometry, [...this.ui.selection], step);
    if (next !== doc) this.store.dispatch({ label: 'cmd.nudge', apply: () => next });
  }

  clearSelection(): void {
    this.ui.selection.clear();
    this.refresh();
  }

  toggleSnaps(): void {
    this.ui.snaps = !this.ui.snaps;
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
    this.ui.levelId = id;
    savePrefs({ levelId: id });
    this.ui.selection.clear();
    this.ui.guide = null;
    this.refresh();
  }

  deleteSelection(): void {
    if (this.ui.selection.size === 0) return;
    this.store.dispatch(deleteElements([...this.ui.selection]));
  }

  // Said with what was undone or redone ("Undone: Delete"): "Undone" alone left the user to look for it.
  undo(): void {
    const what = this.store.undoLabel();
    if (this.store.undo()) this.toast(what ? `${t('toast.undo')}: ${t(what as MessageKey)}` : t('toast.undo'));
  }

  redo(): void {
    const what = this.store.redoLabel();
    if (this.store.redo()) this.toast(what ? `${t('toast.redo')}: ${t(what as MessageKey)}` : t('toast.redo'));
  }

  private seenSelection = '';
  /** The viewport's size at the last check: a change is a resize, which keeps the selection in view. */
  private seenSize = '';
  /** The selection and its extent at the last check: the same selection grown is an edit, which does too. */
  private seenIds = '';
  private seenShape = '';

  /**
   * When the selection changes and the panel lying over the drawing would hide it (the sheet on a
   * phone, the drawer on a tablet), the plan slides just enough to show it beside the panel.
   */
  private keepSelectionInView(): boolean {
    const covered = this.covered();
    const vp0 = this.shell.viewport.getBoundingClientRect();
    // Again when the selection changes, or the panel or a drawer (or the window) changes what is free.
    // The selection's own extent counts too: an arc given a larger radius can reach under the panel.
    const ids = JSON.stringify([...this.ui.selection]);
    const extent = boundsOf(this.geometry, this.ui.selection);
    const shape = JSON.stringify(extent && [extent.min, extent.max].map((p) => [Math.round(p.x * 100), Math.round(p.y * 100)]));
    const key = JSON.stringify([ids, shape, covered, Math.round(vp0.width), Math.round(vp0.height)]);
    if (key === this.seenSelection) return false;
    this.seenSelection = key;
    // A new selection moves the plan only from under what covers it: clicking a long wall that runs
    // past the edge does not pan. A window that changed size, or a selected element that changed
    // extent (an arc given a larger radius), moves it back from the drawing's own edges too.
    const size = `${Math.round(vp0.width)}x${Math.round(vp0.height)}`;
    const resized = this.seenSize !== '' && size !== this.seenSize;
    const reshaped = ids === this.seenIds && shape !== this.seenShape;
    this.seenSize = size;
    this.seenIds = ids;
    this.seenShape = shape;
    if (this.ui.selection.size === 0) return false;
    if (!resized && !reshaped && covered.right === 0 && covered.bottom === 0 && !covered.left) return false;
    const box = boundsOf(this.geometry, this.ui.selection);
    if (!box) return false;
    // On screen: the selection, its turn handle (handles.ts) and its temporary dimensions with their
    // values, which stand off the element by its clearance. The window's own edges count as well as
    // what covers it: a smaller window leaves a selection near its edge out otherwise.
    const onScreen = () => {
      const a = this.plan.toScreen({ x: box.min.x, y: box.max.y });
      const b = this.plan.toScreen({ x: box.max.x, y: box.min.y });
      const xs = [a.x, b.x];
      // The turn handle: under the selection, lower still where it keeps clear of an end's arrow.
      const turn = this.handles().rotate?.at.y;
      const ys = [a.y, Math.max(b.y + ROTATE_OFFSET, turn ?? 0) + 12];
      const TEXT = 12;
      for (const d of this.currentDims()) {
        const line = this.plan.dimLine(d);
        for (const p of [line.a, line.b]) xs.push(p.x - TEXT, p.x + TEXT), ys.push(p.y - TEXT, p.y + TEXT);
      }
      return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
    };
    const view = { w: vp0.width, h: vp0.height };
    const room = { margin: 16, above: 48 };
    // Larger than the free part (a phone's): zoomed out about its middle first, then measured again,
    // since the dimensions stand off by pixels (the tester's P07: the view only panned and cut it).
    let screen = onScreen();
    const k = fitFactor(screen, view, covered, room);
    if (k < 1) {
      this.plan.zoomAt({ x: (screen.left + screen.right) / 2, y: (screen.top + screen.bottom) / 2 }, k);
      screen = onScreen();
    }
    const { dx, dy } = keepInView(screen, view, covered, room);
    if (dx === 0 && dy === 0 && k === 1) return false;
    this.plan.panBy(dx, dy);
    return true;
  }

  /** How much the panel covers of the viewport, at its right (drawer) or bottom (phone sheet). */
  covered(): Insets {
    const vp = this.shell.viewport.getBoundingClientRect();
    const b = this.shell.browser.hidden ? null : this.shell.browser.getBoundingClientRect();
    const left = b && b.width > 0 ? b.right - vp.left : 0;
    if (this.shell.panel.hidden) return { right: 0, bottom: 0, left };
    const p = this.shell.panel.getBoundingClientRect();
    if (p.width === 0 || p.height === 0) return { right: 0, bottom: 0, left };
    if (p.top > vp.top + 8 && p.top < vp.bottom) return { right: 0, bottom: vp.bottom - p.top, left };
    if (p.left > vp.left && p.left < vp.right) return { right: vp.right - p.left, bottom: 0, left };
    return { right: 0, bottom: 0, left };
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
    const box = boundsOf(this.geometry, this.ui.selection);
    // Nothing selected, or nothing with an extent (a guide has no ends): the whole drawing.
    if (box === null) return this.frameAll();
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

  /** The project's name, as one undo step; an empty name is "Untitled project" again. */
  renameProject(next: string): void {
    const name = next.trim();
    if (name === this.store.get().name) return;
    this.store.dispatch({ label: 'cmd.renameProject', apply: (d) => ({ ...d, name }) });
  }

  saveFile(): void {
    const doc = this.store.get();
    const blob = new Blob([writeProject(doc)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // Named after the project, without what a file name cannot hold: every save was "project.json".
    a.download = `${(doc.name || t('app.untitled')).replace(/[\\/:*?"<>|]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(t('toast.saved'));
  }

  /**
   * The view by keyboard (view-keys.ts): in plan, zoom about the middle of the free part and move by
   * pixels; in 3D, zoom toward the target and turn about it (80 px a press is about 10°).
   */
  keyView(action: ViewKey): void {
    if (this.ui.view === 'plan') {
      const vp = this.shell.viewport.getBoundingClientRect();
      const c = this.covered();
      const middle = { x: ((c.left ?? 0) + vp.width - c.right) / 2, y: (vp.height - c.bottom) / 2 };
      if ('zoom' in action) this.plan.zoomAt(middle, action.zoom);
      else this.plan.panBy(action.pan.x, action.pan.y);
      return this.render();
    }
    if ('zoom' in action) this.scene.zoomBy(action.zoom);
    else this.scene.orbit((action.pan.x / 80) * (Math.PI / 18), (action.pan.y / 80) * (Math.PI / 18));
    this.render();
  }

  /**
   * A new, empty project in place of the current one, as one undo step: like opening a file, nothing is
   * lost (Ctrl+Z gives the previous project back), so it asks nothing.
   */
  newProject(): void {
    this.ui.error = null;
    this.ui.selection.clear();
    this.ui.drag = null;
    const doc = newDocument();
    this.ui.levelId = startLevel(doc);
    savePrefs({ levelId: this.ui.levelId });
    this.store.dispatch({ label: 'cmd.newProject', apply: () => doc });
    this.framed.plan = false;
    this.framed['3d'] = false;
    this.frameAll();
    this.toast(t('toast.newUndo'));
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
    this.ui.levelId = startLevel(r.doc);
    savePrefs({ levelId: this.ui.levelId });
    // A project saved without a name is called by its file's: "casa.json" opens as "casa".
    const opened = r.doc.name ? r.doc : { ...r.doc, name: file.name.replace(/\.json$/i, '') };
    // One undo step, like any other change: opening by mistake never loses the project that was open.
    this.store.dispatch({ label: 'cmd.openProject', apply: () => opened });
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
  private underlay(): Point2[][] {
    const below = this.levelBelow();
    if (!below || this.ui.hidden.has('walls')) return [];
    return [...this.geometry.solids.values()].filter((s) => s.wall.levelId === below).flatMap((s) => s.pieces.map((p) => [...p.polygon]));
  }

  /** How many kinds of element (walls, doors and windows, rooms, floors) the selection holds. */
  private selectionKinds(): number {
    const g = this.geometry;
    const ids = [...this.ui.selection];
    return [g.solids, g.openings, g.rooms, g.floors].filter((m) => ids.some((id) => m.has(id))).length + (ids.some(isGuideId) ? 1 : 0);
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
  private mark(name: string): void {
    if (this.perf) this.marks.push([name, performance.now()]);
  }

  render(): void {
    if (!this.perf) return this.renderFrame();
    this.marks = [['start', performance.now()]];
    this.renderFrame();
    this.mark('end');
    const steps = this.marks.slice(1).map(([name, at], i) => `${name} ${(at - this.marks[i]![1]).toFixed(1)}`);
    console.info(`[cad2 perf] ${this.ui.view} ${(this.marks.at(-1)![1] - this.marks[0]![1]).toFixed(1)} ms: ${steps.join(', ')}`);
  }

  /** Where the pointer is over the drawing (client pixels), set by the input layer; null off it. */
  pointer: Point2 | null = null;

  /** The world point under the pointer, on the level shown, for the view as it is now. */
  private pointerWorld(): Point2 | null {
    if (!this.pointer) return null;
    if (this.ui.view === 'plan') {
      const r = this.shell.planCanvas.getBoundingClientRect();
      return this.plan.toWorld({ x: this.pointer.x - r.left, y: this.pointer.y - r.top });
    }
    const z = levelOf(this.store.get(), this.ui.levelId)?.elevation ?? 0;
    return this.scene.groundPoint(this.pointer.x, this.pointer.y, z);
  }

  private renderFrame(): void {
    const { ui, shell } = this;
    const plan = ui.view === 'plan';
    // The point under a pointer that has not moved changes with the view (Home, F, the keys, a drawer):
    // taken again, so the footer's coordinates and a floor outline's last side follow it.
    if (this.pointer) ui.cursor = this.pointerWorld();
    // On narrow screens the panel is a drawer over the drawing: it opens only when it has something
    // to show, so it never covers the model for nothing. Set first: what it covers shapes the view.
    const narrow = matchMedia('(max-width: 900px)').matches;
    // On narrow screens the project browser and the panel are both drawers over the drawing: while the
    // browser is open the panel waits, so the drawing keeps the most room.
    shell.panel.hidden = !ui.panelOpen || (narrow && ((ui.selection.size === 0 && ui.tool === 'select') || ui.browserOpen));
    shell.planCanvas.classList.toggle('hidden', !plan);
    shell.glCanvas.classList.toggle('hidden', plan);
    this.cube.root.hidden = plan;
    // The view cube and the 3D view's centre stay in the part of the viewport the panel leaves free.
    const covered = this.covered();
    this.cube.root.style.right = `${20 + covered.right}px`;
    this.scene.setCovered(covered);
    const preview = new Set([...this.previewWall(), ...this.previewOpening()].map((w) => w.id));
    const guide = this.openingKind() ? ruleGuide(this.store.get(), this.geometry, OPENING_PREVIEW_ID) : null;
    const w = ui.wall;
    const drawing = ui.tool === 'wall' && w.kind === 'drawing';
    const end = drawing ? this.drawingEnd() : null;
    const len = end && w.kind === 'drawing' ? distance(w.last, end) : 0;
    const ang = end && w.kind === 'drawing' ? ((Math.atan2(end.y - w.last.y, end.x - w.last.x) * 180) / Math.PI + 360) % 360 : 0;
    const along = end && w.kind === 'drawing' && len > 0 ? { x: (end.x - w.last.x) / len, y: (end.y - w.last.y) / len } : null;
    // A floor outline's side being drawn: from its last corner to where the next would snap.
    const floorFrom = ui.tool === 'floor' ? (ui.floorDraft.at(-1) ?? null) : null;
    const floorTo = floorFrom ? (ui.snap?.point ?? ui.cursor) : null;
    const floorLen = floorFrom && floorTo ? distance(floorFrom, floorTo) : 0;
    const floorAlong = floorFrom && floorTo && floorLen > 0 ? { x: (floorTo.x - floorFrom.x) / floorLen, y: (floorTo.y - floorFrom.y) / floorLen } : null;
    const floorAng = floorAlong ? ((Math.atan2(floorAlong.y, floorAlong.x) * 180) / Math.PI + 360) % 360 : 0;
    // The tape: from its start to where the next click would land, or as measured.
    const m = ui.tool === 'measure' ? ui.measure : MEASURE_IDLE;
    const tapeFrom = m.kind === 'idle' ? null : m.a;
    const tapeTo = m.kind === 'done' ? m.b : m.kind === 'from' ? (ui.snap?.point ?? ui.cursor) : null;
    const tape = tapeFrom && tapeTo && distance(tapeFrom, tapeTo) > 0 ? reading(tapeFrom, tapeTo) : null;
    // How far the drawn preview reaches on the measure's side: its pieces as derived (reference line,
    // thickness and joins included), so the measure is set off past them.
    const side = along ? { x: -along.y, y: along.x } : null;
    const reach =
      side && w.kind === 'drawing'
        ? Math.max(0, ...(this.geometry.solids.get(PREVIEW_ID)?.pieces ?? []).flatMap((p) => p.polygon.map((v) => (v.x - w.last.x) * side.x + (v.y - w.last.y) * side.y)))
        : 0;
    // A snap on a wall says which one, by its number (shown in the panel's title): "end of wall 3".
    const snapWall = ui.snap?.wallId ? wallNumber(this.store.get(), ui.snap.wallId) : null;
    const ofKey = ui.snap && snapWall !== null && ui.snap.kind in SNAP_OF ? SNAP_OF[ui.snap.kind as keyof typeof SNAP_OF] : null;
    const labelKey = ofKey ?? (ui.snap ? snapLabel[ui.snap.kind] : null);
    // The guide being placed, at the distance typed or pointed; its distance as a dimension.
    const guideOff = this.guideOffset();
    const guideDim = ui.guide && guideOff !== null ? guideMeasure(ui.guide, guideOff) : null;
    if (plan) {
      this.plan.draw(this.visibleGeometry(), {
        selected: ui.selection,
        hover: ui.hover,
        preview,
        guides: this.levelGuides(),
        guideDraft: ui.guide && guideOff !== null ? guideLine(ui.guide, guideOff) : null,
        snap:
          // Drawing, measuring, or dragging a wall's end: where it snaps, said as it is.
          (ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'measure' || ui.drag?.kind === 'grip') && ui.snap
            ? { point: ui.snap.point, label: labelKey ? t(labelKey, { n: snapWall ?? '' }) : null, ...(ui.snap.guideFrom ? { guideFrom: ui.snap.guideFrom } : {}), ...((along ?? floorAlong) ? { away: (along ?? floorAlong)! } : {}) }
            : null,
        measure: guideDim
          ? { at: { x: (guideDim.a.x + guideDim.b.x) / 2, y: (guideDim.a.y + guideDim.b.y) / 2 }, text: `${num(guideOff!)} m`, normal: ui.guide!.base.dir, clear: 0 }
          : end && along && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
            ? { at: { x: (w.last.x + end.x) / 2, y: (w.last.y + end.y) / 2 }, text: `${num(len)} m · ${num(ang, 1)}°`, normal: side!, clear: reach }
            : floorFrom && floorTo && floorAlong && floorLen >= MIN_WALL_LENGTH
              ? { at: { x: (floorFrom.x + floorTo.x) / 2, y: (floorFrom.y + floorTo.y) / 2 }, text: `${num(floorLen)} m · ${num(floorAng, 1)}°`, normal: { x: -floorAlong.y, y: floorAlong.x }, clear: 0 }
              : tape && tapeFrom && tapeTo
                ? {
                    at: { x: (tapeFrom.x + tapeTo.x) / 2, y: (tapeFrom.y + tapeTo.y) / 2 },
                    text: `${num(tape.length)} m · ${num(tape.angle, 1)}°`,
                    normal: { x: -tape.dy / tape.length, y: tape.dx / tape.length },
                    clear: 0,
                  }
                : (this.bendMeasure() ?? this.turnMeasure() ?? guide?.measure ?? null),
        axis: end && len >= MIN_WALL_LENGTH && w.kind === 'drawing' ? { start: w.last, end } : tape && tapeFrom && tapeTo ? { start: tapeFrom, end: tapeTo } : null,
        handles: this.handles(),
        anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : tapeFrom,
        wallTags: this.wallTags(),
        roomLabels: [...this.visibleGeometry().rooms.values()].map((r) => ({
          at: r.label,
          name: `${r.room.number} · ${name(r.room.name)}`,
          short: r.room.number,
          // A room sharing its space with another says so on its tag: the two tags fell on one another
          // and one name was simply not seen.
          area: !r.enclosed
            ? t('warn.roomNotEnclosed')
            : r.sharing.length > 0
              ? t('warn.roomShared', { rooms: r.sharing.map((id) => this.store.get().rooms.find((x) => x.id === id)).flatMap((x) => (x ? [`${x.number} · ${name(x.name)}`] : [])).join(', ') })
              : `${num(r.area)} m²`,
          warn: !r.enclosed || r.sharing.length > 0,
          outline: r.outline,
        })),
        draft: ui.tool === 'floor' && ui.floorDraft.length > 0 ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])] : null,
        draftCorners: ui.tool === 'floor' ? ui.floorDraft : [],
        openingPreview: preview.has(OPENING_PREVIEW_ID) ? OPENING_PREVIEW_ID : null,
        // The opening being placed shows its distance as a dimension too (drawn only, not typed in: the
        // footer field takes the distance while placing).
        dims: [
          ...this.currentDims().map((d) => ({ ...d, text: num(d.value) })),
          ...(guide ? [guide.dim] : []),
          ...(guideDim && guideOff! > 0 ? [{ ...guideDim, side: ui.guide!.base.dir, clear: 0 }] : []),
        ],
        underlay: this.underlay(),
      });
    } else {
      this.scene.sync(this.visibleGeometry(), ui.selection, preview);
      this.cube.update(this.scene.camera);
      // Where the tool snaps and what it draws, over the 3D view as in plan.
      const level = levelOf(this.store.get(), ui.levelId);
      const active = ui.tool === 'wall' || ui.tool === 'floor' || ui.tool === 'measure';
      this.overlayState = {
        project: (p, z) => this.projectAt(p, z),
        floor: level?.elevation ?? 0,
        height: level?.height ?? 2.8,
        snap: active && ui.snap ? { point: ui.snap.point, label: labelKey ? t(labelKey, { n: snapWall ?? '' }) : null } : null,
        axis: end && len >= MIN_WALL_LENGTH && w.kind === 'drawing' ? { start: w.last, end } : tape && tapeFrom && tapeTo ? { start: tapeFrom, end: tapeTo } : null,
        measure:
          end && len >= MIN_WALL_LENGTH && w.kind === 'drawing'
            ? { at: { x: (w.last.x + end.x) / 2, y: (w.last.y + end.y) / 2 }, text: `${num(len)} m · ${num(ang, 1)}°` }
            : floorFrom && floorTo && floorLen >= MIN_WALL_LENGTH
              ? { at: { x: (floorFrom.x + floorTo.x) / 2, y: (floorFrom.y + floorTo.y) / 2 }, text: `${num(floorLen)} m · ${num(floorAng, 1)}°` }
              : tape && tapeFrom && tapeTo
                ? { at: { x: (tapeFrom.x + tapeTo.x) / 2, y: (tapeFrom.y + tapeTo.y) / 2 }, text: `${num(tape.length)} m · ${num(tape.angle, 1)}°` }
                : this.bendMeasure(),
        anchor: ui.tool === 'wall' && (w.kind === 'drawing' || w.kind === 'bend') ? w.last : tapeFrom,
        draft: ui.tool === 'floor' && ui.floorDraft.length > 0 ? [...ui.floorDraft, ...(floorTo ? [floorTo] : [])] : null,
      };
      this.overlay3d.draw(this.overlayState);
    }
    this.overlay3d.canvas.classList.toggle('hidden', plan);
    shell.viewport.style.cursor = toolCursor(ui.tool);
    this.mark(plan ? 'plan' : '3d');
    this.placeDims(plan ? this.currentDims() : []);
    this.mark('dims');
    this.renderBrowserDrawer();
    this.mark('browser');
    this.renderChrome();
    this.mark('chrome');
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
        levelRooms: [...this.geometry.rooms.values()].filter((r) => r.room.levelId === ui.levelId),
        floors: this.selectedFloors(),
        placed: this.geometry.openings,
        openingWarnings: this.geometry.openingWarnings,
        openingTool: placing ? { kind: placing, size: ui.openingDefaults[placing] } : null,
        total: ui.selection.size,
        guides: doc.guides.filter((g) => ui.selection.has(g.id)),
      },
      {
        updateWalls: (patch) => this.store.dispatch(updateWalls([...ui.selection], patch)),
        resetToType: (fields) => this.store.dispatch(resetWallsToType([...ui.selection], fields)),
        editType: () => this.openWallTypes(this.store.get().walls.find((w) => ui.selection.has(w.id))?.wallTypeId),
        updateRadius: (radius) => {
          const w = this.store.get().walls.find((x) => ui.selection.has(x.id));
          const bulge = w?.bulge ? bulgeKeepingSide(distance(w.start, w.end), w.bulge, radius) : null;
          if (w && bulge !== null) this.store.dispatch(updateWalls([w.id], { bulge }));
        },
        arrangeWalls: (how) => {
          // In the order they were picked: the first is the reference.
          const ids = [...ui.selection].filter((id) => this.store.get().walls.some((w) => w.id === id));
          const walls = how === 'align' ? alignWalls(this.store.get(), ids) : distributeWalls(this.store.get(), ids);
          if (walls) this.store.dispatch(setWalls(walls, how === 'align' ? 'cmd.alignWalls' : 'cmd.distributeWalls'));
        },
        ...(() => {
          const first = [...ui.selection].find((id) => this.store.get().walls.some((w) => w.id === id));
          const n = first ? wallNumber(this.store.get(), first) : null;
          return n !== null ? { firstWall: t('wall.tag', { n }) } : {};
        })(),
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
        clearGuides: () => this.clearGuides(),
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

  /**
   * Temporary dimensions of the one selected element, while selecting; while dragging only when they
   * follow the drag: a door or a window slid, or one wall moved (its length and its gaps to the walls
   * parallel to it, as they become).
   */
  private currentDims(): TempDim[] {
    const d = this.ui.drag;
    if (this.ui.tool !== 'select' || (d && d.kind !== 'slide' && d.kind !== 'move')) return [];
    const doc = this.store.get();
    const shown = d?.kind === 'slide' ? { ...doc, openings: d.openings } : d?.kind === 'move' ? { ...doc, walls: d.walls } : doc;
    return tempDims(shown, this.geometry, this.ui.selection);
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
    const nodes: HTMLElement[] = [];
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
      nodes.push(node);
    }
    // Where the plan places them (plan-view.ts: dimValueBoxes), which its tags keep off too.
    const boxes = this.plan.dimValueBoxes(dims.map((d) => ({ ...d, text: num(d.value) })));
    nodes.forEach((node, i) => {
      node.style.left = `${boxes[i]!.x + boxes[i]!.w / 2}px`;
      node.style.top = `${boxes[i]!.y + boxes[i]!.h / 2}px`;
    });
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
    const before = this.covered().left ?? 0;
    this.ui.browserOpen = open;
    savePrefs({ browserOpen: open });
    this.shell.browser.hidden = !open;
    const after = this.covered().left ?? 0;
    // What was in the middle of the free part stays there: the plan slides by half the drawer.
    if (this.ui.view === 'plan') this.plan.panBy((after - before) / 2, 0);
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
      // Guides have no geometry: they go only when guides are hidden.
      if (isGuideId(id) ? this.ui.hidden.has('guides') : !shown.solids.has(id) && !shown.openings.has(id) && !shown.rooms.has(id) && !shown.floors.has(id)) {
        this.ui.selection.delete(id);
      }
    }
    this.refresh();
  }

  /** Every wall of a type on the current level, with the select tool. */
  selectWallsOfType(typeId: string): void {
    this.setTool('select');
    if (!this.ui.hidden.has('walls')) {
      for (const w of this.store.get().walls) if (w.wallTypeId === typeId && w.levelId === this.ui.levelId) this.ui.selection.add(w.id);
    }
    this.refresh();
  }

  private browserKey = '';
  /** Opens the levels dialog; set by the input layer, which owns the dialogs. */
  openLevels: () => void = () => {};
  /** Opens the wall types dialog, on a type if given; set by the input layer too. */
  openWallTypes: (typeId?: string) => void = () => {};

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
    renderBrowser(this, shell.browser, () => this.openLevels(), () => this.openWallTypes());
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
    document.title = `${doc.name || t('app.untitled')} · cad2`;
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
    shell.toolMeasure.setAttribute('aria-pressed', String(ui.tool === 'measure'));
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
    // Gone once the wall tool is on: "press W" no longer applies, and the footer says what to click.
    shell.emptyHint.hidden = doc.walls.length > 0 || ui.tool === 'wall';

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
      : d?.kind === 'slide'
        ? 'hint.sliding'
        : d?.kind === 'move'
        ? 'hint.moving'
        : d?.kind === 'grip' || d?.kind === 'stretch' || d?.kind === 'rotate'
        ? 'hint.handle'
        : d?.kind === 'bulge'
          ? 'hint.bending'
        : d?.kind === 'marquee'
          ? d.b.x < d.a.x
            ? 'hint.marqueeCrossing'
            : 'hint.marqueeWindow'
          : ui.selection.size > 1
            ? // Of several kinds, the panel edits one of them (panel.ts): "edit them together" was not so.
              this.selectionKinds() > 1
              ? 'hint.selectedMixed'
              : 'hint.selectedMany'
            : ui.selection.size === 1
              ? // "click a dimension" only where there is one: a room or a floor has none.
                ui.view === 'plan' && this.currentDims().length > 0
                ? 'hint.selected'
                : 'hint.selected3d'
              : 'hint.select';
    const placing = this.openingKind();
    const aiming = placing !== null && ui.opening.kind === 'aiming';
    const openingHint = placing
      ? ui.opening.kind === 'aiming'
        ? this.previewProblem() ?? t('hint.openingAim', { rule: ruleText(ui.opening.rule, ruleBase(ui.opening.aim, ui.opening.rule)) })
        : t('hint.openingPlace', { kind: t(placing === 'door' ? 'panel.door' : 'panel.window').toLowerCase() })
      : null;
    const toolHint =
      ui.tool === 'room'
        ? t('hint.roomPlace')
        : ui.tool === 'floor'
          ? t(ui.floorDraft.length > 0 ? 'hint.floorNext' : 'hint.floorPlace')
          : ui.tool === 'measure'
            ? this.measureHint()
            : null;
    const guideHint = ui.guide
      ? t('hint.guide', {
          d: num(this.guideOffset() ?? 0),
          base: ui.guide.base.wallId ? t('guide.fromWall', { n: wallNumber(this.store.get(), ui.guide.base.wallId) ?? '' }) : t('guide.fromGuide'),
        })
      : null;
    shell.instr.textContent = ui.error ?? guideHint ?? ui.info ?? openingHint ?? toolHint ?? t(hintKey, { n: ui.selection.size });
    shell.instr.classList.toggle('error', ui.error !== null);
    // Alt sets a guide in the tools that draw by points (input.ts), in plan.
    const altGuide = ui.view === 'plan' ? [keyHint('Alt', t('key.guide'))] : [];
    const keys = ui.guide
      ? [keyHint('Enter', t('key.placeGuide')), keyHint('Esc', t('key.cancel'))]
      : placing || ui.tool === 'room'
      ? [keyHint('Esc', t('key.exit'))]
      : ui.tool === 'measure'
      ? [keyHint('Shift', t('key.straight')), ...altGuide, keyHint('S', t('key.snapOff')), keyHint('Esc', t(ui.measure.kind === 'idle' ? 'key.exit' : 'key.clear'))]
      : ui.tool === 'floor'
      ? [keyHint('Enter', t('key.finish')), ...altGuide, keyHint('Esc', t('key.exit'))]
      : drawing
      ? w.kind !== 'idle'
        ? [keyHint('Enter', t('key.finish')), keyHint('A', t('key.arc')), keyHint('Shift', t('key.straight')), ...altGuide, keyHint('Esc', t('key.finish'))]
        : [keyHint('A', t('key.arc')), ...altGuide, keyHint('S', t('key.snapOff')), keyHint('Esc', t('key.exit'))]
      : ui.selection.size > 0
        ? [
            keyHint('Shift', t('key.addRemove')),
            // Said before the drag, where it is decided: during it was too late to be found.
            ...(this.selectedWalls().length > 0 ? [keyHint('Alt', t('key.dragAlone'))] : []),
            keyHint('Del', t('key.delete')),
            keyHint('F', t('key.frame')),
            keyHint('Esc', t('key.clear')),
          ]
        : [keyHint('Ctrl K', t('key.commands')), keyHint('Ctrl A', t('key.selectAll')), keyHint('?', t('key.shortcuts'))];
    shell.keys.replaceChildren(...keys);
    const lengthMode = drawing && w.kind === 'drawing';
    // Where a point is asked for: the wall's start, a floor's corners, a room's point.
    const pointMode = (drawing && w.kind === 'idle') || ui.tool === 'floor' || ui.tool === 'room' || ui.tool === 'measure' || (lengthMode && shell.measure.value.includes(';'));
    const distanceMode = ui.guide !== null || aiming || (ui.selection.size === 1 && this.selectedOpenings().length === 1);
    const withAngle = lengthMode && shell.measure.value.includes('<');
    shell.measureLabel.textContent = t(
      ui.guide
        ? 'foot.distance'
        : drawing && w.kind === 'bend'
        ? 'foot.radius'
        : withAngle
          ? 'foot.lengthAngle'
          : pointMode
            ? 'foot.point'
            : lengthMode
              ? 'foot.length'
              : distanceMode
                ? 'foot.distance'
                : 'foot.measure',
    );
    // "Measure: Distance", but never "Measure: Measure".
    const what = shell.measureLabel.textContent ?? '';
    shell.measure.setAttribute('aria-label', what === t('foot.measure') ? what : `${t('foot.measure')}: ${what}`);
    shell.measure.placeholder = t(ui.guide ? 'foot.distanceHint' : pointMode && !lengthMode ? 'foot.pointHint' : lengthMode ? 'foot.lengthHint' : distanceMode ? 'foot.distanceHint' : 'foot.measureHint');
    shell.toolWall.classList.toggle('arc-mode', drawing && arc);
    shell.coords.textContent = ui.cursor ? `x ${num(ui.cursor.x)} m  y ${num(ui.cursor.y)} m` : '';
    this.placeFloatBar();
  }

  /** The footer for the measure tool: what to click, or what the tape read. */
  private measureHint(): string {
    const m = this.ui.measure;
    if (m.kind === 'idle') return t('hint.measureStart');
    if (m.kind === 'from') return t('hint.measureEnd');
    const r = reading(m.a, m.b);
    return t('hint.measured', { d: num(r.length), dx: num(Math.abs(r.dx)), dy: num(Math.abs(r.dy)), a: num(r.angle, 1) });
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
          // The buttons outlive the selection they were made for (they are rebuilt only when the set of
          // actions changes): the action is looked up at the click, for what is selected then. Kept from
          // when the bar was built, "Centre" centred the window selected before.
          b.addEventListener('click', () => contextEntries(this, () => this.openCommands()).find((x) => x.id === e.id)?.run());
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
    // Never over a temporary dimension's value, a room's tag or a handle of the selection (bar-place.ts):
    // on a phone after F it sat on the handle at an arc's end (the tester's R04).
    const h0 = this.handles();
    const grip = (p: Point2) => ({ top: p.y - 12, bottom: p.y + 12, left: p.x - 12, right: p.x + 12 });
    const boxes = [
      ...[...h0.squares, ...h0.arrows, ...(h0.bulge ? [h0.bulge] : []), ...(h0.rotate ? [h0.rotate] : [])].map((x) => grip(x.at)),
      ...[...this.shell.dims.children].map((c) => c.getBoundingClientRect()).map((r) => ({ top: r.top - vp.top, bottom: r.bottom - vp.top, left: r.left - vp.left, right: r.right - vp.left })),
      ...(this.ui.view === 'plan' ? this.plan.labelBoxes.map((b) => ({ top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w })) : []),
    ];
    const y = placeBarY({ left, w, h }, { top: yTop, bottom: yBottom }, boxes, { h: covered });
    bar.style.left = `${left}px`;
    bar.style.top = `${Math.min(Math.max(8, y), covered - h - 8)}px`;
  }
}
