---
name: compaction-memory
description: "The work in progress lives in docs/agent (orders.md, STATE.md, work.md), printed back by the SessionStart hooks at every compaction"
metadata:
  type: project
---

On 2026-10-28 the owner asked for a memory that survives compaction and auto-compaction. Only CLAUDE.md, this index and the output of
SessionStart hooks come back after a compaction (https://code.claude.com/docs/en/context-window#what-survives-compaction).

**Why:** a compaction keeps only a summary written by the model; orders, findings and where the work stood were lost with it.

**How to apply:** keep `docs/agent/STATE.md` true and under 9,000 characters; rewrite `docs/agent/work.md` when a task starts and
after every step; never edit `docs/agent/orders.md` by hand (the hook writes it). The hooks are `.claude/hooks/orders.cjs`,
`printfile.cjs` and `resume.cjs`, wired in `.claude/settings.json`; a hook prints at most 9,500 characters (past 10,000 only a 2 KB
preview reaches the session). Related: [[commit-push-github]].
