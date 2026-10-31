// A parametric object evaluated (phase 3): its values (the instance's over its type's over the
// definition's defaults, calculated parameters after), then its parts in the world, repeated and
// conditional by formula, nested definitions inside, each in its material; its handles where they are,
// and its rules' messages. Pure. A formula that fails is a problem the object says, never a thrown error;
// the parts that need it are left out.

import { type Material, materialIn } from '../material/schema';
import { type Env, evaluateFormula, type Value } from './formula';
import type { Expr, HandleDef, MeshData, ObjectDefinition, ObjectInstance, ParamDef, Part, Words } from './schema';
import { pieceSpan } from './piece-shape';
import { held, kelvinColour } from './param-limits';

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
  | { readonly kind: 'sphere'; readonly cx: number; readonly cy: number; readonly z: number; readonly r: number; readonly h: number; readonly material: Material; /** Its radius along its own y (an ellipsoid), r when absent; its leaning and turn as a cylinder's. */ readonly ry?: number; readonly tilt?: number; readonly roll?: number; readonly angle?: number }
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
  /** Parts that should be there (their condition holds) left out for having no size, its nested objects' too. */
  readonly lost: number;
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
    env[p.name] = held(p, v, def);
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

/**
 * An object as it stands. A length made smaller than its type's so far that parts of the object vanish
 * (a bed so low its headboard has no height left, a cabinet too narrow for its doors) is held at the least
 * at which the object keeps every part its type has, to the millimetre, and the panel says so: the object
 * never comes apart, however small the number typed or the handle dragged.
 */
export function evaluateObject(def: ObjectDefinition, o: ObjectInstance, c: ObjectContext): ObjectEval {
  const type = def.types.find((t) => t.id === o.typeId) ?? def.types[0];
  const typeValues = type?.values ?? {};
  const frame = { x: o.at.x, y: o.at.y, z: o.elevation, angle: o.angle };
  const given = { ...typeValues, ...o.values };
  const ev = evaluateIn(def, given, frame, c, 0);
  // Its lowest point above its own floor (a part pushed under it: the object folding up).
  const lowest = (e: ObjectEval) => Math.min(0, ...e.pieces.filter((p) => !p.cut).map((p) => pieceSpan(p).bottom - frame.z));
  if (ev.lost === 0 && ev.problems.length === 0 && lowest(ev) > -0.005) return ev;
  // Whole: no more parts lost, nor formulas failing (a spacing so small its count runs away), nor parts
  // under the floor, than its type.
  const typical = evaluateIn(def, typeValues, frame, c, 0);
  const floor = Math.min(-0.005, lowest(typical) - 0.005);
  const isWhole = (e: ObjectEval) => e.lost <= typical.lost && e.problems.length <= typical.problems.length && lowest(e) >= floor;
  if (isWhole(ev)) return ev;
  const kept: Record<string, number | string> = { ...given };
  const notes: Words[] = [];
  const whole = (name: string, v: number) => isWhole(evaluateIn(def, { ...kept, [name]: v }, frame, c, 0));
  for (const p of def.params) {
    if (p.kind !== 'length' || p.formula !== undefined) continue;
    const [v, least] = [ev.env[p.name], typical.env[p.name]];
    if (v === undefined || least === undefined || v >= least || whole(p.name, v) || !whole(p.name, least)) continue;
    // Between the value that loses parts and the type's that keeps them all, halved down to a micron.
    let [lo, hi] = [v, least];
    while (hi - lo > 1e-6) {
      const mid = (lo + hi) / 2;
      if (whole(p.name, mid)) hi = mid;
      else lo = mid;
    }
    const held = Math.min(least, Math.ceil(hi * 1000 - 1e-6) / 1000);
    kept[p.name] = held;
    const f = held.toFixed(3).replace(/0$/, '');
    notes.push({ pt: `${p.label.pt} mantida em ${f.replace('.', ',')} m: menor, o objeto perderia partes`, en: `${p.label.en} held at ${f} m: any less and the object would lose parts` });
  }
  if (notes.length === 0) return ev;
  const out = evaluateIn(def, kept, frame, c, 0);
  return { ...out, warnings: [...notes, ...out.warnings] };
}

