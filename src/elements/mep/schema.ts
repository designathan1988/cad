// Building services as data (docs/plano-de-escopo.md, phase 13: "pontos de conexão, traçado de redes
// com conexões automáticas, sistemas como entidades"): the systems (each of a discipline, with its
// colour), the points where a network meets a use (a socket, a light, a water outlet, a drain, a
// panel or a tank that feeds the rest), and the runs between them (pipes, conduits, cables, ducts),
// each vertex at its own height. Runs whose ends meet a point or another run are connected
// (network.ts): no fitting is drawn by hand. Pure.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';

export type Discipline = 'power' | 'lighting' | 'data' | 'coldWater' | 'hotWater' | 'sewer' | 'rain' | 'gas' | 'fire' | 'hvac' | 'solar' | 'automation';
export const DISCIPLINES: readonly Discipline[] = ['power', 'lighting', 'data', 'coldWater', 'hotWater', 'sewer', 'rain', 'gas', 'fire', 'hvac', 'solar', 'automation'];

/** The disciplines whose runs and points connect to each other: a lighting point is fed by the power panel. */
export const GROUP_OF: Readonly<Record<Discipline, string>> = {
  power: 'electric',
  lighting: 'electric',
  data: 'data',
  automation: 'data',
  coldWater: 'coldWater',
  hotWater: 'hotWater',
  sewer: 'sewer',
  rain: 'rain',
  gas: 'gas',
  fire: 'fire',
  hvac: 'hvac',
  solar: 'solar',
};

export interface MepSystem {
  readonly id: string;
  readonly name: string;
  readonly discipline: Discipline;
  /** #rrggbb, as it is drawn. */
  readonly color: string;
}

/** The systems a new project has, one per discipline. */
export const DEFAULT_SYSTEMS: readonly MepSystem[] = [
  { id: 'sys_power', name: 'Elétrica (força)', discipline: 'power', color: '#d64545' },
  { id: 'sys_lighting', name: 'Iluminação', discipline: 'lighting', color: '#d9a21b' },
  { id: 'sys_data', name: 'Dados e telefonia', discipline: 'data', color: '#7a5cc7' },
  { id: 'sys_cold', name: 'Água fria', discipline: 'coldWater', color: '#2f7fd6' },
  { id: 'sys_hot', name: 'Água quente', discipline: 'hotWater', color: '#e0612f' },
  { id: 'sys_sewer', name: 'Esgoto', discipline: 'sewer', color: '#8a6a45' },
  { id: 'sys_rain', name: 'Águas pluviais', discipline: 'rain', color: '#3fa7a0' },
  { id: 'sys_gas', name: 'Gás', discipline: 'gas', color: '#c9a400' },
  { id: 'sys_fire', name: 'Incêndio', discipline: 'fire', color: '#c41e3a' },
  { id: 'sys_hvac', name: 'Climatização', discipline: 'hvac', color: '#3a9fd6' },
  { id: 'sys_solar', name: 'Energia solar', discipline: 'solar', color: '#e08a00' },
  { id: 'sys_auto', name: 'Automação', discipline: 'automation', color: '#5a9a3c' },
];

export type PointKind =
  | 'panel'
  | 'socket'
  | 'socketHigh'
  | 'shower'
  | 'switch'
  | 'light'
  | 'data'
  | 'accessPoint'
  | 'reservoir'
  | 'coldOutlet'
  | 'heater'
  | 'hotOutlet'
  | 'drain'
  | 'sewerOutlet'
  | 'rainDrain'
  | 'rainOutlet'
  | 'gasMeter'
  | 'gasOutlet'
  | 'hydrant'
  | 'acUnit'
  | 'solarPanel'
  | 'sensor';

/**
 * Each kind of point: its discipline, its height above the floor (null: at the ceiling; above: so much
 * over the ceiling, on the slab or the roof, as a water tank's way out or a solar panel), whether it
 * feeds the rest (a panel, a tank, a heater, the sewer's way out, a meter), and what it asks: a load
 * (VA) and its voltage for the electric ones, a relative weight for a water outlet (NBR 5626's pesos).
 * These are the usual first values; each point can be given its own.
 */
