// Properties panel, built from what is selected: each element's sections come from its fields
// (elements/*/fields.ts, rendered by fields.ts). It only reads state and sends changes.

import type { EndJoin } from '../elements/wall/schema';
import { type Doc, type DocWall, type WallDefaults, wallNumber } from '../app/document';
import type { OpeningSolid } from '../app/geometry';
import type { OpeningWarning } from '../elements/opening/derive';
import { nextOpeningPanel, openingPanel, openingTitle, type OpeningPanelActions, type OpeningSize } from '../elements/opening/panel';
import type { OpeningId, OpeningKind } from '../elements/opening/schema';
import type { RoomSolid } from '../elements/room/derive';
import type { RoomPanelActions } from '../elements/room/panel';
import { nextWallFields, wallFields } from '../elements/wall/fields';
import type { JoinWarning } from '../elements/wall/join/types';
import type { StackedStep } from '../app/stacked';
import type { ReferenceLine } from '../elements/wall/schema';
import { el } from './controls';
import { fieldsSection } from './fields';
import { name, num, t, type MessageKey } from './i18n';
import { icon, type IconName } from './icons';
import type { AnyKind } from '../elements/contract';
import type { Command } from '../core/store';

export interface PanelInput {
  readonly doc: Doc;
  readonly selected: readonly DocWall[];
  readonly drawing: boolean;
  readonly defaults: WallDefaults;
  readonly warnings: readonly JoinWarning[];
  /** Selected doors and windows; shown when no wall is selected. */
  readonly openings: readonly OpeningSolid[];
  /** Every room of the level shown: what lies on each side of a door. */
  readonly levelRooms: readonly RoomSolid[];
  readonly placed: ReadonlyMap<OpeningId, OpeningSolid>;
  readonly openingWarnings: readonly OpeningWarning[];
  /** The door or window tool is active: its next opening's size. */
  readonly openingTool: { readonly kind: OpeningKind; readonly size: OpeningSize } | null;
  /** How many elements are selected, of every kind: the panel edits one kind at a time. */
  readonly total: number;
  /** The first registry kind with a selected element (elements/registry.ts), and those, as derived. */
  readonly kind: { readonly kind: AnyKind; readonly items: readonly unknown[] } | null;
  /** Walls whose exterior face does not meet the face of the wall they stand on (app/stacked.ts). */
  readonly stacked: readonly StackedStep[];
  /** What of the selection is outside the norms (rules/check.ts), as lines to read. */
  readonly norms: readonly string[];
}

export interface PanelActions {
  readonly updateWalls: (patch: Partial<Omit<DocWall, 'id'>>) => void;
  readonly setReferenceLine: (line: ReferenceLine) => void;
  readonly setWallType: (typeId: string) => void;
  readonly keepClear: boolean;
  readonly setKeepClear: (on: boolean) => void;
  /** Takes these values off the selected walls, so they come from their type again. */
  readonly resetToType: (fields: readonly ('top' | 'baseOffset')[]) => void;
  readonly editType: () => void;
  readonly updateRadius: (radius: number) => void;
  readonly setEndJoin: (end: 'start' | 'end', join: EndJoin | 'auto') => void;
  readonly arrangeWalls: (how: 'align' | 'distribute') => void;
  readonly firstWall?: string;
  readonly updateDefaults: (patch: Partial<WallDefaults>) => void;
  readonly close: () => void;
  /** A section's drawing shown (its panel's button). */
  readonly openSection?: (id: string) => void;
  /** A reference's calibration begun (its panel's button). */
  readonly calibrate?: (id: string) => void;
  /** A spot height begun on a terrain (its panel's button). */
  readonly addSpot?: (id: string) => void;
  readonly opening: OpeningPanelActions;
  readonly room: RoomPanelActions;
  readonly updateOpeningDefaults: (kind: OpeningKind, patch: Partial<OpeningSize>) => void;
  /** A command on the document: what a registry kind's fields send. */
  readonly dispatch: (c: Command<Doc>) => void;
  /** Moves the wall so its exterior face meets the face of the wall below it. */
  readonly alignBelow: (step: StackedStep) => void;
}