function evaluateIn(def: ObjectDefinition, given: Readonly<Record<string, number | string>>, frame: Frame, c: ObjectContext, depth: number): ObjectEval {
  const problems: string[] = [];
  const { env, materials } = values(def, given, problems);
  const pieces: Piece[] = [];
  const lights: PlacedLight[] = [];
  let lost = 0;
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
        if (w === null || d === null || h === null) continue;
        if (w <= 1e-6 || d <= 1e-6 || h <= 1e-6) {
          lost++;
          continue;
        }
        const centre = apply(frame, { x: ox + w / 2, y: oy + d / 2, z: oz });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'mesh', cx: centre.x, cy: centre.y, z: centre.z, w, d, h, angle: frame.angle, mesh, material: materialOf(part) });
      } else if (part.kind === 'box') {
        const w = num(part.w, at, `${label} width`);
        const d = num(part.d, at, `${label} depth`);
        const h = num(part.h, at, `${label} height`);
        if (w === null || d === null || h === null) continue;
        // A box of no size is nothing to draw (a door of a cabinet too narrow for one): left out, and counted.
        if (w <= 1e-6 || d <= 1e-6 || h <= 1e-6) {
          lost++;
          continue;
        }
        const round = part.round === undefined ? 0 : (num(part.round, at, `${label} edge radius`) ?? 0);
        const tilt = ((part.tilt === undefined ? 0 : (num(part.tilt, at, `${label} tilt`) ?? 0)) * Math.PI) / 180;
        const roll = ((part.roll === undefined ? 0 : (num(part.roll, at, `${label} roll`) ?? 0)) * Math.PI) / 180;
        // Its base's centre, turned with it: about its base's front edge (tilt), then its left edge (roll).
        const ty = (d / 2) * Math.cos(tilt);
        const tz = -(d / 2) * Math.sin(tilt);
        const rx = (w / 2) * Math.cos(roll) + tz * Math.sin(roll);
        const rz = -(w / 2) * Math.sin(roll) + tz * Math.cos(roll);
        // Turned in plan about the vertical through its base's centre: its leaning centre's offset from there with it.
        const turn = ((part.turn === undefined ? 0 : (num(part.turn, at, `${label} turn`) ?? 0)) * Math.PI) / 180;
        const [ux, uy] = [rx - w / 2, ty - d / 2];
        const centre = apply(frame, { x: ox + w / 2 + ux * Math.cos(turn) - uy * Math.sin(turn), y: oy + d / 2 + ux * Math.sin(turn) + uy * Math.cos(turn), z: oz + rz });
        const leaning = { ...(Math.abs(tilt) > 1e-9 ? { tilt } : {}), ...(Math.abs(roll) > 1e-9 ? { roll } : {}) };
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'box', cx: centre.x, cy: centre.y, z: centre.z, w, d, h, angle: frame.angle + turn, material: materialOf(part), round: Math.max(0, Math.min(round, Math.min(w, d, h) / 2 - 1e-4)), ...leaning });
      } else if (part.kind === 'cylinder') {
        const r = num(part.r, at, `${label} radius`);
        const h = num(part.h, at, `${label} height`);
        const r2 = part.r2 === undefined ? r : num(part.r2, at, `${label} top radius`);
        if (r === null || h === null || r2 === null) continue;
        if (h <= 1e-6 || Math.max(r, r2) <= 1e-6) {
          lost++;
          continue;
        }
        const centre = apply(frame, { x: ox, y: oy, z: oz });
        const tilt = ((part.tilt === undefined ? 0 : (num(part.tilt, at, `${label} tilt`) ?? 0)) * Math.PI) / 180;
        const roll = ((part.roll === undefined ? 0 : (num(part.roll, at, `${label} roll`) ?? 0)) * Math.PI) / 180;
        const turn = ((part.turn === undefined ? 0 : (num(part.turn, at, `${label} turn`) ?? 0)) * Math.PI) / 180;
        const leaning = Math.abs(tilt) > 1e-9 || Math.abs(roll) > 1e-9 ? { tilt, roll, angle: frame.angle + turn } : {};
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'cylinder', cx: centre.x, cy: centre.y, z: centre.z, r: Math.max(0, r), r2: Math.max(0, r2), h, material: materialOf(part), ...leaning });
      } else if (part.kind === 'revolve') {
        const raw = part.points.map(([pr, pz], k) => ({ r: num(pr, at, `${label} r${k + 1}`), z: num(pz, at, `${label} z${k + 1}`) }));
        if (raw.some((q) => q.r === null || q.z === null)) continue;
        // Its base at the lowest point: z from there; r never below the axis.
        const low = Math.min(...raw.map((q) => q.z!));
        const profile = raw.map((q) => ({ r: Math.max(0, q.r!), z: q.z! - low }));
        const h = Math.max(...profile.map((q) => q.z));
        const r = Math.max(...profile.map((q) => q.r));
        if (h <= 1e-6 || r <= 1e-6) {
          lost++;
          continue;
        }
        const centre = apply(frame, { x: ox, y: oy, z: oz + low });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'revolve', cx: centre.x, cy: centre.y, z: centre.z, h, r, profile, material: materialOf(part) });
      } else if (part.kind === 'profile') {
        const h = num(part.h, at, `${label} height`);
        const local = part.points.map(([px, py], k) => ({ x: num(px, at, `${label} x${k + 1}`), y: num(py, at, `${label} y${k + 1}`) }));
        if (h === null || local.some((q) => q.x === null || q.y === null)) continue;
        if (h <= 1e-6) {
          lost++;
          continue;
        }
        let points = local.map((q) => apply(frame, { x: ox + q.x!, y: oy + q.y!, z: 0 })).map((q) => ({ x: q.x, y: q.y }));
        // Wound counter-clockwise (the extrusion's faces outward), and not a sliver.
        const area = points.reduce((s, q, k) => s + q.x * points[(k + 1) % points.length]!.y - points[(k + 1) % points.length]!.x * q.y, 0) / 2;
        if (Math.abs(area) < 1e-8) {
          lost++;
          continue;
        }
        if (area < 0) points = [...points].reverse();
        const base = apply(frame, { x: ox, y: oy, z: oz });
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'profile', cx: base.x, cy: base.y, z: base.z, h, points, material: materialOf(part) });
      } else if (part.kind === 'sphere') {
        const r = num(part.r, at, `${label} radius`);
        const h = num(part.h, at, `${label} height`);
        if (r === null || h === null) continue;
        if (h <= 1e-6 || r <= 1e-6) {
          lost++;
          continue;
        }
        const centre = apply(frame, { x: ox, y: oy, z: oz });
        const ry = part.d === undefined ? r : (num(part.d, at, `${label} radius along y`) ?? r);
        const deg = (e: Expr | undefined, what: string) => ((e === undefined ? 0 : (num(e, at, `${label} ${what}`) ?? 0)) * Math.PI) / 180;
        const [tilt, roll, turn] = [deg(part.tilt, 'tilt'), deg(part.roll, 'roll'), deg(part.turn, 'turn')];
        // An ellipsoid or a leaning one keeps its shape's own axes; a plain one is as it was.
        const shaped = Math.abs(ry - r) > 1e-9 || Math.abs(tilt) > 1e-9 || Math.abs(roll) > 1e-9 || Math.abs(turn) > 1e-9 ? { ry: Math.max(1e-4, ry), tilt, roll, angle: frame.angle + turn } : {};
        pieces.push({ ...(part.cut ? { cut: true } : {}), kind: 'sphere', cx: centre.x, cy: centre.y, z: centre.z, r, h, material: materialOf(part), ...shaped });
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
        lost += inside.lost;
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
  return { env, materials, pieces, handles, problems, warnings, lights, lost };
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
