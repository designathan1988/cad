// IFC import (phase 11): a project from an IFC file (IFC2x3 or IFC4), what has an element of its own here
// made one. Storeys become levels; walls straight walls, along their own axis (their placement's x, as
// IFC places them), as long, thick and high as their bodies, of a wall type made of their layers (or
// one of their thickness), their reference line where their layer usage says; doors and windows in the
// walls whose voids they fill, at their place along them, as wide and high as they are; spaces rooms,
// with their name and number; slabs floors with their outline; columns and beams theirs, of a rectangle, a
// round or an I section. The rest (stairs, roofs, furniture…) has no parametric element to become here:
// counted, by class, and said. Pure but for the ids it is given.

import { newDocument, type Doc, type DocWall, type Level } from '../app/document';
import type { Point2 } from '../core/vector';
import { BUILT_IN_MATERIALS, type Material } from '../elements/material/schema';
import { newOpening, type Opening } from '../elements/opening/schema';
import { labelPoint, insideRing } from '../elements/room/derive';
import type { Floor, Room } from '../elements/room/schema';
import type { LayerFunction, WallLayer, WallType } from '../elements/wall/schema';
import { type Column, COLUMN_PREFIX } from '../elements/column/schema';
import { type Beam, BEAM_PREFIX } from '../elements/beam/schema';
import { isEnum, isRef, isTyped, readStep, type StepEntity, type StepValue } from './step';

export interface IfcImport {
  readonly doc: Doc;
  /** What was made, by kind, and what had nothing to become (by IFC class). */
  readonly made: Readonly<Record<'levels' | 'walls' | 'wallTypes' | 'doors' | 'windows' | 'rooms' | 'floors' | 'columns' | 'beams', number>>;
  readonly skipped: Readonly<Record<string, number>>;
}

type Vec = [number, number, number];
/** A placement: its origin and its three axes. */
interface Frame {
  readonly o: Vec;
  readonly x: Vec;
  readonly y: Vec;
  readonly z: Vec;
}

