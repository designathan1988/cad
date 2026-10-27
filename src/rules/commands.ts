// Commands on the project's norm rules. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../app/document';
import type { Command } from '../core/store';
import { newId } from '../core/id';
import type { RoomUse } from '../elements/room/schema';
import { packsOf, type Rule, type RulePack, rulesOf, type RuleSubject, type Severity } from './schema';

export type RulePatch = {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  readonly source?: string;
  readonly article?: string;
  readonly on?: boolean;
  readonly severity?: Severity;
  readonly uses?: readonly RoomUse[];
};

/** One rule changed; the project takes its own copy of the rules the first time. */
export const updateRule = (id: string, patch: RulePatch): Command<Doc> => ({
  label: 'cmd.updateRule',
  apply: (doc) => {
    if ([patch.min, patch.max].some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    const list = rulesOf(doc);
    let changed = false;
    const rules = list.map((r): Rule => {
      if (r.id !== id) return r;
      // A bound set to undefined is taken off: "no maximum".
      const next = Object.fromEntries(Object.entries({ ...r, ...patch }).filter(([, v]) => v !== undefined)) as unknown as Rule;
      if (JSON.stringify(next) === JSON.stringify(r)) return r;
      changed = true;
      return next;
    });
    return changed ? { ...doc, rules } : doc;
  },
});

/** Back to the rules a new project has. */
export const resetRules = (): Command<Doc> => ({
  label: 'cmd.resetRules',
  apply: (doc) => {
    if (doc.rules === undefined && doc.rulePacks === undefined) return doc;
    const { rules: _rules, rulePacks: _packs, ...rest } = doc;
    return rest;
  },
});

/** A new rule on a subject, in a pack, with no bounds yet (to be filled in from the norm). */
export const addRule = (subject: RuleSubject, pack: string | undefined, source: string): Command<Doc> => ({
  label: 'cmd.addRule',
  apply: (doc) => ({ ...doc, rules: [...rulesOf(doc), { id: newId('rule'), subject, source, on: true, ...(pack ? { pack } : {}) }] }),
});

export const deleteRule = (id: string): Command<Doc> => ({
  label: 'cmd.deleteRule',
  apply: (doc) => {
    const list = rulesOf(doc);
    return list.some((r) => r.id === id) ? { ...doc, rules: list.filter((r) => r.id !== id) } : doc;
  },
});

/** A pack's data changed (its name, where it holds, its edition). */
export const updatePack = (id: string, patch: Partial<Omit<RulePack, 'id'>>): Command<Doc> => ({
  label: 'cmd.updatePack',
  apply: (doc) => {
    const list = packsOf(doc);
    if (!list.some((p) => p.id === id)) return doc;
    return { ...doc, rulePacks: list.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
  },
});

/**
 * Packs and their rules brought in (a pack file, ui/rules-dialog.ts): a pack the project has under
 * the same id is replaced, with its rules; the others are added.
 */
export const importPacks = (packs: readonly RulePack[], rules: readonly Rule[]): Command<Doc> => ({
  label: 'cmd.importPacks',
  apply: (doc) => {
    const ids = new Set(packs.map((p) => p.id));
    const ruleIds = new Set(rules.map((r) => r.id));
    return {
      ...doc,
      rulePacks: [...packsOf(doc).filter((p) => !ids.has(p.id)), ...packs],
      rules: [...rulesOf(doc).filter((r) => !(r.pack !== undefined && ids.has(r.pack)) && !ruleIds.has(r.id)), ...rules],
    };
  },
});