/** The common value of a field across the selection, or null when it differs. */
function common<T>(walls: readonly DocWall[], get: (w: DocWall) => T): T | null {
  const first = walls[0];
  if (first === undefined) return null;
  const v = get(first);
  return walls.every((w) => JSON.stringify(get(w)) === JSON.stringify(v)) ? v : null;
}

export function renderPanel(root: HTMLElement, input: PanelInput, act: PanelActions): void {
  const { doc, selected } = input;
  const head = (iconName: IconName, title: string) => {
    const h = el('div', { class: 'panel-head' });
    h.innerHTML = icon(iconName, 16);
    const close = el('button', { class: 'icon-btn', type: 'button', title: t('panel.close'), 'aria-label': t('panel.close') });
    close.innerHTML = icon('close', 16);
    close.addEventListener('click', act.close);
    h.append(el('span', { class: 'title' }, title), close);
    return h;
  };
  const nodes: HTMLElement[] = [];
  // A selection of several kinds shows one of them (walls, else rooms, floors, openings): said, so
  // "2 walls" over a selection of 5 does not read as if the others were not selected.
  const part = (shown: number) => {
    if (shown < input.total) nodes.push(el('div', { class: 'panel-hint' }, t('panel.partOf', { shown, n: input.total })));
  };

  if (selected.length > 0) {
    const typeId = common(selected, (w) => w.wallTypeId);
    const type = doc.wallTypes.find((w) => w.id === typeId);
    const title =
      selected.length === 1 ? t('panel.wall', { n: wallNumber(doc, selected[0]!.id) ?? '', type: type ? name(type.name) : '?' }) : t('panel.walls', { n: selected.length });
    nodes.push(head('wall', title));
    part(selected.length);
    // Built from the wall's fields (elements/wall/fields.ts).
    const fields = wallFields(doc, act, selected);
    const general = fieldsSection(t('panel.general'), true, fields.general, selected);
    const constraints = fieldsSection(t('panel.constraints'), true, fields.constraints, selected);
    const more = fieldsSection(t('panel.more'), false, fields.more, selected);
    nodes.push(general, constraints, more);
    if (selected.length >= 2) nodes.push(fieldsSection(t('panel.arrange'), true, fields.arrange, selected));
    const ids = new Set(selected.map((w) => w.id));
    const mine = input.warnings.filter((w) => w.walls.some((id) => ids.has(id)));
    if (mine.length > 0) {
      const box = el('div', { class: 'warn-list', role: 'status' });
      box.innerHTML = icon('warning', 16);
      // One line per kind: the same problem at two joints reads once. An overlap names the walls it is
      // with: "Walls overlap" alone left the user to find, among walls drawn one over the other, which.
      const others = [...new Set(mine.filter((w) => w.kind === 'wallsOverlap').flatMap((w) => w.walls.filter((id) => !ids.has(id))))];
      const numbers = others.flatMap((id) => wallNumber(doc, id) ?? []).sort((a, b) => a - b);
      const line = (k: JoinWarning['kind']) =>
        k === 'wallsOverlap' && numbers.length > 0 ? t('warn.wallsOverlapWith', { walls: numbers.join(', ') }) : t(`warn.${k}` as MessageKey);
      box.append(el('div', {}, ...[...new Set(mine.map((w) => w.kind))].map((k) => el('div', {}, line(k)))));
      nodes.push(box);
    }
    // One wall standing off the face of the wall below: the step, and the way to align it.
    const step = selected.length === 1 ? input.stacked.find((s) => s.upperId === selected[0]!.id) : undefined;
    if (step) {
      const box = el('div', { class: 'warn-list', role: 'status' });
      box.innerHTML = icon('warning', 16);
      const below = wallNumber(doc, step.lowerId) ?? '';
      const align = el('button', { class: 'btn', type: 'button' }, t('panel.alignBelow'));
      align.addEventListener('click', () => act.alignBelow(step));
      box.append(el('div', {}, el('div', {}, t('warn.stackedStep', { d: num(step.size * 100, 1), n: below })), align));
      nodes.push(box);
    }
  } else if (input.openings.length > 0) {
    const kinds = new Set(input.openings.map((o) => o.opening.kind));
    nodes.push(head(kinds.size === 1 && kinds.has('window') ? 'window' : 'door', openingTitle(input.openings)));
    part(input.openings.length);
    nodes.push(...openingPanel(doc, input.placed, input.openings, input.openingWarnings, act.opening, input.levelRooms));
  } else if (input.kind) {
    // A registry kind: its own icon, title and fields (elements/contract.ts).
    const { kind, items } = input.kind;
    const n = items.length;
    const title = kind.title ? kind.title(items) : { icon: kind.icon, text: n === 1 ? t(kind.one) : t(kind.many, { n }) };
    nodes.push(head(title.icon, title.text));
    part(n);
    nodes.push(fieldsSection(t('panel.general'), true, kind.fields(items, { dispatch: act.dispatch, doc, ...(act.room.startFloorHole ? { startFloorHole: act.room.startFloorHole } : {}), ...(act.openSection ? { openSection: act.openSection } : {}), ...(act.calibrate ? { calibrate: act.calibrate } : {}), ...(act.addSpot ? { addSpot: act.addSpot } : {}) }), items));
    if (kind.hint) nodes.push(el('div', { class: 'panel-hint' }, t(kind.hint)));
    const problem = kind.warning?.(items, doc) ?? null;
    if (problem) {
      const box = el('div', { class: 'warn-list', role: 'status' });
      box.innerHTML = icon('warning', 16);
      box.append(el('div', {}, problem));
      nodes.push(box);
    }
  } else if (input.openingTool) {
    const { kind, size } = input.openingTool;
    nodes.push(head(kind, t(kind === 'door' ? 'panel.nextDoor' : 'panel.nextWindow')));
    nodes.push(...nextOpeningPanel(kind, size, (patch) => act.updateOpeningDefaults(kind, patch)));
  } else if (input.drawing) {
    const d = input.defaults;
    nodes.push(head('wall', t('panel.nextWall')), el('div', { class: 'panel-hint' }, t('panel.nextWallHint')));
    const s = fieldsSection(t('panel.general'), true, nextWallFields(doc, act.updateDefaults), [d]);
    nodes.push(s);
  } else {
    nodes.push(head('pointer', t('panel.properties')));
    const empty = el('div', { class: 'empty-state' });
    empty.innerHTML = icon('pointer', 22);
    empty.append(el('strong', {}, t('panel.nothing')), el('span', {}, t('panel.nothingHint')));
    nodes.push(empty);
  }
  // What of the selection is outside the project's norms (rules/), each with its source.
  if (input.norms.length > 0) {
    const box = el('div', { class: 'warn-list', role: 'status' });
    box.innerHTML = icon('warning', 16);
    box.append(el('div', {}, el('strong', {}, t('rules.outside')), ...input.norms.map((line) => el('div', {}, line))));
    nodes.push(box);
  }
  // A control of the panel that had the focus has it again in the panel drawn anew: a list changed with
  // the arrow keys took one step, then the focus fell to the page and the next keys went to the app.
  const a = document.activeElement;
  const mark = a instanceof HTMLElement && root.contains(a) ? focusMark(root, a) : null;
  root.replaceChildren(...nodes);
  if (mark && !root.contains(document.activeElement)) {
    const again = focusables(root).filter((e) => signature(e) === mark.sig)[mark.n];
    again?.focus({ preventScroll: true });
  }
}

const focusables = (root: HTMLElement): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('input, select, textarea, button')];

/**
 * What a control is, in any panel drawn from the same state: its kind, its name and its row's label.
 * Not its title: a list's is the option chosen, so it changes with the value.
 */
const signature = (e: HTMLElement): string => {
  const label = (e as HTMLInputElement).labels?.[0]?.textContent ?? '';
  return [e.tagName, (e as HTMLInputElement).type ?? '', e.getAttribute('aria-label') ?? '', label].join('|');
};

/** A control by its signature and, among the controls that share it, its place. */
function focusMark(root: HTMLElement, e: HTMLElement): { sig: string; n: number } {
  const sig = signature(e);
  return { sig, n: focusables(root).filter((x) => signature(x) === sig).indexOf(e) };
}
