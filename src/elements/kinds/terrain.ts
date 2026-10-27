// The terrain in the registry (contract.ts): elements/terrain holds the element and builds its surface.
// Drawn in plan under everything: its outline dashed, its contour lines (every fifth heavier, with its
// height), its spot heights marked; in 3D a surface in a ground colour; in the IFC a terrain.

import * as THREE from 'three';
import type { Point2 } from '../../core/vector';
import { num, t } from '../../ui/i18n';
import type { ElementKind, PlanPaint } from '../contract';
import type { Material } from '../material/schema';
import { insideRing } from '../room/derive';
import { deriveTerrain, type TerrainSolid } from '../terrain/derive';
import { earthworksOf } from '../terrain/earthworks';
import { isTerrain, type Terrain, TERRAIN_PREFIX } from '../terrain/schema';

/** The ground's colour in 3D. */
const GRASS: Material = { id: 'terrain', name: '', color: '#8ea86a', roughness: 0.95, metalness: 0, cut: 'solid' };

const setTerrains = (ids: readonly string[], change: (t: Terrain) => Terrain, label: string) => ({
  label,
  apply: (doc: import('../../app/document').Doc) => {
    let changed = false;
    const terrains = doc.terrains.map((x) => {
      if (!ids.includes(x.id)) return x;
      const next = change(x);
      if (!isTerrain(next) || JSON.stringify(next) === JSON.stringify(x)) return x;
      changed = true;
      return next;
    });
    return changed ? { ...doc, terrains } : doc;
  },
});

