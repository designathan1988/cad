// Beams in the registry (contract.ts): elements/beam holds the element itself.

import * as THREE from 'three';
import { finite, isObject, isPoint } from '../../core/guards';
import { updateBeams } from '../beam/commands';
import { beamFields } from '../beam/fields';
import { type Beam, BEAM_PREFIX, beamOutline } from '../beam/schema';
import type { ElementKind } from '../contract';
import { insideRing } from '../room/derive';
import { nearSegment, throughElement, trace } from './paint';

export interface BeamSolid {
  readonly beam: Beam;
  readonly outline: readonly { x: number; y: number }[];
  readonly bottom: number;
  readonly top: number;
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
    (b.topOffset === undefined || finite(b.topOffset)),
  // Hanging from its level's top (plus its adjustment), its depth down.
  derive: (doc, b) => {
    const level = doc.levels.find((l) => l.id === b.levelId) ?? { elevation: 0, height: 2.8 };
    const top = level.elevation + level.height + (b.topOffset ?? 0);
    return { beam: b, outline: beamOutline(b), bottom: top - b.depth, top };
  },
  element: (s) => s.beam,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || nearSegment(p, s.beam.start, s.beam.end, near),
  // Above the walls in plan: a click aims at what is under it first.
  pick: 'afterWalls',
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
    ctx.lineWidth = lit ? 2 : 1;
    ctx.stroke();
    ctx.restore();
  },
  solid: (s) => {
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(s.outline.map((v) => new THREE.Vector2(v.x, v.y))), { depth: s.top - s.bottom, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    return { geometry, y: s.bottom, material: 'side', edges: true };
  },
  dxfLayers: [{ name: 'S-BEAM', colour: 8 }],
  dxf: (s, out) => out.polyline('S-BEAM', s.outline, true),
  fields: (items, { dispatch }) => throughElement(beamFields(items.map((s) => s.beam), { updateBeams: (ids, patch) => dispatch(updateBeams(ids, patch)) }), (s: BeamSolid) => s.beam),
};
