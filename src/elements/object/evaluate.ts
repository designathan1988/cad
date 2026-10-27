// A parametric object evaluated (phase 3): its values (the instance's over its type's over the
// definition's defaults, calculated parameters after), then its parts in the world, repeated and
// conditional by formula, nested definitions inside, each in its material; its handles where they are,
// and its rules' messages. Pure. A formula that fails is a problem the object says, never a thrown error;
// the parts that need it are left out.

import { type Material, materialIn } from '../material/schema';
import { type Env, evaluateFormula, type Value } from './formula';
import type { Expr, HandleDef, MeshData, ObjectDefinition, ObjectInstance, ParamDef, Part, Words } from './schema';

/** A piece in the world: a box (its centre, size and turn) or an upright cylinder (its base's centre); `cut`, a void
 * taken out of the solid pieces. */
export type Piece = { readonly cut?: boolean } & (
  | { readonly kind: 'box'; readonly cx: number; readonly cy: number; readonly z: number; readonly w: number; readonly d: number; readonly h: number; readonly angle: number; readonly material: Material; /** Its edges' radius, 0 square; never more than half its least side. */ readonly round: number; /** Leaning (radians) about its own x and y axes through its base's centre, tilt first (absent: upright); (cx, cy, z) is its base's centre where it is. */ readonly tilt?: number; readonly roll?: number }
  | { readonly kind: 'cylinder'; readonly cx: number; readonly cy: number; readonly z: number; readonly r: number; readonly r2: number; readonly h: number; readonly material: Material; /** Leaning (radians) about its base's centre, tilt about its x then roll about its y, and its turn in plan. */ readonly tilt?: number; readonly roll?: number; readonly angle?: number }
  /** A profile extruded up from z by h: its corners in the world (plan), counter-clockwise. */
  | { readonly kind: 'profile'; readonly cx: number; readonly cy: number; readonly z: number; readonly h: number; readonly points: readonly { readonly x: number; readonly y: number }[]; readonly material: Material }
  /** A profile turned about the vertical through its base's centre: its points (r out, z up from its base). */
  | { readonly kind: 'revolve'; readonly cx: number; readonly cy: number; readonly z: number; readonly h: number; readonly r: number; readonly profile: readonly { readonly r: number; readonly z: number }[]; readonly material: Material }
  /** A rounded mass (an ellipsoid) on its base's centre: r across, h up. */
  | { readonly kind: 'sphere'; readonly cx: number; readonly cy: number; readonly z: number; readonly r: number; readonly h: number; readonly material: Material }
  /** A mesh stretched to its box (centre, size and turn, as a box's). */
  | { readonly kind: 'mesh'; readonly cx: number; readonly cy: number; readonly z: number; readonly w: number; readonly d: number; readonly h: number; readonly angle: number; readonly mesh: MeshData; readonly material: Material });

/** A light in the world: where (z above the level's floor), how many lumens, its colour (#rrggbb). */
export interface PlacedLight {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly lumens: number;
  readonly color: string;
}

export interface PlacedHandle {
  readonly param: string;
  readonly axis: 'x' | 'y' | 'z';
  /** In the world: x, y in plan, z the height above the level's floor. */
  readonly at: { readonly x: number; readonly y: number; readonly z: number };
  /** The axis's direction in the world (z: up), the way that makes the parameter grow. */
  readonly dir: { readonly x: number; readonly y: number; readonly z: number };
  readonly shift: number;
}

export interface ObjectEval {
  /** Every parameter's number (a material: no number; a bool: 1 or 0; a choice: its index). */
  readonly env: Env;
  /** Material parameters' ids. */
  readonly materials: Readonly<Record<string, string>>;
  readonly pieces: readonly Piece[];
  readonly handles: readonly PlacedHandle[];
  /** Formulas that fail and parts left out: said in the panel, in the definition's words. */
  readonly problems: readonly string[];
  /** Its rules' messages that hold now. */
  readonly warnings: readonly Words[];
  /** The lights it gives, its nested objects' too. */
  readonly lights: readonly PlacedLight[];
}

/** Where a definition looks for others (nested parts) and for materials. */
export interface ObjectContext {
  readonly definitions: readonly ObjectDefinition[];
  readonly materials: readonly Material[];
}

const MAX_REPEAT = 500;
const MAX_DEPTH = 4;

