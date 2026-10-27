// Documents generated from the model (docs/plano-de-escopo.md, phase 12: "relatório de conformidade",
// "quadro de áreas", "memorial"): each an HTML page of its own, plain and printable (A4, black on
// white), that a browser opens, prints or saves as PDF. Built from the document and its geometry, with
// the interface's words; nothing here changes the model.

import { complianceReport, type RuleReport, type RuleStatus } from '../rules/check';
import { packsOf, rulesOf } from '../rules/schema';
import { citation, rangeText, ruleValue } from '../ui/rules-dialog';
import { materialLabel, name, num, t } from '../ui/i18n';
import { approvalOf, progressOf } from '../approval/schema';
import { materialIn } from '../elements/material/schema';
import { referenceLength } from '../elements/opening/derive';
import { cubEstimate } from '../costs/budget';
import { costsOf } from '../costs/schema';
import { type Doc, levelOf } from './document';
import { wallAreas } from './quantities';
import type { DerivedGeometry } from './geometry';
import { lotOf } from './lot';
import { type Cell, SIM_SECTIONS, simBlock } from './sim-tables';
import { type LotReport, lotReport } from './lot-areas';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A whole page: its title, the project's name and the day it was made, then the body. */
export function page(title: string, doc: Doc, body: string, today: string): string {
  const project = doc.name || t('app.untitled');
  return `<!doctype html>
<html lang="${t('doc.lang')}"><head><meta charset="utf-8"><title>${esc(`${title} · ${project}`)}</title>
<style>
@page { size: A4; margin: 18mm 15mm; }
body { font: 10.5pt/1.45 system-ui, sans-serif; color: #111; margin: 0 auto; max-width: 180mm; padding: 8mm 0; }
h1 { font-size: 16pt; margin: 0 0 2mm; } h2 { font-size: 12.5pt; margin: 7mm 0 2mm; } h3 { font-size: 11pt; margin: 5mm 0 1.5mm; }
.meta { color: #444; margin: 0 0 4mm; }
table { border-collapse: collapse; width: 100%; margin: 1mm 0 3mm; }
th, td { border: 0.3mm solid #999; padding: 1mm 1.5mm; text-align: left; vertical-align: top; }
th { background: #eee; } td.n, th.n { text-align: right; white-space: nowrap; }
.ok { color: #1d6b2f; } .fails { color: #a3150b; font-weight: 600; } .unset { color: #8a5a00; } .off, .nothing { color: #666; }
.note { color: #444; font-size: 9pt; }
</style></head><body>
<h1>${esc(title)}</h1>
<p class="meta">${esc(project)} · ${esc(today)}</p>
${body}
</body></html>
`;
}

const STATUS_CLASS: Readonly<Record<RuleStatus, string>> = { ok: 'ok', fails: 'fails', unset: 'unset', off: 'off', nothing: 'nothing' };

/** The lot's lines: where it is, its registry, its zone and the law. */
function lotLines(doc: Doc): string {
  const lot = lotOf(doc);
  const rows: [string, string][] = [
    [t('lot.address'), [lot.address, lot.city, lot.state].filter(Boolean).join(', ')],
    [t('lot.registry'), lot.registry],
    [t('lot.taxNumber'), lot.taxNumber],
    [t('lot.zone'), lot.zone],
    [t('lot.law'), lot.law],
  ];
  return `<table>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v || '—')}</td></tr>`).join('')}</table>`;
}

/** The table of areas: the lot's, each level's, the built total, the projection and the shares. */
export function areasTable(doc: Doc, r: LotReport): string {
  const m2 = (v: number | null) => (v === null ? '—' : `${num(v, 2)} m²`);
  const pct = (v: number | null) => (v === null ? '—' : `${num(v, 2)} %`);
  const lot = lotOf(doc);
  const levels = r.levels.map((l) => `<tr><td>${esc(name(levelOf(doc, l.levelId)?.name ?? ''))}</td><td class="n">${m2(l.built)}</td></tr>`).join('');
  const limit = (v: number | undefined, f: (x: number) => string) => (v === undefined ? '—' : f(v));
  const metres = (v: number | null) => (v === null ? '—' : `${num(v, 2)} m`);
  return `<table><tr><th>${esc(t('areas.level'))}</th><th class="n">${esc(t('areas.built'))}</th></tr>${levels}
