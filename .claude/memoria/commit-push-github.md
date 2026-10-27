---
name: commit-push-github
description: "In cad2, always commit finished work and push it to github.com/designathan1988/cad (remote origin, branch main)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ef9b8065-dff0-4657-add5-91c73f5deabd
  modified: 2026-10-25T18:34:59.424Z
---

Always commit and push cad2 work to https://github.com/designathan1988/cad.git (remote `origin`, branch `main`, set up on 2026-10-25 with `git push -u origin main`).

**Why:** the user asked "faça push e commit em https://github.com/designathan1988/cad.git e sempre commit lá" (2026-10-25).

On 2026-10-25 the user added "FAÇA COMMIT REGULARMENTE": commit in small steps, each feature or fix as soon as it passes `npm run check` and its browser check, rather than batching several features into one late commit.

**How to apply:** after each finished, verified change, commit (repo style: English message, tests alongside) and `git push`. Stage only project files (src, tests, docs, config the user changed on purpose); never stage `.claude/`, `.playwright-mcp/`, `CLAUDE.md`, `_hooks-novos/` or the watcher's files unless asked. Related: [[no-visible-browser]].
