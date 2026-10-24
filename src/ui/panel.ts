// Properties panel, built from what is selected. It only reads state and sends changes.

import { type Doc, type DocWall, type WallDefaults, wallBase, wallOverrides, wallTop } from '../app/document';
import type { OpeningSolid } from '../app/geometry';
import { type OpeningWarning, referenceLength } from '../elements/opening/derive';
import { arcOf } from '../elements/wall/geometry/arc';
import { nextOpeningPanel, openingPanel, openingTitle, type OpeningPanelActions, type OpeningSize } from '../elements/opening/panel';
import type { OpeningId, OpeningKind } from '../elements/opening/schema';
import type { FloorSolid, RoomSolid } from '../elements/room/derive';
import { floorPanel, roomPanel, type RoomPanelActions } from '../elements/room/panel';
import { distance } from '../core/vector';
import type { JoinWarning } from '../elements/wall/join/types';
import type { ReferenceLine } from '../elements/wall/schema';
import { el, numberField, row, scrub, searchSelect, section, segmented, select } from './controls';
import { layerSwatch } from './swatch';
import { name, num, t, type MessageKey } from './i18n';
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

const REFS: readonly { value: ReferenceLine; key: MessageKey; icon: 'refCenter' | 'refExterior' | 'refInterior' }[] = [
  { value: 'centerline', key: 'ref.centerline', icon: 'refCenter' },
  { value: 'exteriorFace', key: 'ref.exteriorFace', icon: 'refExterior' },
  { value: 'interiorFace', key: 'ref.interiorFace', icon: 'refInterior' },
];

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
  // Types are many and alike: a list with search and a thumbnail of each one's layers.
  const typeOptions = doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name), keywords: w.name, thumb: layerSwatch(w.layers) }));
  const refOptions = REFS.map((r) => ({ value: r.value, label: t(r.key), icon: r.icon }));
  const topOptions = [
    { value: 'level' as const, label: t('panel.topLevel') },
    { value: 'fixed' as const, label: t('panel.topFixed') },
  ];
  const nodes: HTMLElement[] = [];

  if (selected.length > 0) {
    const typeId = common(selected, (w) => w.wallTypeId);
    const type = doc.wallTypes.find((w) => w.id === typeId);
    const title = selected.length === 1 ? t('panel.wall', { type: type ? name(type.name) : '?' }) : t('panel.walls', { n: selected.length });
    nodes.push(head('wall', title));
    // What each wall has, its own or its type's; and whether any selected wall overrides its type.
    const topOf = (w: DocWall) => wallTop(doc, w);
    const top = common(selected, (w) => topOf(w).kind);
    const topValue = common(selected, (w) => {
      const r = topOf(w);
      return r.kind === 'level' ? r.offset : r.height;
    });
    const baseOffset = common(selected, (w) => wallBase(doc, w));
    const over = { top: selected.some((w) => wallOverrides(doc, w).top), baseOffset: selected.some((w) => wallOverrides(doc, w).baseOffset) };
    /** A field with the override mark and the way back to the type, when it overrides it. */
    const typed = (field: HTMLElement, which: 'top' | 'baseOffset'): HTMLElement => {
      if (!over[which]) return field;
      const back = el('button', { type: 'button', class: 'icon-btn reset-type', title: t('panel.resetToType'), 'aria-label': t('panel.resetToType') });
      back.innerHTML = icon('undo', 14);
      back.addEventListener('click', () => act.resetToType([which]));
      return el('div', { class: 'overridden' }, field, back);
    };
    const general = section(
      t('panel.general'),
      true,
      row(t('panel.type'), searchSelect(typeOptions, typeId, (v) => act.updateWalls({ wallTypeId: v }), t('panel.type'))),
      row(t('panel.reference'), segmented(refOptions, common(selected, (w) => w.referenceLine), (v) => act.updateWalls({ referenceLine: v }))),
    );
    const constraints = section(
      t('panel.constraints'),
      true,
      row(t('panel.base'), select(doc.levels.map((l) => ({ value: l.id, label: name(l.name) })), common(selected, (w) => w.levelId), (v) => act.updateWalls({ levelId: v }))),
      row(over.baseOffset ? `${t('panel.baseOffset')} •` : t('panel.baseOffset'), typed(numberField(baseOffset, (v) => act.updateWalls({ baseOffset: v })), 'baseOffset')),
      row(
        over.top ? `${t('panel.top')} •` : t('panel.top'),
        typed(select(topOptions, top, (v) => act.updateWalls({ top: v === 'level' ? { kind: 'level', offset: 0 } : { kind: 'fixed', height: 2.8 } })), 'top'),
      ),
      ...(top === null
        ? []
        : [
            row(
              t(top === 'level' ? 'panel.offset' : 'panel.height'),
              numberField(topValue, (v) => act.updateWalls({ top: top === 'level' ? { kind: 'level', offset: v } : { kind: 'fixed', height: v } }), top === 'fixed' ? 0.01 : -Infinity),
              { sub: true },
            ),
          ]),
      ...(over.top || over.baseOffset ? [el('div', {}, el('div', { class: 'panel-note' }, t('panel.overrideNote')))] : []),
    );
    const thickness = type ? type.layers.reduce((s, l) => s + l.thickness, 0) : null;
    const one = selected.length === 1 ? selected[0]! : null;
    const length = one ? referenceLength(one) : null;
    const arc = one && one.bulge ? arcOf({ start: one.start, end: one.end, bulge: one.bulge }) : null;
    const readout = (text: string) => el('div', { class: 'readout' }, text);
    const more = section(
      t('panel.more'),
      false,
      row(t('panel.thickness'), readout(thickness === null ? t('panel.varies') : `${num(thickness, 3)} m`)),
      row(t('panel.length'), readout(length === null ? t('panel.varies') : `${num(length)} m`)),
      ...(arc && one
        ? [row(t('panel.chord'), readout(`${num(distance(one.start, one.end))} m`)), row(t('panel.radius'), readout(`${num(arc.radius)} m`))]
        : []),
    );
    nodes.push(general, constraints, more);
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
    const s = section(
      t('panel.general'),
      true,
      row(t('panel.type'), searchSelect(typeOptions, d.wallTypeId, (v) => act.updateDefaults({ wallTypeId: v }), t('panel.type'))),
      row(t('panel.reference'), segmented(refOptions, d.referenceLine, (v) => act.updateDefaults({ referenceLine: v }))),
      row(t('panel.baseOffset'), numberField(d.baseOffset, (v) => act.updateDefaults({ baseOffset: v }))),
      row(t('panel.top'), select(topOptions, d.top.kind, (v) => act.updateDefaults({ top: v === 'level' ? { kind: 'level', offset: 0 } : { kind: 'fixed', height: 2.8 } }))),
      row(
        t(d.top.kind === 'level' ? 'panel.offset' : 'panel.height'),
        numberField(d.top.kind === 'level' ? d.top.offset : d.top.height, (v) =>
          act.updateDefaults({ top: d.top.kind === 'level' ? { kind: 'level', offset: v } : { kind: 'fixed', height: v } }),
        ),
        { sub: true },
      ),
    );
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
  const l = [...sec.querySelectorAll('label')].find((x) => x.textContent === label);
  if (l) scrub(l, get, commit);
}
