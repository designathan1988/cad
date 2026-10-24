// Properties panel, built from what is selected: each element's sections come from its fields
// (elements/*/fields.ts, rendered by fields.ts). It only reads state and sends changes.

import { type Doc, type DocWall, type WallDefaults, wallBase, wallNumber } from '../app/document';
import type { OpeningSolid } from '../app/geometry';
import type { OpeningWarning } from '../elements/opening/derive';
import { nextOpeningPanel, openingPanel, openingTitle, type OpeningPanelActions, type OpeningSize } from '../elements/opening/panel';
import type { OpeningId, OpeningKind } from '../elements/opening/schema';
import type { FloorSolid, RoomSolid } from '../elements/room/derive';
import { floorPanel, roomPanel, type RoomPanelActions } from '../elements/room/panel';
import { nextWallFields, wallFields } from '../elements/wall/fields';
import type { JoinWarning } from '../elements/wall/join/types';
import { el, scrub } from './controls';
import { fieldsSection } from './fields';
import { name, t, type MessageKey } from './i18n';
import { icon } from './icons';

export interface PanelInput {
  readonly doc: Doc;
  readonly selected: readonly DocWall[];
  readonly drawing: boolean;
  readonly defaults: WallDefaults;
  readonly warnings: readonly JoinWarning[];
  /** Selected doors and windows; shown when no wall is selected. */
  readonly openings: readonly OpeningSolid[];
  readonly rooms: readonly RoomSolid[];
  readonly floors: readonly FloorSolid[];
  readonly placed: ReadonlyMap<OpeningId, OpeningSolid>;
  readonly openingWarnings: readonly OpeningWarning[];
  /** The door or window tool is active: its next opening's size. */
  readonly openingTool: { readonly kind: OpeningKind; readonly size: OpeningSize } | null;
}

export interface PanelActions {
  readonly updateWalls: (patch: Partial<Omit<DocWall, 'id'>>) => void;
  /** Takes these values off the selected walls, so they come from their type again. */
  readonly resetToType: (fields: readonly ('top' | 'baseOffset')[]) => void;
  readonly updateDefaults: (patch: Partial<WallDefaults>) => void;
  readonly close: () => void;
  readonly opening: OpeningPanelActions;
  readonly room: RoomPanelActions;
  readonly updateOpeningDefaults: (kind: OpeningKind, patch: Partial<OpeningSize>) => void;
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
  const head = (iconName: 'wall' | 'pointer' | 'door' | 'window' | 'room' | 'slab', title: string) => {
    const h = el('div', { class: 'panel-head' });
    h.innerHTML = icon(iconName, 16);
    const close = el('button', { class: 'icon-btn', type: 'button', title: t('panel.close'), 'aria-label': t('panel.close') });
    close.innerHTML = icon('close', 16);
    close.addEventListener('click', act.close);
    h.append(el('span', { class: 'title' }, title), close);
    return h;
  };
  const nodes: HTMLElement[] = [];

  if (selected.length > 0) {
    const typeId = common(selected, (w) => w.wallTypeId);
    const type = doc.wallTypes.find((w) => w.id === typeId);
    const title =
      selected.length === 1 ? t('panel.wall', { n: wallNumber(doc, selected[0]!.id) ?? '', type: type ? name(type.name) : '?' }) : t('panel.walls', { n: selected.length });
    nodes.push(head('wall', title));
    // Built from the wall's fields (elements/wall/fields.ts).
    const fields = wallFields(doc, act);
    const general = fieldsSection(t('panel.general'), true, fields.general, selected);
    const constraints = fieldsSection(t('panel.constraints'), true, fields.constraints, selected);
    const more = fieldsSection(t('panel.more'), false, fields.more, selected);
    nodes.push(general, constraints, more);
    const baseOffset = common(selected, (w) => wallBase(doc, w));
    wireScrub(constraints, t('panel.baseOffset'), () => baseOffset, (v) => act.updateWalls({ baseOffset: v }));
    const ids = new Set(selected.map((w) => w.id));
    const mine = input.warnings.filter((w) => w.walls.some((id) => ids.has(id)));
    if (mine.length > 0) {
      const box = el('div', { class: 'warn-list', role: 'status' });
      box.innerHTML = icon('warning', 16);
      // One line per kind: the same problem at two joints reads once.
      box.append(el('div', {}, ...[...new Set(mine.map((w) => w.kind))].map((k) => el('div', {}, t(`warn.${k}` as MessageKey)))));
      nodes.push(box);
    }
  } else if (input.rooms.length > 0) {
    const one = input.rooms.length === 1 ? input.rooms[0]! : null;
    nodes.push(head('room', one ? t('room.title', { name: name(one.room.name) }) : t('room.titleMany', { n: input.rooms.length })));
    nodes.push(...roomPanel(input.rooms, act.room));
  } else if (input.floors.length > 0) {
    nodes.push(head('slab', input.floors.length === 1 ? t('floor.title') : t('floor.titleMany', { n: input.floors.length })));
    const roomName = (id: string) => doc.rooms.find((r) => r.id === id)?.name ?? '—';
    nodes.push(...floorPanel(input.floors, roomName, act.room));
  } else if (input.openings.length > 0) {
    const kinds = new Set(input.openings.map((o) => o.opening.kind));
    nodes.push(head(kinds.size === 1 && kinds.has('window') ? 'window' : 'door', openingTitle(input.openings)));
    nodes.push(...openingPanel(doc, input.placed, input.openings, input.openingWarnings, act.opening));
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
  root.replaceChildren(...nodes);
}

function wireScrub(sec: HTMLElement, label: string, get: () => number | null, commit: (v: number) => void): void {
  // By the label's own text: a mark for an own value (row's `mark`) follows it in a separate span.
  const l = [...sec.querySelectorAll('label')].find((x) => x.firstChild?.textContent === label);
  if (l) scrub(l, get, commit);
}