export const POINT_KINDS: Readonly<Record<PointKind, { readonly discipline: Discipline; readonly height: number | null; readonly above?: number; readonly source?: true; readonly power?: number; readonly voltage?: number; readonly weight?: number }>> = {
  panel: { discipline: 'power', height: 1.5, source: true },
  socket: { discipline: 'power', height: 0.3, power: 100, voltage: 127 },
  socketHigh: { discipline: 'power', height: 1.1, power: 600, voltage: 127 },
  shower: { discipline: 'power', height: 2.2, power: 5500, voltage: 220 },
  switch: { discipline: 'lighting', height: 1.1 },
  light: { discipline: 'lighting', height: null, power: 100, voltage: 127 },
  data: { discipline: 'data', height: 0.3 },
  // A Wi-Fi access point, on the ceiling (sim/wifi.ts maps its signal).
  accessPoint: { discipline: 'data', height: null },
  reservoir: { discipline: 'coldWater', height: null, above: 0.3, source: true },
  coldOutlet: { discipline: 'coldWater', height: 0.6, weight: 0.3 },
  heater: { discipline: 'hotWater', height: 1.8, source: true },
  hotOutlet: { discipline: 'hotWater', height: 0.6, weight: 0.3 },
  drain: { discipline: 'sewer', height: 0 },
  sewerOutlet: { discipline: 'sewer', height: -0.4, source: true },
  rainDrain: { discipline: 'rain', height: 0 },
  // The rain's own way out (a sand box to the street): NBR 8160 keeps it apart from the sewer.
  rainOutlet: { discipline: 'rain', height: -0.4, source: true },
  gasMeter: { discipline: 'gas', height: 1.0, source: true },
  gasOutlet: { discipline: 'gas', height: 0.6 },
  hydrant: { discipline: 'fire', height: 1.3 },
  acUnit: { discipline: 'hvac', height: 2.2 },
  solarPanel: { discipline: 'solar', height: null, above: 0.5 },
  sensor: { discipline: 'automation', height: 2.2 },
};
export const POINT_KIND_LIST = Object.keys(POINT_KINDS) as PointKind[];

export interface MepPoint {
  readonly id: string;
  readonly levelId: string;
  readonly at: Point2;
  /** Above its level's floor (m). */
  readonly height: number;
  readonly kind: PointKind;
  readonly systemId: string;
  /** Its load (VA) and voltage (V), for an electric point. */
  readonly power?: number;
  readonly voltage?: number;
  /** Its circuit's name ("C1"); none: the circuit its kind and level make (electrical.ts). */
  readonly circuit?: string;
  /** Its relative weight (NBR 5626), for a water outlet. */
  readonly weight?: number;
  /** The fixture a sewer point drains (NBR 8160 table 3): its contribution units and least branch. */
  readonly fixture?: Fixture;
  /** The roof or ground a rain drain takes (m² of contribution area, NBR 10844 5.2). */
  readonly area?: number;
  readonly label?: string;
}

/**
 * NBR 8160 (1999) table 3, as reproduced in a design memorial (to confirm in the edition in force): each
 * fixture's Hunter contribution units (UHC) and the least nominal diameter of its discharge branch (m).
 * A floor drain (caixa sifonada) is sized by the fixtures it takes, so it is no line of its own.
 */
export const FIXTURES = {
  toilet: { uhc: 6, dn: 0.1 },
  bathtub: { uhc: 2, dn: 0.04 },
  bidet: { uhc: 1, dn: 0.04 },
  shower: { uhc: 2, dn: 0.04 },
  basin: { uhc: 1, dn: 0.04 },
  kitchenSink: { uhc: 3, dn: 0.05 },
  laundryTub: { uhc: 3, dn: 0.04 },
  dishwasher: { uhc: 2, dn: 0.05 },
  washingMachine: { uhc: 3, dn: 0.05 },
} as const;
export type Fixture = keyof typeof FIXTURES;
export const FIXTURE_LIST = Object.keys(FIXTURES) as Fixture[];

export type RunKind = 'pipe' | 'conduit' | 'cable' | 'duct';
export const RUN_KINDS: readonly RunKind[] = ['pipe', 'conduit', 'cable', 'duct'];

