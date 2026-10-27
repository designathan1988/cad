---
name: tests-before-commit
description: "In cad2, run vitest alone and check its exit code before committing; never chain `vitest | grep && git commit`"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-26T16:03:53.751Z
---

Twice (2026-10-26) a commit went out with a failing test because `npx vitest run | grep ... && git add && git commit` — grep's exit code hid vitest's.

**Why:** the user's rules forbid shipping broken work and claiming it passed.
**How to apply:** `npx vitest run > file; echo EXIT=$?` (and `npx tsc --noEmit`), read the result, and only then run `git commit` as a separate command. The tokens test also rejects raw px in styles.css outside `:root` tokens.
