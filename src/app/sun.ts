// The site and the sun (docs/plano-de-escopo.md, phase 11: "imagens com sol por data, hora e
// localização, sombras"): where the project is (latitude, longitude, the plan's north), and the sun's
// place in the sky at a date and hour there, by NOAA's solar position equations (accurate to about a
// tenth of a degree from 1901 to 2099). Pure.

import type { Point2 } from '../core/vector';

export interface Site {
  /** Degrees, north positive. */
  readonly latitude: number;
  /** Degrees, east positive. */
  readonly longitude: number;
  /** Where north is in plan: degrees counter-clockwise from the plan's up (+y). */
  readonly north: number;
  /** The local date and hour the sun is shown at, "YYYY-MM-DD" and "HH:MM", and the hours the clock is
   * ahead of UTC (−3 in Brasília). */
  readonly date: string;
  readonly time: string;
  readonly utcOffset: number;
  /** Shadows cast in the 3D view. */
  readonly shadows: boolean;
}

/** São Paulo at the June solstice at 10:00: a sun low enough for shadows to read. */
export const DEFAULT_SITE: Site = { latitude: -23.55, longitude: -46.63, north: 0, date: '2026-06-21', time: '10:00', utcOffset: -3, shadows: false };

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The instant of a local date and hour (ms since 1970, UTC); NaN when it is not one. */
export function siteInstant(s: Pick<Site, 'date' | 'time' | 'utcOffset'>): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(s.time);
  if (!d || !t) return Number.NaN;
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) - s.utcOffset * 3600000;
}

/** The sun at an instant from a place: its azimuth (degrees from north, clockwise) and altitude (degrees above the horizon). */
export function sunPosition(latitude: number, longitude: number, utcMs: number): { azimuth: number; altitude: number } {
  const jd = utcMs / 86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const omega = 125.04 - 1934.136 * T;
  const lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda)));
  const y = Math.tan(rad(eps / 2)) ** 2;
  const eqTime = 4 * deg(y * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) - 0.5 * y * y * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const minutes = (((utcMs / 60000) % 1440) + 1440) % 1440;
  const trueSolar = (((minutes + eqTime + 4 * longitude) % 1440) + 1440) % 1440;
  const ha = rad(trueSolar / 4 - 180);
  const lat = rad(latitude);
  const cosZen = Math.max(-1, Math.min(1, Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)));
  const zen = Math.acos(cosZen);
  const az = deg(Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat))) + 180;
  return { azimuth: ((az % 360) + 360) % 360, altitude: 90 - deg(zen) };
}

/** Where north points in plan (unit), the plan's up turned by the site's north. */
export function northOf(s: Pick<Site, 'north'>): Point2 {
  const t = rad(s.north);
  return { x: -Math.sin(t), y: Math.cos(t) };
}

/** The way to the sun in plan coordinates and height (unit): x, y in plan, z up. */
export function sunDirection(s: Site): { x: number; y: number; z: number } | null {
  const at = siteInstant(s);
  if (!Number.isFinite(at)) return null;
  const p = sunPosition(s.latitude, s.longitude, at);
  const n = northOf(s);
  // East: north turned a quarter clockwise.
  const e = { x: n.y, y: -n.x };
  const a = rad(p.azimuth);
  const h = Math.cos(rad(p.altitude));
  return { x: (n.x * Math.cos(a) + e.x * Math.sin(a)) * h, y: (n.y * Math.cos(a) + e.y * Math.sin(a)) * h, z: Math.sin(rad(p.altitude)) };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const isSite = (x: unknown): x is Site => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    finite(o.latitude) &&
    Math.abs(o.latitude) <= 90 &&
    finite(o.longitude) &&
    Math.abs(o.longitude) <= 180 &&
    finite(o.north) &&
    typeof o.date === 'string' &&
    typeof o.time === 'string' &&
    finite(o.utcOffset) &&
    Math.abs(o.utcOffset) <= 14 &&
    typeof o.shadows === 'boolean' &&
    Number.isFinite(siteInstant(o as unknown as Site))
  );
};