<tr><th>${esc(t('areas.total'))}</th><th class="n">${m2(r.built)}</th></tr></table>
<table><tr><th></th><th class="n">${esc(t('areas.measured'))}</th><th class="n">${esc(t('areas.allowed'))}</th></tr>
<tr><td>${esc(t('areas.lot'))}</td><td class="n">${m2(r.lotArea)}</td><td class="n"></td></tr>
<tr><td>${esc(t('areas.projection'))}</td><td class="n">${m2(r.projection)}</td><td class="n"></td></tr>
<tr><td>${esc(t('rules.subject.lotOccupancy'))}</td><td class="n">${pct(r.occupancy)}</td><td class="n">${limit(lot.maxOccupancy, (x) => `≤ ${num(x, 2)} %`)}</td></tr>
<tr><td>${esc(t('rules.subject.lotFloorRatio'))}</td><td class="n">${r.floorRatio === null ? '—' : num(r.floorRatio, 2)}</td><td class="n">${limit(lot.maxFloorRatio, (x) => `≤ ${num(x, 2)}`)}</td></tr>
<tr><td>${esc(t('rules.subject.lotPermeability'))}</td><td class="n">${pct(r.permeability)}</td><td class="n">${limit(lot.minPermeability, (x) => `≥ ${num(x, 2)} %`)}</td></tr>
<tr><td>${esc(t('rules.subject.setbackFront'))}</td><td class="n">${metres(r.setbacks.front)}</td><td class="n">${limit(lot.front, (x) => `≥ ${num(x, 2)} m`)}</td></tr>
<tr><td>${esc(t('rules.subject.setbackSide'))}</td><td class="n">${metres(r.setbacks.side)}</td><td class="n">${limit(lot.side, (x) => `≥ ${num(x, 2)} m`)}</td></tr>
<tr><td>${esc(t('rules.subject.setbackBack'))}</td><td class="n">${metres(r.setbacks.back)}</td><td class="n">${limit(lot.back, (x) => `≥ ${num(x, 2)} m`)}</td></tr>
<tr><td>${esc(t('rules.subject.buildingHeight'))}</td><td class="n">${metres(r.height)}</td><td class="n">${limit(lot.maxHeight, (x) => `≤ ${num(x, 2)} m`)}</td></tr>
</table>
<p class="note">${esc(t('areas.note'))}</p>`;
}

/**
 * The compliance report: the lot, the table of areas, then pack by pack each rule with its citation,
 * what it asks, how many it was checked on, its state, and the elements outside it with their values;
 * first a summary of how many hold, fail (errors and warnings), have no bound yet and are off.
 */
export function complianceHtml(doc: Doc, g: DerivedGeometry, title: (id: string) => string, today: string): string {
  const report = complianceReport(g, rulesOf(doc), doc);
  const count = (s: RuleStatus) => report.filter((r) => r.status === s).length;
  const errors = report.filter((r) => r.status === 'fails' && r.rule.severity === 'error').length;
  const summary = `<p>${esc(t('report.summary', { ok: count('ok'), fails: count('fails'), errors, unset: count('unset'), nothing: count('nothing'), off: count('off') }))}</p>`;
  const row = (r: RuleReport) => {
    const findings = r.findings.map((f) => `${esc(title(f.elementId))}: ${esc(ruleValue(r.rule.subject, f.value))}`).join('<br>');
    return `<tr><td>${esc(t(`rules.subject.${r.rule.subject}`))}${r.rule.uses?.length ? `<br><span class="note">${esc(r.rule.uses.map((u) => t(`use.${u}`)).join(', '))}</span>` : ''}</td>
