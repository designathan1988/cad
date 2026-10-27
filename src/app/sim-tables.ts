// The simulations' results as tables (sim/*), in the interface's words: what the simulations dialog
// shows (ui/simulation-dialog.ts) and the report prints (app/documents.ts), the same rows for both.
// A cell naming an element carries its id, so the dialog can select it. Each section ends with its
// premises: every result is an estimate, said with what it assumed.

import { type MessageKey, materialLabel, name, num, t } from '../ui/i18n';
import { materialIn } from '../elements/material/schema';
import { acousticOf, glaserOf, guidelineOf, R_SE, R_SI, reverberationOf, thermalOf, WALL_CLASSES, zoneWall } from '../sim/envelope';
import { roomsBeside } from './quantities';
import { levelOf } from './document';
import { DAYLIGHT, daylightOf, exteriorFaces, GLAZED, hoursOf, octant, roomSun, sunDays, sunSlots } from '../sim/exposure';
import { RISK_LIMITS, risksOf } from '../sim/risks';
import { DEFAULT_SIM, type SimSettings } from '../sim/settings';
import { accessPoints, GOOD, roomWifi } from '../sim/wifi';
import { DEFAULT_SITE } from './sun';
import type { Doc } from './document';
import type { DerivedGeometry } from './geometry';
import { roomFace } from '../tools/edit';
import { insideRing } from '../elements/room/derive';

export type SimSection = 'sun' | 'daylight' | 'thermal' | 'condensation' | 'acoustic' | 'wifi' | 'risks';
export const SIM_SECTIONS: readonly SimSection[] = ['sun', 'daylight', 'thermal', 'condensation', 'acoustic', 'wifi', 'risks'];

export type Cell = string | { readonly text: string; readonly id: string } | { readonly text: string; readonly ok: boolean };

export interface SimTable {
  readonly title?: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly Cell[])[];
  /** Columns of numbers, right-aligned. */
  readonly numeric: readonly number[];
}

export interface SimBlock {
  readonly tables: readonly SimTable[];
  /** What is said when there is nothing to show. */
  readonly empty?: string;
  readonly premises: readonly string[];
}

export const simSettingsOf = (doc: Doc): SimSettings => doc.simulation ?? DEFAULT_SIM;

const mark = (ok: boolean | null): Cell => (ok === null ? '—' : { text: t(ok ? 'services.ok' : 'services.bad'), ok });
const orientation = (azimuth: number) => t(`sim.dir.${octant(azimuth)}` as MessageKey);
const typeName = (doc: Doc, id: string) => name(doc.wallTypes.find((x) => x.id === id)?.name ?? id);
const matName = (doc: Doc, id: string) => materialLabel(materialIn(doc.materials, id));
const hours = (h: number) => `${num(h, 1)} h`;

/** The types of the walls that are there, the exterior ones first. */
function typesInUse(doc: Doc, g: DerivedGeometry): { id: string; exterior: boolean }[] {
  const inRoom = (levelId: string, p: { x: number; y: number }) => [...g.rooms.values()].some((r) => r.room.levelId === levelId && r.enclosed && insideRing(r.outline, p));
  const ext = new Set<string>();
  const used = new Set<string>();
  for (const w of doc.walls) {
    used.add(w.wallTypeId);
    const f = roomFace(doc, w, inRoom);
    if (f === 'interior' || f === 'exterior') ext.add(w.wallTypeId);
  }
  return doc.wallTypes.filter((x) => used.has(x.id)).map((x) => ({ id: x.id, exterior: ext.has(x.id) })).sort((a, b) => Number(b.exterior) - Number(a.exterior));
}

