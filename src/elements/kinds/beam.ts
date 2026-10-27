// Beams in the registry (contract.ts): elements/beam holds the element itself.

import * as THREE from 'three';
import { finite, isObject, isPoint } from '../../core/guards';
import { updateBeams } from '../beam/commands';
import { beamFields } from '../beam/fields';
import { type Beam, BEAM_PREFIX, beamOutline, beamSection } from '../beam/schema';
import type { ElementKind } from '../contract';
import { insideRing } from '../room/derive';
import { nearSegment, throughElement, trace } from './paint';

export interface BeamSolid {
  readonly beam: Beam;
  readonly outline: readonly { x: number; y: number }[];
  readonly bottom: number;
  readonly top: number;
  /** Its top at its start and at its end (m). */
  readonly startTop: number;
  readonly endTop: number;
}

/**
 * A section (across, up from the top) swept along a straight axis whose top goes from z0 to z1: its
 * sides and its two end caps, in three.js coordinates (x, height, −y).
 */
function sweep(section: readonly [number, number][], start: { x: number; y: number }, end: { x: number; y: number }, z0: number, z1: number): THREE.BufferGeometry {
  const l = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const n = { x: -(end.y - start.y) / l, y: (end.x - start.x) / l };
  const at = (p: { x: number; y: number }, z: number, [a, u]: [number, number]) => [p.x + n.x * a, z + u, -(p.y + n.y * a)] as const;
  const pos: number[] = [];
  const m = section.length;
  for (let i = 0; i < m; i++) {
    const s0 = section[i]!;
    const s1 = section[(i + 1) % m]!;
    const a0 = at(start, z0, s0);
    const b0 = at(start, z0, s1);
    const a1 = at(end, z1, s0);
    const b1 = at(end, z1, s1);
    pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
  }
  const tris = THREE.ShapeUtils.triangulateShape(section.map(([a, u]) => new THREE.Vector2(a, u)), []);
  for (const tri of tris) {
    const [i, j, k] = tri as [number, number, number];
    pos.push(...at(start, z0, section[i]!), ...at(start, z0, section[k]!), ...at(start, z0, section[j]!));
    pos.push(...at(end, z1, section[i]!), ...at(end, z1, section[j]!), ...at(end, z1, section[k]!));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export const beamKind: ElementKind<Beam, BeamSolid> = {
  key: 'beams',
  prefix: BEAM_PREFIX,
  category: 'walls',
  icon: 'beam',
  one: 'beam.title',
  many: 'beam.titleMany',
  dropped: 'fix.droppedBeams',
  exportName: 'export.beam',
  exportColour: 'structure',
  valid: (b): b is Beam =>
    isObject(b) &&
    typeof b.id === 'string' &&
    typeof b.levelId === 'string' &&
    isPoint(b.start) &&
    isPoint(b.end) &&
    JSON.stringify(b.start) !== JSON.stringify(b.end) &&
    finite(b.width) &&
    b.width > 0 &&
    finite(b.depth) &&
    b.depth > 0 &&
    (b.topOffset === undefined || finite(b.topOffset)) &&
    (b.endOffset === undefined || finite(b.endOffset)) &&
    (b.shape === undefined || b.shape === 'rect' || b.shape === 'I') &&
    (b.plate === undefined || (finite(b.plate) && b.plate > 0)),
  // Hanging from its level's top (plus its adjustment), its depth down; sloping when its end's top differs.
  memo: 'level',
  derive: (doc, b) => {
    const level = doc.levels.find((l) => l.id === b.levelId) ?? { elevation: 0, height: 2.8 };
    const ceiling = level.elevation + level.height;
    const startTop = ceiling + (b.topOffset ?? 0);
    const endTop = ceiling + (b.endOffset ?? b.topOffset ?? 0);
    return { beam: b, outline: beamOutline(b), bottom: Math.min(startTop, endTop) - b.depth, top: Math.max(startTop, endTop), startTop, endTop };
  },
  element: (s) => s.beam,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || nearSegment(p, s.beam.start, s.beam.end, near),
  // Above the walls in plan: a click aims at what is under it first.
  pick: 'afterWalls',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (b, d) => ({ ...b, start: { x: b.start.x + d.x, y: b.start.y + d.y }, end: { x: b.end.x + d.x, y: b.end.y + d.y } }),
  mapped: (b, t, id) => ({ ...b, id, start: t.map(b.start), end: t.map(b.end), width: b.width * t.factor }),
  onGrid: (b, onLine) => onLine(b.start) && onLine(b.end),
  similar: (a, b) => Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.depth - b.depth) < 1e-6,
  // Above the cut: dashed, as hidden lines are.
  plan: (p, s, lit) => {
    const { ctx } = p;
    ctx.save();
    ctx.setLineDash([6, 4]);
    trace(p, s.outline);
    if (lit) {
      ctx.fillStyle = p.color('--wall-sel-fill');
      ctx.fill();
    }
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--text-2');
    ctx.lineWidth = p.pen('fine') * (lit ? 2 : 1);
    ctx.stroke();
    ctx.restore();
  },
  // Its section swept from its start to its end, each end at its own top.
  solid: (s) => ({ geometry: sweep(beamSection(s.beam), s.beam.start, s.beam.end, s.startTop, s.endTop), y: 0, material: 'side', edges: true }),
  dxfLayers: [{ name: 'S-BEAM', colour: 8 }],
  dxf: (s, out) => out.polyline('S-BEAM', s.outline, true),
  fields: (items, { dispatch }) => throughElement(beamFields(items.map((s) => s.beam), { updateBeams: (ids, patch) => dispatch(updateBeams(ids, patch)) }), (s: BeamSolid) => s.beam),
};