<td>${esc(citation(r.rule))}</td><td class="n">${esc(rangeText(r.rule.subject, r.min, r.max))}</td><td class="n">${r.checked}</td>
<td class="${STATUS_CLASS[r.status]}">${esc(t(`report.status.${r.status}`))}${r.status === 'fails' ? ` (${esc(t(r.rule.severity === 'error' ? 'rules.error' : 'rules.warning'))})` : ''}</td><td>${findings}</td></tr>`;
  };
  const packs = packsOf(doc);
  const groups = [...packs.map((p) => ({ title: [p.name, p.place, p.version].filter(Boolean).join(' · '), list: report.filter((r) => r.rule.pack === p.id) })), { title: t('rules.ownPack'), list: report.filter((r) => !packs.some((p) => p.id === r.rule.pack)) }];
  const head = `<tr><th>${esc(t('rules.what'))}</th><th>${esc(t('rules.source'))}</th><th class="n">${esc(t('report.asked'))}</th><th class="n">${esc(t('report.checked'))}</th><th>${esc(t('report.state'))}</th><th>${esc(t('report.outside'))}</th></tr>`;
  const tables = groups
    .filter((x) => x.list.length > 0)
    .map((x) => `<h3>${esc(x.title)}</h3><table>${head}${x.list.map(row).join('')}</table>`)
    .join('');
  const body = `${summary}<h2>${esc(t('lot.title'))}</h2>${lotLines(doc)}<h2>${esc(t('areas.title'))}</h2>${areasTable(doc, lotReport(doc, g))}<h2>${esc(t('report.rules'))}</h2>${tables}<p class="note">${esc(t('report.note'))}</p>`;
  return page(t('report.title'), doc, body, today);
}

const m2 = (v: number) => `${num(v, 2)} m²`;
const metres = (v: number) => `${num(v, 2)} m`;
const table = (head: readonly string[], rows: readonly (readonly string[])[], numeric: readonly number[] = []) =>
  `<table><tr>${head.map((h, i) => `<th${numeric.includes(i) ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr>${rows
    .map((r) => `<tr>${r.map((c, i) => `<td${numeric.includes(i) ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`)
    .join('')}</table>`;

/**
 * The descriptive memorial (memorial descritivo): the lot, the table of areas, the wall systems (each
 * type's layers, where it is used, its length and net area), the doors and windows by size, and the
 * rooms level by level with their areas, heights and finishes. All read from the model.
 */
export function memorialHtml(doc: Doc, g: DerivedGeometry, today: string): string {
  const mat = (id: string) => materialLabel(materialIn(doc.materials, id));
  // The wall types in use, each with its layers, its walls' length and net area.
  const walls = doc.wallTypes
    .map((type) => {
      const mine = doc.walls.filter((w) => w.wallTypeId === type.id);
      if (mine.length === 0) return '';
      const length = mine.reduce((s, w) => s + referenceLength(w), 0);
      const net = mine.reduce((s, w) => s + wallAreas(doc, g, w).net, 0);
      const thickness = type.layers.reduce((s, l) => s + l.thickness, 0);
      const layers = table(
        [t('memo.layer'), t('memo.material'), t('memo.thickness')],
        type.layers.map((l) => [t(`fn.${l.function}`), mat(l.materialId), `${num(l.thickness * 100, 1)} cm`]),
        [2],
      );
      return `<h3>${esc(name(type.name))}</h3><p>${esc(t('memo.wallUse', { n: mine.length, length: metres(length), area: m2(net), thickness: `${num(thickness * 100, 1)} cm` }))}</p>${layers}`;
    })
    .join('');
  // Doors and windows by kind and size.
  const groups = new Map<string, { kind: string; w: number; h: number; sill: number; n: number }>();
  for (const o of doc.openings) {
    const key = `${o.kind}/${o.width}/${o.height}/${o.kind === 'window' ? o.sill : 0}`;
    const g0 = groups.get(key) ?? { kind: o.kind, w: o.width, h: o.height, sill: o.kind === 'window' ? o.sill : 0, n: 0 };
    groups.set(key, { ...g0, n: g0.n + 1 });
  }
  const openings = table(
    [t('memo.kind'), t('memo.size'), t('memo.sill'), t('memo.count')],
    [...groups.values()]
      .sort((a, b) => a.kind.localeCompare(b.kind) || b.w * b.h - a.w * a.h)
      .map((x) => [t(x.kind === 'door' ? 'memo.door' : 'memo.window'), `${num(x.w, 2)} × ${num(x.h, 2)} m`, x.kind === 'window' ? metres(x.sill) : '—', String(x.n)]),
    [3],
  );
  // The rooms, level by level.
  const rooms = [...doc.levels]
    .sort((a, b) => a.elevation - b.elevation)
    .map((level) => {
      const list = doc.rooms.filter((r) => r.levelId === level.id);
      if (list.length === 0) return '';
      const rows = list.map((r) => {
        const s = g.rooms.get(r.id);
        const f = r.finishes;
        return [
          `${r.number} · ${name(r.name)}`,
          r.use ? t(`use.${r.use}`) : '',
          s?.enclosed ? m2(s.area) : '—',
          metres(r.height ?? level.height),
          f?.floor ? mat(f.floor) : '—',
          f?.wall ? mat(f.wall) : '—',
          f?.ceiling ? mat(f.ceiling) : '—',
        ];
      });
      return `<h3>${esc(name(level.name))}</h3>${table([t('memo.room'), t('memo.use'), t('memo.area'), t('memo.height'), t('memo.floor'), t('memo.wallFinish'), t('memo.ceiling')], rows, [2, 3])}`;
    })
    .join('');
  const body = `<h2>1. ${esc(t('lot.title'))}</h2>${lotLines(doc)}
<h2>2. ${esc(t('areas.title'))}</h2>${areasTable(doc, lotReport(doc, g))}
<h2>3. ${esc(t('memo.walls'))}</h2>${walls || `<p>${esc(t('memo.none'))}</p>`}
<h2>4. ${esc(t('memo.openings'))}</h2>${groups.size > 0 ? openings : `<p>${esc(t('memo.none'))}</p>`}
<h2>5. ${esc(t('memo.rooms'))}</h2>${rooms || `<p>${esc(t('memo.none'))}</p>`}
<p class="note">${esc(t('memo.note'))}</p>`;
  return page(t('memo.title'), doc, body, today);
}

/** The table of areas on its own page, with the lot. */
export function areasHtml(doc: Doc, g: DerivedGeometry, today: string): string {
  return page(t('areas.title'), doc, `<h2>${esc(t('lot.title'))}</h2>${lotLines(doc)}<h2>${esc(t('areas.title'))}</h2>${areasTable(doc, lotReport(doc, g))}`, today);
}

/** The CUB estimate on a page: the standard, the month, the area, the value, the estimate, the source. */
export function cubHtml(doc: Doc, g: DerivedGeometry, today: string): string {
  const { cub } = costsOf(doc);
  const e = cubEstimate(doc, g);
  const money = (v: number) => `R$ ${num(v, 2)}`;
  const rows = [
    [t('budget.cubStandard'), cub.standard],
    [t('budget.cubState'), cub.state],
    [t('budget.cubMonth'), cub.month],
    [t('budget.cubDesonerado'), t(cub.desonerado ? 'memo.yes' : 'memo.no')],
    [t('budget.cubArea'), m2(e.area)],
    [t('budget.cubValue'), `${money(e.value)}/m²`],
    [t('budget.cubTotal'), money(e.total)],
    [t('budget.cubSource'), cub.source],
  ];
  return page(t('budget.tab.cub'), doc, `${table(['', ''], rows)}<p class="note">${esc(t('budget.cubIntro'))}</p>`, today);
}

/** The approval journey: step by step its documents, who issues each, its state and note; the steps' estimates. */
export function approvalHtml(doc: Doc, today: string): string {
  const a = approvalOf(doc);
  const p = progressOf(a);
  const steps = a.steps
    .map((s, i) => {
      const est = [s.days !== undefined ? t('approval.days', { n: s.days }) : '', s.cost !== undefined ? `R$ ${num(s.cost, 2)}` : ''].filter(Boolean).join(' · ');
      return `<h3>${i + 1}. ${esc(s.name)}${est ? ` <span class="note">(${esc(est)})</span>` : ''}</h3>${table(
        [t('approval.doc'), t('approval.issuer'), t('approval.state'), t('approval.note')],
        s.docs.map((d) => [d.name, d.issuer, t(`approval.state.${d.state}`), d.note ?? '']),
      )}`;
    })
    .join('');
  const summary = `<p>${esc(a.city)} · ${esc(t('approval.progress', { done: p.done, all: p.all }))}${p.days || p.cost ? ` · ${esc(t('approval.estimates', { days: p.days, cost: num(p.cost, 2) }))}` : ''}</p>`;
  return page(t('approval.title'), doc, summary + steps, today);
}

/**
 * The simulations' report: each simulation's tables and its premises, as the dialog shows them (app/
 * sim-tables.ts), under a warning that all of it is an estimate.
 */
export function simulationHtml(doc: Doc, g: DerivedGeometry, title: (id: string) => string, today: string): string {
  const text = (c: Cell) => (typeof c === 'string' ? c : c.text);
  const body = SIM_SECTIONS.map((section) => {
    const b = simBlock(section, doc, g, title);
    const tables = b.tables.map((x) => `${x.title ? `<h3>${esc(x.title)}</h3>` : ''}${table(x.head, x.rows.map((r) => r.map(text)), x.numeric)}`).join('');
    const empty = b.tables.length === 0 && b.empty ? `<p>${esc(b.empty)}</p>` : '';
    return `<h2>${esc(t(`sim.tab.${section}`))}</h2>${empty}${tables}${b.premises.map((p) => `<p class="note">${esc(p)}</p>`).join('')}`;
  }).join('');
  return page(t('sim.title'), doc, `<p class="note">${esc(t('sim.reportIntro'))}</p>${body}`, today);
}
