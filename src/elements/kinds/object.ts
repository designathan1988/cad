// Parametric objects in the registry (contract.ts, phase 3): the instance and its definition evaluated
// (elements/object/evaluate.ts) into pieces; the plan draws each piece's outline from the lowest up (a
// table's top over its legs), the 3D each piece in its material, the GLB the same. Kept from one
// derivation to the next while the object, its level, the definitions and the materials are the same.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Doc } from '../../app/document';
import { insideRing } from '../room/derive';
import type { BaseGeometry, ElementKind, KindSolid } from '../contract';
import { heightAt } from '../terrain/schema';
import { evaluateObject, type ObjectEval, type Piece, pieceOutline } from '../object/evaluate';
import { type ObjectItem, objectFields, words } from '../object/fields';
import { isObjectInstance } from '../object/valid';
import { OBJECT_PREFIX, type ObjectDefinition, type ObjectInstance } from '../object/schema';
import { nearSegment, trace } from './paint';
import { t } from '../../ui/i18n';

export interface ObjectSolid extends ObjectItem {
  /** Each piece's outline in plan, lowest first. */
  readonly rings: readonly (readonly { x: number; y: number }[])[];
  /** The box around them all, turned with the object. */
  readonly outline: readonly { x: number; y: number }[];
  /** Its level's floor, and its lowest and highest points (m). */
  readonly floor: number;
  readonly bottom: number;
  readonly top: number;
}

const kept = new WeakMap<ObjectInstance, { defs: readonly ObjectDefinition[]; mats: Doc['materials']; level: unknown; ground: number | null; s: ObjectSolid | null }>();

/**
 * What an object stands on out of doors: the terrain of its level under it (its height there), when it
 * is in no enclosed room and on no floor drawn by its outline; null indoors or off every terrain, where
 * it stands on its level's floor. A tree, a car, a bench placed on a slope sits on it as it would.
 */
export function groundUnder(doc: Doc, g: BaseGeometry, levelId: string, at: { x: number; y: number }): number | null {
  const terrain = doc.terrains.find((t) => t.levelId === levelId && insideRing(t.outline, at));
  if (!terrain) return null;
  for (const r of g.rooms.values()) if (r.room.levelId === levelId && r.enclosed && insideRing(r.outline, at)) return null;
  for (const f of doc.floors) if (f.levelId === levelId && f.source.kind === 'outline' && insideRing(f.source.points, at)) return null;
  return heightAt(terrain.spots, at);
}

function derive(doc: Doc, o: ObjectInstance, g: BaseGeometry): ObjectSolid | null {
  const level = doc.levels.find((l) => l.id === o.levelId);
  // Out of doors on a terrain: its height there is the object's floor (absolute, as the terrain's).
  const ground = level ? groundUnder(doc, g, o.levelId, o.at) : null;
  const hit = kept.get(o);
  if (hit && hit.defs === doc.definitions && hit.mats === doc.materials && hit.level === level && hit.ground === ground) return hit.s;
  const def = doc.definitions.find((d) => d.id === o.definitionId);
  const s = def && level ? build(o, def, evaluateObject(def, o, { definitions: doc.definitions, materials: doc.materials }), ground ?? level.elevation) : null;
  kept.set(o, { defs: doc.definitions, mats: doc.materials, level, ground, s });
  return s;
}

function build(object: ObjectInstance, def: ObjectDefinition, ev: ObjectEval, floor: number): ObjectSolid {
  const pieces = [...ev.pieces].sort((a, b) => a.z + a.h - (b.z + b.h));
  const rings = pieces.map(pieceOutline);
  // The box around the pieces in the object's own axes, turned back into the plan.
  const c = Math.cos(object.angle);
  const s = Math.sin(object.angle);
  const local = rings.flat().map((p) => ({ u: (p.x - object.at.x) * c + (p.y - object.at.y) * s, v: -(p.x - object.at.x) * s + (p.y - object.at.y) * c }));
  const u0 = local.length ? Math.min(...local.map((p) => p.u)) : -0.1;
  const u1 = local.length ? Math.max(...local.map((p) => p.u)) : 0.1;
  const v0 = local.length ? Math.min(...local.map((p) => p.v)) : -0.1;
  const v1 = local.length ? Math.max(...local.map((p) => p.v)) : 0.1;
  const outline = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ].map(([u, v]) => ({ x: object.at.x + u! * c - v! * s, y: object.at.y + u! * s + v! * c }));
  const bottom = floor + (pieces.length ? Math.min(...pieces.map((p) => p.z)) : object.elevation);
  const top = floor + (pieces.length ? Math.max(...pieces.map((p) => p.z + p.h)) : object.elevation + 0.1);
  return { object, def, eval: ev, rings, outline, floor, bottom, top };
}

/** A piece's geometry where it is, in three.js's axes: plan x, y and height z are x, −z and y; a turn in
 * plan (counter-clockwise) is one about y. For the 3D, the GLB and the definition editor alike. */
