// Commands on wall types (ref/chat.txt:12). A wall stores only its type's id: thickness, layers and
// core are derived from the type every time, so editing a type changes every wall of it at once, in
// one undo step. A command that would leave a type unusable changes nothing.

import type { Doc } from '../../app/document';
import type { Command } from '../../core/store';
import { stackProblem } from '../layers/stack';
import type { HeightRule, WallLayer, WallType, WallTypeId } from './schema';

const usable = (t: Pick<WallType, 'name' | 'layers'>): boolean => t.name.trim() !== '' && stackProblem(t.layers) === null;

export const addWallType = (type: WallType): Command<Doc> => ({
  label: 'cmd.addWallType',
  apply: (doc) => (!usable(type) || doc.wallTypes.some((t) => t.id === type.id) ? doc : { ...doc, wallTypes: [...doc.wallTypes, { ...type, name: type.name.trim() }] }),
});

/** A copy of a type, with its layers, top and base, under a new id and name. */
export const duplicateWallType = (id: WallTypeId, newId: WallTypeId, name: string): Command<Doc> => ({
  label: 'cmd.duplicateWallType',
  apply: (doc) => {
    const src = doc.wallTypes.find((t) => t.id === id);
    return src ? addWallType({ ...src, id: newId, name }).apply(doc) : doc;
  },
});

/** What can change on a type. `top` or `baseOffset` given as undefined takes it off the type. */
export interface WallTypePatch {
  readonly name?: string;
  readonly layers?: readonly WallLayer[];
  readonly top?: HeightRule | undefined;
  readonly baseOffset?: number | undefined;
}

/**
 * Name, layers, top or base offset. A top or base taken off the type leaves its walls on their level's.
 * A blank name or an unusable stack changes nothing; nor do the same values.
 */
export const updateWallType = (id: WallTypeId, patch: WallTypePatch): Command<Doc> => ({
  label: 'cmd.updateWallType',
  apply: (doc) => {
    const old = doc.wallTypes.find((t) => t.id === id);
    if (!old) return doc;
    const { top, baseOffset, ...rest } = { ...old, ...patch };
    const next: WallType = {
      ...rest,
      name: rest.name.trim(),
      ...(top !== undefined ? { top } : {}),
      ...(baseOffset !== undefined ? { baseOffset } : {}),
    };
    if (!usable(next) || JSON.stringify(next) === JSON.stringify(old)) return doc;
    return { ...doc, wallTypes: doc.wallTypes.map((t) => (t.id === id ? next : t)) };
  },
});

/** Why a type cannot be deleted: walls use it, or it is the last one. Null when it can be. */
export function typeDeleteBlocker(doc: Doc, id: WallTypeId): 'inUse' | 'last' | 'missing' | null {
  if (!doc.wallTypes.some((t) => t.id === id)) return 'missing';
  if (doc.wallTypes.length <= 1) return 'last';
  return doc.walls.some((w) => w.wallTypeId === id) ? 'inUse' : null;
}

export const deleteWallType = (id: WallTypeId): Command<Doc> => ({
  label: 'cmd.deleteWallType',
  apply: (doc) => (typeDeleteBlocker(doc, id) === null ? { ...doc, wallTypes: doc.wallTypes.filter((t) => t.id !== id) } : doc),
});
