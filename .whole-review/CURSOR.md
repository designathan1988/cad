# Cursor

What I am doing now, the next step, and open questions. Keep it short and current.

- Owner's order (2026-10-28, docs/prompt-escopo-fundamental.md, Passo 2): run this skill in fix mode; goal = the "Objetivo para a skill" there. Talk to the owner in Portuguese; project text in English; commit per verified step, git add by path, push origin main (git commit is not allowed by the hooks before apptest: commit the fixes when the hooks allow it, or at finish).
- Phase READ done (415 read, 1 skipped: src/io/project-db.ts binary). Phase VERIFY done: 139 decided, 137 confirmed, 2 rejected (F-0005, F-0025). Corrections written into F-0099 (^0.0.27 pins), F-0111 (sphere d is renamed), F-0117 (roof covering stays, label fixed), F-0122 (keyboard reach, hover browser-dependent), F-0138 (falls back to pairwise joins).
- Now phase FIX. For each: `work F-NNNN`, WebFetch how to do it, edit, re-read the changed lines and callers, update notes, mark `fixed` with Fix:, Fix source:, Verified by:. tsc must pass after the last edit. docs/agent/work.md and STATE.md editable now: update them first.
- Fixed so far (11): F-0003, F-0010, F-0021, F-0030, F-0107, F-0136, F-0139, F-0045, F-0068 (file v68 migration), F-0008 (keepOpenings: only its own wall moves an opening), F-0006 (Command.replaces). F-0126 (five stores into one component, S4, large) moved to the end with the S4s. Always run the check as `npx tsc --noEmit` alone (with `cd … &&` the ledger does not count it). After editing a file cited by an earlier fixed finding, re-read its cited ranges (line shifts!) and update that entry.
- Then also fixed: F-0042, F-0050, F-0051. TO DO after apptest (file removal blocked by the hooks now): delete src/elements/grid/carry.ts (unused since F-0051) and what only it used (registry.ts kindsOnLine, contract.ts onGrid, the kinds' onGrid in column/beam/curtain, grid/schema.ts onGrid).
- Then: F-0101, F-0106, F-0087 fixed; F-0138 blocked (needs running the property test or the app: check a star of walls in apptest). Next: the S2s F-0013, F-0019, F-0049, F-0057; then F-0023 (RC3, one descriptor per tool: move, click, right click, Escape, Enter, hint, keys, drafts); then S3, S4.
- Owner (mid-fix): "se precisar testar algo na aplicação e não ficar medindo, rodando teste cego, pode fazer". The skill's hook blocks running anything in phase fix, so what needs the app is gathered for phase apptest (F-0138 star of walls first) and fixed from what it shows.
- Fix order:
  1. RC1 (one option in many places): F-0003 context-menu keys, F-0010 footer/i18n keys, F-0021 keys twice, F-0030 next-element lists, F-0107 categories x3, F-0136 layer-stack rule x4, F-0139 2.8 m x16, F-0126 five stores, F-0045 in-line angle.
  2. RC2 (moving a door moves neighbours): F-0068 core (explicit stations + migration; tests temp-dims, arrange, opening-tool pin the old design), F-0008 dispatch wrapper, F-0006, F-0042, F-0050, F-0051.
  3. Wall-engine breaks: F-0101 (near-parallel guard, also split.ts cornerWalls), F-0106, F-0087, F-0138.
  4. RC3 (giant controllers): F-0023.
  5. The rest by severity: S2 (F-0013, F-0049, F-0057, …), then S3, then S4.
- Items to test in the app (apptest): F-0113 native select Escape, F-0122 hover title on disabled button, F-0127 dblclick after redraw, F-0138 star of walls.
