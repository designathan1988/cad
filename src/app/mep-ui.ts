// The services' tools (elements/mep): a point of the kind chosen on the ribbon placed where the click is,
// at its kind's height; a run of the system chosen drawn by clicks, Enter (or a click on its last
// point) ending it. A run is laid just under the ceiling (or under the floor, for sewer and rain); an
// end on a point of its group comes down (or up) to that point's height, and an end on another run's
// vertex takes its height: so they connect (network.ts). Sewer and rain fall the way they are drawn,
// by their diameter's least fall. Functions over the app (app.ts delegates).

import { newId } from '../core/id';
import { distance, type Point2 } from '../core/vector';
import { MIN_WALL_LENGTH } from '../core/tolerance';
import { GROUP_OF, MEP_POINT_PREFIX, MEP_RUN_PREFIX, type MepPoint, type MepRun, POINT_KINDS, type PointKind, RUN_DEFAULTS, type RunVertex, systemIn, systemsOf } from '../elements/mep/schema';
import { t } from '../ui/i18n';
import { coverAt, leastFall, type RoofFaces, VENT_ABOVE } from '../elements/mep/water';
import type { Doc } from './document';
import type { App } from './app';

/** How near (m, in plan) a run's end must be to a point or a vertex to meet it. */
export const MEET = 0.05;

/** The first system of a discipline: what a point of a kind belongs to at first. */
export function systemFor(doc: Doc, kind: PointKind): string {
  const d = POINT_KINDS[kind].discipline;
  return systemsOf(doc).find((s) => s.discipline === d)?.id ?? systemsOf(doc)[0]!.id;
}

/** A point kind's height on a level: its own, just under the level's ceiling, or so much over it. */
export function kindHeight(doc: Doc, levelId: string, kind: PointKind): number {
  const { height, above } = POINT_KINDS[kind];
  const ceiling = doc.levels.find((l) => l.id === levelId)?.height ?? 2.8;
  return height ?? (above === undefined ? ceiling - 0.02 : ceiling + above);
}

export function startMepPoint(app: App, kind: PointKind): void {
  app.ui.mepKind = kind;
  app.setTool('mepPoint');
}

export function startMepRun(app: App, systemId: string): void {
  app.ui.mepSystem = systemId;
  app.ui.mepDraft = [];
  app.setTool('mepRun');
}

export function mepPointClick(app: App, p: Point2): void {
  const doc = app.store.get();
  const kind = app.ui.mepKind;
  // A vent terminal stands 0.30 m over the roof over it (or over the top level's ceiling).
  const height =
    kind === 'ventTerminal'
      ? coverAt(doc, [...(app.geometry.kinds.get('roofs')?.values() ?? [])] as RoofFaces[], p) + VENT_ABOVE - (doc.levels.find((l) => l.id === app.ui.levelId)?.elevation ?? 0)
      : kindHeight(doc, app.ui.levelId, kind);
  const point: MepPoint = { id: newId(MEP_POINT_PREFIX), levelId: app.ui.levelId, at: { x: p.x, y: p.y }, height, kind, systemId: systemFor(doc, kind) };
  app.store.dispatch({ label: 'cmd.addMep', apply: (d) => ({ ...d, mepPoints: [...d.mepPoints, point] }) });
  app.ui.info = t('hint.mepPlaced', { what: t(`mep.kind.${kind}`) });
  app.render();
}

export function mepRunClick(app: App, p: Point2, mpp: number): void {
  const draft = app.ui.mepDraft;
  if (draft.length >= 2 && distance(p, draft.at(-1)!) <= 10 * mpp) return mepRunFinish(app);
  if (draft.length > 0 && distance(p, draft.at(-1)!) < MIN_WALL_LENGTH) return;
  app.ui.mepDraft = [...draft, p];
  app.render();
}

