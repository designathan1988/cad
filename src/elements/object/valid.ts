// What a file may hold of parametric objects (phase 3), checked as it is read: a definition with the
// shape of one (its formulas are checked when evaluated, and a failing one is said, not refused), and an
// instance with a place, a turn and values. Pure guards.

import { finite, isObject, isPoint } from '../../core/guards';
import type { ObjectDefinition, ObjectInstance, Part, Words } from './schema';

const isWords = (w: unknown): w is Words => isObject(w) && typeof w.pt === 'string' && typeof w.en === 'string';
const isExpr = (e: unknown): boolean => (typeof e === 'number' && Number.isFinite(e)) || typeof e === 'string';
const PARAM_KINDS = ['length', 'number', 'integer', 'bool', 'choice', 'material'];

/**
 * A handle: its parameter, axis and point, a shift between 0 and 1 and a sign of ±1. A shift of "x" made a drag
 * NaN for the object's position, and the instance was then refused when the file was opened again.
 */
const isHandle = (h: unknown): boolean =>
  isObject(h) &&
  typeof h.param === 'string' &&
  ['x', 'y', 'z'].includes(h.axis as string) &&
  Array.isArray(h.at) &&
  h.at.length === 3 &&
  h.at.every(isExpr) &&
  (h.shift === undefined || (finite(h.shift) && h.shift >= 0 && h.shift <= 1)) &&
  (h.sign === undefined || h.sign === 1 || h.sign === -1);

function isPart(p: unknown): p is Part {
  if (!isObject(p) || !isExpr(p.x) || !isExpr(p.y) || !isExpr(p.z)) return false;
  if (p.when !== undefined && typeof p.when !== 'string') return false;
  if (p.material !== undefined && typeof p.material !== 'string') return false;
  if (p.repeat !== undefined && !(isObject(p.repeat) && isExpr(p.repeat.count))) return false;
  if (p.cut !== undefined && typeof p.cut !== 'boolean') return false;
  if (p.kind === 'box') return isExpr(p.w) && isExpr(p.d) && isExpr(p.h) && (p.round === undefined || isExpr(p.round)) && (p.tilt === undefined || isExpr(p.tilt)) && (p.roll === undefined || isExpr(p.roll)) && (p.turn === undefined || isExpr(p.turn));
  if (p.kind === 'cylinder') return (p.tilt === undefined || isExpr(p.tilt)) && (p.roll === undefined || isExpr(p.roll)) && (p.turn === undefined || isExpr(p.turn)) && isExpr(p.r) && isExpr(p.h) && (p.r2 === undefined || isExpr(p.r2));
  if (p.kind === 'sphere') return isExpr(p.r) && isExpr(p.h) && [p.d, p.tilt, p.roll, p.turn].every((e) => e === undefined || isExpr(e));
  if (p.kind === 'revolve') return Array.isArray(p.points) && p.points.length >= 2 && p.points.every((q) => Array.isArray(q) && q.length === 2 && isExpr(q[0]) && isExpr(q[1]));
  if (p.kind === 'profile') return Array.isArray(p.points) && p.points.length >= 3 && p.points.every((q) => Array.isArray(q) && q.length === 2 && isExpr(q[0]) && isExpr(q[1])) && isExpr(p.h);
  if (p.kind === 'object') return typeof p.definition === 'string' && (p.values === undefined || isObject(p.values));
  if (p.kind === 'mesh') return typeof p.mesh === 'string' && isExpr(p.w) && isExpr(p.d) && isExpr(p.h);
  return false;
}

/** A mesh: coordinates in the unit box, triangles of its vertices, a closed outline. */
function isMesh(m: unknown): boolean {
  if (!isObject(m) || typeof m.id !== 'string' || !Array.isArray(m.positions) || !Array.isArray(m.indices) || !Array.isArray(m.outline)) return false;
  const n = m.positions.length / 3;
  return (
    m.positions.length % 3 === 0 &&
    m.positions.every((v) => finite(v) && v >= -1e-6 && v <= 1 + 1e-6) &&
    m.indices.length % 3 === 0 &&
    m.indices.every((i) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < n) &&
    m.outline.length % 2 === 0 &&
    m.outline.every(finite)
  );
}

export function isDefinition(d: unknown): d is ObjectDefinition {
  return (
    isObject(d) &&
    typeof d.id === 'string' &&
    isWords(d.name) &&
    typeof d.category === 'string' &&
    (d.folder === undefined || typeof d.folder === 'string') &&
    Array.isArray(d.params) &&
    d.params.every((p) => isObject(p) && typeof p.name === 'string' && /^[A-Za-z_À-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ]*$/.test(p.name) && isWords(p.label) && PARAM_KINDS.includes(p.kind as string) && (typeof p.default === 'number' || typeof p.default === 'string')) &&
    Array.isArray(d.parts) &&
    d.parts.every(isPart) &&
    Array.isArray(d.handles) &&
    d.handles.every(isHandle) &&
    Array.isArray(d.types) &&
    d.types.length > 0 &&
    d.types.every((t) => isObject(t) && typeof t.id === 'string' && isWords(t.name) && isObject(t.values)) &&
    (d.rules === undefined || (Array.isArray(d.rules) && d.rules.every((r) => isObject(r) && typeof r.when === 'string' && isWords(r.message)))) &&
    (d.light === undefined || (isObject(d.light) && isExpr(d.light.x) && isExpr(d.light.y) && isExpr(d.light.z) && isExpr(d.light.watts) && (d.light.kelvin === undefined || isExpr(d.light.kelvin)))) &&
    (d.meshes === undefined || (Array.isArray(d.meshes) && d.meshes.every(isMesh))) &&
    // A mesh part draws a mesh of its own definition's.
    d.parts.every((p) => p.kind !== 'mesh' || (Array.isArray(d.meshes) && d.meshes.some((m) => isObject(m) && m.id === p.mesh)))
  );
}

export function isObjectInstance(o: unknown): o is ObjectInstance {
  return (
    isObject(o) &&
    typeof o.id === 'string' &&
    typeof o.levelId === 'string' &&
    typeof o.definitionId === 'string' &&
    typeof o.typeId === 'string' &&
    isPoint(o.at) &&
    finite(o.angle) &&
    finite(o.elevation) &&
    isObject(o.values) &&
    Object.values(o.values).every((v) => (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'string')
  );
}