type Frame = { readonly x: number; readonly y: number; readonly z: number; readonly angle: number };

const apply = (f: Frame, p: { x: number; y: number; z: number }) => {
  const c = Math.cos(f.angle);
  const s = Math.sin(f.angle);
  return { x: f.x + p.x * c - p.y * s, y: f.y + p.x * s + p.y * c, z: f.z + p.z };
};

/** Each parameter's value: given (instance, then type, then default), held to its range and step. */
function values(def: ObjectDefinition, given: Readonly<Record<string, number | string>>, problems: string[]): { env: Record<string, number>; materials: Record<string, string> } {
  const env: Record<string, number> = {};
  const materials: Record<string, string> = {};
  for (const p of def.params) {
    if (p.formula !== undefined) continue;
    const raw = given[p.name] ?? p.default;
    if (p.kind === 'material') {
      materials[p.name] = typeof raw === 'string' ? raw : String(p.default);
      continue;
    }
    let v = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(v)) {
      problems.push(`${p.name}: not a number`);
      v = typeof p.default === 'number' ? p.default : 0;
    }
    env[p.name] = held(p, v);
  }
  // Calculated parameters, each once its names are known: as many rounds as there are of them.
  const calculated = def.params.filter((p) => p.formula !== undefined);
  let pending = calculated;
  for (let round = 0; round <= calculated.length && pending.length > 0; round++) {
    const next: ParamDef[] = [];
    for (const p of pending) {
      const v = evaluateFormula(p.formula!, env);
      if (v.ok) env[p.name] = p.kind === 'integer' ? Math.round(v.value) : v.value;
      else next.push(p);
    }
    if (next.length === pending.length) break;
    pending = next;
  }
  for (const p of pending) {
    const v = evaluateFormula(p.formula!, env);
    problems.push(`${p.name} = ${p.formula}: ${v.ok ? 'circular' : v.error}`);
    env[p.name] = typeof p.default === 'number' ? p.default : 0;
  }
  return { env, materials };
}

/** The least and greatest length any object takes (m): a millimetre, a building's length. */
export const LENGTH_LIMITS = { min: 0.001, max: 500 } as const;

/**
 * A value as the object takes it, on its step; whole for an integer, 0 or 1 for a yes/no. A length's or a
 * number's range is its usual one, not a lock (a sofa of 5 m, a table of 45 cm are the user's to make):
 * it is held only to what makes sense (a length from 1 mm to 500 m; a number not below 0 when its range
 * starts there), and one outside its range is said (outsideRange). A count (integer, choice) keeps its
 * range: formulas rely on it.
 */
export function held(p: ParamDef, v: number): number {
  let x = v;
  if (p.kind === 'bool') return x !== 0 ? 1 : 0;
  if (p.kind === 'length') x = Math.min(LENGTH_LIMITS.max, Math.max(LENGTH_LIMITS.min, x));
  else if (p.kind === 'number') x = p.min !== undefined && p.min >= 0 ? Math.max(0, x) : x;
  else {
    if (p.min !== undefined) x = Math.max(p.min, x);
    if (p.max !== undefined) x = Math.min(p.max, x);
  }
  if (p.step !== undefined && p.step > 0) x = Math.round(x / p.step) * p.step;
  if (p.kind === 'integer' || p.kind === 'choice') x = Math.round(x);
  return x;
}

export function evaluateObject(def: ObjectDefinition, o: ObjectInstance, c: ObjectContext): ObjectEval {
  const type = def.types.find((t) => t.id === o.typeId) ?? def.types[0];
  return evaluateIn(def, { ...(type?.values ?? {}), ...o.values }, { x: o.at.x, y: o.at.y, z: o.elevation, angle: o.angle }, c, 0);
}

