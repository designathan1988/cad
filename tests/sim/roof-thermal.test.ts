// A roof's thermal behaviour against NBR 15220-3's table D.4 (its 2003 project text, LabEEE/UFSC): clay
// tile 1 cm alone, U 4,55 and φ 0,3 h; with a 3 cm concrete ceiling under an attic, U 2,24.

import { describe, expect, it } from 'vitest';
import { BUILT_IN_MATERIALS } from '../../src/elements/material/schema';
import { ROOF_COVERING } from '../../src/elements/roof/schema';
import { impactOf, roofThermalOf, zoneRoof } from '../../src/sim/envelope';
import { type Doc, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { simBlock } from '../../src/app/sim-tables';
import { num, t } from '../../src/ui/i18n';

describe('roof thermal (NBR 15220-2, flow down; NBR 15220-3 table C.2)', () => {
  it('a clay tile with no ceiling is 4,55 W/m²K and 0,3 h, as table D.4', () => {
    const r = roofThermalOf(ROOF_COVERING, null, BUILT_IN_MATERIALS, 3);
    expect(r.transmittance!).toBeCloseTo(4.55, 1);
    expect(r.lag!).toBeCloseTo(0.3, 1);
    // Zone 3 asks a light insulated roof: U ≤ 2,00, which a bare tile is far from.
    expect(r.u).toBe(false);
  });

  it('with a 3 cm concrete ceiling under the attic, 2,24 W/m²K, as table D.4', () => {
    const r = roofThermalOf(ROOF_COVERING, [{ materialId: 'concrete', thickness: 0.03 }], BUILT_IN_MATERIALS, 3);
    expect(r.transmittance!).toBeCloseTo(2.24, 2);
    expect(r.capacity!).toBeGreaterThan(70);
  });

  it('the zones ask: 1 to 6 light insulated, 7 heavy, 8 light reflective', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(zoneRoof)).toEqual(['lightInsulated', 'lightInsulated', 'lightInsulated', 'lightInsulated', 'lightInsulated', 'lightInsulated', 'heavy', 'lightReflective']);
  });

  it('Simulations › Thermal lists each roof: a bare tile fails zone 3; with a ceiling of 3 cm concrete U falls to 2,24', () => {
    const base = newDocument();
    const roof = { id: 'roof_1', levelId: 'lvl_ground', outline: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 }], edges: [0, 1, 2, 3].map((i) => ({ grade: i % 2 === 0 ? 30 : null, overhang: 0.3 })), kind: 'gable' as const, thickness: 0.12, baseOffset: 0 };
    const doc: Doc = { ...base, roofs: [roof] };
    const table = (d: Doc) => simBlock('thermal', d, deriveGeometry(d), (id) => id).tables.find((x) => x.head.includes(t('sim.ceiling')));
    const bare = table(doc)!;
    expect(bare.rows).toHaveLength(1);
    expect(bare.rows[0]![3]).toMatchObject({ text: `${num(4.56, 2)} W/m²K`, ok: false });
    const ceiling = { id: 'floor_c', levelId: 'lvl_ground', source: { kind: 'outline' as const, points: roof.outline }, thickness: 0.03, offset: 2.6, kind: 'ceiling' as const, layers: [{ materialId: 'concrete', thickness: 0.03 }] };
    const under = table({ ...doc, floors: [ceiling as never] })!;
    expect(under.rows[0]![3]).toMatchObject({ text: `${num(2.24, 2)} W/m²K` });
  });

  it('a material with no physics leaves the results waiting, said', () => {
    const r = roofThermalOf({ materialId: 'nope', thickness: 0.01 }, null, BUILT_IN_MATERIALS, 3);
    expect(r.transmittance).toBeNull();
    expect(r.missing).toEqual(['nope']);
  });

  it('impact sound of a floor: Ln,w = 164 − 35·log m″ in 100–600 kg/m², against NBR 15575-3', () => {
    // 15 cm of concrete (2300 kg/m³): 345 kg/m², 75 dB, the minimum level.
    const slab = impactOf([{ materialId: 'concrete', thickness: 0.15 }], BUILT_IN_MATERIALS);
    expect(slab.mass!).toBeCloseTo(345, 6);
    expect(slab.lnw!).toBeCloseTo(164 - 35 * Math.log10(345), 9);
    expect(slab.level).toBe('minimum');
    // 25 cm: 575 kg/m², 67 dB, still the minimum; 4 cm, 92 kg/m², outside the expression.
    expect(impactOf([{ materialId: 'concrete', thickness: 0.25 }], BUILT_IN_MATERIALS).level).toBe('minimum');
    expect(impactOf([{ materialId: 'concrete', thickness: 0.04 }], BUILT_IN_MATERIALS).lnw).toBeNull();
  });
});
