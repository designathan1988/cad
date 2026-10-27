// Documents generated from the model (docs/plano-de-escopo.md, phase 12: "relatório de conformidade",
// "quadro de áreas", "memorial"): each an HTML page of its own, plain and printable (A4, black on
// white), that a browser opens, prints or saves as PDF. Built from the document and its geometry, with
// the interface's words; nothing here changes the model.

import { complianceReport, type RuleReport, type RuleStatus } from '../rules/check';
import { packsOf, rulesOf } from '../rules/schema';
import { citation, rangeText, ruleValue } from '../ui/rules-dialog';
import { name, num, t } from '../ui/i18n';
import { type Doc, levelOf } from './document';
import type { DerivedGeometry } from './geometry';
import { lotOf } from './lot';
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
