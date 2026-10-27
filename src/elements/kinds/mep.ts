// Building services in the registry (contract.ts): elements/mep holds the elements. A point is drawn in
// plan as a disc in its system's colour with its kind's letters, in 3D as a small ball at its height; a
// run as a line in its system's colour as wide as it is (a riser as a ring), in 3D as tubes from vertex
// to vertex and down (or up) to the points it passes over. Both on the "services" layer, on their own DXF layers.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point2 } from '../../core/vector';
import { type MessageKey, num, t } from '../../ui/i18n';
import type { Doc } from '../../app/document';
import type { ElementKind, PlanPaint } from '../contract';
import type { Material } from '../material/schema';
import { type Discipline, type Fixture, FIXTURE_LIST, GROUP_OF, isMepPoint, isMepRun, MEP_POINT_PREFIX, MEP_RUN_PREFIX, type MepPoint, type MepRun, POINT_KIND_LIST, POINT_KINDS, type PointKind, RUN_KINDS, type RunKind, type RunVertex, systemIn, systemsOf } from '../mep/schema';
import { segmentDistance } from '../dimension/anchor';
import { nearSegment } from './paint';

/** Each point kind's letters in plan. */
export const POINT_LETTERS: Readonly<Record<PointKind, string>> = {
  panel: 'QD',
  socket: 'T',
  socketHigh: 'TA',
  shower: 'CH',
  switch: 'S',
  light: 'L',
  data: 'D',
  accessPoint: 'AP',
  reservoir: 'RS',
  coldOutlet: 'AF',
  heater: 'AQ',
  hotOutlet: 'Q',
  drain: 'E',
  sewerOutlet: 'CI',
  rainDrain: 'P',
  rainOutlet: 'CA',
  gasMeter: 'MG',
  gasOutlet: 'G',
  hydrant: 'H',
  acUnit: 'AC',
  solarPanel: 'FV',
  sensor: 'SN',
};

export interface MepPointSolid {
  readonly point: MepPoint;
  /** Absolute height (m): its level's floor and its own. */
  readonly z: number;
  readonly color: string;
  readonly discipline: Discipline;
}

export interface MepRunSolid {
  readonly run: MepRun;
  /** Its vertices with absolute heights. */
  readonly path: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  /** Its drops to the points it passes over, absolute (drawn in 3D; not in its length). */
  readonly drops: readonly { readonly from: RunVertex; readonly to: RunVertex }[];
  readonly length: number;
  readonly color: string;
  readonly discipline: Discipline;
}

