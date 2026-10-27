// Every ribbon button has its short name in both languages: one missing threw while the ribbon was
// drawn, and the whole ribbon came out empty (the Norms button, 2026-10-26).

import { describe, expect, it } from 'vitest';
import { ribbonTabs } from '../../src/app/ribbon-tabs';
import { setLang, t } from '../../src/ui/i18n';
import { newDocument } from '../../src/app/document';

describe('ribbon labels', () => {
  const app = {
    ui: { tool: 'select', view: 'plan', view3d: { levels: 'all' }, levelId: 'lvl_ground', selection: new Set() },
    store: { get: () => newDocument() },
    shell: { panel: { hidden: false } },
    walker: null,
  } as never;
  for (const lang of ['pt', 'en'] as const) {
    it(`every button's short name and its tab's and panels' titles are there (${lang})`, () => {
      setLang(lang);
      const missing: string[] = [];
      for (const tab of ribbonTabs(app)) {
        for (const key of [tab.title, ...tab.panels.map((p) => p.title), ...tab.panels.flatMap((p) => p.items.flatMap((i) => (i.short ? [i.short] : [])))]) {
          try {
            if (t(key) === key) missing.push(key);
          } catch {
            missing.push(key);
          }
        }
      }
      expect(missing).toEqual([]);
    });
  }
});
