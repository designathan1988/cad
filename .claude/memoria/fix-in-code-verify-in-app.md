---
name: fix-in-code-verify-in-app
description: "No test suites, mutation runs or heavy measurements; find problems by reading code, fix them, verify in the app with real gestures and screenshots"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-26T18:00:18.768Z
---

The user forbade (2026-10-26, "REGRA INVIOLÁVEL") running more test suites, mutation testing (Stryker), property fuzzing, or any slow/heavy process. Work = read the code, find the problems, fix them, then check directly in the running app with real user gestures (Playwright window), take screenshots, analyse them, and fix what they show.

**Why:** hours went into tests and measurements (Stryker 54 min, fuzz runs, repeated full suites) while the user wanted visible problems fixed; they lost patience twice in a row.

A one-off, specific check may be a small script, but it must finish in under 30 s; if it takes longer, drop it.

**How to apply:** no `vitest run`, no `npm run mutation`, no FUZZ_SCALE runs. A quick `tsc --noEmit` before committing is fine (it catches broken builds in seconds). Verify each fix in the app with gestures + a screenshot and undo any test edits made to the user's house (Ctrl+Z). This overrides [[tests-before-commit]]. Keep [[playwright-occlusion-hang]] and [[no-visible-browser]] rules.
