// What the simulations assume (docs/plano-de-escopo.md, phase 14), kept in the project and shown with
// every result: the bioclimatic zone (NBR 15220-3), the air on each side of the walls for the
// condensation check, the days the sun is followed, and the Wi-Fi band and power. Each value is
// "adopted" until the professional sets it. Pure.

export type WifiBand = '2.4' | '5';

export interface SimSettings {
  /** NBR 15220-3's bioclimatic zone, 1 to 8. */
  readonly zone: number;
  /** Inside and outside air for the condensation check: °C and relative humidity (0–1). */
  readonly inside: { readonly temperature: number; readonly humidity: number };
  readonly outside: { readonly temperature: number; readonly humidity: number };
  readonly wifi: { readonly band: WifiBand; /** dBm at the antenna. */ readonly power: number };
  /** The design rain for the rain pipes (mm/h, NBR 10844); none: 150, the norm's figure for up to 100 m². */
  readonly rain?: number;
  /** Where it was taken from: a place of NBR 10844's table 5 and the return (years); none: typed. */
  readonly rainPlace?: string;
  readonly rainReturn?: 1 | 5 | 25;
}

/** São Paulo (zone 3), a cold winter night outside a heated room, a common router. */
export const DEFAULT_SIM: SimSettings = {
  zone: 3,
  inside: { temperature: 20, humidity: 0.65 },
  outside: { temperature: 5, humidity: 0.85 },
  wifi: { band: '2.4', power: 20 },
};

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const air = (x: unknown): boolean => typeof x === 'object' && x !== null && finite((x as { temperature: unknown }).temperature) && finite((x as { humidity: unknown }).humidity) && (x as { humidity: number }).humidity > 0 && (x as { humidity: number }).humidity <= 1;

export const isSimSettings = (x: unknown): x is SimSettings => {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  const w = o.wifi as Record<string, unknown> | undefined;
  return finite(o.zone) && Number.isInteger(o.zone) && o.zone >= 1 && o.zone <= 8 && air(o.inside) && air(o.outside) && typeof w === 'object' && w !== null && (w.band === '2.4' || w.band === '5') && finite(w.power) && (o.rain === undefined || (finite(o.rain) && o.rain > 0)) && (o.rainPlace === undefined || typeof o.rainPlace === 'string') && (o.rainReturn === undefined || o.rainReturn === 1 || o.rainReturn === 5 || o.rainReturn === 25);
};