export const terrainKind: ElementKind<Terrain, TerrainSolid> = {
  key: 'terrains',
  prefix: TERRAIN_PREFIX,
  category: null,
  layer: 'under',
  icon: 'map',
  one: 'terrain.title',
  many: 'terrain.titleMany',
  hint: 'terrain.held',
  dropped: 'fix.droppedTerrains',
  exportName: 'terrain.title',
  exportColour: 'floor',
  valid: (x): x is Terrain => isTerrain(x),
  memo: 'element',
  derive: (_doc, x) => deriveTerrain(x),
  element: (s) => s.terrain,
  outlines: (s) => [s.terrain.outline],
  hit: (s, p) => insideRing(s.terrain.outline, p),
  pick: 'last',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (x, d) => ({ ...x, outline: x.outline.map((p) => ({ x: p.x + d.x, y: p.y + d.y })), spots: x.spots.map((s) => ({ ...s, x: s.x + d.x, y: s.y + d.y })) }),
  mapped: (x, tr, id) => {
    const outline = x.outline.map(tr.map);
    return { ...x, id, outline: tr.mirror ? [...outline].reverse() : outline, spots: x.spots.map((s) => ({ ...tr.map(s), z: s.z })) };
  },
  plan: (p, s, lit) => drawTerrain(p, s, lit),
  solid: (s) => {
    const pos = new Float32Array(s.tris.length * 9);
    s.tris.forEach((r, i) => {
      for (let k = 0; k < 3; k++) {
        // Plan (x, y, z) to three.js (x, z, −y).
        pos[i * 9 + k * 3] = r[k * 3]!;
        pos[i * 9 + k * 3 + 1] = r[k * 3 + 2]!;
        pos[i * 9 + k * 3 + 2] = -r[k * 3 + 1]!;
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.computeVertexNormals();
    // A hair under its heights: where the ground floor's slab stands on it, the slab shows, not both.
    return { geometry, y: -0.005, material: GRASS, edges: false };
  },
  dxfLayers: [{ name: 'C-TOPO', colour: 3 }],
  dxf: (s, out) => {
    out.polyline('C-TOPO', s.terrain.outline, true);
    for (const c of s.contours) for (const [a, b] of c.segments) out.line('C-TOPO', a, b);
    for (const sp of s.terrain.spots) out.text('C-TOPO', sp, 0.15, num(sp.z, 2));
  },
  fields: (items, { dispatch, addSpot, outlineTerrain, doc, geometry }) => {
    const ids = items.map((s) => s.terrain.id);
    const one = items.length === 1 ? items[0]! : null;
    // Cut and fill under the lowest level's footprint (terrain/earthworks.ts): the model's, not one terrain's.
    const earth = geometry ? earthworksOf(doc, geometry) : null;
    return [
      { id: 'spots', label: 'terrain.spots', kind: 'readout', text: (xs) => (xs.length === 1 ? String(xs[0]!.terrain.spots.length) : '—') },
      {
        id: 'range',
        label: 'terrain.range',
        kind: 'readout',
        text: (xs) => (xs.length === 1 ? `${num(xs[0]!.bottom, 2)} … ${num(xs[0]!.top, 2)} m` : '—'),
      },
      ...(earth
        ? ([
            { id: 'cut', label: 'terrain.cut', kind: 'readout', text: () => `${num(earth.cut, 2)} m³` },
            { id: 'fill', label: 'terrain.fill', kind: 'readout', text: () => `${num(earth.fill, 2)} m³` },
          ] as const)
        : []),
      { id: 'interval', label: 'terrain.interval', kind: 'number', min: 0.05, get: (s) => s.terrain.interval, set: (v) => dispatch(setTerrains(ids, (x) => ({ ...x, interval: v }), 'cmd.updateTerrain')) },
      ...(one && addSpot ? [{ id: 'addSpot', label: 'terrain.addSpot', kind: 'action', run: () => addSpot(one.terrain.id) } as const] : []),
      ...(one && outlineTerrain ? [{ id: 'outline', label: 'terrain.outline', kind: 'action', run: () => outlineTerrain(one.terrain.id) } as const] : []),
      {
        id: 'dropSpot',
        label: 'terrain.dropSpot',
        kind: 'action',
        enabled: (xs) => xs.some((s) => s.terrain.spots.length > 0),
        run: () => dispatch(setTerrains(ids, (x) => ({ ...x, spots: x.spots.slice(0, -1) }), 'cmd.updateTerrain')),
      },
    ];
  },
};

/** The terrain in plan: dashed outline, contour lines (each fifth heavier, its height on it), spot heights. */
export function drawTerrain(p: PlanPaint, s: TerrainSolid, lit: boolean): void {
  const { ctx } = p;
  const colour = lit ? p.color('--wall-sel') : p.color('--text-2');
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.lineWidth = p.pen('fine');
  ctx.setLineDash([8, 4]);
  ctx.beginPath();
  s.terrain.outline.forEach((q, i) => {
    const v = p.toScreen(q);
    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.7;
  const major = s.terrain.interval * 5;
  for (const c of s.contours) {
    const heavy = Math.abs(c.z / major - Math.round(c.z / major)) < 1e-6;
    ctx.lineWidth = heavy ? p.pen('seen') : p.pen('fine');
    ctx.beginPath();
    for (const [a, b] of c.segments) {
      const u = p.toScreen(a);
      const v = p.toScreen(b);
      ctx.moveTo(u.x, u.y);
      ctx.lineTo(v.x, v.y);
    }
    ctx.stroke();
    if (heavy && c.segments.length > 0) {
      const mid = c.segments[Math.floor(c.segments.length / 2)]!;
      const at = p.toScreen({ x: (mid[0].x + mid[1].x) / 2, y: (mid[0].y + mid[1].y) / 2 });
      ctx.font = p.font('400', '--fs-xs');
      ctx.fillStyle = colour;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num(c.z, 1), at.x, at.y);
    }
  }
  ctx.globalAlpha = 1;
  // Spot heights: a cross and the height beside it.
  ctx.font = p.font('600', '--fs-xs');
  ctx.fillStyle = colour;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = p.pen('annotation');
  for (const sp of s.terrain.spots) {
    const v: Point2 = p.toScreen(sp);
    ctx.beginPath();
    ctx.moveTo(v.x - 4, v.y - 4);
    ctx.lineTo(v.x + 4, v.y + 4);
    ctx.moveTo(v.x + 4, v.y - 4);
    ctx.lineTo(v.x - 4, v.y + 4);
    ctx.stroke();
    ctx.fillText(t('terrain.spotAt', { z: num(sp.z, 2) }), v.x + 6, v.y);
  }
  ctx.restore();
}
