// The load table (quadro de cargas, docs/plano-de-escopo.md phase 13): the electric points by circuit,
// each circuit's load, current, breaker, wire section and voltage drop along its way from the panel
// through the conduits (network.ts). The values used are NBR 5410's as usually tabled, to be confirmed
// in the edition in force: the least sections (1,5 mm² for lighting, 2,5 mm² for the rest), the current
// a copper wire with PVC insulation carries in conduit in a wall (method B1, two loaded conductors), and
// a drop of at most 4 % in a final circuit. A point with no circuit of its own goes in its kind's and
// level's: lighting (IL), general sockets (TUG), each shower its own (TUE). Pure.

import type { Doc } from '../../app/document';
import { fromSources, type Network, networksOf } from './network';
import { type MepPoint, POINT_KINDS, pointLoad, systemIn } from './schema';

/** Breakers' rated currents (A). */
export const BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125] as const;
/** Copper, PVC, method B1, 2 loaded conductors: section (mm²) and the current it carries (A). */
export const AMPACITY: readonly (readonly [number, number])[] = [
  [1.5, 17.5],
  [2.5, 24],
  [4, 32],
  [6, 41],
  [10, 57],
  [16, 76],
  [25, 101],
  [35, 125],
];
/** Copper's resistivity at its working temperature (Ω·mm²/m) and the most drop allowed in a final circuit (%). */
export const RESISTIVITY = 0.0178;
export const MAX_DROP = 4;

export type CircuitKind = 'lighting' | 'tug' | 'tue';

export interface Circuit {
  readonly name: string;
  readonly kind: CircuitKind;
  readonly points: readonly MepPoint[];
  /** VA, V, A. */
  readonly power: number;
  readonly voltage: number;
  readonly current: number;
  /** The breaker (A) and the wire section (mm²); null when no breaker or wire in the tables is enough. */
  readonly breaker: number | null;
  readonly section: number | null;
  /** The way from the panel to its farthest point (m), and the drop there (%); null when it is not connected. */
  readonly length: number | null;
  readonly drop: number | null;
}

export interface LoadTable {
  readonly circuits: readonly Circuit[];
  readonly total: number;
  /** Points with a load that no conduit reaches from a panel. */
  readonly unreached: readonly MepPoint[];
  readonly hasPanel: boolean;
}

const kindOf = (p: MepPoint): CircuitKind => (p.kind === 'shower' ? 'tue' : POINT_KINDS[p.kind].discipline === 'lighting' ? 'lighting' : 'tug');

/** A circuit's name when a point gives none: its kind and level's number, a shower its own. */
function autoName(doc: Doc, p: MepPoint, showers: Map<string, number>): string {
  const order = [...doc.levels].sort((a, b) => a.elevation - b.elevation).findIndex((l) => l.id === p.levelId) + 1;
  const k = kindOf(p);
  if (k === 'tue') {
    if (!showers.has(p.id)) showers.set(p.id, showers.size + 1);
    return `TUE${showers.get(p.id)}`;
  }
  return `${k === 'lighting' ? 'IL' : 'TUG'}${order}`;
}

/** The breaker and the section for a current: the least breaker over it, the least wire that carries the breaker's current. */
export function protect(current: number, kind: CircuitKind): { breaker: number | null; section: number | null } {
  const breaker = BREAKERS.find((b) => b >= current - 1e-9) ?? null;
  if (breaker === null) return { breaker: null, section: null };
  const least = kind === 'lighting' ? 1.5 : 2.5;
  const section = AMPACITY.find(([s, iz]) => s >= least && iz >= breaker)?.[0] ?? null;
  return { breaker, section };
}

/** The drop (%) along a length (m) of a two-wire circuit carrying a current at a voltage over a section. */
export const voltageDrop = (length: number, current: number, section: number, voltage: number): number => ((2 * RESISTIVITY * length * current) / section / voltage) * 100;

export function loadTable(doc: Doc): LoadTable {
  const electric = doc.mepPoints.filter((p) => {
    const d = systemIn(doc, p.systemId)?.discipline ?? POINT_KINDS[p.kind].discipline;
    return (d === 'power' || d === 'lighting') && pointLoad(p).power > 0;
  });
  const net: Network | undefined = networksOf(doc).get('electric');
  const panels = net ? net.points.filter((p) => p.kind === 'panel').map((p) => net.pointNode.get(p.id)!) : [];
  const reach = net && panels.length > 0 ? fromSources(net, panels).dist : new Map<number, number>();
  const showers = new Map<string, number>();
  const groups = new Map<string, MepPoint[]>();
  for (const p of electric) {
    const name = p.circuit?.trim() || autoName(doc, p, showers);
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(p);
  }
  const unreached: MepPoint[] = [];
  const circuits = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([name, points]): Circuit => {
      const power = points.reduce((s, p) => s + pointLoad(p).power, 0);
      const voltage = Math.max(...points.map((p) => pointLoad(p).voltage));
      const current = power / voltage;
      const kind: CircuitKind = points.some((p) => kindOf(p) === 'tue') ? 'tue' : points.every((p) => kindOf(p) === 'lighting') ? 'lighting' : 'tug';
      const { breaker, section } = protect(current, kind);
      const lengths = points.map((p) => (net ? reach.get(net.pointNode.get(p.id)!) : undefined));
      points.forEach((p, i) => lengths[i] === undefined && unreached.push(p));
      const known = lengths.filter((x): x is number => x !== undefined);
      const length = known.length === points.length && known.length > 0 ? Math.max(...known) : null;
      const drop = length !== null && section !== null ? voltageDrop(length, current, section, voltage) : null;
      return { name, kind, points, power, voltage, current, breaker, section, length, drop };
    });
  return { circuits, total: circuits.reduce((s, c) => s + c.power, 0), unreached, hasPanel: panels.length > 0 };
}