function evaluateIn(def: ObjectDefinition, given: Readonly<Record<string, number | string>>, frame: Frame, c: ObjectContext, depth: number): ObjectEval {
  const problems: string[] = [];
  const { env, materials } = values(def, given, problems);
  const pieces: Piece[] = [];
  const lights: PlacedLight[] = [];
  const num = (e: Expr, at: Env, what: string): number | null => {
    const v: Value = evaluateFormula(e, at);
    if (v.ok) return v.value;
    problems.push(`${what}: ${v.error}`);
    return null;
  };
  const materialOf = (part: Part): Material => {
    const ref = part.material === undefined ? 'plaster' : (materials[part.material] ?? part.material);
    return materialIn(c.materials, ref);
  };
  def.parts.forEach((part, k) => {
    const label = part.name?.en ?? `part ${k + 1}`;
    const count = part.repeat ? num(part.repeat.count, env, `${label} count`) : 1;
    if (count === null) return;
    const n = Math.max(0, Math.min(MAX_REPEAT, Math.floor(count + 1e-9)));
    if (count > MAX_REPEAT) problems.push(`${label}: at most ${MAX_REPEAT} copies`);
    for (let i = 0; i < n; i++) {
      const at: Env = { ...env, i };
      if (part.when !== undefined) {
        const w = num(part.when, at, `${label} condition`);
        if (w === null || w === 0) continue;
      }
      const dx = part.repeat?.dx === undefined ? 0 : (num(part.repeat.dx, at, label) ?? 0);
      const dy = part.repeat?.dy === undefined ? 0 : (num(part.repeat.dy, at, label) ?? 0);
      const dz = part.repeat?.dz === undefined ? 0 : (num(part.repeat.dz, at, label) ?? 0);
      const x = num(part.x, at, `${label} x`);
      const y = num(part.y, at, `${label} y`);
      const z = num(part.z, at, `${label} z`);
      if (x === null || y === null || z === null) continue;
      const ox = x + dx * i;
      const oy = y + dy * i;
      const oz = z + dz * i;
      if (part.kind === 'mesh') {
        const mesh = def.meshes?.find((m) => m.id === part.mesh);
        const w = num(part.w, at, `${label} width`);
        const d = num(part.d, at, `${label} depth`);
        const h = num(part.h, at, `${label} height`);
        if (!mesh) {
          problems.push(`${label}: its mesh ${part.mesh} is not in the object`);
          continue;
        }
        if (w === null || d === null || h === null || w <= 1e-6 || d <= 1e-6 || h <= 1e-6) continue;
        const centre = apply(frame, { x: ox + w / 2, y: oy + d / 2, z: oz });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'mesh', cx: centre.x, cy: centre.y, z: centre.z, w, d, h, angle: frame.angle, mesh, material: materialOf(part) });
      } else if (part.kind === 'box') {
        const w = num(part.w, at, `${label} width`);
        const d = num(part.d, at, `${label} depth`);
        const h = num(part.h, at, `${label} height`);
        if (w === null || d === null || h === null) continue;
        // A box of no size is nothing to draw (a door of a cabinet too narrow for one): left out quietly.
        if (w <= 1e-6 || d <= 1e-6 || h <= 1e-6) continue;
        const round = part.round === undefined ? 0 : (num(part.round, at, `${label} edge radius`) ?? 0);
        const tilt = ((part.tilt === undefined ? 0 : (num(part.tilt, at, `${label} tilt`) ?? 0)) * Math.PI) / 180;
        const roll = ((part.roll === undefined ? 0 : (num(part.roll, at, `${label} roll`) ?? 0)) * Math.PI) / 180;
        // Its base's centre, turned with it: about its base's front edge (tilt), then its left edge (roll).
        const ty = (d / 2) * Math.cos(tilt);
        const tz = -(d / 2) * Math.sin(tilt);
        const rx = (w / 2) * Math.cos(roll) + tz * Math.sin(roll);
        const rz = -(w / 2) * Math.sin(roll) + tz * Math.cos(roll);
        const centre = apply(frame, { x: ox + rx, y: oy + ty, z: oz + rz });
        const leaning = { ...(Math.abs(tilt) > 1e-9 ? { tilt } : {}), ...(Math.abs(roll) > 1e-9 ? { roll } : {}) };
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'box', cx: centre.x, cy: centre.y, z: centre.z, w, d, h, angle: frame.angle, material: materialOf(part), round: Math.max(0, Math.min(round, Math.min(w, d, h) / 2 - 1e-4)), ...leaning });
      } else if (part.kind === 'cylinder') {
        const r = num(part.r, at, `${label} radius`);
        const h = num(part.h, at, `${label} height`);
        const r2 = part.r2 === undefined ? r : num(part.r2, at, `${label} top radius`);
        if (r === null || h === null || r2 === null || h <= 1e-6 || Math.max(r, r2) <= 1e-6) continue;
        const centre = apply(frame, { x: ox, y: oy, z: oz });
        const tilt = ((part.tilt === undefined ? 0 : (num(part.tilt, at, `${label} tilt`) ?? 0)) * Math.PI) / 180;
        const roll = ((part.roll === undefined ? 0 : (num(part.roll, at, `${label} roll`) ?? 0)) * Math.PI) / 180;
        const leaning = Math.abs(tilt) > 1e-9 || Math.abs(roll) > 1e-9 ? { tilt, roll, angle: frame.angle } : {};
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'cylinder', cx: centre.x, cy: centre.y, z: centre.z, r: Math.max(0, r), r2: Math.max(0, r2), h, material: materialOf(part), ...leaning });
      } else if (part.kind === 'revolve') {
        const raw = part.points.map(([pr, pz], k) => ({ r: num(pr, at, `${label} r${k + 1}`), z: num(pz, at, `${label} z${k + 1}`) }));
        if (raw.some((q) => q.r === null || q.z === null)) continue;
        // Its base at the lowest point: z from there; r never below the axis.
        const low = Math.min(...raw.map((q) => q.z!));
        const profile = raw.map((q) => ({ r: Math.max(0, q.r!), z: q.z! - low }));
        const h = Math.max(...profile.map((q) => q.z));
        const r = Math.max(...profile.map((q) => q.r));
        if (h <= 1e-6 || r <= 1e-6) continue;
        const centre = apply(frame, { x: ox, y: oy, z: oz + low });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'revolve', cx: centre.x, cy: centre.y, z: centre.z, h, r, profile, material: materialOf(part) });
      } else if (part.kind === 'profile') {
        const h = num(part.h, at, `${label} height`);
        const local = part.points.map(([px, py], k) => ({ x: num(px, at, `${label} x${k + 1}`), y: num(py, at, `${label} y${k + 1}`) }));
        if (h === null || h <= 1e-6 || local.some((q) => q.x === null || q.y === null)) continue;
        let points = local.map((q) => apply(frame, { x: ox + q.x!, y: oy + q.y!, z: 0 })).map((q) => ({ x: q.x, y: q.y }));
        // Wound counter-clockwise (the extrusion's faces outward), and not a sliver.
        const area = points.reduce((s, q, k) => s + q.x * points[(k + 1) % points.length]!.y - points[(k + 1) % points.length]!.x * q.y, 0) / 2;
        if (Math.abs(area) < 1e-8) continue;
        if (area < 0) points = [...points].reverse();
        const base = apply(frame, { x: ox, y: oy, z: oz });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'profile', cx: base.x, cy: base.y, z: base.z, h, points, material: materialOf(part) });
      } else if (part.kind === 'sphere') {
        const r = num(part.r, at, `${label} radius`);
        const h = num(part.h, at, `${label} height`);
        if (r === null || h === null || h <= 1e-6 || r <= 1e-6) continue;
        const centre = apply(frame, { x: ox, y: oy, z: oz });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'sphere', cx: centre.x, cy: centre.y, z: centre.z, r, h, material: materialOf(part) });
      } else {
        const inner = c.definitions.find((d) => d.id === part.definition);
        if (!inner) {
          problems.push(`${label}: the object ${part.definition} is not in the project`);
          continue;
        }
        if (depth >= MAX_DEPTH) {
          problems.push(`${label}: objects nested too deep (at most ${MAX_DEPTH})`);
          continue;
        }
        const turn = part.angle === undefined ? 0 : (num(part.angle, at, `${label} angle`) ?? 0);
        const childValues: Record<string, number | string> = {};
        for (const [name, e] of Object.entries(part.values ?? {})) {
          // A material passed down by name: the inner material parameter takes this one's material.
          if (typeof e === 'string' && materials[e] !== undefined) childValues[name] = materials[e];
          else {
            const v = num(e, at, `${label} ${name}`);
            if (v !== null) childValues[name] = v;
          }
        }
        const origin = apply(frame, { x: ox, y: oy, z: oz });
        const inside = evaluateIn(inner, childValues, { ...origin, angle: frame.angle + (turn * Math.PI) / 180 }, c, depth + 1);
        pieces.push(...inside.pieces);
        lights.push(...inside.lights);
        problems.push(...inside.problems.map((p) => `${label} › ${p}`));
      }
    }
  });
  const handles = depth === 0 ? def.handles.flatMap((h) => placeHandle(h, env, frame, problems)) : [];
  // A length or a number outside its usual range: said, not changed.
  const outside: Words[] =
    depth === 0
      ? def.params.flatMap((p) => {
          if ((p.kind !== 'length' && p.kind !== 'number') || p.formula !== undefined) return [];
          const v = env[p.name];
          if (v === undefined || ((p.min === undefined || v >= p.min - 1e-9) && (p.max === undefined || v <= p.max + 1e-9))) return [];
          const f = (n: number) => (p.kind === 'length' ? n.toFixed(2).replace('.', ',') : String(n).replace('.', ','));
          const fe = (n: number) => (p.kind === 'length' ? n.toFixed(2) : String(n));
          const range = { pt: `${p.min !== undefined ? f(p.min) : '…'} a ${p.max !== undefined ? f(p.max) : '…'}`, en: `${p.min !== undefined ? fe(p.min) : '…'} to ${p.max !== undefined ? fe(p.max) : '…'}` };
          return [{ pt: `${p.label.pt} fora da faixa usual (${range.pt})`, en: `${p.label.en} outside its usual range (${range.en})` }];
        })
      : [];
  const rules = depth === 0 ? (def.rules ?? []).filter((r) => {
    const v = evaluateFormula(r.when, env);
    if (!v.ok) problems.push(`rule ${r.when}: ${v.error}`);
    return v.ok && v.value !== 0;
  }).map((r) => r.message) : [];
  const warnings = [...outside, ...rules];
  // Its own light, where its formulas put it.
  if (def.light) {
    const l = def.light;
    const [x, y, z, watts, kelvin] = [l.x, l.y, l.z, l.watts, l.kelvin ?? 3000].map((e) => evaluateFormula(e, env));
    if ([x, y, z, watts, kelvin].every((v) => v!.ok)) {
      const [vx, vy, vz, vw, vk] = [x, y, z, watts, kelvin].map((v) => (v as { value: number }).value) as [number, number, number, number, number];
      lights.push({ ...apply(frame, { x: vx, y: vy, z: vz }), lumens: Math.max(0, vw) * 100, color: kelvinColour(vk) });
    } else problems.push('light: a formula fails');
  }
  return { env, materials, pieces, handles, problems, warnings, lights };
}

