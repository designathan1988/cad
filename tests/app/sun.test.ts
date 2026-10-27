// The sun's place (phase 11), against values worked out by hand and NOAA's calculator: at the June
// solstice the sun's declination is +23.44°, so at true solar noon its altitude is 90° − |latitude −
// 23.44°|; at the equinoxes it rises due east at about 6:00 solar time.

import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE, isSite, northOf, siteInstant, sunDirection, sunPosition } from '../../src/app/sun';

describe('the sun', () => {
  it('at the June solstice, at solar noon in São Paulo, it stands north at about 43°', () => {
    // Solar noon at 46.63° W: 12:00 + 46.63 × 4 min ≈ 15:07 UTC, less the equation of time (−1.7 min).
    const p = sunPosition(-23.55, -46.63, Date.UTC(2026, 5, 21, 15, 8));
    expect(p.altitude).toBeCloseTo(90 - (23.55 + 23.44), 0);
    expect(Math.min(p.azimuth, 360 - p.azimuth)).toBeLessThan(2);
  });

  it('at the December solstice, at solar noon there (15:05 UTC: the equation of time is +1.7 min), it is all but overhead', () => {
    const p = sunPosition(-23.55, -46.63, Date.UTC(2026, 11, 21, 15, 5));
    expect(p.altitude).toBeGreaterThan(89);
  });

  it('at the March equinox, at the equator, it rises in the east and stands overhead at noon', () => {
    const rise = sunPosition(0, 0, Date.UTC(2026, 2, 20, 6, 7));
    expect(Math.abs(rise.altitude)).toBeLessThan(1.5);
    expect(rise.azimuth).toBeCloseTo(90, 0);
    expect(sunPosition(0, 0, Date.UTC(2026, 2, 20, 12, 7)).altitude).toBeGreaterThan(88);
  });

  it('a local date and hour as an instant: Brasília is three hours behind UTC', () => {
    expect(siteInstant({ date: '2026-06-21', time: '10:00', utcOffset: -3 })).toBe(Date.UTC(2026, 5, 21, 13, 0));
    expect(siteInstant({ date: '21/06/2026', time: '10:00', utcOffset: -3 })).toBeNaN();
  });

  it('in plan: the morning sun of the southern winter comes from the north-east, low; turned with the plan\'s north', () => {
    const d = sunDirection(DEFAULT_SITE)!;
    expect(d.x).toBeGreaterThan(0);
    expect(d.y).toBeGreaterThan(0);
    expect(d.z).toBeGreaterThan(0.3);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1, 9);
    // North a quarter turn to the left of the plan's up: the plan's west.
    const n = northOf({ north: 90 });
    expect(n.x).toBeCloseTo(-1, 9);
    expect(n.y).toBeCloseTo(0, 9);
  });

  it('a site read from a file is checked', () => {
    expect(isSite(DEFAULT_SITE)).toBe(true);
    expect(isSite({ ...DEFAULT_SITE, latitude: 95 })).toBe(false);
    expect(isSite({ ...DEFAULT_SITE, time: '25h' })).toBe(false);
  });
});
