// The office's logo in the lot (phase 10: "carimbo com o logotipo do escritório"): kept as a PNG or JPEG
// data URL, checked as the file is read, not over its size.

import { describe, expect, it } from 'vitest';
import { newDocument } from '../../src/app/document';
import { DEFAULT_LOT, isLogo, isLot, LOGO_MAX } from '../../src/app/lot';
import { readProject, writeProject } from '../../src/io/project-file';

// A 1 × 1 white PNG.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

describe('the office logo', () => {
  it('a PNG or a JPEG as a data URL, not another type, not text, not over the size kept', () => {
    expect(isLogo(PNG)).toBe(true);
    expect(isLogo(PNG.replace('image/png', 'image/jpeg'))).toBe(true);
    expect(isLogo(PNG.replace('image/png', 'image/svg+xml'))).toBe(false);
    expect(isLogo('data:image/png;base64,<script>')).toBe(false);
    expect(isLogo(`data:image/png;base64,${'A'.repeat(LOGO_MAX)}`)).toBe(false);
  });

  it('in the lot, and the file keeps it; a bad one leaves the lot out, as any bad lot', () => {
    expect(isLot({ ...DEFAULT_LOT, logo: PNG })).toBe(true);
    expect(isLot({ ...DEFAULT_LOT, logo: 'x' })).toBe(false);
    const doc = { ...newDocument(), lot: { ...DEFAULT_LOT, firm: 'Escritório', logo: PNG } };
    const r = readProject(writeProject(doc));
    expect(r.ok && r.doc.lot?.logo).toBe(PNG);
  });
});