/** A light's colour from its temperature (K), as a #rrggbb (Tanner Helland's fit, 1000 K to 12000 K). */
export function kelvinColour(k: number): string {
  const t = Math.min(12000, Math.max(1000, k)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const hex = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function placeHandle(h: HandleDef, env: Env, frame: Frame, problems: string[]): PlacedHandle[] {
  const p = h.at.map((e) => evaluateFormula(e, env));
  if (p.some((v) => !v.ok)) {
    problems.push(`handle of ${h.param}: ${p.map((v) => (v.ok ? '' : v.error)).join(' ').trim()}`);
    return [];
  }
  const [x, y, z] = p.map((v) => (v as { value: number }).value) as [number, number, number];
  const sign = h.sign ?? 1;
  const local = h.axis === 'x' ? { x: sign, y: 0, z: 0 } : h.axis === 'y' ? { x: 0, y: sign, z: 0 } : { x: 0, y: 0, z: sign };
  const c = Math.cos(frame.angle);
  const s = Math.sin(frame.angle);
  return [{ param: h.param, axis: h.axis, at: apply(frame, { x, y, z }), dir: { x: local.x * c - local.y * s, y: local.x * s + local.y * c, z: local.z }, shift: h.shift ?? 0 }];
}

/** A piece's outline in plan: a box's four corners, a cylinder's circle as a polygon. */
/** A leaning box's eight corners in the world (z above the level's floor). */
export function boxCorners(p: Extract<Piece, { kind: 'box' }>): { x: number; y: number; z: number }[] {
  const t = p.tilt ?? 0;
  const r = p.roll ?? 0;
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  const out: { x: number; y: number; z: number }[] = [];
  for (const x of [-p.w / 2, p.w / 2])
    for (const y of [-p.d / 2, p.d / 2])
      for (const z of [0, p.h]) {
        // Tilt about its x axis, roll about its y axis, through its base's centre; then its turn in plan.
        const y1 = y * Math.cos(t) + z * Math.sin(t);
        const z1 = -y * Math.sin(t) + z * Math.cos(t);
        const x2 = x * Math.cos(r) + z1 * Math.sin(r);
        const z2 = -x * Math.sin(r) + z1 * Math.cos(r);
        out.push({ x: p.cx + x2 * c - y1 * s, y: p.cy + x2 * s + y1 * c, z: p.z + z2 });
      }
  return out;
}

/** A point of a piece's own axes (x, y across its base's centre, z up its axis) in the world, leaning as it does. */
function leant(p: { cx: number; cy: number; z: number; tilt?: number; roll?: number; angle?: number }, x: number, y: number, z: number): { x: number; y: number; z: number } {
  const t = p.tilt ?? 0;
  const r = p.roll ?? 0;
  const c = Math.cos(p.angle ?? 0);
  const s = Math.sin(p.angle ?? 0);
  const y1 = y * Math.cos(t) + z * Math.sin(t);
  const z1 = -y * Math.sin(t) + z * Math.cos(t);
  const x2 = x * Math.cos(r) + z1 * Math.sin(r);
  const z2 = -x * Math.sin(r) + z1 * Math.cos(r);
  return { x: p.cx + x2 * c - y1 * s, y: p.cy + x2 * s + y1 * c, z: p.z + z2 };
}

/** A leaning cylinder's rims, 16 points each, in the world. */
function cylinderRims(p: Extract<Piece, { kind: 'cylinder' }>): { x: number; y: number; z: number }[] {
  return [0, 1].flatMap((top) => Array.from({ length: 16 }, (_, k) => {
    const a = (k / 16) * 2 * Math.PI;
    const rr = top ? p.r2 : p.r;
    return leant(p, rr * Math.cos(a), rr * Math.sin(a), top ? p.h : 0);
  }));
}

/** The convex hull of points in plan, counter-clockwise (Andrew's monotone chain). */
function hull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const ps = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: { x: number; y: number }[]) => {
    const out: { x: number; y: number }[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 1e-12) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(ps), ...half([...ps].reverse())];
}

