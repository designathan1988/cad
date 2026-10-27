// Problems explained and put right in one click (docs/plano-de-escopo.md, "diferenciais", 7: "diagnóstico
// explicado de junções e de objetos, com correção em um clique"): for each kind of problem the panel lists
// (diagnostics.ts), why it happens, and, where there is one safe way to put it right, that way as one
// command (one undo step). Where the right fix is the user's choice (which of two rooms to keep, which
// wall to move) none is offered: the explanation says what to do. Pure.

import type { Doc } from './document';
import { referenceLength } from '../elements/opening/derive';
import type { DerivedGeometry } from './geometry';
import type { Diagnostic } from './diagnostics';
import type { Command } from '../core/store';
import { deleteElements, updateOpening } from '../elements/opening/commands';
import { updateWalls } from '../elements/wall/commands';
import type { MessageKey } from '../ui/i18n';

export interface DiagnosticFix {
  readonly label: MessageKey;
  readonly command: Command<Doc>;
}

/** Why a problem of this kind happens: its message key (`why.<kind>`), or null when there is none. */
export const whyKey = (kind: string): MessageKey | null =>
  (
    ({
      wallsOverlap: 'why.wallsOverlap',
      piecesOverlap: 'why.wallsOverlap',
      complexJoin: 'why.complexJoin',
      arcJoinUnsupported: 'why.arcJoinUnsupported',
      arcTooTight: 'why.arcTooTight',
      wallTooShort: 'why.wallTooShort',
      wallEmpty: 'why.wallEmpty',
      wallSliver: 'why.wallSliver',
      missingWallType: 'why.missingWallType',
      invalidWallType: 'why.missingWallType',
      openingNoHost: 'why.openingNoHost',
      openingBadReference: 'why.openingBadReference',
      openingOutside: 'why.openingOutside',
      openingOverlap: 'why.openingOverlap',
      openingTooTall: 'why.openingTooTall',
      openingAtJoint: 'why.openingAtJoint',
      openingSwingClash: 'why.openingSwingClash',
      roomNotEnclosed: 'why.roomNotEnclosed',
      roomShared: 'why.roomShared',
    }) as Readonly<Record<string, MessageKey>>
  )[kind] ?? null;

/** The one-click way to put a problem right, if there is a safe one. */
export function fixFor(d: Diagnostic, doc: Doc, g: DerivedGeometry): DiagnosticFix | null {
  const wall = (id: string) => doc.walls.find((w) => w.id === id);
  switch (d.kind) {
    case 'wallsOverlap':
    case 'piecesOverlap': {
      // Two walls over each other: the shorter goes, the longer stays where it is.
      const ws = d.ids.map(wall).filter((w): w is NonNullable<typeof w> => w !== undefined);
      if (ws.length < 2) return null;
      const shorter = [...ws].sort((a, b) => referenceLength(a) - referenceLength(b))[0]!;
      return { label: 'fix.deleteShorter', command: deleteElements([shorter.id]) };
    }
    case 'wallTooShort':
    case 'wallEmpty':
      return d.ids.every((id) => wall(id)) ? { label: 'fix.deleteWall', command: deleteElements([...d.ids]) } : null;
    case 'missingWallType':
    case 'invalidWallType': {
      const type = doc.wallTypes[0];
      return type ? { label: 'fix.firstType', command: updateWalls(d.ids, { wallTypeId: type.id }) } : null;
    }
    case 'openingNoHost':
      return { label: 'fix.deleteOpening', command: deleteElements([...d.ids]) };
    case 'openingBadReference':
    case 'openingOutside':
    case 'openingAtJoint':
    case 'openingOverlap': {
      // Back to the middle of its wall: where it fits if anywhere, and measured from nothing that can go.
      const id = d.ids[0];
      return id ? { label: 'fix.centre', command: updateOpening(id, { rule: { kind: 'centered' } }) } : null;
    }
    case 'openingTooTall': {
      const id = d.ids[0];
      const o = id ? doc.openings.find((x) => x.id === id) : undefined;
      const s = o ? g.solids.get(o.wallId) : undefined;
      if (!o || !s) return null;
      // As tall as the wall leaves it, 5 cm under its top.
      const height = Math.max(0.1, s.top - s.bottom - o.sill - 0.05);
      return { label: 'fix.fitHeight', command: updateOpening(o.id, { height: Math.round(height * 100) / 100 }) };
    }
    case 'openingSwingClash': {
      // The second door opens the other way.
      const id = d.ids[1] ?? d.ids[0];
      const o = id ? doc.openings.find((x) => x.id === id) : undefined;
      return o ? { label: 'fix.otherSwing', command: updateOpening(o.id, { swing: o.swing === 'left' ? 'right' : 'left' }) } : null;
    }
    default:
      return null;
  }
}