/** A run's vertices from its plan points: at the run's height, its ends meeting what is there. */
export function runVertices(doc: Doc, levelId: string, systemId: string, plan: readonly Point2[]): RunVertex[] {
  const sys = systemIn(doc, systemId);
  const discipline = sys?.discipline ?? 'power';
  const level = doc.levels.find((l) => l.id === levelId);
  const base = RUN_DEFAULTS[discipline].height ?? (level?.height ?? 2.8) - 0.1;
  const group = GROUP_OF[discipline];
  const mine = (id: string) => {
    const s = systemIn(doc, id);
    return s !== undefined && GROUP_OF[s.discipline] === group;
  };
  const points = doc.mepPoints.filter((x) => x.levelId === levelId && mine(x.systemId));
  const vertices = doc.mepRuns.filter((r) => r.levelId === levelId && mine(r.systemId)).flatMap((r) => r.points);
  // Sewer and rain fall the way they are drawn, by their diameter's least fall (water.ts).
  const falls = discipline === 'sewer' || discipline === 'rain';
  const fall = falls ? leastFall(RUN_DEFAULTS[discipline].diameter) / 100 : 0;
  let along = 0;
  let out: RunVertex[] = plan.map((q, i) => {
    if (i > 0) along += distance(q, plan[i - 1]!);
    return { x: q.x, y: q.y, z: base - fall * along };
  });
  // The pipe already at a plan point (at a point, the one at the height nearest the run's, not its drop).
  const pipeAt = (at: RunVertex): RunVertex | null =>
    vertices.filter((x) => distance(x, at) <= MEET).reduce<RunVertex | null>((a, b) => (a === null || Math.abs(b.z - at.z) < Math.abs(a.z - at.z) ? b : a), null);
  // A falling run drawn into a pipe ends at that pipe's height, its fall kept the whole way (else the
  // last stretch would jump or lie flat); drawn out of one, it starts at it.
  const into = falls ? pipeAt(out.at(-1)!) : null;
  const from = falls && !into ? pipeAt(out[0]!) : null;
  const shift = into ? into.z - out.at(-1)!.z : from ? from.z - out[0]!.z : 0;
  if (shift !== 0) out = out.map((v) => ({ ...v, z: v.z + shift }));
  // Each end: on a point, it goes to it and down (or up) to its height; on a run's vertex, it takes its height.
  const meet = (i: 0 | -1) => {
    const at = out.at(i)!;
    const point = points.find((x) => distance(x.at, at) <= MEET);
    // A falling run met at a point by a pipe there joins that pipe: the point's drop is that pipe's.
    const joined = falls && point ? pipeAt(at) : null;
    if (joined) {
      if (i === 0) out[0] = { ...joined };
      else out[out.length - 1] = { ...joined };
      return;
    }
    if (point) {
      const end = { x: point.at.x, y: point.at.y, z: at.z };
      const drop = { x: point.at.x, y: point.at.y, z: point.height };
      const replaced = Math.abs(at.z - point.height) > 1e-6 ? [end, drop] : [end];
      if (i === 0) out.splice(0, 1, ...replaced.reverse());
      else out.splice(out.length - 1, 1, ...replaced);
      return;
    }
    const v = vertices.find((x) => distance(x, at) <= MEET);
    if (v) {
      if (i === 0) out[0] = { x: v.x, y: v.y, z: v.z };
      else out[out.length - 1] = { x: v.x, y: v.y, z: v.z };
    }
  };
  meet(0);
  meet(-1);
  return out;
}

export function mepRunFinish(app: App): void {
  const plan = app.ui.mepDraft;
  app.ui.mepDraft = [];
  if (plan.length < 2) return app.render();
  const doc = app.store.get();
  const systemId = app.ui.mepSystem;
  const discipline = systemIn(doc, systemId)?.discipline ?? 'power';
  const d = RUN_DEFAULTS[discipline];
  const run: MepRun = { id: newId(MEP_RUN_PREFIX), levelId: app.ui.levelId, points: runVertices(doc, app.ui.levelId, systemId, plan), systemId, kind: d.kind, diameter: d.diameter };
  app.store.dispatch({ label: 'cmd.addMep', apply: (x) => ({ ...x, mepRuns: [...x.mepRuns, run] }) });
  app.ui.info = t('hint.mepRunMade');
  app.render();
}