export function simBlock(section: SimSection, doc: Doc, g: DerivedGeometry, title: (id: string) => string): SimBlock {
  const s = simSettingsOf(doc);
  const site = doc.site ?? DEFAULT_SITE;
  const days = sunDays(site);
  const dayHead = [t('sim.june'), t('sim.december'), t('sim.march')];
  if (section === 'sun') {
    const faces = exteriorFaces(doc, g, site);
    const facades: SimTable = {
      title: t('sim.facades'),
      head: [t('sim.face'), t('sim.facing'), ...dayHead],
      rows: faces.map((f) => [{ text: title(f.id), id: f.id }, `${orientation(f.azimuth)} (${num(f.azimuth, 0)}°)`, ...days.map((d) => hours(hoursOf(sunSlots(doc, g, f, d, site))))]),
      numeric: [2, 3, 4],
    };
    const rooms: SimTable = {
      title: t('sim.roomsSun'),
      head: [t('memo.room'), t('sim.windows'), ...dayHead],
      rows: roomSun(doc, g, site).map((r) => [{ text: title(r.roomId), id: r.roomId }, String(r.windows), ...r.hours.map(hours)]),
      numeric: [1, 2, 3, 4],
    };
    return {
      tables: faces.length > 0 ? [facades, rooms] : [],
      empty: t('sim.noFaces'),
      premises: [t('sim.sunPremise', { lat: num(site.latitude, 2), lon: num(site.longitude, 2), north: num(site.north, 0) }), t('sim.sunShade')],
    };
  }
  if (section === 'daylight') {
    const rows = daylightOf(doc, g).map((d) => [{ text: title(d.roomId), id: d.roomId }, `${num(d.glass, 2)} m²`, `${num(d.surfaces, 2)} m²`, `${num(d.factor, 2)} %`, d.target === null ? '—' : `${num(d.target, 1)} %`, d.target === null ? '' : mark(d.factor >= d.target)]);
    return {
      tables: rows.length > 0 ? [{ head: [t('memo.room'), t('sim.glass'), t('sim.surfaces'), t('sim.dlf'), t('sim.target'), ''], rows, numeric: [1, 2, 3, 4] }] : [],
      empty: t('sim.noRooms'),
      premises: [t('sim.dlfPremise', { t: num(DAYLIGHT.transmittance, 2), sky: DAYLIGHT.sky, r: num(DAYLIGHT.reflectance, 2), glazed: num(GLAZED * 100, 0) }), t('sim.dlfTarget')],
    };
  }
  if (section === 'thermal') {
    const results = typesInUse(doc, g).map(({ id, exterior }) => ({ id, exterior, r: thermalOf(doc.wallTypes.find((x) => x.id === id)!, doc.materials, s) }));
    const rows = results.map(({ id, exterior, r }) => {
      if (r.missing.length > 0) return [typeName(doc, id), t(exterior ? 'sim.yes' : 'sim.no'), t('sim.missing', { what: r.missing.map((m) => matName(doc, m)).join(', ') }), '', '', '', '', '', '', ''];
      return [
        typeName(doc, id),
        t(exterior ? 'sim.yes' : 'sim.no'),
        `${num(r.transmittance!, 2)} W/m²K`,
        `≤ ${num(r.limitU, 1)}`,
        `${num(r.capacity!, 0)} kJ/m²K`,
        r.limitCT === null ? '—' : `≥ ${num(r.limitCT, 0)}`,
        num(r.absorptance, 2),
        `${num(r.lag!, 1)} h`,
        `${num(r.solarFactor!, 1)} %`,
        exterior ? mark(Boolean(r.okU) && r.okCT !== false) : '—',
      ];
    });
    // The exterior types against the wall NBR 15220-3 recommends for the zone.
    const wall = zoneWall(s.zone);
    const c = WALL_CLASSES[wall];
    const guide: SimTable = {
      title: t('sim.guideTitle', {
        zone: s.zone,
        wall: t(`sim.wall.${wall}`),
        limits: `U ≤ ${num(c.u, 1)}; φ ${c.lagMax !== null ? `≤ ${num(c.lagMax, 1)}` : `≥ ${num(c.lagMin!, 1)}`} h; FSo ≤ ${num(c.fso, 1)} %`,
      }),
      head: [t('sim.type'), 'U', 'φ', 'FSo', t('sim.status')],
      rows: results.flatMap(({ id, exterior, r }) => {
        const k = exterior ? guidelineOf(r, s.zone) : null;
        return k ? [[typeName(doc, id), { text: `${num(r.transmittance!, 2)} W/m²K`, ok: k.u }, { text: `${num(r.lag!, 1)} h`, ok: k.lag }, { text: `${num(r.solarFactor!, 1)} %`, ok: k.fso }, mark(k.ok)]] : [];
      }),
      numeric: [1, 2, 3],
    };
    return {
      tables: rows.length > 0 ? [{ head: [t('sim.type'), t('sim.exterior'), 'U', t('sim.limit'), 'CT', t('sim.limit'), 'α', 'φ', 'FSo', t('sim.status')], rows, numeric: [2, 3, 4, 5, 6, 7, 8] }, ...(guide.rows.length > 0 ? [guide] : [])] : [],
      empty: t('sim.noWalls'),
      premises: [t('sim.thermalPremise', { rsi: num(R_SI, 2), rse: num(R_SE, 2), zone: s.zone }), t('sim.thermalLimits'), t('sim.absorptance'), t('sim.lagPremise'), t('sim.guidePremise')],
    };
  }
  if (section === 'condensation') {
    const rows = typesInUse(doc, g).map(({ id }) => {
      const type = doc.wallTypes.find((x) => x.id === id)!;
      const r = glaserOf(type, doc.materials, s);
      if (r.missing.length > 0) return [typeName(doc, id), t('sim.missing', { what: r.missing.map((m) => matName(doc, m)).join(', ') }), '', '', ''];
      const inside = [...type.layers].reverse();
      const where = r.condenses.map((k) => (k < 0 ? t('sim.insideFace') : k >= inside.length - 1 ? t('sim.outsideFace') : t('sim.between', { a: matName(doc, inside[k]!.materialId), b: matName(doc, inside[k + 1]!.materialId) }))).join('; ');
      return [typeName(doc, id), `${num(r.planes[0]!.temperature, 1)} °C`, `${num(r.surfaceHumidity * 100, 0)} %`, r.mould ? { text: t('sim.mould'), ok: false } : { text: t('sim.noMould'), ok: true }, where ? { text: where, ok: false } : { text: t('sim.noCondensation'), ok: true }];
    });
    return {
      tables: rows.length > 0 ? [{ head: [t('sim.type'), t('sim.surfaceTemp'), t('sim.surfaceRh'), t('sim.mouldRisk'), t('sim.condensation')], rows, numeric: [1, 2] }] : [],
      empty: t('sim.noWalls'),
      premises: [t('sim.glaserPremise', { ti: num(s.inside.temperature, 1), hi: num(s.inside.humidity * 100, 0), te: num(s.outside.temperature, 1), he: num(s.outside.humidity * 100, 0) }), t('sim.glaserVapour')],
    };
  }
  if (section === 'acoustic') {
    const rows = typesInUse(doc, g).map(({ id }) => {
      const type = doc.wallTypes.find((x) => x.id === id)!;
      const r = acousticOf(type, doc.materials);
      if (r.missing.length > 0) return [typeName(doc, id), t('sim.missing', { what: r.missing.map((m) => matName(doc, m)).join(', ') }), '', ''];
      return [typeName(doc, id), `${num(r.mass!, 0)} kg/m²`, r.rw === null ? t('sim.light') : `${num(r.rw, 0)} dB`, `${num(r.r500!, 0)} dB`];
    });
    // Each room's reverberation, empty, by its finishes and its openings.
    const holes = new Map<string, { windows: number; doors: number }>();
    for (const o of doc.openings) {
      const w = doc.walls.find((x) => x.id === o.wallId);
      if (!w || !g.openings.get(o.id)?.valid) continue;
      for (const r of new Set(roomsBeside(g, o.id, w.levelId).flatMap((x) => (x ? [x.id] : [])))) {
        const h = holes.get(r) ?? { windows: 0, doors: 0 };
        holes.set(r, o.kind === 'window' ? { ...h, windows: h.windows + o.width * o.height } : { ...h, doors: h.doors + o.width * o.height });
      }
    }
    const rooms = doc.rooms.flatMap((r) => {
      const x = g.rooms.get(r.id);
      return x?.enclosed ? [{ id: r.id, area: x.area, perimeter: x.perimeter, height: r.height ?? levelOf(doc, r.levelId)?.height ?? 2.8, ...(r.finishes ? { finishes: r.finishes } : {}) }] : [];
    });
    const reverb: SimTable = {
      title: t('sim.reverb'),
      head: [t('memo.room'), t('sim.volume'), t('sim.absorption'), t('sim.t60')],
      rows: reverberationOf(rooms, (id) => holes.get(id) ?? { windows: 0, doors: 0 }).map((r) => [{ text: title(r.roomId), id: r.roomId }, `${num(r.volume, 1)} m³`, `${num(r.absorption, 2)} m²`, `${num(r.time, 2)} s`]),
      numeric: [1, 2, 3],
    };
    return {
      tables: [...(rows.length > 0 ? [{ head: [t('sim.type'), t('sim.mass'), 'Rw', 'R 500 Hz'], rows, numeric: [1, 2, 3] }] : []), ...(reverb.rows.length > 0 ? [reverb] : [])],
      empty: t('sim.noWalls'),
      premises: [t('sim.acousticPremise'), t('sim.acousticReference'), t('sim.reverbPremise')],
    };
  }
  if (section === 'wifi') {
    const aps = accessPoints(doc);
    const rows = aps.length === 0 ? [] : roomWifi(doc, g, s).map((r) => [{ text: title(r.roomId), id: r.roomId }, `${num(r.min, 0)} dBm`, `${num(r.mean, 0)} dBm`, `${num(r.covered * 100, 0)} %`, mark(r.covered >= 0.9)]);
    return {
      tables: rows.length > 0 ? [{ head: [t('memo.room'), t('sim.weakest'), t('sim.mean'), t('sim.covered', { dbm: GOOD }), ''], rows, numeric: [1, 2, 3] }] : [],
      empty: t(aps.length === 0 ? 'sim.noAp' : 'sim.noRooms'),
      premises: [t('sim.wifiPremise', { band: num(Number(s.wifi.band), 1), power: num(s.wifi.power, 0), aps: aps.length }), t('sim.wifiWalls')],
    };
  }
  const risks = risksOf(doc, g);
  const rows = risks.map((r) => [t(`sim.risk.${r.kind}` as MessageKey), t(`sim.rule.${r.rule}` as MessageKey, { v: r.value === undefined ? '' : num(r.value, 2) }), { text: title(r.elementId), id: r.elementId }]);
  return {
    tables: rows.length > 0 ? [{ head: [t('sim.riskKind'), t('sim.riskRule'), t('sim.element')], rows, numeric: [] }] : [],
    empty: t('sim.noRisks'),
    premises: [t('sim.riskPremise', { panel: num(RISK_LIMITS.panel, 0), ground: num(RISK_LIMITS.floorOverGround * 100, 0), slope: num(RISK_LIMITS.tiledSlope, 0) })],
  };
}
