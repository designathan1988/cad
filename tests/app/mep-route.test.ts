// Automatic routing (app/mep-route.ts): every point of a system reached from its source, by orthogonal runs.

import { describe, expect, it } from 'vitest';
import { type Doc, newDocument } from '../../src/app/document';
import { autoRoute } from '../../src/app/mep-route';
import { fromSources, networksOf, sourcesOf } from '../../src/elements/mep/network';
import type { MepPoint } from '../../src/elements/mep/schema';

const pt = (id: string, kind: MepPoint['kind'], x: number, y: number, height: number, systemId: string): MepPoint => ({ id, levelId: 'lvl_ground', at: { x, y }, height, kind, systemId });

describe('automatic routing', () => {
  const doc: Doc = {
    ...newDocument(),
    mepPoints: [pt('qd', 'panel', 0, 0, 1.5, 'sys_power'), pt('t1', 'socket', 4, 0, 0.3, 'sys_power'), pt('t2', 'socket', 4, 3, 0.3, 'sys_power'), pt('t3', 'socket', -2, 5, 0.3, 'sys_power')],
    mepRuns: [],
  };

  it('every socket reached from the panel, each run square to the axes, the nearest first', () => {
    const runs = autoRoute(doc, 'sys_power', 'lvl_ground');
    expect(runs).toHaveLength(3);
    for (const r of runs)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1]!;
        const b = r.points[i]!;
        // Each stretch along one axis only: x, y or up and down.
        expect([Math.abs(a.x - b.x) > 1e-9, Math.abs(a.y - b.y) > 1e-9, Math.abs(a.z - b.z) > 1e-9].filter(Boolean).length).toBe(1);
      }
    const done: Doc = { ...doc, mepRuns: runs };
    const net = networksOf(done).get('electric')!;
    const { via } = fromSources(net, sourcesOf(net));
    for (const id of ['t1', 't2', 't3']) expect(via.has(net.pointNode.get(id)!)).toBe(true);
    // Run again: nothing left to join.
    expect(autoRoute(done, 'sys_power', 'lvl_ground')).toEqual([]);
  });

  it('no source, no runs', () => {
    expect(autoRoute({ ...doc, mepPoints: doc.mepPoints.filter((p) => p.kind !== 'panel') }, 'sys_power', 'lvl_ground')).toEqual([]);
  });
});
