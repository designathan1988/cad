// Application state and rendering. The project changes only through the store; selection, tool,
// view, camera, language and theme are interface state, outside the document and outside undo.

import * as THREE from 'three';
import { parseLengthAngle } from '../core/measure';
import { createStore, type Store } from '../core/store';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { addWalls, deleteWalls, updateWalls } from '../elements/wall/commands';
import type { WallId } from '../elements/wall/schema';
import { PlanView } from '../render/plan-view';
import { Scene3D } from '../render/scene-3d';
import { ViewCube } from '../render/view-cube';
import { getLang, name, num, setLang, t, type Lang, type MessageKey } from '../ui/i18n';
import { icon } from '../ui/icons';
import { renderPanel } from '../ui/panel';
import { buildShell, keyHint, type Shell, type ToolId, type ViewId } from '../ui/shell';
import { snapLabel, type Snap } from '../tools/snap';
import { IDLE, wallTransition, type WallToolEvent, type WallToolState } from '../tools/wall-tool';
import { type Doc, type DocWall, newDocument, type WallDefaults } from './document';
import { boundsOf, deriveGeometry, type DerivedGeometry } from './geometry';
import { loadDocument, loadPrefs, saveDocument, savePrefs } from './persist';
import { newId } from '../core/id';

export interface UiState {
  view: ViewId;
  tool: ToolId;
  selection: Set<WallId>;
  hover: WallId | null;
  levelId: string;
  theme: 'light' | 'dark';
  panelOpen: boolean;
  snaps: boolean;
  defaults: WallDefaults;
  wall: WallToolState;
  snap: Snap | null;
  cursor: Point2 | null;
  error: string | null;
}

