// The Visibility popover (the view bar's Visibility button): everything about what the view shows, in one
// place: the categories with an eye each, the plan's own marks, the graphic overrides on or off with their
// editor, and the saved combinations. They were split between the project browser's Layers (words
// "visible / hidden", struck through) and a dialog the button opened (docs/revisao-interface.md, B3, J2).
// It only reads the state and calls the app.

import type { App } from '../session/app';
import type { Category } from '../project/derived-filters';
import { el } from './controls';
import { t, type MessageKey } from '../i18n/messages';
import { icon } from '../i18n/icons';
import * as appPlacing from '../session/app-placing';
import * as appSettings from '../session/app-settings';

const CATEGORIES: readonly { id: Category; key: MessageKey }[] = [
  { id: 'walls', key: 'layer.walls' },
  { id: 'openings', key: 'layer.openings' },
  { id: 'rooms', key: 'layer.rooms' },
  { id: 'floors', key: 'layer.floors' },
  { id: 'objects', key: 'layer.objects' },
  { id: 'guides', key: 'layer.guides' },
];

/** A row: its name, and an eye that says and switches whether it shows. */
function eyeRow(label: string, shown: boolean, toggle: () => void): HTMLElement {
  const b = el('button', { type: 'button', class: 'vis-row', 'aria-pressed': String(shown), title: t(shown ? 'vis.hide' : 'vis.show', { what: label.toLowerCase() }) });
  b.append(el('span', { class: 'vis-label' }, label));
  b.insertAdjacentHTML('beforeend', icon(shown ? 'eye' : 'eyeOff', 16));
  b.addEventListener('click', toggle);
  return b;
}

function group(title: string, ...rows: HTMLElement[]): HTMLElement {
  return el('div', { class: 'vis-group' }, el('div', { class: 'vis-title' }, title), ...rows);
}

export function renderVisibility(app: App, box: HTMLElement): void {
  const { ui } = app;
  const doc = app.store.get();
  const sets = doc.layerSets ?? [];
  const hasOverrides = (doc.overrides ?? []).length + (doc.roomOverrides ?? []).length > 0;
  const action = (label: string, run: () => void, ic?: Parameters<typeof icon>[0]): HTMLElement => {
    const b = el('button', { type: 'button', class: 'vis-action' });
    if (ic) b.insertAdjacentHTML('beforeend', icon(ic, 16));
    b.append(el('span', {}, label));
    b.addEventListener('click', run);
    return b;
  };
  const setRows = sets.map((s) => {
    const same = s.hidden.length === ui.hidden.size && s.hidden.every((c) => ui.hidden.has(c));
    const apply = el('button', { type: 'button', class: 'vis-row', 'aria-current': String(same) }, el('span', { class: 'vis-label' }, s.name));
    apply.addEventListener('click', () => appSettings.applyLayerSet(app, s.id));
    const del = el('button', { type: 'button', class: 'icon-btn', title: t('layers.delete', { name: s.name }), 'aria-label': t('layers.delete', { name: s.name }) });
    del.innerHTML = icon('close', 14);
    del.addEventListener('click', () => appSettings.deleteLayerSet(app, s.id));
    return el('div', { class: 'vis-set' }, apply, del);
  });
  box.replaceChildren(
    el('div', { class: 'vis-head' }, t('vis.title')),
    group(t('vis.elements'), ...CATEGORIES.map((c) => eyeRow(t(c.key), !ui.hidden.has(c.id), () => appSettings.toggleCategory(app, c.id)))),
    group(
      t('vis.plan'),
      eyeRow(t('layer.refLines'), ui.refLines, () => appSettings.toggleRefLines(app)),
      eyeRow(t('layer.openingTags'), ui.openingTags, () => appPlacing.toggleOpeningTags(app)),
    ),
    group(
      t('vis.overrides'),
      ...(hasOverrides ? [eyeRow(t('vis.overrides'), ui.overridesOn, () => appSettings.toggleOverrides(app))] : []),
      action(
        t('vis.editOverrides'),
        () => {
          box.hidden = true;
          app.openOverrides();
        },
        'frame',
      ),
    ),
    group(t('vis.sets'), ...setRows, action(t('layers.save'), () => appSettings.saveLayerSet(app), 'plus')),
  );
}