const elevationOf = (doc: Doc, levelId: string) => doc.levels.find((l) => l.id === levelId)?.elevation ?? 0;
const plain = (color: string, id: string): Material => ({ id, name: '', color, roughness: 0.6, metalness: 0.1, cut: 'solid' });
const updatePoints = (ids: readonly string[], patch: { readonly [K in keyof Omit<MepPoint, 'id'>]?: MepPoint[K] | undefined }) => ({
  label: 'cmd.updateMep',
  apply: (doc: Doc) => {
    const set = new Set(ids);
    let changed = false;
    const raised: { p: MepPoint; to: number }[] = [];
    const mepPoints = doc.mepPoints.map((p) => {
      if (!set.has(p.id)) return p;
      const next = Object.fromEntries(Object.entries({ ...p, ...patch }).filter(([, v]) => v !== undefined)) as unknown as MepPoint;
      if (!isMepPoint(next) || JSON.stringify(next) === JSON.stringify(p)) return p;
      changed = true;
      if (next.height !== p.height) raised.push({ p, to: next.height });
      return next;
    });
    if (!changed) return doc;
    // A run's vertex on a point raised or lowered goes with it: the run still reaches it.
    const on = (r: MepRun, v: RunVertex) => raised.find(({ p }) => p.levelId === r.levelId && Math.hypot(v.x - p.at.x, v.y - p.at.y) <= ON && Math.abs(v.z - p.height) <= ON);
    const mepRuns = raised.length === 0 ? doc.mepRuns : doc.mepRuns.map((r) => (r.points.some((v) => on(r, v)) ? { ...r, points: r.points.map((v) => ({ ...v, z: on(r, v)?.to ?? v.z })) } : r));
    return { ...doc, mepPoints, mepRuns };
  },
});
/** How near (m) a run's vertex is to a point to be on it (network.ts: SAME). */
const ON = 0.02;
/** How near (m, in plan) a point is to a run's vertex to hang from it (network.ts: REACH). */
const REACH = 0.05;
const updateRuns = (ids: readonly string[], change: (r: MepRun) => MepRun) => ({
  label: 'cmd.updateMep',
  apply: (doc: Doc) => {
    const set = new Set(ids);
    let changed = false;
    const mepRuns = doc.mepRuns.map((r) => {
      if (!set.has(r.id)) return r;
      const next = change(r);
      if (!isMepRun(next) || JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, mepRuns } : doc;
  },
});

/** What a set of items has in common, or a dash. */
const same = <T>(xs: readonly T[], f: (x: T) => string): string => (xs.length > 0 && xs.every((x) => f(x) === f(xs[0]!)) ? f(xs[0]!) : '—');

export const mepPointKind: ElementKind<MepPoint, MepPointSolid> = {
  key: 'mepPoints',
  prefix: MEP_POINT_PREFIX,
  category: 'services',
  // Over the room tags too: a shower or a drain in a small bathroom lies under its name.
  layer: 'top',
  icon: 'pin',
  one: 'mep.point',
  many: 'mep.points',
  dropped: 'fix.droppedMepPoints',
  exportName: 'mep.point',
  exportColour: 'structure',
  valid: (x): x is MepPoint => isMepPoint(x),
  derive: (doc, p) => {
    const sys = systemIn(doc, p.systemId);
    return { point: p, z: elevationOf(doc, p.levelId) + p.height, color: sys?.color ?? '#888888', discipline: sys?.discipline ?? POINT_KINDS[p.kind].discipline };
  },
  element: (s) => s.point,
  outlines: (s, scale = 50) => {
    const r = 9 / scale;
    const { x, y } = s.point.at;
    return [[{ x: x - r, y: y - r }, { x: x + r, y: y - r }, { x: x + r, y: y + r }, { x: x - r, y: y + r }]];
  },
  hit: (s, p, near, scale) => Math.hypot(p.x - s.point.at.x, p.y - s.point.at.y) <= 9 / scale + near,
  distance: (s, p) => Math.hypot(p.x - s.point.at.x, p.y - s.point.at.y),
  pick: 'first',
  span: (s) => ({ bottom: s.z - 0.05, top: s.z + 0.05 }),
  moved: (p, d) => ({ ...p, at: { x: p.at.x + d.x, y: p.at.y + d.y } }),
  mapped: (p, tr, id) => ({ ...p, id, at: tr.map(p.at) }),
  similar: (a, b) => a.kind === b.kind && a.systemId === b.systemId,
  plan: (p, s, lit) => drawPoint(p, s, lit),
  solid: (s) => {
    const geometry = new THREE.SphereGeometry(0.05, 12, 8);
    geometry.translate(s.point.at.x, 0, -s.point.at.y);
    return { geometry, y: s.z, material: plain(s.color, `mep_${s.color}`), edges: false };
  },
  dxfLayers: [{ name: 'M-PNTS', colour: 1 }],
  dxf: (s, out) => out.text('M-PNTS', s.point.at, 0.12, POINT_LETTERS[s.point.kind]),
  fields: (items, { dispatch, doc }) => {
    const ids = items.map((s) => s.point.id);
    const one = items.length === 1 ? items[0]! : null;
    const electric = items.every((s) => s.discipline === 'power' || s.discipline === 'lighting');
    // A weight for the outlets only: a tank or a heater feeds them, asks nothing.
    const water = items.every((s) => (s.discipline === 'coldWater' || s.discipline === 'hotWater') && !POINT_KINDS[s.point.kind].source);
    return [
      {
        id: 'mepKind',
        label: 'mep.kind',
        kind: 'select',
        options: POINT_KIND_LIST.map((k) => ({ value: k, label: t(`mep.kind.${k}` as MessageKey) })),
        get: (s) => s.point.kind,
        set: (v) => dispatch(updatePoints(ids, { kind: v as PointKind })),
      },
      {
        id: 'mepSystem',
        label: 'mep.system',
        kind: 'select',
        options: systemsOf(doc).map((x) => ({ value: x.id, label: x.name })),
        get: (s) => s.point.systemId,
        set: (v) => dispatch(updatePoints(ids, { systemId: v })),
      },
      { id: 'mepHeight', label: 'mep.height', kind: 'number', get: (s) => s.point.height, set: (v) => dispatch(updatePoints(ids, { height: v })) },
      ...(electric
        ? ([
            { id: 'mepPower', label: 'mep.power', kind: 'number', min: 0, unit: 'VA', decimals: 0, get: (s: MepPointSolid) => s.point.power ?? POINT_KINDS[s.point.kind].power ?? 0, set: (v: number) => dispatch(updatePoints(ids, { power: v })) },
            { id: 'mepVoltage', label: 'mep.voltage', kind: 'select', options: ['127', '220', '380'].map((v) => ({ value: v, label: `${v} V` })), get: (s: MepPointSolid) => String(s.point.voltage ?? POINT_KINDS[s.point.kind].voltage ?? 127), set: (v: string) => dispatch(updatePoints(ids, { voltage: Number(v) })) },
            { id: 'mepCircuit', label: 'mep.circuit', kind: 'text', get: (s: MepPointSolid) => s.point.circuit ?? '', set: (v: string) => dispatch(updatePoints(ids, { circuit: v.trim() || undefined })) },
          ] as const)
        : []),
      ...(water
        ? ([{ id: 'mepWeight', label: 'mep.weight', kind: 'number', min: 0, unit: '', get: (s: MepPointSolid) => s.point.weight ?? POINT_KINDS[s.point.kind].weight ?? 0, set: (v: number) => dispatch(updatePoints(ids, { weight: v })) }] as const)
        : []),
      // A sewer drain: the fixture it takes (NBR 8160 table 3), for the pipes' units and diameters.
      ...(items.every((s) => s.discipline === 'sewer' && !POINT_KINDS[s.point.kind].source)
        ? ([
            {
              id: 'mepFixture',
              label: 'mep.fixture',
              kind: 'select',
              options: [{ value: '', label: t('mep.fixture.none') }, ...FIXTURE_LIST.map((f) => ({ value: f, label: t(`mep.fixture.${f}` as MessageKey) }))],
              get: (s: MepPointSolid) => s.point.fixture ?? '',
              set: (v: string) => dispatch(updatePoints(ids, { fixture: v === '' ? undefined : (v as Fixture) })),
            },
          ] as const)
        : []),
      ...(one ? ([{ id: 'mepLabel', label: 'mep.label', kind: 'text', get: (s: MepPointSolid) => s.point.label ?? '', set: (v: string) => dispatch(updatePoints(ids, { label: v.trim() || undefined })) }] as const) : []),
      { id: 'mepAbs', label: 'mep.absolute', kind: 'readout', text: (xs) => same(xs, (s) => `${num(s.z, 2)} m`) },
    ];
  },
};

export const mepRunKind: ElementKind<MepRun, MepRunSolid> = {
  key: 'mepRuns',
  prefix: MEP_RUN_PREFIX,
  category: 'services',
  layer: 'over',
  icon: 'guide',
  one: 'mep.run',
  many: 'mep.runs',
  dropped: 'fix.droppedMepRuns',
  exportName: 'mep.run',
  exportColour: 'structure',
  valid: (x): x is MepRun => isMepRun(x),
  derive: (doc, r) => {
    const sys = systemIn(doc, r.systemId);
    const e = elevationOf(doc, r.levelId);
    const path = r.points.map((v) => ({ x: v.x, y: v.y, z: v.z + e }));
    let length = 0;
    for (let i = 1; i < path.length; i++) length += Math.hypot(path[i]!.x - path[i - 1]!.x, path[i]!.y - path[i - 1]!.y, path[i]!.z - path[i - 1]!.z);
    // A point of its group under (or over) one of its vertices that the run does not reach itself (one
    // it passes over): a drop from that vertex to it, as the network joins them (network.ts).
    const group = sys ? GROUP_OF[sys.discipline] : null;
    const drops = doc.mepPoints
      .filter((p) => p.levelId === r.levelId && group !== null && GROUP_OF[systemIn(doc, p.systemId)?.discipline ?? POINT_KINDS[p.kind].discipline] === group)
      .filter((p) => !r.points.some((v) => Math.hypot(v.x - p.at.x, v.y - p.at.y) <= ON && Math.abs(v.z - p.height) <= ON))
      .flatMap((p) => {
        const v = r.points.find((x) => Math.hypot(x.x - p.at.x, x.y - p.at.y) <= REACH);
        return v ? [{ from: { x: v.x, y: v.y, z: v.z + e }, to: { x: p.at.x, y: p.at.y, z: p.height + e } }] : [];
      });
    return { run: r, path, drops, length, color: sys?.color ?? '#888888', discipline: sys?.discipline ?? 'power' };
  },
  element: (s) => s.run,
  outlines: (s) => [s.run.points.map((v) => ({ x: v.x, y: v.y }))],
  hit: (s, p, near) => s.run.points.some((v, i) => i > 0 && nearSegment(p, s.run.points[i - 1]!, v, near + s.run.diameter / 2)),
  distance: (s, p) => Math.min(...s.run.points.slice(1).map((v, i) => segmentDistance(p, s.run.points[i]!, v))),
  // After the points: a click on a point's disc takes the point, not the run that ends under it.
  pick: 'beforeWalls',
  span: (s) => ({ bottom: Math.min(...s.path.map((v) => v.z)), top: Math.max(...s.path.map((v) => v.z)) }),
  moved: (r, d) => ({ ...r, points: r.points.map((v) => ({ ...v, x: v.x + d.x, y: v.y + d.y })) }),
  mapped: (r, tr, id) => ({ ...r, id, points: r.points.map((v) => ({ ...tr.map(v), z: v.z })) }),
  similar: (a, b) => a.systemId === b.systemId && a.kind === b.kind,
  plan: (p, s, lit) => drawRun(p, s, lit),
  solid: (s) => {
    const parts: THREE.BufferGeometry[] = [];
    const pieces = [...s.path.slice(1).map((to, i) => ({ from: s.path[i]!, to })), ...s.drops];
    for (const { from, to } of pieces) {
      // Plan (x, y, z) to three.js (x, z, −y).
      const a = new THREE.Vector3(from.x, from.z, -from.y);
      const b = new THREE.Vector3(to.x, to.z, -to.y);
      const len = a.distanceTo(b);
      if (len < 1e-6) continue;
      const g = new THREE.CylinderGeometry(s.run.diameter / 2, s.run.diameter / 2, len, 10, 1, false);
      g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
      g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      parts.push(g);
    }
    if (parts.length === 0) return null;
    const geometry = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    parts.forEach((g) => g.dispose());
    return geometry ? { geometry, y: 0, material: plain(s.color, `mep_${s.color}`), edges: false } : null;
  },
  dxfLayers: [{ name: 'M-RUNS', colour: 5 }],
  dxf: (s, out) => out.polyline('M-RUNS', s.run.points, false),
  fields: (items, { dispatch, doc }) => {
    const ids = items.map((s) => s.run.id);
    return [
      {
        id: 'runSystem',
        label: 'mep.system',
        kind: 'select',
        options: systemsOf(doc).map((x) => ({ value: x.id, label: x.name })),
        get: (s) => s.run.systemId,
        set: (v) => dispatch(updateRuns(ids, (r) => ({ ...r, systemId: v }))),
      },
      {
        id: 'runKind',
        label: 'mep.runKind',
        kind: 'select',
        options: RUN_KINDS.map((k) => ({ value: k, label: t(`mep.runKind.${k}` as MessageKey) })),
        get: (s) => s.run.kind,
        set: (v) => dispatch(updateRuns(ids, (r) => ({ ...r, kind: v as RunKind }))),
      },
      { id: 'runDiameter', label: 'mep.diameter', kind: 'number', min: 0.005, decimals: 3, get: (s) => s.run.diameter, set: (v) => dispatch(updateRuns(ids, (r) => ({ ...r, diameter: v }))) },
      // Every vertex to one height (risers too): the run laid flat.
      { id: 'runHeight', label: 'mep.runHeight', kind: 'number', get: (s) => s.run.points[0]!.z, set: (v) => dispatch(updateRuns(ids, (r) => ({ ...r, points: r.points.map((x) => ({ ...x, z: v })) }))) },
      { id: 'runLength', label: 'mep.length', kind: 'readout', text: (xs) => `${num(xs.reduce((sum, s) => sum + s.length, 0), 2)} m` },
    ];
  },
};

/** A point in plan: a disc of its system's colour with its letters, a ring around it when selected. */
function drawPoint(p: PlanPaint, s: MepPointSolid, lit: boolean): void {
  const { ctx } = p;
  const c = p.toScreen(s.point.at);
  const r = 9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fillStyle = s.color;
  ctx.fill();
  ctx.lineWidth = lit ? 2.5 : 1;
  ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--bg');
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = p.font('700', '--fs-xs');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(POINT_LETTERS[s.point.kind], c.x, c.y + 0.5);
  if (s.point.label) {
    ctx.fillStyle = p.color('--text-2');
    ctx.textAlign = 'left';
    ctx.fillText(s.point.label, c.x + r + 3, c.y);
  }
  ctx.restore();
}

/** A run in plan: its line in its system's colour, as wide as it is at the scale (a pen at least); a riser as a ring. */
function drawRun(p: PlanPaint, s: MepRunSolid, lit: boolean): void {
  const { ctx } = p;
  const pts = s.run.points;
  ctx.save();
  ctx.strokeStyle = lit ? p.color('--wall-sel') : s.color;
  ctx.lineWidth = Math.max(p.pen('seen'), s.run.diameter * p.scale) + (lit ? 1.5 : 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Sewer and rain below the floor are dashed, as drawn under the slab.
  if ((s.discipline === 'sewer' || s.discipline === 'rain') && pts.every((v) => v.z < 0)) ctx.setLineDash([8, 4]);
  ctx.beginPath();
  pts.forEach((v, i) => {
    const q = p.toScreen(v);
    if (i === 0) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  });
  ctx.stroke();
  ctx.setLineDash([]);
  // Risers: a vertex climbing or falling where it stands.
  ctx.lineWidth = p.pen('fine');
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.005 && Math.abs(a.z - b.z) > 0.01) {
      const q: Point2 = p.toScreen(a);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}
