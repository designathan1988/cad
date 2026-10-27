// Costs (phase 12): a price base read from XLSX or CSV whatever its title lines, the budget's lines tied
// to the model's quantities, the office's prices over the base's, BDI, ABC curve, schedule, CUB.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { layerQuantities } from '../../src/app/quantities';
import { abcOf, budgetOf, cubEstimate, linesFromModel, scheduleOf, searchBase } from '../../src/costs/budget';
import { breakdownOf } from '../../src/costs/breakdown';
import { findColumns, guessFromName, itemsFromRows, readNumber } from '../../src/costs/price-base';
import { type Costs, DEFAULT_COSTS } from '../../src/costs/schema';
import { newOpening } from '../../src/elements/opening/schema';
import { readCsv, readXlsx } from '../../src/io/xlsx';

/** A ZIP of these files, stored or deflated (the reader does not check the CRC: it is left 0). */
async function zip(files: Record<string, string>, deflate: boolean): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text);
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw;
    const n = enc.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, deflate ? 8 : 0, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, n.length, true);
    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(10, deflate ? 8 : 0, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, raw.length, true);
    dir.setUint16(28, n.length, true);
    dir.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), n, data);
    central.push(new Uint8Array(dir.buffer), n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, a) => s + a.length, 0));
  let at = 0;
  for (const a of all) (out.set(a, at), (at += a.length));
  return out;
}

// A sheet laid out as SINAPI's: title lines, then the header, then the items (one a group title).
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c><c r="D3" t="s"><v>4</v></c></row>
<row r="4"><c r="A4" t="s"><v>5</v></c></row>
<row r="5"><c r="A5"><v>103325</v></c><c r="B5" t="inlineStr"><is><t>ALVENARIA DE VEDA&#199;&#195;O 14X19X39</t></is></c><c r="C5" t="s"><v>6</v></c><c r="D5"><v>86.37</v></c></row>
<row r="6"><c r="A6"><v>87905</v></c><c r="B6" t="inlineStr"><is><t>CHAPISCO</t></is></c><c r="C6" t="s"><v>6</v></c><c r="D6"><v>9.1</v></c></row>
</sheetData></worksheet>`;
const STRINGS = `<sst>${['SINAPI - CUSTO DE COMPOSIÇÕES - SP', 'CÓDIGO DA COMPOSIÇÃO', 'DESCRIÇÃO DA COMPOSIÇÃO', 'UNIDADE', 'CUSTO TOTAL', 'ALVENARIAS', 'M2'].map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`;

describe('price bases', () => {
  for (const deflate of [false, true])
    it(`an XLSX's first sheet as rows (${deflate ? 'deflated' : 'stored'}), its header found under its title`, async () => {
      const bytes = await zip({ 'xl/sharedStrings.xml': STRINGS, 'xl/worksheets/sheet1.xml': SHEET }, deflate);
      const rows = await readXlsx(bytes);
      expect(rows[2]).toEqual(['CÓDIGO DA COMPOSIÇÃO', 'DESCRIÇÃO DA COMPOSIÇÃO', 'UNIDADE', 'CUSTO TOTAL']);
      const r = itemsFromRows(rows)!;
      expect(r.items).toEqual([
        { code: '103325', description: 'ALVENARIA DE VEDAÇÃO 14X19X39', unit: 'M2', price: 86.37 },
        { code: '87905', description: 'CHAPISCO', unit: 'M2', price: 9.1 },
      ]);
      // The group title line has a code-less row: skipped.
      expect(r.skipped).toBe(1);
    });

  it('a CSV as a Portuguese spreadsheet writes it', () => {
    const rows = readCsv('﻿Código;Descrição;Unid;Preço\r\n100;"Porta; madeira";un;1.234,50\r\n');
    expect(rows).toEqual([
      ['Código', 'Descrição', 'Unid', 'Preço'],
      ['100', 'Porta; madeira', 'un', '1.234,50'],
    ]);
    expect(itemsFromRows(rows)!.items[0]!.price).toBe(1234.5);
    expect(findColumns([['nothing', 'here']])).toBeNull();
  });

  it('numbers and file names read', () => {
    expect(readNumber('R$ 2.686,65')).toBe(2686.65);
    expect(readNumber('86.37')).toBe(86.37);
    expect(readNumber('')).toBeNull();
    expect(guessFromName('SINAPI_Custo_Ref_Composicoes_Sintetico_SP_202608_NaoDesonerado.xlsx')).toEqual({ state: 'SP', month: '2026-08', desonerado: false });
    expect(searchBase([{ code: '103325', description: 'ALVENARIA DE VEDAÇÃO', unit: 'M2', price: 1 }], 'vedacao alv')).toHaveLength(1);
  });
});

