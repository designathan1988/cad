// The services dialog (elements/mep): the systems with what each has; the load table and its one-line
// diagram; the water pressures at the points; the sewer's falls; the runs through the structure; the
// structure's analytic model and warnings; the isometric drawing; the wet rooms' waterproofing. Read
// from the model each time it is drawn; a row with an element selects and frames it.

import type { App } from '../app/app';
import { analyticModel, clashesOf, isometricSvg, waterproofing } from '../elements/mep/coordination';
import { loadTable, MAX_DROP } from '../elements/mep/electrical';
import { fittingsOf, networksOf } from '../elements/mep/network';
import { GROUP_OF, systemsOf } from '../elements/mep/schema';
import { DEFAULT_RAIN, MAX_STATIC, MIN_DYNAMIC, pressures, sewerFalls, sewerStacks } from '../elements/mep/water';
import type { RoofSolid } from '../elements/roof/geometry';
import { DOWNPIPE_LEAST, GUTTER_FALL, gutters } from '../elements/mep/gutters';
import { simSettingsOf } from '../app/sim-tables';
import { el, numberField, searchSelect, segmented, select } from './controls';
import { RAIN_PLACES, rainOf, type RainReturn } from '../elements/mep/rain-places';
import { openProjectDialog } from './dialog';
import { type MessageKey, num, t } from './i18n';

type Tab = 'systems' | 'loads' | 'water' | 'sewer' | 'clashes' | 'structure' | 'iso' | 'wet';
const TABS: readonly Tab[] = ['systems', 'loads', 'water', 'sewer', 'clashes', 'structure', 'iso', 'wet'];

/** A one-line diagram of the panel and its circuits, as SVG. */
function oneLine(circuits: ReturnType<typeof loadTable>['circuits']): string {
  const row = 34;
  const h = 40 + circuits.length * row;
  const lines = circuits
    .map((c, i) => {
      const y = 40 + i * row + row / 2;
      return `<line x1="60" y1="${y}" x2="150" y2="${y}" stroke="currentColor" stroke-width="1.5"/><rect x="150" y="${y - 7}" width="26" height="14" fill="none" stroke="currentColor"/><text x="190" y="${y + 4}" font-size="12" fill="currentColor">${c.name} · ${c.breaker ?? '?'} A · ${c.section === null ? '?' : num(c.section, 1)} mm² · ${Math.round(c.power)} VA</text>`;
    })
    .join('');
  // Drawn at its own size (a page's text size), not stretched to the dialog's width.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="${h}" viewBox="0 0 520 ${h}" class="services-svg" role="img"><text x="12" y="22" font-size="12" font-weight="700" fill="currentColor">QD</text><line x1="60" y1="30" x2="60" y2="${h - 10}" stroke="currentColor" stroke-width="3"/>${lines}</svg>`;
}

