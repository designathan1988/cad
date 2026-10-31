// Every group of the tools' rail and every short name of its buttons is there in both languages: one missing
// threw while the ribbon (the rail's forerunner) was drawn, and the whole ribbon came out empty (2026-10-26).

import { describe, expect, it } from 'vitest';
import { railGroups } from '../../src/ui/tool-rail';
import { setLang, t } from '../../src/i18n/messages';
import { newDocument } from '../../src/project/doc';
import { lid } from '../ids';
import type { BarItem } from '../../src/ui/bars';

describe('rail labels', () => {
  const app = {
    ui: { tool: 'select', view: 'plan', view3d: { levels: 'all' }, levelId: lid('lvl_ground'), selection: new Set(), objectDef: null },
    store: { get: () => newDocument() },
    shell: { panel: { hidden: false } },
  } as never;
  const shorts = (i: BarItem): string[] => [...(i.short ? [i.short] : []), ...(i.menu?.() ?? []).flatMap(shorts)];
  for (const lang of ['pt', 'en'] as const) {
    it(`every group's name and every button's short name are there (${lang})`, () => {
      setLang(lang);
      const missing: string[] = [];
      for (const group of railGroups(app)) {
        for (const key of [group.name, ...group.items.flatMap(shorts)]) {
          try {
            if (t(key as never) === key) missing.push(key);
          } catch {
            missing.push(key);
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }
});
