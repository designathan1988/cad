// Problems explained and put right in one click (phase 11): each problem the panel lists has its
// explanation, and where a fix is offered, applying it makes that problem go away.

import { describe, expect, it } from 'vitest';
import { type Doc, type DocWall, newDocument } from '../../src/app/document';
import { deriveGeometry } from '../../src/app/geometry';
import { diagnose } from '../../src/app/diagnostics';
import { fixFor, whyKey } from '../../src/app/diagnostic-fixes';
import { newOpening } from '../../src/elements/opening/schema';
import { getLang, hasMessage, setLang, t } from '../../src/ui/i18n';

const wall = (id: string, a: [number, number], b: [number, number], type = 'wt_concrete20'): DocWall => ({
  id,
  wallTypeId: type,
  start: { x: a[0], y: a[1] },
  end: { x: b[0], y: b[1] },
  referenceLine: 'centerline',
  levelId: 'lvl_ground',
  baseOffset: 0,
  top: { kind: 'level', offset: 0 },
});

/** The problem of this kind in the document, fixed: the kinds left after its fix. */
function fixed(doc: Doc, kind: string): { label: string; after: string[] } {
  const d = diagnose(deriveGeometry(doc)).find((x) => x.kind === kind);
  expect(d, kind).toBeDefined();
  const fix = fixFor(d!, doc, deriveGeometry(doc));
  expect(fix, kind).not.toBeNull();
  const next = fix!.command.apply(doc);
  return { label: fix!.label, after: diagnose(deriveGeometry(next)).map((x) => x.kind) };
}

describe('diagnostic fixes', () => {
  it('every problem kind has its explanation, in both languages', () => {
    const kinds = [
      'wallsOverlap', 'piecesOverlap', 'complexJoin', 'arcJoinUnsupported', 'arcTooTight', 'wallTooShort', 'wallEmpty',
      'wallSliver', 'missingWallType', 'invalidWallType', 'openingNoHost', 'openingBadReference', 'openingOutside',
      'openingOverlap', 'openingTooTall', 'openingAtJoint', 'openingSwingClash', 'roomNotEnclosed', 'roomShared',
    ];
    for (const k of kinds) {
      const key = whyKey(k);
      expect(key, k).not.toBeNull();
      expect(hasMessage(key!), k).toBe(true);
      const was = getLang();
      for (const l of ['en', 'pt'] as const) {
        setLang(l);
        expect(t(key!).length, k).toBeGreaterThan(20);
      }
      setLang(was);
    }
    expect(whyKey('nothingLikeThis')).toBeNull();
  });

  it('two walls over each other: the shorter one goes', () => {
    const doc: Doc = { ...newDocument(), walls: [wall('a', [0, 0], [6, 0]), wall('b', [1, 0], [3, 0])] };
    const d = diagnose(deriveGeometry(doc)).find((x) => x.kind === 'wallsOverlap' || x.kind === 'piecesOverlap')!;
    const fix = fixFor(d, doc, deriveGeometry(doc))!;
    const next = fix.command.apply(doc);
    expect(next.walls.map((w) => w.id)).toEqual(['a']);
  });

  it('a wall whose type is gone gets the first type', () => {
    const doc: Doc = { ...newDocument(), walls: [wall('a', [0, 0], [6, 0], 'wt_gone')] };
    const r = fixed(doc, 'missingWallType');
    expect(r.label).toBe('fix.firstType');
    expect(r.after).not.toContain('missingWallType');
  });

  it('a door past its wall\'s end goes back to the middle', () => {
    const doc: Doc = {
      ...newDocument(),
      walls: [wall('a', [0, 0], [4, 0])],
      openings: [newOpening('o', 'a', 'door', { kind: 'fromStart', distance: 3.8 })],
    };
    const r = fixed(doc, 'openingOutside');
    expect(r.label).toBe('fix.centre');
    expect(r.after).not.toContain('openingOutside');
  });

  it('a window above the wall\'s top is made to fit under it', () => {
    const doc: Doc = {
      ...newDocument(),
      walls: [wall('a', [0, 0], [4, 0])],
      openings: [{ ...newOpening('o', 'a', 'window', { kind: 'centered' }), sill: 1, height: 5 }],
    };
    const r = fixed(doc, 'openingTooTall');
    expect(r.label).toBe('fix.fitHeight');
    expect(r.after).not.toContain('openingTooTall');
  });

  it('a door whose wall is gone is deleted', () => {
    const doc: Doc = { ...newDocument(), openings: [newOpening('o', 'gone', 'door', { kind: 'centered' })] };
    const r = fixed(doc, 'openingNoHost');
    expect(r.label).toBe('fix.deleteOpening');
    expect(r.after).toEqual([]);
  });

  it('where the choice is the user\'s (two rooms in one space), no fix is offered', () => {
    expect(fixFor({ severity: 'warn', kind: 'roomShared', ids: ['r1', 'r2'] }, newDocument(), deriveGeometry(newDocument()))).toBeNull();
  });
});
