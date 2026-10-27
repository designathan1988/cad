// The simulations dialog (sim/*, app/sim-tables.ts): a tab per simulation with its results and
// premises, a row naming an element selects and frames it; and a tab of what they assume (the zone,
// the air on each side, the Wi-Fi), with the map over the plan, the report and the detailed engines'
// inputs (EnergyPlus, Radiance, FDS).

import type { App } from '../app/app';
import { type Cell, SIM_SECTIONS, type SimSection, simBlock, simSettingsOf } from '../app/sim-tables';
import { SIM_MAPS, type SimMap } from '../app/sim-map';
import type { SimSettings, WifiBand } from '../sim/settings';
import { el, numberField, segmented, select } from './controls';
import { openProjectDialog } from './dialog';
import { type MessageKey, t } from './i18n';

type Tab = SimSection | 'settings';
const TABS: readonly Tab[] = [...SIM_SECTIONS, 'settings'];

export function showSimulations(app: App, first: Tab = 'sun'): void {
  let tab: Tab = first;
  let dialog: { redraw: () => void } | null = null;
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const g = app.geometry;
    const tabs = segmented(
      TABS.map((k) => ({ value: k, label: t(`sim.tab.${k}` as MessageKey) })),
      tab,
      (k) => {
        tab = k;
        dialog?.redraw();
      },
      true,
    );
    const pick = (id: string) => () => {
      close();
      app.ui.selection = new Set([id]);
      app.showElementLevel(id);
      app.frameSelection();
    };
    const cell = (c: Cell): string | HTMLElement => {
      if (typeof c === 'string') return c;
      if ('id' in c) {
        const b = el('button', { type: 'button', class: 'icon-btn text-btn services-link' }, c.text);
        b.addEventListener('click', pick(c.id));
        return b;
      }
      return el('span', { class: c.ok ? 'services-ok' : 'services-bad' }, c.text);
    };
    const btn = (label: string, run: () => void) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn' }, label);
      b.addEventListener('click', run);
      return b;
    };
    // A label over its control, in a grid of them (the lot dialog's way).
    const field = (label: string, control: HTMLElement) => el('label', { class: 'lot-row' }, el('span', {}, label), control);
    let body: HTMLElement;
    if (tab === 'settings') {
      const s = simSettingsOf(doc);
      const set = (patch: Partial<SimSettings>) => app.setSimulation({ ...s, ...patch });
      const zone = select(
        [1, 2, 3, 4, 5, 6, 7, 8].map((z) => ({ value: String(z), label: t('sim.zoneN', { n: z }) })),
        String(s.zone),
        (v) => set({ zone: Number(v) }),
      );
      const temp = (side: 'inside' | 'outside') => numberField(s[side].temperature, (v) => set({ [side]: { ...s[side], temperature: v } }), -30, 1, '°C', 50);
      const rh = (side: 'inside' | 'outside') => numberField(s[side].humidity * 100, (v) => set({ [side]: { ...s[side], humidity: Math.min(1, Math.max(0.01, v / 100)) } }), 1, 0, '%', 100);
      const band = segmented<WifiBand>([{ value: '2.4', label: '2,4 GHz' }, { value: '5', label: '5 GHz' }], s.wifi.band, (v) => set({ wifi: { ...s.wifi, band: v } }), true);
      const power = numberField(s.wifi.power, (v) => set({ wifi: { ...s.wifi, power: v } }), -10, 0, 'dBm', 36);
      const map = select(
        SIM_MAPS.map((m) => ({ value: m, label: t(`sim.map.${m}` as MessageKey) })),
        app.ui.simMap,
        (v) => {
          app.ui.simMap = v as SimMap;
          app.render();
          dialog?.redraw();
        },
      );
      const download = (kind: 'idf' | 'rad' | 'fds' | 'report') => () => app.downloadSimulation(kind);
      body = el(
        'div',
        { class: 'budget-scroll sim-settings' },
        el('h3', {}, t('sim.assumptions')),
        el(
          'div',
          { class: 'lot-grid' },
          field(t('sim.zone'), zone),
          field(t('sim.insideTemp'), temp('inside')),
          field(t('sim.insideRh'), rh('inside')),
          field(t('sim.outsideTemp'), temp('outside')),
          field(t('sim.outsideRh'), rh('outside')),
          field(t('sim.wifiBand'), band),
          field(t('sim.wifiPower'), power),
        ),
        el('p', { class: 'tour-empty' }, t('sim.settingsNote')),
        el('h3', {}, t('sim.mapTitle')),
        el('div', { class: 'lot-grid' }, field(t('sim.mapShown'), map)),
        el('p', { class: 'tour-empty' }, t('sim.mapNote')),
        el('h3', {}, t('sim.outputs')),
        el('div', { class: 'budget-bar' }, btn(t('sim.report'), download('report')), btn(t('sim.idf'), download('idf')), btn(t('sim.rad'), download('rad')), btn(t('sim.fds'), download('fds'))),
        el('p', { class: 'tour-empty' }, t('sim.outputsNote')),
      );
    } else {
      const block = simBlock(tab, doc, g, (id) => app.reportTitle(id));
      body = el(
        'div',
        { class: 'budget-scroll' },
        ...(block.tables.length === 0 && block.empty ? [el('p', { class: 'tour-empty' }, block.empty)] : []),
        ...block.tables.flatMap((tb) => [
          ...(tb.title ? [el('h3', {}, tb.title)] : []),
          el(
            'table',
            { class: 'schedule-table' },
            el('thead', {}, el('tr', {}, ...tb.head.map((h, i) => el('th', { class: tb.numeric.includes(i) ? 'num' : '' }, h)))),
            el('tbody', {}, ...tb.rows.map((r) => el('tr', {}, ...r.map((c, i) => el('td', { class: tb.numeric.includes(i) ? 'num' : '' }, cell(c)))))),
          ),
        ]),
        ...block.premises.map((p) => el('p', { class: 'tour-empty' }, p)),
      );
    }
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-xl budget-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('sim.title') },
      el('h2', {}, t('sim.title')),
      el('div', { class: 'schedule-tabs' }, tabs),
      body,
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  dialog = openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