const PREVIEW_ID = '__preview__';

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
      snaps: true,
      defaults: { wallTypeId: doc.wallTypes[0]!.id, referenceLine: 'centerline', baseOffset: 0, top: { kind: 'level', offset: 0 } },
      wall: IDLE,
      snap: null,
      cursor: null,
      error: null,
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
      for (const id of [...this.ui.selection]) if (!d.walls.some((w) => w.id === id)) this.ui.selection.delete(id);
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
    this.geometry = deriveGeometry(this.store.get(), this.previewWall());
    this.render();
  }

  previewWall(): DocWall[] {
    const w = this.ui.wall;
    if (this.ui.tool !== 'wall' || w.kind !== 'drawing' || distance(w.last, w.cursor) < MIN_WALL_LENGTH) return [];
    return [this.makeWall(w.last, w.cursor, PREVIEW_ID)];
  }

  makeWall(start: Point2, end: Point2, id = newId('wall')): DocWall {
    const d = this.ui.defaults;
    return { id, wallTypeId: d.wallTypeId, referenceLine: d.referenceLine, start, end, levelId: this.ui.levelId, baseOffset: d.baseOffset, top: d.top };
  }

  // ---- actions -------------------------------------------------------------------------------

  setTool(tool: ToolId): void {
    this.ui.tool = tool;
    this.ui.wall = IDLE;
    this.ui.snap = null;
    this.ui.error = null;
    if (tool === 'wall') this.ui.selection.clear();
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
    this.ui.wall = r.state;
    if (r.segment) this.store.dispatch(addWalls([this.makeWall(r.segment.start, r.segment.end)]));
    else this.refresh();
  }

  /** The footer field: a length (and angle) while drawing; a new length for one selected wall. */
  submitMeasure(text: string): boolean {
    if (text.trim() === '') return false;
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

  deleteSelection(): void {
    if (this.ui.selection.size === 0) return;
    this.store.dispatch(deleteWalls([...this.ui.selection]));
  }

  undo(): void {
    if (this.store.undo()) this.toast(t('toast.undo'));
  }

  redo(): void {
    if (this.store.redo()) this.toast(t('toast.redo'));
  }

  frameAll(): void {
    const r = this.shell.viewport.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    this.framed[this.ui.view] = true;
    const box = boundsOf(this.geometry);
    if (this.ui.view === 'plan') this.plan.frame(box);
    else this.scene.frame(box, this.height());
    this.render();
  }

  frameSelection(): void {
    if (this.ui.selection.size === 0) return this.frameAll();
    const box = boundsOf(this.geometry, this.ui.selection);
    if (this.ui.view === 'plan') this.plan.frame(box);
    else this.scene.frame(box, this.height());
    this.render();
  }

  setLanguage(lang: Lang): void {
    setLang(lang);
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
    this.scene.setTheme(this.ui.theme === 'dark');
  }

  saveFile(): void {
    const doc = this.store.get();
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(t('toast.saved'));
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
    shell.planCanvas.classList.toggle('hidden', !plan);
    shell.glCanvas.classList.toggle('hidden', plan);
    this.cube.root.hidden = plan;
    const preview = new Set(this.previewWall().map((w) => w.id));
    if (plan) {
      const w = ui.wall;
      const drawing = ui.tool === 'wall' && w.kind === 'drawing';
      const len = drawing ? distance(w.last, w.cursor) : 0;
      const ang = drawing ? ((Math.atan2(w.cursor.y - w.last.y, w.cursor.x - w.last.x) * 180) / Math.PI + 360) % 360 : 0;
      const labelKey = ui.snap ? snapLabel[ui.snap.kind] : null;
      this.plan.draw(this.geometry, {
        selected: ui.selection,
        hover: ui.hover,
        preview,
        snap: ui.tool === 'wall' && ui.snap ? { point: ui.snap.point, label: labelKey ? t(labelKey) : null, ...(ui.snap.guideFrom ? { guideFrom: ui.snap.guideFrom } : {}) } : null,
        measure: drawing && len >= MIN_WALL_LENGTH ? { at: { x: (w.last.x + w.cursor.x) / 2, y: (w.last.y + w.cursor.y) / 2 }, text: `${num(len)} m · ${num(ang, 1)}°` } : null,
        axis: drawing && len >= MIN_WALL_LENGTH ? { start: w.last, end: w.cursor } : null,
      });
    } else {
      this.scene.sync(this.geometry, ui.selection, preview);
      this.cube.update(this.scene.camera);
    }
    this.renderChrome();
    // The panel is rebuilt only when what it shows changed: rebuilding on every mouse move would
    // close an open list and drop the focus of a field being typed in.
    const doc = this.store.get();
    const panelKey = [ui.tool, [...ui.selection].sort().join(','), getLang(), JSON.stringify(ui.defaults), JSON.stringify(this.geometry.warnings)].join('|');
    if (doc === this.panelDoc && panelKey === this.panelKey) return;
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
      },
      {
        updateWalls: (patch) => this.store.dispatch(updateWalls([...ui.selection], patch)),
        updateDefaults: (patch) => {
          ui.defaults = { ...ui.defaults, ...patch };
          this.refresh();
        },
        close: () => this.togglePanel(false),
      },
    );
  }

  togglePanel(open = !this.ui.panelOpen): void {
    this.ui.panelOpen = open;
    savePrefs({ panelOpen: open });
    this.render();
  }

  private renderChrome(): void {
    const { ui, shell, store } = this;
    const doc = store.get();
    // On narrow screens the panel is a drawer over the drawing: it opens only when it has something
    // to show, so it never covers the model for nothing.
    const narrow = matchMedia('(max-width: 900px)').matches;
    shell.panel.hidden = !ui.panelOpen || (narrow && ui.selection.size === 0 && ui.tool === 'select');
    shell.panelToggle.setAttribute('aria-pressed', String(ui.panelOpen));
    shell.projectName.textContent = doc.name || t('app.untitled');
    shell.undo.disabled = !store.canUndo();
    shell.redo.disabled = !store.canRedo();
    shell.view3d.setAttribute('aria-pressed', String(ui.view === '3d'));
    shell.viewPlan.setAttribute('aria-pressed', String(ui.view === 'plan'));
    shell.viewWalk.setAttribute('aria-pressed', 'false');
    shell.toolSelect.setAttribute('aria-pressed', String(ui.tool === 'select'));
    shell.toolWall.setAttribute('aria-pressed', String(ui.tool === 'wall'));
    shell.lang.textContent = getLang().toUpperCase();
    // Rewritten only when it changes: replacing the icon under the pointer between press and release
    // would cancel the click.
    const themeIcon = ui.theme === 'dark' ? 'sun' : 'moon';
    if (shell.theme.dataset.icon !== themeIcon) {
      shell.theme.innerHTML = icon(themeIcon);
      shell.theme.dataset.icon = themeIcon;
    }
    shell.snapBtn.setAttribute('aria-pressed', String(ui.snaps));
    if (shell.level.options.length !== doc.levels.length || shell.level.dataset.lang !== getLang()) {
      shell.level.replaceChildren(...doc.levels.map((l) => new Option(name(l.name), l.id)));
      shell.level.dataset.lang = getLang();
    }
    shell.level.value = ui.levelId;
    shell.emptyHint.hidden = doc.walls.length > 0 || (ui.tool === 'wall' && ui.wall.kind === 'drawing');

    // Footer: what to do now, the keys that work now, and the measure field.
    const drawing = ui.tool === 'wall';
    const hintKey: MessageKey = drawing
      ? ui.wall.kind === 'idle'
        ? 'hint.wallStart'
        : ui.wall.count >= 2
          ? 'hint.wallNextClose'
          : 'hint.wallNext'
      : ui.selection.size > 0
        ? 'hint.selected'
        : 'hint.select';
    shell.instr.textContent = ui.error ?? t(hintKey, { n: ui.selection.size });
    shell.instr.classList.toggle('error', ui.error !== null);
    const keys = drawing
      ? ui.wall.kind === 'drawing'
        ? [keyHint('Enter', t('key.finish')), keyHint('Shift', t('key.straight')), keyHint('S', t('key.snapOff')), keyHint('Esc', t('key.finish'))]
        : [keyHint('S', t('key.snapOff')), keyHint('Esc', t('key.exit'))]
      : ui.selection.size > 0
        ? [keyHint('Shift', t('key.addRemove')), keyHint('Del', t('key.delete')), keyHint('F', t('key.frame')), keyHint('Esc', t('key.clear'))]
        : [keyHint('?', t('key.shortcuts'))];
    shell.keys.replaceChildren(...keys);
    const lengthMode = drawing && ui.wall.kind === 'drawing';
    shell.measureLabel.textContent = t(lengthMode ? 'foot.length' : 'foot.measure');
    shell.measure.placeholder = t(lengthMode ? 'foot.lengthHint' : 'foot.measureHint');
    shell.coords.textContent = ui.cursor ? `x ${num(ui.cursor.x)} m  y ${num(ui.cursor.y)} m` : '';
    this.placeFloatBar();
  }

  /** The selection's quick actions, above the selection and never over it. */
  private placeFloatBar(): void {
    const bar = this.shell.floatBar;
    const box = this.ui.tool === 'select' ? boundsOf(this.geometry, this.ui.selection) : null;
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
      for (const id of this.ui.selection) {
        const solid = this.geometry.solids.get(id);
        if (!solid) continue;
        for (const piece of solid.pieces) {
          for (const v of piece.polygon) {
            for (const z of [solid.bottom, solid.top]) {
              const p = new THREE.Vector3(v.x, z, -v.y).project(this.scene.camera);
              xs.push(((p.x + 1) / 2) * vp.width);
              ys.push(((1 - p.y) / 2) * vp.height);
            }
          }
        }
      }
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
      yTop = Math.min(...ys);
      yBottom = Math.max(...ys);
    }
    const w = bar.offsetWidth || 104;
    const h = bar.offsetHeight || 36;
    let y = yTop - h - 10;
    if (y < 8) y = yBottom + 10;
    bar.style.left = `${Math.min(Math.max(8, x - w / 2), vp.width - w - 8)}px`;
    bar.style.top = `${Math.min(Math.max(8, y), vp.height - h - 8)}px`;
  }
}
