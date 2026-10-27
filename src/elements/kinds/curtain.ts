// Curtain walls in the registry (contract.ts): elements/curtain holds the element and its frame.

import * as THREE from 'three';
import { finite, isObject, isPoint } from '../../core/guards';
import type { ElementKind, KindSolid } from '../contract';
import { updateCurtains } from '../curtain/commands';
import { curtainFields } from '../curtain/fields';
import { type CurtainBox, type CurtainSolid, curtainSolid } from '../curtain/geometry';
import { type Curtain, CURTAIN_PREFIX, isGridRule } from '../curtain/schema';
import { type Material, materialIn } from '../material/schema';
import { insideRing } from '../room/derive';
import { nearSegment, trace } from './paint';

/** As built, with the materials its frame and panels are of. */
export interface CurtainBuilt extends CurtainSolid {
  readonly frameMaterial: Material;
  readonly panelMaterial: Material;
}

/** Boxes as one geometry, in three.js coordinates (x, height, −y), from height 0. */
function boxes(list: readonly CurtainBox[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const v = (p: { x: number; y: number }, z: number) => [p.x, z, -p.y] as const;
  for (const b of list) {
    const q = b.polygon;
    const tri = (a: readonly number[], c: readonly number[], d: readonly number[]) => pos.push(...a, ...c, ...d);
    tri(v(q[0]!, b.top), v(q[1]!, b.top), v(q[2]!, b.top));
    tri(v(q[0]!, b.top), v(q[2]!, b.top), v(q[3]!, b.top));
    tri(v(q[0]!, b.bottom), v(q[2]!, b.bottom), v(q[1]!, b.bottom));
    tri(v(q[0]!, b.bottom), v(q[3]!, b.bottom), v(q[2]!, b.bottom));
    for (let i = 0; i < 4; i++) {
      const a = q[i]!;
      const c = q[(i + 1) % 4]!;
      tri(v(a, b.bottom), v(c, b.bottom), v(c, b.top));
      tri(v(a, b.bottom), v(c, b.top), v(a, b.top));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const curtainKind: ElementKind<Curtain, CurtainBuilt> = {
  key: 'curtains',
  prefix: CURTAIN_PREFIX,
  category: 'walls',
  icon: 'window',
  one: 'curtain.title',
  many: 'curtain.titleMany',
  dropped: 'fix.droppedCurtains',
  exportName: 'export.curtain',
  exportColour: 'structure',
  valid: (c): c is Curtain =>
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.levelId === 'string' &&
    isPoint(c.start) &&
    isPoint(c.end) &&
    JSON.stringify(c.start) !== JSON.stringify(c.end) &&
    finite(c.baseOffset) &&
    (c.height === undefined || (finite(c.height) && c.height > 0)) &&
    isGridRule(c.vertical) &&
    isGridRule(c.horizontal) &&
    finite(c.mullion) &&
    c.mullion > 0 &&
    finite(c.depth) &&
    c.depth > 0 &&
    (c.panel === 'glass' || c.panel === 'opaque'),
  memo: 'level',
  derive: (doc, c) => {
    const level = doc.levels.find((l) => l.id === c.levelId) ?? { elevation: 0, height: 2.8 };
    return {
      ...curtainSolid(c, level.height, level.elevation),
      frameMaterial: materialIn(doc.materials, 'metal'),
      panelMaterial: materialIn(doc.materials, c.panel === 'glass' ? 'glass' : 'plaster'),
    };
  },
  element: (s) => s.curtain,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || nearSegment(p, s.curtain.start, s.curtain.end, near),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (c, d) => ({ ...c, start: { x: c.start.x + d.x, y: c.start.y + d.y }, end: { x: c.end.x + d.x, y: c.end.y + d.y } }),
  mapped: (c, t, id) => ({ ...c, id, start: t.map(c.start), end: t.map(c.end) }),
  onGrid: (c, onLine) => onLine(c.start) && onLine(c.end),
  similar: (a, b) => JSON.stringify([a.vertical, a.horizontal, a.mullion, a.depth, a.panel]) === JSON.stringify([b.vertical, b.horizontal, b.mullion, b.depth, b.panel]),
  // Cut: its two faces thin, the glass line along its middle, a mullion at each vertical line.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    trace(p, s.outline);
    ctx.fillStyle = lit ? p.color('--wall-sel-fill') : p.color('--canvas');
    ctx.fill();
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    ctx.lineWidth = lit ? 1.5 : 1;
    ctx.stroke();
    trace(p, [s.curtain.start, s.curtain.end], false);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    for (const b of s.frame) if (b.top - b.bottom > s.top - s.bottom - 1e-6) {
      trace(p, b.polygon);
      ctx.fill();
    }
    ctx.restore();
  },
  solid: (s): KindSolid[] => [
    { geometry: boxes(s.frame), y: 0, material: s.frameMaterial, edges: true },
    { geometry: boxes(s.panels), y: 0, material: s.panelMaterial, edges: false },
  ],
  dxfLayers: [{ name: 'A-GLAZ-CWMG', colour: 5 }],
  dxf: (s, out) => {
    out.polyline('A-GLAZ-CWMG', s.outline, true);
    for (const b of s.frame) if (b.top - b.bottom > s.top - s.bottom - 1e-6) out.polyline('A-GLAZ-CWMG', b.polygon, true);
  },
  fields: (items, { dispatch }) => curtainFields(items, { updateCurtains: (ids, patch) => dispatch(updateCurtains(ids, patch)) }),
};