export function showServices(app: App, first: Tab = 'systems'): void {
  let tab: Tab = first;
  let isoGroup = 'all';
  let dialog: { redraw: () => void } | null = null;
  const render = (close: () => void): HTMLElement => {
    const doc = app.store.get();
    const g = app.geometry;
    const tabs = segmented(
      TABS.map((k) => ({ value: k, label: t(`services.tab.${k}` as MessageKey) })),
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
    const table = (head: readonly string[], rows: readonly (readonly (string | HTMLElement)[])[], numeric: readonly number[] = []) =>
      el(
        'table',
        { class: 'schedule-table' },
        el('thead', {}, el('tr', {}, ...head.map((h, i) => el('th', { class: numeric.includes(i) ? 'num' : '' }, h)))),
        el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c, i) => el('td', { class: numeric.includes(i) ? 'num' : '' }, c))))),
      );
    const link = (text: string, id: string) => {
      const b = el('button', { type: 'button', class: 'icon-btn text-btn services-link' }, text);
      b.addEventListener('click', pick(id));
      return b;
    };
    const mark = (ok: boolean) => el('span', { class: ok ? 'services-ok' : 'services-bad' }, t(ok ? 'services.ok' : 'services.bad'));
    const note = (key: MessageKey, vars?: Readonly<Record<string, string | number>>) => el('p', { class: 'tour-empty' }, t(key, vars));
    let body: HTMLElement;
    if (tab === 'systems') {
      const runs = new Map<string, number>();
      for (const s of g.kinds.get('mepRuns')?.values() ?? []) {
        const r = s as { run: { systemId: string }; length: number };
        runs.set(r.run.systemId, (runs.get(r.run.systemId) ?? 0) + r.length);
      }
      const fittings = fittingsOf(doc);
      body = el(
        'div',
        { class: 'budget-scroll' },
        table(
          [t('services.system'), t('services.discipline'), t('services.points'), t('services.runLength')],
          systemsOf(doc).map((s) => {
            const swatch = el('span', { class: 'services-swatch' });
            swatch.style.background = s.color;
            return [el('span', {}, swatch, s.name), t(`services.disc.${s.discipline}` as MessageKey), String(doc.mepPoints.filter((p) => p.systemId === s.id).length), `${num(runs.get(s.id) ?? 0, 2)} m`];
          }),
          [2, 3],
        ),
        note('services.systemsNote'),
        ...(fittings.length > 0
          ? [
              el('h3', {}, t('services.fittings')),
              table(
                [t('services.groupCol'), t('services.fitting'), t('services.diameter'), t('services.quantity')],
                fittings.map((f) => [t(`services.group.${f.group}` as MessageKey), t(`services.fit.${f.kind}` as MessageKey), `${Math.round(f.diameter * 1000)} mm`, String(f.count)]),
                [2, 3],
              ),
              note('services.fittingsNote'),
            ]
          : []),
      );
    } else if (tab === 'loads') {
      const lt = loadTable(doc, g);
      const rows = lt.circuits.map((c) => [
        c.name,
        t(`services.circuit.${c.kind}` as MessageKey),
        String(c.points.length),
        `${Math.round(c.power)} VA`,
        `${c.voltage} V`,
        `${num(c.current, 2)} A`,
        c.breaker === null ? '—' : `${c.breaker} A`,
        c.section === null ? '—' : `${num(c.section, 1)} mm²`,
        c.length === null ? '—' : `${num(c.length, 2)} m`,
        c.drop === null ? '—' : `${num(c.drop, 2)} %`,
        c.drop === null ? '—' : mark(c.drop <= MAX_DROP),
        c.phase,
        c.dr === null ? '—' : t('services.drFor', { where: c.dr === 'outside' ? t('services.outside') : t(`use.${c.dr}` as MessageKey) }),
      ]);
      const svg = el('div', { class: 'services-diagram' });
      svg.innerHTML = oneLine(lt.circuits);
      body = el(
        'div',
        { class: 'budget-scroll' },
        ...(lt.hasPanel ? [] : [note('services.noPanel')]),
        table(
          [t('services.circuitName'), t('services.circuitKind'), t('services.points'), t('services.load'), t('services.voltage'), t('services.current'), t('services.breaker'), t('services.section'), t('services.way'), t('services.drop'), '', t('services.phase'), t('services.dr')],
          rows,
          [2, 3, 4, 5, 6, 7, 8, 9],
        ),
        el('p', {}, t('services.totalLoad', { va: Math.round(lt.total) })),
        el('p', {}, t('services.phases', { a: Math.round(lt.phases.a), b: Math.round(lt.phases.b), imbalance: num(lt.phases.imbalance, 0) })),
        // The probable demand: the loads under the utility's factors (electrical.ts: Demand).
        el('h3', {}, t('services.demand')),
        table(
          [t('services.demandOf'), t('services.load'), t('services.factor'), t('services.demandVa')],
          [
            [t('services.demandGeneral'), `${Math.round(lt.demand.general.load)} VA`, lt.demand.general.load > 0 ? `${num((lt.demand.general.demand / lt.demand.general.load) * 100, 0)} %` : '—', `${Math.round(lt.demand.general.demand)} VA`],
            [t('services.demandShowers', { n: lt.demand.showers.count }), `${Math.round(lt.demand.showers.load)} VA`, lt.demand.showers.count > 0 ? `${num(lt.demand.showers.factor * 100, 0)} %` : '—', `${Math.round(lt.demand.showers.demand)} VA`],
            [t('services.demandOthers'), `${Math.round(lt.demand.others.load)} VA`, lt.demand.others.load > 0 ? '100 %' : '—', `${Math.round(lt.demand.others.demand)} VA`],
            [t('services.demandTotal'), `${Math.round(lt.total)} VA`, lt.total > 0 ? `${num((lt.demand.total / lt.total) * 100, 0)} %` : '—', `${Math.round(lt.demand.total)} VA`],
          ],
          [1, 2, 3],
        ),
        note('services.demandNote'),
        ...(lt.unreached.length > 0 ? [el('p', { class: 'services-bad' }, t('services.unreached', { n: lt.unreached.length })), el('div', {}, ...lt.unreached.map((p) => link(app.reportTitle(p.id), p.id)))] : []),
        el('h3', {}, t('services.oneLine')),
        svg,
        note('services.loadsNote', { drop: MAX_DROP }),
        note('services.protectionNote'),
      );
    } else if (tab === 'water') {
      const all = [...pressures(doc, 'coldWater'), ...pressures(doc, 'hotWater')];
      body = el(
        'div',
        { class: 'budget-scroll' },
        all.length === 0
          ? note('services.noWater')
          : table(
              [t('services.outlet'), t('services.head'), t('services.loss'), t('services.static'), t('services.dynamic'), ''],
              all.map((p) => [
                link(`${app.reportTitle(p.point.id)}${p.point.label ? ` · ${p.point.label}` : ''}`, p.point.id),
                p.head === null ? '—' : `${num(p.head, 2)} m`,
                p.loss === null ? '—' : `${num(p.loss, 3)} m`,
                p.staticKpa === null ? '—' : `${num(p.staticKpa, 1)} kPa`,
                p.dynamicKpa === null ? '—' : `${num(p.dynamicKpa, 1)} kPa`,
                p.head === null ? el('span', { class: 'services-bad' }, t('services.noSource')) : mark(p.ok),
              ]),
              [1, 2, 3, 4],
            ),
        note('services.waterNote', { min: MIN_DYNAMIC, max: MAX_STATIC }),
      );
    } else if (tab === 'sewer') {
      // The design rain: typed, or a place of NBR 10844's table 5 and a return, which fill it in.
      const rainPremise = (): HTMLElement[] => {
        const s = simSettingsOf(doc);
        const place = RAIN_PLACES.find((p) => p.name === s.rainPlace) ?? null;
        const years: RainReturn = s.rainReturn ?? 5;
        const choose = (name: string, y: RainReturn) => {
          const p = RAIN_PLACES.find((x) => x.name === name);
          const r = p ? rainOf(p, y) : null;
          app.setSimulation({ ...s, rainPlace: name, rainReturn: y, ...(r ? { rain: r.value } : {}) });
        };
        const { rainPlace: _typed, ...typed } = s;
        const got = place ? rainOf(place, years) : null;
        const said = !place ? t('services.rainTypedNote') : got === null ? t('services.rainNone', { place: place.name, years }) : t(got.years === 1 ? 'services.rainFromOne' : 'services.rainFrom', { place: place.name, years: got.years, value: got.value });
        return [
          el(
            'div',
            { class: 'services-rain' },
            el(
              'label',
              { class: 'lot-row' },
              el('span', {}, t('services.rainPlace')),
              searchSelect([{ value: '', label: t('services.rainTyped') }, ...RAIN_PLACES.map((p) => ({ value: p.name, label: p.name }))], s.rainPlace ?? '', (v) => (v === '' ? app.setSimulation(typed) : choose(v, years)), t('services.rainPlace')),
            ),
            el(
              'div',
              { class: 'lot-row' },
              el('span', {}, t('services.rainReturn')),
              segmented(
                ([1, 5, 25] as const).map((y) => ({ value: String(y), label: y === 1 ? t('services.yearOne') : t('services.years', { n: y }) })),
                String(years),
                (v) => (place ? choose(place.name, Number(v) as RainReturn) : app.setSimulation({ ...s, rainReturn: Number(v) as RainReturn })),
              ),
            ),
            el(
              'label',
              { class: 'lot-row' },
              el('span', {}, t('services.rainIntensity')),
              numberField(s.rain ?? DEFAULT_RAIN, (v) => app.setSimulation({ ...typed, rain: Math.max(1, v) }), 1, 0, 'mm/h', 1000),
            ),
          ),
          el('p', { class: 'tour-empty' }, said),
        ];
      };
      // The sewer's stacks and vents (NBR 8160 tables 6 and 2), each with its open end over the roof.
      const stacksBlock = (): HTMLElement[] => {
        const { stacks, vented, fixtures, traps } = sewerStacks(doc, [...(g.kinds.get('roofs')?.values() ?? [])] as RoofSolid[]);
        if (stacks.length === 0 && fixtures === 0) return [];
        const dn = (d: number) => `DN ${Math.round(d * 1000)}`;
        return [
          el('h3', {}, t('services.stacks')),
          ...(stacks.length > 0
            ? [
                table(
                  [t('services.stretch'), t('services.stackKind'), t('services.diameter'), t('services.length'), 'UHC', t('services.neededDn'), t('services.ventGroup'), '', t('services.aboveRoof'), ''],
                  stacks.map((s) => [
                    link(app.reportTitle(s.runIds[0]!), s.runIds[0]!),
                    t(`services.stack.${s.kind}` as MessageKey),
                    `${Math.round(s.diameter * 1000)} mm`,
                    `${num(s.length, 2)} m`,
                    s.uhc > 0 ? num(s.uhc, 0) : '—',
                    s.needed === null ? (s.uhc > 0 ? t('services.pastTables') : '—') : dn(s.needed),
                    // A vent's group of fixtures (table 8): "14 UHC com bacia → DN 50".
                    s.group ? `${t(s.group.toilet ? 'services.groupToilet' : 'services.groupPlain', { uhc: num(s.group.uhc, 0) })} → ${s.group.needed === null ? t('services.pastTables') : dn(s.group.needed)}` : '—',
                    s.uhc > 0 || s.group ? mark(s.sized) : '—',
                    `${num(s.above, 2)} m`,
                    mark(s.through),
                  ]),
                  [2, 3, 4, 5, 8],
                ),
              ]
            : []),
          ...(vented ? [] : [el('p', { class: 'services-bad' }, t('services.noVent'))]),
          note('services.stackNote', { n: doc.levels.length }),
          // Each fixture's trap and how far along the pipes its vent is (table 1).
          ...(traps.length > 0
            ? [
                el('h3', {}, t('services.traps')),
                table(
                  [t('services.trapFixture'), t('services.branchDn'), t('services.toVent'), t('services.trapMost'), '', t('services.ventBy')],
                  traps.map((x) => [
                    link(`${app.reportTitle(x.point.id)} · ${t(`mep.fixture.${x.point.fixture!}` as MessageKey)}`, x.point.id),
                    dn(x.dn),
                    x.distance === null ? t('services.noVentReached') : `${num(x.distance, 2)} m`,
                    `${num(x.most, 2)} m`,
                    mark(x.ok),
                    x.vent === null ? '—' : link(app.reportTitle(stacks[x.vent]!.runIds[0]!), stacks[x.vent]!.runIds[0]!),
                  ]),
                  [1, 2, 3],
                ),
                note('services.trapNote'),
              ]
            : []),
        ];
      };
      // The roofs' eave gutters (NBR 10844 table 3), from their sloped faces, at the design rain.
      const guttersBlock = (): HTMLElement[] => {
        const roofs = [...(g.kinds.get('roofs')?.values() ?? [])] as RoofSolid[];
        const list = gutters(roofs, doc.simulation?.rain ?? DEFAULT_RAIN);
        if (list.length === 0) return [];
        return [
          el('h3', {}, t('services.gutters')),
          table(
            [t('services.gutterFace'), t('services.eaves'), t('services.contribution'), t('services.flow'), t('services.gutterMin')],
            list.map((x) => [
              link(`${app.reportTitle(x.roofId)} · ${t('services.slopeN', { n: x.face })}`, x.roofId),
              `${num(x.eaves, 2)} m`,
              `${num(x.area, 2)} m²`,
              `${num(x.flow, 0)} L/min`,
              x.diameter === null ? t('services.pastTables') : `${Math.round(x.diameter * 1000)} mm`,
            ]),
            [1, 2, 3, 4],
          ),
          note('services.gutterNote', { fall: num(GUTTER_FALL, 1), pipe: Math.round(DOWNPIPE_LEAST * 1000) }),
        ];
      };
      const blocks = (['sewer', 'rain'] as const).map((group) => {
        const f = sewerFalls(doc, group);
        return el(
          'div',
          {},
          el('h3', {}, t(`services.disc.${group}` as MessageKey)),
          // The rain: the design rain the flows take, kept with the simulations' premises.
          ...(group === 'rain' ? rainPremise() : []),
          ...(f.stretches.length === 0 ? [note('services.noStretches')] : []),
          ...(f.stretches.length > 0
            ? [
                table(
                  [t('services.stretch'), t('services.diameter'), t('services.length'), t('services.fall'), t('services.least'), '', group === 'sewer' ? 'UHC' : t('services.flow'), t('services.neededDn'), ''],
                  f.stretches.map((s) => [
                    link(app.reportTitle(s.runId), s.runId),
                    `${Math.round(s.diameter * 1000)} mm`,
                    `${num(s.length, 2)} m`,
                    `${num(s.slope, 2)} %`,
                    `${num(s.least, 1)} %`,
                    mark(s.ok),
                    ...((load: number, text: string) => [load > 0 ? text : '—', s.needed === null ? (load > 0 ? t('services.pastTables') : '—') : `DN ${Math.round(s.needed * 1000)}`, load > 0 ? mark(s.sized) : '—'])(
                      group === 'sewer' ? s.uhc : s.flow,
                      group === 'sewer' ? num(s.uhc, 0) : `${num(s.flow, 0)} L/min`,
                    ),
                  ]),
                  [1, 2, 3, 4, 6, 7],
                ),
              ]
            : []),
          ...(f.stretches.length > 0 && !f.hasOutlet ? [note('services.noOutlet')] : []),
          ...(f.unreached.length > 0 ? [el('p', { class: 'services-bad' }, t('services.drainsLoose', { n: f.unreached.length }))] : []),
          ...(f.unsized.length > 0 ? [el('p', { class: 'services-bad' }, t(group === 'sewer' ? 'services.unsized' : 'services.rainUnsized', { n: f.unsized.length })), el('div', {}, ...f.unsized.map((p) => link(app.reportTitle(p.id), p.id)))] : []),
          ...(group === 'sewer' ? stacksBlock() : guttersBlock()),
        );
      });
      body = el('div', { class: 'budget-scroll' }, ...blocks, note('services.sewerNote'), note('services.uhcNote'), note('services.rainNote'));
    } else if (tab === 'clashes') {
      const c = clashesOf(doc, g);
      body = el(
        'div',
        { class: 'budget-scroll' },
        c.length === 0 ? el('p', { class: 'services-ok' }, t('services.noClash')) : table([t('mep.run'), t('services.through'), t('services.where')], c.map((x) => [link(app.reportTitle(x.runId), x.runId), link(app.reportTitle(x.elementId), x.elementId), `${num(x.at.x, 2)}; ${num(x.at.y, 2)} · ${num(x.z, 2)} m`])),
        note('services.clashNote'),
      );
    } else if (tab === 'structure') {
      const m = analyticModel(g);
      body = el(
        'div',
        { class: 'budget-scroll' },
        m.bars.length === 0
          ? note('services.noStructure')
          : table(
              [t('services.bar'), t('services.barKind'), t('services.length'), t('services.sectionSize')],
              m.bars.map((b) => [link(app.reportTitle(b.id), b.id), t(b.kind === 'column' ? 'column.title' : 'beam.title'), `${num(b.length, 2)} m`, `${num(b.width * 100, 0)} × ${num(b.depth * 100, 0)} cm`]),
              [2, 3],
            ),
        ...(m.warnings.length > 0 ? [el('h3', {}, t('services.warnings', { n: m.warnings.length })), ...m.warnings.map((w) => el('p', { class: 'services-bad' }, link(app.reportTitle(w.elementId), w.elementId), ' ', t(`services.warn.${w.kind}` as MessageKey, { v: num(w.value * 100, 0) })))] : []),
        note('services.structureNote'),
      );
    } else if (tab === 'iso') {
      const groups = [...networksOf(doc).keys()].sort();
      const chooser = select([{ value: 'all', label: t('services.allSystems') }, ...groups.map((x) => ({ value: x, label: t(`services.group.${x}` as MessageKey) }))], isoGroup, (v) => {
        isoGroup = v;
        dialog?.redraw();
      });
      const runs = doc.mepRuns.filter((r) => {
        if (isoGroup === 'all') return true;
        const s = systemsOf(doc).find((x) => x.id === r.systemId);
        return s ? GROUP_OF[s.discipline] === isoGroup : false;
      });
      const box = el('div', { class: 'services-iso' });
      box.innerHTML = isometricSvg(doc, runs);
      const save = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('services.saveSvg'));
      save.addEventListener('click', () => {
        const file = `${app.fileBase()} - ${t('services.tab.iso')}.svg`;
        app.download(file, new Blob([isometricSvg(doc, runs, 1600, 1040)], { type: 'image/svg+xml' }), 'image/svg+xml');
        app.toast(t('image.saved', { file }));
      });
      body = el('div', { class: 'budget-scroll' }, el('div', { class: 'budget-bar' }, chooser, save), runs.length === 0 ? note('services.noRuns') : box);
    } else {
      const w = waterproofing(doc, g);
      body = el(
        'div',
        { class: 'budget-scroll' },
        w.length === 0 ? note('services.noWet') : table([t('memo.room'), t('services.wetFloor'), t('services.wetWalls'), t('budget.total')], w.map((x) => [link(app.reportTitle(x.roomId), x.roomId), `${num(x.floor, 2)} m²`, `${num(x.walls, 2)} m²`, `${num(x.floor + x.walls, 2)} m²`]), [1, 2, 3]),
        note('services.wetNote'),
      );
    }
    const closeBtn = el('button', { type: 'button', class: 'icon-btn text-btn' }, t('help.close'));
    closeBtn.dataset.focus = 'close';
    closeBtn.addEventListener('click', close);
    return el(
      'div',
      { class: 'dialog dialog-xl budget-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('services.title') },
      el('h2', {}, t('services.title')),
      el('div', { class: 'schedule-tabs' }, tabs),
      body,
      el('div', { class: 'actions' }, el('span', { class: 'spacer' }), closeBtn),
    );
  };
  dialog = openProjectDialog(app, render);
  app.shell.helpBack.querySelector<HTMLElement>('[data-focus="close"]')?.focus();
}