/** A run's way through the building: plan points with their heights above its level's floor. */
export interface RunVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MepRun {
  readonly id: string;
  readonly levelId: string;
  readonly points: readonly RunVertex[];
  readonly systemId: string;
  readonly kind: RunKind;
  /** Its outer diameter (m). */
  readonly diameter: number;
}

/** What a run of a discipline is made of at first, and how wide, and at what height (null: just under the ceiling). */
export const RUN_DEFAULTS: Readonly<Record<Discipline, { readonly kind: RunKind; readonly diameter: number; readonly height: number | null }>> = {
  power: { kind: 'conduit', diameter: 0.025, height: null },
  lighting: { kind: 'conduit', diameter: 0.025, height: null },
  data: { kind: 'conduit', diameter: 0.025, height: null },
  automation: { kind: 'cable', diameter: 0.01, height: null },
  coldWater: { kind: 'pipe', diameter: 0.025, height: null },
  hotWater: { kind: 'pipe', diameter: 0.022, height: null },
  sewer: { kind: 'pipe', diameter: 0.1, height: -0.2 },
  rain: { kind: 'pipe', diameter: 0.1, height: -0.2 },
  gas: { kind: 'pipe', diameter: 0.022, height: null },
  fire: { kind: 'pipe', diameter: 0.065, height: null },
  hvac: { kind: 'duct', diameter: 0.15, height: null },
  solar: { kind: 'cable', diameter: 0.01, height: null },
};

export const MEP_POINT_PREFIX = 'mpt';
export const MEP_RUN_PREFIX = 'mrun';

const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

export const isMepSystem = (s: unknown): s is MepSystem => isObject(s) && typeof s.id === 'string' && typeof s.name === 'string' && DISCIPLINES.includes(s.discipline as Discipline) && isColor(s.color);

export const isMepPoint = (p: unknown): p is MepPoint =>
  isObject(p) &&
  typeof p.id === 'string' &&
  typeof p.levelId === 'string' &&
  isPoint(p.at) &&
  finite(p.height) &&
  POINT_KIND_LIST.includes(p.kind as PointKind) &&
  typeof p.systemId === 'string' &&
  (p.power === undefined || (finite(p.power) && p.power >= 0)) &&
  (p.voltage === undefined || (finite(p.voltage) && p.voltage > 0)) &&
  (p.circuit === undefined || typeof p.circuit === 'string') &&
  (p.weight === undefined || (finite(p.weight) && p.weight >= 0)) &&
  (p.fixture === undefined || (FIXTURE_LIST as readonly unknown[]).includes(p.fixture)) &&
  (p.area === undefined || (finite(p.area) && p.area >= 0)) &&
  (p.label === undefined || typeof p.label === 'string');

export const isMepRun = (r: unknown): r is MepRun =>
  isObject(r) &&
  typeof r.id === 'string' &&
  typeof r.levelId === 'string' &&
  Array.isArray(r.points) &&
  r.points.length >= 2 &&
  r.points.every((v) => isObject(v) && finite(v.x) && finite(v.y) && finite(v.z)) &&
  typeof r.systemId === 'string' &&
  RUN_KINDS.includes(r.kind as RunKind) &&
  finite(r.diameter) &&
  r.diameter > 0;

/** The project's systems: its own, else the defaults. */
export const systemsOf = (doc: { readonly systems?: readonly MepSystem[] }): readonly MepSystem[] => doc.systems ?? DEFAULT_SYSTEMS;

/** A system by id, and its discipline (a system gone: its point's kind's). */
export const systemIn = (doc: { readonly systems?: readonly MepSystem[] }, id: string): MepSystem | undefined => systemsOf(doc).find((s) => s.id === id);

/** A point's load, voltage and weight: its own, else its kind's. */
export const pointLoad = (p: MepPoint): { power: number; voltage: number; weight: number } => ({
  power: p.power ?? POINT_KINDS[p.kind].power ?? 0,
  voltage: p.voltage ?? POINT_KINDS[p.kind].voltage ?? 127,
  weight: p.weight ?? POINT_KINDS[p.kind].weight ?? 0,
});