export function pieceGeometry(piece: Piece): THREE.BufferGeometry {
  const geometry =
    piece.kind === 'mesh'
      ? meshGeometry(piece)
      : piece.kind === 'box'
        ? piece.round > 1e-4
          ? new RoundedBoxGeometry(piece.w, piece.h, piece.d, 3, piece.round)
          : new THREE.BoxGeometry(piece.w, piece.h, piece.d)
        : piece.kind === 'sphere'
          ? new THREE.SphereGeometry(1, 28, 18).scale(piece.r, piece.h / 2, piece.r)
          : new THREE.CylinderGeometry(piece.r2, piece.r, piece.h, 24);
  if (piece.kind === 'box' || piece.kind === 'mesh') geometry.rotateY(piece.angle);
  geometry.translate(piece.cx, piece.z + piece.h / 2, -piece.cy);
  return geometry;
}

/** A mesh piece's geometry about its box's centre, in three.js's axes (x, height, −y), not yet turned. */
function meshGeometry(p: Extract<Piece, { kind: 'mesh' }>): THREE.BufferGeometry {
  const src = p.mesh.positions;
  const pos = new Float32Array(src.length);
  for (let i = 0; i + 2 < src.length; i += 3) {
    pos[i] = (src[i]! - 0.5) * p.w;
    pos[i + 1] = (src[i + 2]! - 0.5) * p.h;
    pos[i + 2] = -(src[i + 1]! - 0.5) * p.d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex([...p.mesh.indices]);
  g.computeVertexNormals();
  return g;
}

export const objectKind: ElementKind<ObjectInstance, ObjectSolid> = {
  key: 'objects',
  prefix: OBJECT_PREFIX,
  category: 'objects',
  icon: 'box',
  one: 'object.title',
  many: 'object.titleMany',
  title: (items) => ({ icon: 'box', text: items.length === 1 ? `${words(items[0]!.def.name)} · ${words(items[0]!.def.types.find((x) => x.id === items[0]!.object.typeId)?.name ?? items[0]!.def.name)}` : t('object.titleMany', { n: items.length }) }),
  warning: (items) => {
    const said = items.flatMap((i) => [...i.eval.warnings.map(words), ...i.eval.problems.map((p) => t('object.problem', { text: p }))]);
    return said.length ? [...new Set(said)].join(' · ') : null;
  },
  dropped: 'fix.droppedObjects',
  exportName: 'export.object',
  exportColour: 'structure',
  valid: isObjectInstance,
  derive: (doc, o, g) => derive(doc, o, g),
  element: (s) => s.object,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || s.outline.some((v, i) => nearSegment(p, v, s.outline[(i + 1) % s.outline.length]!, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (o, d) => ({ ...o, at: { x: o.at.x + d.x, y: o.at.y + d.y } }),
  // It turns with a turn and a mirror: its x is taken by the transform. Its size stays its parameters'.
  mapped: (o, tr, id) => {
    const at = tr.map(o.at);
    const x = tr.map({ x: o.at.x + Math.cos(o.angle), y: o.at.y + Math.sin(o.angle) });
    return { ...o, id, at, angle: Math.atan2(x.y - at.y, x.x - at.x) };
  },
  similar: (a, b) => a.definitionId === b.definitionId && a.typeId === b.typeId,
  // Each piece from the lowest up, filled with the drawing's colour so the higher hides the lower (the
  // top over the legs), outlined thin; the object's box when selected.
  plan: (p, s, lit) => {
    // At 1:200 and smaller the furniture is left out (drawing/schema.ts, detailOf); selected, it shows.
    if (p.detail === 'coarse' && !lit) return;
    const line = lit ? p.color('--wall-sel') : p.color('--text-2');
    for (const ring of s.rings) {
      trace(p, ring);
      p.ctx.fillStyle = lit ? p.color('--wall-sel-fill') : p.color('--furniture');
      p.ctx.fill();
      p.ctx.strokeStyle = line;
      p.ctx.lineWidth = p.pen('fine');
      p.ctx.stroke();
    }
    if (lit) {
      trace(p, s.outline);
      p.ctx.setLineDash([4, 3]);
      p.ctx.strokeStyle = line;
      p.ctx.stroke();
      p.ctx.setLineDash([]);
    }
  },
  solid: (s) =>
    s.eval.pieces.map((piece, i): KindSolid => {
      const geometry = pieceGeometry(piece);
      // Its lights go with its first piece (a luminaire's: contract.ts, lights).
      return { geometry, y: s.floor, material: piece.material, edges: true, ...(i === 0 && s.eval.lights.length > 0 ? { lights: s.eval.lights } : {}) };
    }),
  dxfLayers: [{ name: 'A-FURN', colour: 8 }],
  dxf: (s, out) => {
    for (const ring of s.rings) out.polyline('A-FURN', ring, true);
  },
  fields: (items, { dispatch, doc }) => objectFields(items, doc, dispatch),
};