const IDENTITY: Frame = { o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
const unit = (v: Vec): Vec => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** A point of `f`'s frame in its parent's. */
const apply = (f: Frame, p: Vec): Vec => [
  f.o[0] + f.x[0] * p[0] + f.y[0] * p[1] + f.z[0] * p[2],
  f.o[1] + f.x[1] * p[0] + f.y[1] * p[1] + f.z[1] * p[2],
  f.o[2] + f.x[2] * p[0] + f.y[2] * p[1] + f.z[2] * p[2],
];
const applyDir = (f: Frame, d: Vec): Vec => [f.x[0] * d[0] + f.y[0] * d[1] + f.z[0] * d[2], f.x[1] * d[0] + f.y[1] * d[1] + f.z[1] * d[2], f.x[2] * d[0] + f.y[2] * d[1] + f.z[2] * d[2]];
/** `inner` placed in `outer`. */
const compose = (outer: Frame, inner: Frame): Frame => ({ o: apply(outer, inner.o), x: applyDir(outer, inner.x), y: applyDir(outer, inner.y), z: applyDir(outer, inner.z) });
/** A world point in `f`'s own frame. */
const toLocal = (f: Frame, p: Vec): Vec => {
  const d: Vec = [p[0] - f.o[0], p[1] - f.o[1], p[2] - f.o[2]];
  return [dot(d, f.x), dot(d, f.y), dot(d, f.z)];
};

/** The classes as IFC spells them (a STEP file writes them in capitals). */
const CLASS_NAMES: Readonly<Record<string, string>> = Object.fromEntries(
  [
    'IfcWall', 'IfcWallStandardCase', 'IfcDoor', 'IfcWindow', 'IfcSpace', 'IfcSlab', 'IfcRoof', 'IfcStair', 'IfcStairFlight', 'IfcRailing', 'IfcColumn', 'IfcBeam',
    'IfcCurtainWall', 'IfcCovering', 'IfcFurniture', 'IfcFurnishingElement', 'IfcSanitaryTerminal', 'IfcLightFixture', 'IfcElectricAppliance', 'IfcFlowTerminal',
    'IfcBuildingElementProxy', 'IfcPlate', 'IfcMember', 'IfcRamp', 'IfcFooting', 'IfcGeographicElement',
  ].map((n) => [n.toUpperCase(), n]),
);

/** The project read from an IFC file; `id` makes the ids (the app's newId). */
export function importIfc(text: string, id: (prefix: string) => string): IfcImport {
  const all = readStep(text);
  const get = (v: StepValue | undefined): StepEntity | null => (isRef(v) ? (all.get(v.ref) ?? null) : null);
  const num = (v: StepValue | undefined): number => (typeof v === 'number' ? v : isTyped(v) && typeof v.value === 'number' ? v.value : 0);
  const str = (v: StepValue | undefined): string => (typeof v === 'string' ? v : isTyped(v) && typeof v.value === 'string' ? v.value : '');
  const listOf = (v: StepValue | undefined): readonly StepValue[] => (Array.isArray(v) ? v : []);
  const byType = (...types: string[]) => [...all.values()].filter((e) => types.includes(e.type));
  // Lengths in the file's unit: metres, or as its SI prefix says (MILLI: mm).
  const lengthUnit = byType('IFCSIUNIT').find((u) => isEnum(u.args[1]) && u.args[1].enum === 'LENGTHUNIT');
  const prefix = lengthUnit && isEnum(lengthUnit.args[2]) ? lengthUnit.args[2].enum : null;
  const k = prefix === 'MILLI' ? 0.001 : prefix === 'CENTI' ? 0.01 : prefix === 'DECI' ? 0.1 : 1;

  const vec = (e: StepEntity | null, fallback: Vec): Vec => {
    if (!e) return fallback;
    const c = listOf(e.args[0]).map((x) => num(x));
    return [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0];
  };
  const point = (e: StepEntity | null): Vec => {
    const v = vec(e, [0, 0, 0]);
    return [v[0] * k, v[1] * k, v[2] * k];
  };
  const axis2 = (e: StepEntity | null): Frame => {
    if (!e) return IDENTITY;
    const o = point(get(e.args[0]));
    if (e.type === 'IFCAXIS2PLACEMENT2D') {
      const x = unit(vec(get(e.args[1]), [1, 0, 0]));
      return { o, x: [x[0], x[1], 0], y: [-x[1], x[0], 0], z: [0, 0, 1] };
    }
    const z = unit(vec(get(e.args[1]), [0, 0, 1]));
    let x = vec(get(e.args[2]), [1, 0, 0]);
    // The x axis square to z, as IFC builds it.
    const along = dot(x, z);
    x = unit([x[0] - z[0] * along, x[1] - z[1] * along, x[2] - z[2] * along]);
    return { o, x, y: cross(z, x), z };
  };
  const placements = new Map<number, Frame>();
  const placement = (e: StepEntity | null, depth = 0): Frame => {
    if (!e || depth > 50) return IDENTITY;
    const kept = placements.get(e.id);
    if (kept) return kept;
    const rel = e.args[0];
    const parent = rel === null ? IDENTITY : placement(get(rel), depth + 1);
    const f = compose(parent, axis2(get(e.args[1])));
    placements.set(e.id, f);
    return f;
  };

  // A body's points, in the element's own frame: extrusions, swept profiles, triangulated and faceted sets.
  const itemPoints = (e: StepEntity | null, depth = 0): Vec[] => {
    if (!e || depth > 20) return [];
    switch (e.type) {
      case 'IFCEXTRUDEDAREASOLID': {
        const pos = axis2(get(e.args[1]));
        const dir = unit(vec(get(e.args[2]), [0, 0, 1]));
        const d = num(e.args[3]) * k;
        const prof = profilePoints(get(e.args[0]));
        return prof.flatMap((p) => {
          const base: Vec = [p[0], p[1], 0];
          return [apply(pos, base), apply(pos, [base[0] + dir[0] * d, base[1] + dir[1] * d, dir[2] * d])];
        });
      }
      case 'IFCBOOLEANCLIPPINGRESULT':
      case 'IFCBOOLEANRESULT':
        return itemPoints(get(e.args[1]), depth + 1);
      case 'IFCTRIANGULATEDFACESET':
      case 'IFCPOLYGONALFACESET': {
        const pl = get(e.args[0]);
        return listOf(pl?.args[0]).map((c) => {
          const v = listOf(c).map((x) => num(x));
          return [(v[0] ?? 0) * k, (v[1] ?? 0) * k, (v[2] ?? 0) * k] as Vec;
        });
      }
      case 'IFCFACETEDBREP': {
        const shell = get(e.args[0]);
        return listOf(shell?.args[0]).flatMap((f) => listOf(get(f)?.args[0]).flatMap((b) => listOf(get(get(b)?.args[0] ?? null)?.args[0] ?? null).map((p) => point(get(p)))));
      }
      case 'IFCMAPPEDITEM': {
        const map = get(e.args[0]);
        const origin = axis2(get(map?.args[0] ?? null));
        const rep = get(map?.args[1] ?? null);
        const target = get(e.args[1]);
        const t = target ? axis2(target.args[0] === null ? null : get(target.args[0])) : IDENTITY;
        // From the map's origin to where it is placed.
        return listOf(rep?.args[3]).flatMap((i) => itemPoints(get(i), depth + 1)).map((p) => apply(t, toLocal(origin, p)));
      }
      default:
        return [];
    }
  };
  const profilePoints = (e: StepEntity | null): [number, number][] => {
    if (!e) return [];
    if (e.type === 'IFCRECTANGLEPROFILEDEF') {
      const pos = axis2(get(e.args[2]));
      const hx = (num(e.args[3]) * k) / 2;
      const hy = (num(e.args[4]) * k) / 2;
      return ([
        [-hx, -hy],
        [hx, -hy],
        [hx, hy],
        [-hx, hy],
      ] as const).map(([x, y]) => {
        const p = apply(pos, [x, y, 0]);
        return [p[0], p[1]];
      });
    }
    // A circle (its 16 points) and an I (its overall box): a round column's, a steel one's.
    if (e.type === 'IFCCIRCLEPROFILEDEF' || e.type === 'IFCISHAPEPROFILEDEF') {
      const pos = axis2(get(e.args[2]));
      const ring: [number, number][] =
        e.type === 'IFCCIRCLEPROFILEDEF'
          ? Array.from({ length: 16 }, (_, i) => [num(e.args[3]) * k * Math.cos((i * Math.PI) / 8), num(e.args[3]) * k * Math.sin((i * Math.PI) / 8)])
          : ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, y]) => [(x * num(e.args[3]) * k) / 2, (y * num(e.args[4]) * k) / 2]);
      return ring.map(([x, y]) => {
        const p = apply(pos, [x, y, 0]);
        return [p[0], p[1]];
      });
    }
    if (e.type === 'IFCARBITRARYCLOSEDPROFILEDEF' || e.type === 'IFCARBITRARYPROFILEDEFWITHVOIDS') return curvePoints(get(e.args[2]));
    return [];
  };
  /** A body's section, when it is an extrusion of a round or an I profile: the column's or beam's shape and its flanges. */
  const sectionOf = (product: StepEntity): { shape: 'round' | 'I'; plate?: number } | null => {
    const ex = representationItems(product, 'Body').find((i) => i.type === 'IFCEXTRUDEDAREASOLID');
    const prof = ex ? get(ex.args[0]) : null;
    if (prof?.type === 'IFCCIRCLEPROFILEDEF') return { shape: 'round' };
    if (prof?.type === 'IFCISHAPEPROFILEDEF') return { shape: 'I', plate: num(prof.args[6]) * k };
    return null;
  };
  const curvePoints = (e: StepEntity | null): [number, number][] => {
    if (!e) return [];
    if (e.type === 'IFCPOLYLINE') return listOf(e.args[0]).map((p) => {
      const v = point(get(p));
      return [v[0], v[1]];
    });
    if (e.type === 'IFCINDEXEDPOLYCURVE') {
      return listOf(get(e.args[0])?.args[0]).map((c) => {
        const v = listOf(c).map((x) => num(x));
        return [(v[0] ?? 0) * k, (v[1] ?? 0) * k];
      });
    }
    return [];
  };
  const representationItems = (product: StepEntity, kind: string): StepEntity[] => {
    const shape = get(product.args[6]);
    return listOf(shape?.args[2])
      .map(get)
      .filter((r): r is StepEntity => r !== null && str(r.args[1]) === kind)
      .flatMap((r) => listOf(r.args[3]).map(get).filter((i): i is StepEntity => i !== null));
  };
  const bodyPoints = (product: StepEntity): Vec[] => representationItems(product, 'Body').flatMap((i) => itemPoints(i));
  const worldFrame = (product: StepEntity) => placement(get(product.args[5]));

  // Relations: what holds what.
  const containedIn = new Map<number, number>();
  for (const r of byType('IFCRELCONTAINEDINSPATIALSTRUCTURE')) for (const e of listOf(r.args[4])) if (isRef(e) && isRef(r.args[5])) containedIn.set(e.ref, r.args[5].ref);
  for (const r of byType('IFCRELAGGREGATES')) for (const e of listOf(r.args[5])) if (isRef(e) && isRef(r.args[4])) containedIn.set(e.ref, r.args[4].ref);
  const typeOf = new Map<number, StepEntity>();
  for (const r of byType('IFCRELDEFINESBYTYPE')) {
    const t = get(r.args[5]);
    if (t) for (const e of listOf(r.args[4])) if (isRef(e)) typeOf.set(e.ref, t);
  }
  const materialOf = new Map<number, StepEntity>();
  for (const r of byType('IFCRELASSOCIATESMATERIAL')) {
    const m = get(r.args[5]);
    if (m) for (const e of listOf(r.args[4])) if (isRef(e)) materialOf.set(e.ref, m);
  }
  const voidHost = new Map<number, number>();
  for (const r of byType('IFCRELVOIDSELEMENT')) if (isRef(r.args[4]) && isRef(r.args[5])) voidHost.set(r.args[5].ref, r.args[4].ref);
  const filling = new Map<number, number>();
  for (const r of byType('IFCRELFILLSELEMENT')) if (isRef(r.args[4]) && isRef(r.args[5])) filling.set(r.args[5].ref, r.args[4].ref);

  // Storeys → levels, from the lowest; each as high as the gap to the next (2.8 m for the last).
  const storeys = byType('IFCBUILDINGSTOREY')
    .map((s) => ({ s, elevation: s.args[9] !== null && s.args[9] !== undefined ? num(s.args[9]) * k : worldFrame(s).o[2] }))
    .sort((a, b) => a.elevation - b.elevation);
  const base = newDocument();
  const levels: Level[] = (storeys.length > 0 ? storeys : [{ s: null, elevation: 0 }]).map((x, i, list_) => ({
    id: id('lvl'),
    name: x.s ? str(x.s.args[2]) || `Storey ${i + 1}` : base.levels[0]!.name,
    elevation: x.elevation,
    height: list_[i + 1] ? Math.max(0.5, list_[i + 1]!.elevation - x.elevation) : 2.8,
  }));
  const levelOfStorey = new Map<number, Level>();
  storeys.forEach((x, i) => levelOfStorey.set(x.s.id, levels[i]!));
  /** The level an element is on: its storey's, found up its containers; else the one its base is nearest. */
  const levelFor = (e: StepEntity, z: number): Level => {
    let at = containedIn.get(e.id);
    for (let guard = 0; at !== undefined && guard < 20; guard++) {
      const lv = levelOfStorey.get(at);
      if (lv) return lv;
      at = containedIn.get(at);
    }
    return [...levels].reverse().find((l) => l.elevation <= z + 1e-3) ?? levels[0]!;
  };

  // Materials by name: a built-in one of that name, else a new one in grey.
  const materials: Material[] = [...BUILT_IN_MATERIALS];
  const materialId = (name: string): string => {
    const n = name.trim() || 'IFC';
    const found = materials.find((m) => m.name.toLowerCase() === n.toLowerCase() || m.id.toLowerCase() === n.toLowerCase());
    if (found) return found.id;
    const m: Material = { id: id('mat'), name: n, color: '#b5b1aa', roughness: 0.8, metalness: 0, cut: 'solid' };
    materials.push(m);
    return m.id;
  };
  // Wall types: one for each distinct set of layers.
  const wallTypes: WallType[] = [];
  const wallTypeFor = (name: string, layers: readonly { thickness: number; material: string }[]): WallType => {
    const thickest = layers.reduce((b, l, i) => (l.thickness > layers[b]!.thickness ? i : b), 0);
    const made: WallLayer[] = layers.map((l, i) => ({ thickness: l.thickness, function: (i === thickest ? 'structure' : 'finish1') as LayerFunction, materialId: materialId(l.material) }));
    const same = wallTypes.find((t) => t.layers.length === made.length && t.layers.every((l, i) => Math.abs(l.thickness - made[i]!.thickness) < 1e-4 && l.materialId === made[i]!.materialId));
    if (same) return same;
    const total = made.reduce((s, l) => s + l.thickness, 0);
    const t: WallType = { id: id('wt'), name: name || `IFC ${Math.round(total * 100)} cm`, layers: made };
    wallTypes.push(t);
    return t;
  };
  const layerSetOf = (e: StepEntity | null): { layers: { thickness: number; material: string }[]; name: string } | null => {
    if (!e) return null;
    const set = e.type === 'IFCMATERIALLAYERSETUSAGE' ? get(e.args[0]) : e.type === 'IFCMATERIALLAYERSET' ? e : null;
    if (!set) return null;
    const layers = listOf(set.args[0])
      .map(get)
      .filter((l): l is StepEntity => l !== null)
      .map((l) => ({ thickness: num(l.args[1]) * k, material: str(get(l.args[0])?.args[0]) || str(l.args[3]) }));
    return layers.length > 0 ? { layers, name: str(set.args[1]) } : null;
  };

  const walls: DocWall[] = [];
  const wallInfo = new Map<number, { wall: DocWall; frame: Frame; x0: number; flip: boolean; bottom: number }>();
  const skipped: Record<string, number> = {};
  const skip = (e: StepEntity) => {
    const n = CLASS_NAMES[e.type] ?? e.type;
    skipped[n] = (skipped[n] ?? 0) + 1;
  };
  for (const e of byType('IFCWALL', 'IFCWALLSTANDARDCASE')) {
    const frame = worldFrame(e);
    const pts = bodyPoints(e);
    // Its own frame's x along the wall, as IFC places walls; one placed otherwise is read along its longer side.
    if (pts.length === 0) {
      skip(e);
      continue;
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    // Its axis, when it has one: its reference line (the body reaches past it at joined corners).
    const axis = representationItems(e, 'Axis').flatMap((i) => curvePoints(i));
    let x0 = axis.length >= 2 ? axis[0]![0] : Math.min(...xs);
    let x1 = axis.length >= 2 ? axis.at(-1)![0] : Math.max(...xs);
    const axisY = axis.length >= 2 ? axis[0]![1] : null;
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const across = y1 - y0;
    if (x1 - x0 < 1e-3 || across < 1e-4) {
      skip(e);
      continue;
    }
    const zWorld = pts.map((p) => apply(frame, p)[2]);
    const bottom = Math.min(...zWorld);
    const top = Math.max(...zWorld);
    // Its layers: from its usage (or its type's set), from the face its offset says.
    const usage = materialOf.get(e.id) ?? null;
    const set = layerSetOf(usage) ?? layerSetOf(typeOf.has(e.id) ? (materialOf.get(typeOf.get(e.id)!.id) ?? null) : null);
    const thickness = set ? set.layers.reduce((s, l) => s + l.thickness, 0) : across;
    const sense = usage?.type === 'IFCMATERIALLAYERSETUSAGE' && isEnum(usage.args[2]) ? usage.args[2].enum : 'POSITIVE';
    const offset = usage?.type === 'IFCMATERIALLAYERSETUSAGE' ? num(usage.args[3]) * k : null;
    // Layers run from the exterior (our right) toward +y; a negative sense runs them the other way: the
    // wall is drawn the other way round.
    const flip = sense === 'NEGATIVE';
    // Without a usage, its exterior face is its body's lowest y (layers run toward +y), from its axis.
    const o = offset === null ? (axisY === null ? null : y0 - axisY) : flip ? -offset : offset;
    let refY: number;
    let line: DocWall['referenceLine'];
    const at = axisY ?? 0;
    if (o !== null && Math.abs(o + thickness / 2) < 1e-3) [refY, line] = [at, 'centerline'];
    else if (o !== null && Math.abs(o) < 1e-3) [refY, line] = [at, 'exteriorFace'];
    else if (o !== null && Math.abs(o + thickness) < 1e-3) [refY, line] = [at, 'interiorFace'];
    else [refY, line] = [(y0 + y1) / 2, 'centerline'];
    if (flip) [x0, x1] = [x1, x0];
    const lv = levelFor(e, bottom);
    const typeName = typeOf.has(e.id) ? str(typeOf.get(e.id)!.args[2]) : (set?.name ?? '');
    const type = wallTypeFor(typeName, set?.layers ?? [{ thickness, material: 'concrete' }]);
    const toPlan = (x: number): Point2 => {
      const p = apply(frame, [x, flip ? -refY : refY, 0]);
      return { x: p[0], y: p[1] };
    };
    const height = top - bottom;
    const wall: DocWall = {
      id: id('wall'),
      wallTypeId: type.id,
      start: toPlan(x0),
      end: toPlan(x1),
      referenceLine: line,
      levelId: lv.id,
      ...(Math.abs(bottom - lv.elevation) > 1e-3 ? { baseOffset: bottom - lv.elevation } : {}),
      ...(Math.abs(height - lv.height) > 1e-3 || Math.abs(bottom - lv.elevation) > 1e-3 ? { top: { kind: 'fixed' as const, height } } : {}),
    };
    walls.push(wall);
    wallInfo.set(e.id, { wall, frame, x0, flip, bottom });
  }

  // Doors and windows: in the wall whose void they fill, where their void is along it.
  const openings: Opening[] = [];
  let doors = 0;
  let windows = 0;
  for (const e of byType('IFCDOOR', 'IFCWINDOW')) {
    const opening = filling.get(e.id);
    const host = opening !== undefined ? voidHost.get(opening) : undefined;
    const w = host !== undefined ? wallInfo.get(host) : undefined;
    if (!w || opening === undefined) {
      skip(e);
      continue;
    }
    const o = all.get(opening)!;
    const pts = bodyPoints(o).map((p) => apply(worldFrame(o), p));
    const own = pts.length > 0 ? pts : bodyPoints(e).map((p) => apply(worldFrame(e), p));
    if (own.length === 0) {
      skip(e);
      continue;
    }
    const local = own.map((p) => toLocal(w.frame, p));
    const s0 = Math.min(...local.map((p) => p[0]));
    const s1 = Math.max(...local.map((p) => p[0]));
    const z0 = Math.min(...own.map((p) => p[2]));
    const z1 = Math.max(...own.map((p) => p[2]));
    const door = e.type === 'IFCDOOR';
    const width = num(e.args[9]) * k || s1 - s0;
    const height = num(e.args[8]) * k || z1 - z0;
    // From the wall's start to its near jamb: the void's middle less half its width (a void may reach
    // past its door), the wall drawn either way.
    const centre = (s0 + s1) / 2;
    const fromStart = Math.max(0, w.flip ? w.x0 - centre - width / 2 : centre - width / 2 - w.x0);
    openings.push(newOpening(id('opening'), w.wall.id, door ? 'door' : 'window', { kind: 'fromStart', distance: fromStart }, { width, height, sill: door ? 0 : Math.max(0, z0 - w.bottom) }));
    if (door) doors++;
    else windows++;
  }

  // Spaces: a room at a point inside each, with its name and number.
  const rooms: Room[] = [];
  for (const e of byType('IFCSPACE')) {
    const f = worldFrame(e);
    const items = representationItems(e, 'Body');
    let outline: Point2[] = [];
    for (const it of items) {
      if (it.type !== 'IFCEXTRUDEDAREASOLID') continue;
      const pos = compose(f, axis2(get(it.args[1])));
      outline = profilePoints(get(it.args[0])).map(([x, y]) => {
        const p = apply(pos, [x, y, 0]);
        return { x: p[0], y: p[1] };
      });
      if (outline.length >= 3) break;
    }
    const world = bodyPoints(e).map((p) => apply(f, p));
    if (outline.length < 3 && world.length === 0) {
      skip(e);
      continue;
    }
    let seed: Point2;
    if (outline.length >= 3) {
      const ring = outline.at(-1)!.x === outline[0]!.x && outline.at(-1)!.y === outline[0]!.y ? outline.slice(0, -1) : outline;
      seed = labelPoint(ring);
      if (!insideRing(ring, seed)) seed = ring.reduce((s, p) => ({ x: s.x + p.x / ring.length, y: s.y + p.y / ring.length }), { x: 0, y: 0 });
    } else seed = { x: world.reduce((s, p) => s + p[0], 0) / world.length, y: world.reduce((s, p) => s + p[1], 0) / world.length };
    const z = world.length > 0 ? Math.min(...world.map((p) => p[2])) : f.o[2];
    const lv = levelFor(e, z);
    const number = str(e.args[2]) || String(rooms.length + 1);
    rooms.push({ id: id('room'), levelId: lv.id, seed, name: str(e.args[7]) || number, number });
  }

  // Slabs: floors of their outline, as thick as they are deep, their top where it is.
  const floors: Floor[] = [];
  for (const e of byType('IFCSLAB')) {
    const f = worldFrame(e);
    const ex = representationItems(e, 'Body').find((i) => i.type === 'IFCEXTRUDEDAREASOLID');
    if (!ex) {
      skip(e);
      continue;
    }
    const pos = compose(f, axis2(get(ex.args[1])));
    const ring = profilePoints(get(ex.args[0])).map(([x, y]) => {
      const p = apply(pos, [x, y, 0]);
      return { x: p[0], y: p[1] };
    });
    const pts = bodyPoints(e).map((p) => apply(f, p));
    if (ring.length < 3 || pts.length === 0) {
      skip(e);
      continue;
    }
    const zTop = Math.max(...pts.map((p) => p[2]));
    const zBottom = Math.min(...pts.map((p) => p[2]));
    const lv = levelFor(e, zTop);
    const closed = ring.at(-1)!.x === ring[0]!.x && ring.at(-1)!.y === ring[0]!.y ? ring.slice(0, -1) : ring;
    floors.push({ id: id('floor'), levelId: lv.id, source: { kind: 'outline', points: closed }, thickness: Math.max(0.01, zTop - zBottom), offset: zTop - lv.elevation });
  }

  // Columns and beams: their bodies' extent along their own level axes (whichever of their placement's
  // axes lie level), the longer a beam's axis; a column stands on its level's floor up to its top, a
  // beam hangs from its top. A sloping beam is read level, at its highest.
  const levelAxes = (f: Frame): Vec[] => [f.x, f.y, f.z].filter((d) => Math.abs(d[2]) < 0.1).map((d) => unit([d[0], d[1], 0]));
  const spread = (pts: readonly Vec[], d: Vec) => {
    const s = pts.map((p) => p[0] * d[0] + p[1] * d[1]);
    return { lo: Math.min(...s), hi: Math.max(...s) };
  };
  const columns: Column[] = [];
  for (const e of byType('IFCCOLUMN')) {
    const f = worldFrame(e);
    const pts = bodyPoints(e).map((p) => apply(f, p));
    const axes = levelAxes(f);
    if (pts.length === 0 || axes.length < 2) {
      skip(e);
      continue;
    }
    const [u, v] = [axes[0]!, axes[1]!];
    const a = spread(pts, u);
    const b = spread(pts, v);
    const bottom = Math.min(...pts.map((p) => p[2]));
    const top = Math.max(...pts.map((p) => p[2]));
    if (a.hi - a.lo < 1e-3 || b.hi - b.lo < 1e-3 || top - bottom < 1e-3) {
      skip(e);
      continue;
    }
    const lv = levelFor(e, bottom);
    const cu = (a.lo + a.hi) / 2;
    const cv = (b.lo + b.hi) / 2;
    const section = sectionOf(e);
    const toTop = top - (lv.elevation + lv.height);
    columns.push({
      id: id(COLUMN_PREFIX),
      levelId: lv.id,
      at: { x: u[0] * cu + v[0] * cv, y: u[1] * cu + v[1] * cv },
      width: a.hi - a.lo,
      depth: b.hi - b.lo,
      angle: Math.atan2(u[1], u[0]),
      ...(Math.abs(toTop) > 1e-3 ? { topOffset: toTop } : {}),
      ...(section ? { shape: section.shape, ...(section.plate ? { plate: section.plate } : {}) } : {}),
    });
  }
  const beams: Beam[] = [];
  for (const e of byType('IFCBEAM')) {
    const f = worldFrame(e);
    const pts = bodyPoints(e).map((p) => apply(f, p));
    const axes = levelAxes(f);
    if (pts.length === 0 || axes.length === 0) {
      skip(e);
      continue;
    }
    // Its axis the level axis it is longest along; across it, square to that in plan.
    const along = axes.map((d) => ({ d, s: spread(pts, d) })).reduce((m, x) => (x.s.hi - x.s.lo > m.s.hi - m.s.lo ? x : m));
    const across: Vec = [-along.d[1], along.d[0], 0];
    const c = spread(pts, across);
    const bottom = Math.min(...pts.map((p) => p[2]));
    const top = Math.max(...pts.map((p) => p[2]));
    if (along.s.hi - along.s.lo < 1e-3 || c.hi - c.lo < 1e-3 || top - bottom < 1e-3) {
      skip(e);
      continue;
    }
    const lv = levelFor(e, bottom - 0.01);
    const mid = (c.lo + c.hi) / 2;
    const at = (s: number): Point2 => ({ x: along.d[0] * s + across[0] * mid, y: along.d[1] * s + across[1] * mid });
    const section = sectionOf(e);
    const toTop = top - (lv.elevation + lv.height);
    beams.push({
      id: id(BEAM_PREFIX),
      levelId: lv.id,
      start: at(along.s.lo),
      end: at(along.s.hi),
      width: c.hi - c.lo,
      depth: top - bottom,
      ...(Math.abs(toTop) > 1e-3 ? { topOffset: toTop } : {}),
      ...(section?.shape === 'I' ? { shape: 'I' as const, ...(section.plate ? { plate: section.plate } : {}) } : {}),
    });
  }

  // What has nothing to become here, by class.
  const handled = new Set(['IFCWALL', 'IFCWALLSTANDARDCASE', 'IFCDOOR', 'IFCWINDOW', 'IFCSPACE', 'IFCSLAB', 'IFCCOLUMN', 'IFCBEAM', 'IFCOPENINGELEMENT', 'IFCBUILDINGSTOREY', 'IFCBUILDING', 'IFCSITE']);
  const products = ['IFCROOF', 'IFCSTAIR', 'IFCSTAIRFLIGHT', 'IFCRAILING', 'IFCCOLUMN', 'IFCBEAM', 'IFCCURTAINWALL', 'IFCCOVERING', 'IFCFURNITURE', 'IFCFURNISHINGELEMENT', 'IFCSANITARYTERMINAL', 'IFCLIGHTFIXTURE', 'IFCELECTRICAPPLIANCE', 'IFCFLOWTERMINAL', 'IFCBUILDINGELEMENTPROXY', 'IFCPLATE', 'IFCMEMBER', 'IFCRAMP', 'IFCFOOTING', 'IFCGEOGRAPHICELEMENT'];
  for (const e of byType(...products)) if (!handled.has(e.type)) skip(e);

  const project = byType('IFCPROJECT')[0];
  const doc: Doc = {
    ...base,
    name: project ? str(project.args[2]) : '',
    levels,
    materials,
    wallTypes: wallTypes.length > 0 ? wallTypes : base.wallTypes,
    walls,
    openings,
    rooms,
    floors,
    columns,
    beams,
  };
  return {
    doc,
    made: { levels: levels.length, walls: walls.length, wallTypes: wallTypes.length, doors, windows, rooms: rooms.length, floors: floors.length, columns: columns.length, beams: beams.length },
    skipped,
  };
}
