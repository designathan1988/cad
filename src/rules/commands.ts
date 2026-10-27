// Commands on the project's norm rules. Each returns a new document; the store makes each one undo step.

import type { Doc } from '../app/document';
import type { Command } from '../core/store';
import { type Rule, rulesOf } from './schema';

export type RulePatch = { readonly min?: number; readonly max?: number; readonly source?: string; readonly on?: boolean };

/** One rule changed; the project takes its own copy of the rules the first time. */
export const updateRule = (id: string, patch: RulePatch): Command<Doc> => ({
  label: 'cmd.updateRule',
  apply: (doc) => {
    if ([patch.min, patch.max].some((v) => v !== undefined && !Number.isFinite(v))) return doc;
    const list = rulesOf(doc);
    let changed = false;
    const rules = list.map((r): Rule => {
      if (r.id !== id) return r;
      const next = { ...r, ...patch };
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
    if (doc.rules === undefined) return doc;
    const { rules: _rules, ...rest } = doc;
    return rest;
  },
});