const wall = (id: string, a: [number, number], b: [number, number]): DocWall => ({
  id,
  wallTypeId: 'wt_masonry15',
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

const house: Doc = {
  ...newDocument(),
  walls: [wall('s', [0, 0], [6, 0]), wall('e', [6, 0], [6, 4]), wall('n', [6, 4], [0, 4]), wall('w', [0, 4], [0, 0])],
  openings: [newOpening('d', 's', 'door', { kind: 'centered' }, { width: 0.8, height: 2.1 }), newOpening('j', 'n', 'window', { kind: 'centered' }, { width: 1.2, height: 1, sill: 1 })],
  rooms: [{ id: 'r', levelId: 'lvl_ground', seed: { x: 3, y: 2 }, name: 'Sala', number: '1', finishes: { floor: 'tile' } }],
};
const say = { item: (k: string) => k, material: (id: string) => id };

describe('the budget', () => {
  const g = deriveGeometry(house);
  const lines = linesFromModel(house, g, say);

  it('lines from the model, each tied to its quantity', () => {
    expect(lines.map((l) => [l.quantity.of, l.quantity.material ?? '', l.unit])).toEqual([
      ['faceExterior', 'plaster', 'm²'],
      ['masonry', 'brick', 'm²'],
      ['mortar', 'brick', 'm³'],
      ['faceInterior', 'plaster', 'm²'],
      ['floor', 'tile', 'm²'],
      ['doors', '', 'un'],
      ['windows', '', 'm²'],
    ]);
  });

  it('priced from the base, the office\'s price over it; BDI, other costs, unpriced lines left out', () => {
    // Every wall's masonry: the sum of their net areas.
    const net = layerQuantities(house, g)
      .filter((q) => q.mortar !== null)
      .reduce((s, q) => s + q.area, 0);
    const [ext, masonry, , , floor, doors] = lines;
    const costs: Costs = {
      ...DEFAULT_COSTS,
      base: { name: 'SINAPI', state: 'SP', month: '2026-08', desonerado: false, items: [{ code: '103325', description: 'Alvenaria', unit: 'M2', price: 86.37 }, { code: '87905', description: 'Chapisco', unit: 'M2', price: 9.1 }] },
      own: [{ code: '87905', description: 'Chapisco (nosso)', unit: 'M2', price: 8 }],
      lines: [{ ...masonry!, code: '103325' }, { ...ext!, code: '87905' }, { ...doors!, price: 750 }, floor!],
      bdi: 20,
      extras: [{ id: 'x', name: 'Alvará', value: 1000 }],
    };
    const b = budgetOf({ ...house, costs }, g);
    expect(b.rows[0]!.quantity).toBeCloseTo(net, 9);
    expect(b.rows[0]!.price).toEqual({ price: 86.37, from: 'base' });
    expect(b.rows[1]!.price).toEqual({ price: 8, from: 'own' });
    expect(b.rows[2]!.total).toBe(750);
    expect(b.rows[3]!.total).toBeNull();
    expect(b.unpriced).toBe(1);
    const direct = net * 86.37 + b.rows[1]!.quantity * 8 + 750;
    expect(b.direct).toBeCloseTo(direct, 6);
    expect(b.total).toBeCloseTo(direct * 1.2 + 1000, 6);
    // ABC: the masonry is A; the shares add to 100 %.
    const abc = abcOf(b);
    expect(abc[0]!.row.line.code).toBe('103325');
    expect(abc[0]!.cls).toBe('A');
    expect(abc.at(-1)!.cumulative).toBeCloseTo(100, 9);
    // The schedule: the masonry's stage over its two months, with the BDI; the months add to the lines' total with BDI.
    const s = scheduleOf({ ...house, costs }, b);
    const masonryStage = s.rows.find((r) => r.stage.id === 'stage_masonry')!;
    expect(masonryStage.months[0]).toBeCloseTo((net * 86.37 * 1.2) / 2, 6);
    expect(s.cumulative.at(-1)).toBeCloseTo(direct * 1.2, 6);
    // By element: the walls and the door carry it all, each wall its share; nothing left unshared.
    const d = breakdownOf({ ...house, costs }, g, b);
    expect([...d.byElement.values()].reduce((x, y) => x + y, 0) + d.unshared).toBeCloseTo(direct, 6);
    expect(d.unshared).toBe(0);
    expect(d.byElement.get('d')).toBeCloseTo(750, 9);
    expect(['s', 'e', 'n', 'w'].every((id) => (d.byElement.get(id) ?? 0) > 0)).toBe(true);
  });

  it('the CUB estimate: the built area times the CUB', () => {
    const e = cubEstimate(house, g);
    expect(e.area).toBeCloseTo(6.15 * 4.15, 6);
    expect(e.total).toBeCloseTo(6.15 * 4.15 * 2686.65, 4);
  });
});

describe('the services in the budget', () => {
  // A conduit from a panel up, across 4 m and down to a socket; and a cold pipe of 2 m.
  const mep: Doc = {
    ...newDocument(),
    mepPoints: [
      { id: 'mepPoint_qd', levelId: 'lvl_ground', at: { x: 0, y: 0 }, height: 1.5, kind: 'panel', systemId: 'sys_power' },
      { id: 'mepPoint_t', levelId: 'lvl_ground', at: { x: 4, y: 0 }, height: 0.3, kind: 'socket', systemId: 'sys_power' },
    ],
    mepRuns: [
      { id: 'mepRun_e', levelId: 'lvl_ground', systemId: 'sys_power', kind: 'conduit', diameter: 0.025, points: [{ x: 0, y: 0, z: 1.5 }, { x: 0, y: 0, z: 2.7 }, { x: 4, y: 0, z: 2.7 }, { x: 4, y: 0, z: 0.3 }] },
      { id: 'mepRun_a', levelId: 'lvl_ground', systemId: 'sys_cold', kind: 'pipe', diameter: 0.025, points: [{ x: 0, y: 2, z: 2.7 }, { x: 2, y: 2, z: 2.7 }] },
    ],
  };
  const g = deriveGeometry(mep);

  it('a line per run system and diameter, per point kind, per fitting; measured in space, in their own stage', () => {
    const lines = linesFromModel(mep, g, { item: (k: string) => k, material: (id: string) => id });
    const runs = lines.filter((l) => l.quantity.of === 'runs');
    expect(runs.map((l) => [l.quantity.item, l.unit, l.stage])).toEqual([
      ['sys_power@0.025', 'm', 'stage_services'],
      ['sys_cold@0.025', 'm', 'stage_services'],
    ]);
    expect(lines.filter((l) => l.quantity.of === 'points').map((l) => l.quantity.item)).toEqual(['panel', 'socket']);
    // The conduit turns twice: two 90° elbows of 25 mm.
    expect(lines.filter((l) => l.quantity.of === 'fittings').map((l) => l.quantity.item)).toEqual(['electric|elbow90@0.025']);
    const priced: Doc = { ...mep, costs: { ...DEFAULT_COSTS, lines: runs.map((l) => ({ ...l, price: 10 })) } };
    const b = budgetOf(priced, g);
    expect(b.rows[0]!.quantity).toBeCloseTo(1.2 + 4 + 2.4, 9);
    expect(b.rows[1]!.quantity).toBeCloseTo(2, 9);
    // Shared among the runs by their length.
    const d = breakdownOf(priced, g, b);
    expect(d.byElement.get('mepRun_e')).toBeCloseTo(76, 9);
    expect(d.byElement.get('mepRun_a')).toBeCloseTo(20, 9);
  });

  it('a budget from before the services stage puts them in the general one', () => {
    const old: Doc = { ...mep, costs: { ...DEFAULT_COSTS, stages: DEFAULT_COSTS.stages.filter((s) => s.id !== 'stage_services') } };
    expect(new Set(linesFromModel(old, g, { item: (k: string) => k, material: (id: string) => id }).filter((l) => l.quantity.of === 'runs').map((l) => l.stage))).toEqual(new Set(['stage_general']));
  });
});