/** A piece's lowest and highest point above the level's floor (a leaning box's by its corners). */
export function pieceSpan(p: Piece): { readonly bottom: number; readonly top: number } {
  if ((p.kind === 'box' || p.kind === 'cylinder') && (p.tilt || p.roll)) {
    const zs = (p.kind === 'box' ? boxCorners(p) : cylinderRims(p)).map((q) => q.z);
    return { bottom: Math.min(...zs), top: Math.max(...zs) };
  }
  return { bottom: p.z, top: p.z + p.h };
}

export function pieceOutline(p: Piece): { x: number; y: number }[] {
  if (p.kind === 'box' && (p.tilt || p.roll)) return hull(boxCorners(p));
  if (p.kind === 'cylinder' && (p.tilt || p.roll)) return hull(cylinderRims(p));
  if (p.kind === 'profile') return p.points.map((q) => ({ x: q.x, y: q.y }));
  if (p.kind === 'cylinder' || p.kind === 'sphere' || p.kind === 'revolve') {
    const r = p.kind === 'cylinder' ? Math.max(p.r, p.r2) : p.r;
    return Array.from({ length: 24 }, (_, k) => ({ x: p.cx + r * Math.cos((k / 24) * 2 * Math.PI), y: p.cy + r * Math.sin((k / 24) * 2 * Math.PI) }));
  }
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  if (p.kind === 'mesh') {
    // Its hull, from the unit square to its box.
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i + 1 < p.mesh.outline.length; i += 2) {
      const a = (p.mesh.outline[i]! - 0.5) * p.w;
      const b = (p.mesh.outline[i + 1]! - 0.5) * p.d;
      out.push({ x: p.cx + a * c - b * s, y: p.cy + a * s + b * c });
    }
    return out;
  }
  return [
    [-p.w / 2, -p.d / 2],
    [p.w / 2, -p.d / 2],
    [p.w / 2, p.d / 2],
    [-p.w / 2, p.d / 2],
  ].map(([a, b]) => ({ x: p.cx + a! * c - b! * s, y: p.cy + a! * s + b! * c }));
}
