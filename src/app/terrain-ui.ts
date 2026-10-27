// The terrain in the app (phase 11; elements/terrain): one made round the model, and spot heights put on
// it with their tool, each its height typed (the ground's there, as it is, offered).

import type { App } from './app';
import { boundsOf, deriveGeometry } from './geometry';
import { newId } from '../core/id';
import type { Point2 } from '../core/vector';
import { insideRing } from '../elements/room/derive';
import { DEFAULT_INTERVAL, heightAt, TERRAIN_PREFIX, type Terrain } from '../elements/terrain/schema';
import { el, numberField } from '../ui/controls';
import { openProjectDialog } from '../ui/dialog';
import { t } from '../ui/i18n';

/** How far round the model the terrain reaches (m). */
const MARGIN = 6;

/** A terrain round the whole model, flat at its lowest level, on that level. */
export function addTerrain(app: App): void {
  const doc = app.store.get();
  const box = boundsOf(deriveGeometry(doc)) ?? { min: { x: -10, y: -10 }, max: { x: 10, y: 10 } };
  const level = [...doc.levels].sort((a, b) => a.elevation - b.elevation)[0]!;
  const { min, max } = box;
  const terrain: Terrain = {
    id: newId(TERRAIN_PREFIX),
    levelId: level.id,
    outline: [
      { x: min.x - MARGIN, y: min.y - MARGIN },
      { x: max.x + MARGIN, y: min.y - MARGIN },
      { x: max.x + MARGIN, y: max.y + MARGIN },
      { x: min.x - MARGIN, y: max.y + MARGIN },
    ],
    spots: [],
    interval: DEFAULT_INTERVAL,
  };
  app.store.dispatch({ label: 'cmd.addTerrain', apply: (d) => ({ ...d, terrains: [...d.terrains, terrain] }) });
  app.ui.selection = new Set([terrain.id]);
  app.toast(t('terrain.made'));
  app.refresh();
}

export function startSpot(app: App, id: string): void {
  app.setTool('spot');
  app.ui.spotFor = id;
  app.render();
}

/** A click of the spot tool: in its terrain, the height asked for and the spot put there. */
export function spotClick(app: App, p: Point2): void {
  const terrain = app.store.get().terrains.find((x) => x.id === app.ui.spotFor);
  if (!terrain) return app.setTool('select');
  if (!insideRing(terrain.outline, p)) {
    app.toast(t('terrain.outside'));
    return;
  }
  let z = Math.round(heightAt(terrain.spots, p) * 100) / 100;
  openProjectDialog(app, (close) => {
    const field = numberField(z, (v) => {
      z = v;
    }, -10000, 2, 'm', 10000);
    const input = field.querySelector('input')!;
    input.dataset.focus = 'z';
    input.setAttribute('aria-label', t('terrain.spotHeight'));
    const ok = el('button', { type: 'button', class: 'icon-btn text-btn primary' }, t('terrain.put'));
    ok.dataset.focus = 'ok';
    const apply = () => {
      app.store.dispatch({
        label: 'cmd.addSpot',
        apply: (d) => ({ ...d, terrains: d.terrains.map((x) => (x.id === terrain.id ? { ...x, spots: [...x.spots, { x: p.x, y: p.y, z }] } : x)) }),
      });
      close();
    };
    ok.addEventListener('click', apply);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') setTimeout(apply, 0);
    });
    const cancel = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    cancel.dataset.focus = 'close';
    cancel.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('terrain.spotTitle') },
      el('h2', {}, t('terrain.spotTitle')),
      el('div', { class: 'units-body' }, el('div', { class: 'mat-row' }, el('span', { class: 'mat-cap' }, t('terrain.spotHeight')), field), el('p', { class: 'mat-note' }, t('terrain.spotNote'))),
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), ok, cancel),
    );
  });
  const input = app.shell.helpBack.querySelector<HTMLInputElement>('[data-focus="z"]');
  input?.focus();
  input?.select();
}
