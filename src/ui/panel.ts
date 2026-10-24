// Properties panel, built from what is selected. It only reads state and sends changes.

import type { Doc, DocWall, WallDefaults } from '../app/document';
import { distance } from '../core/vector';
import type { JoinWarning } from '../elements/wall/join/types';
import type { ReferenceLine } from '../elements/wall/schema';
import { el, numberField, row, scrub, section, segmented, select } from './controls';
import { name, num, t, type MessageKey } from './i18n';
import { icon } from './icons';

export interface PanelInput {
  readonly doc: Doc;
  readonly selected: readonly DocWall[];
  readonly drawing: boolean;
  readonly defaults: WallDefaults;
  readonly warnings: readonly JoinWarning[];
}

export interface PanelActions {
  readonly updateWalls: (patch: Partial<Omit<DocWall, 'id'>>) => void;
  readonly updateDefaults: (patch: Partial<WallDefaults>) => void;
  readonly close: () => void;
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
  const head = (iconName: 'wall' | 'pointer', title: string) => {
    const h = el('div', { class: 'panel-head' });
    h.innerHTML = icon(iconName, 16);
    const close = el('button', { class: 'icon-btn', type: 'button', title: t('panel.close'), 'aria-label': t('panel.close') });
    close.innerHTML = icon('close', 16);
    close.addEventListener('click', act.close);
    h.append(el('span', { class: 'title' }, title), close);
    return h;
  };
  const typeOptions = doc.wallTypes.map((w) => ({ value: w.id, label: name(w.name) }));
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
    const top = common(selected, (w) => w.top.kind);
    const topValue = common(selected, (w) => (w.top.kind === 'level' ? w.top.offset : w.top.height));
    const baseOffset = common(selected, (w) => w.baseOffset);
    const general = section(
      t('panel.general'),
      true,
      row(t('panel.type'), select(typeOptions, typeId, (v) => act.updateWalls({ wallTypeId: v }))),
      row(t('panel.reference'), segmented(refOptions, common(selected, (w) => w.referenceLine), (v) => act.updateWalls({ referenceLine: v }))),
    );
    const constraints = section(
      t('panel.constraints'),
      true,
      row(t('panel.base'), select(doc.levels.map((l) => ({ value: l.id, label: name(l.name) })), common(selected, (w) => w.levelId), (v) => act.updateWalls({ levelId: v }))),
      row(t('panel.baseOffset'), numberField(baseOffset, (v) => act.updateWalls({ baseOffset: v }))),
      row(t('panel.top'), select(topOptions, top, (v) => act.updateWalls({ top: v === 'level' ? { kind: 'level', offset: 0 } : { kind: 'fixed', height: 2.8 } }))),
      ...(top === null
        ? []
        : [
            row(
              t(top === 'level' ? 'panel.offset' : 'panel.height'),
              numberField(topValue, (v) => act.updateWalls({ top: top === 'level' ? { kind: 'level', offset: v } : { kind: 'fixed', height: v } }), top === 'fixed' ? 0.01 : -Infinity),
              { sub: true },
            ),
          ]),
    );
    const thickness = type ? type.layers.reduce((s, l) => s + l.thickness, 0) : null;
    const length = selected.length === 1 ? distance(selected[0]!.start, selected[0]!.end) : null;
    const more = section(
      t('panel.more'),
      false,
      row(t('panel.thickness'), el('div', { class: 'readout' }, thickness === null ? t('panel.varies') : `${num(thickness, 3)} m`)),
      row(t('panel.length'), el('div', { class: 'readout' }, length === null ? t('panel.varies') : `${num(length)} m`)),
    );
    nodes.push(general, constraints, more);
    wireScrub(constraints, t('panel.baseOffset'), () => baseOffset, (v) => act.updateWalls({ baseOffset: v }));
    const ids = new Set(selected.map((w) => w.id));
    const mine = input.warnings.filter((w) => w.walls.some((id) => ids.has(id)));
    if (mine.length > 0) {
      const box = el('div', { class: 'warn-list', role: 'status' });
      box.innerHTML = icon('warning', 16);
      box.append(el('div', {}, ...mine.map((w) => el('div', {}, t(`warn.${w.kind}` as MessageKey)))));
      nodes.push(box);
    }
  } else if (input.drawing) {
    const d = input.defaults;
    nodes.push(head('wall', t('panel.nextWall')), el('div', { class: 'panel-hint' }, t('panel.nextWallHint')));
    const s = section(
      t('panel.general'),
      true,
      row(t('panel.type'), select(typeOptions, d.wallTypeId, (v) => act.updateDefaults({ wallTypeId: v }))),
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
