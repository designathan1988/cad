---
name: scope-plan
description: "the user's scope plan (docs/plano-de-escopo.md, 15 phases) is the work to implement; test everything in a new blank project in the app"
metadata:
  node_type: memory
  type: project
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-26T19:27:49.864Z
---

On 2026-10-26 the user gave "Plano de escopo aplicação CAD BIM paramétrica.md" (copied to docs/plano-de-escopo.md) as the implementation spec: 15 phases, starting with phase 1, the element contract and registry (plus incremental recompute, spatial index, workers), then the parametric object core, a no-code editor, doors and windows as definitions, and onward to norms, costs, MEP and simulations.

The user also asked that, when implementing it, Claude opens a NEW BLANK project in the app and builds and tests everything there from the start, instead of on the "Casa Jardim" house.

**Why:** test everything from the beginning and do it right.

**How to apply:** keep a backup of Casa Jardim (downloaded .json) before starting the blank project, since the app holds one project in localStorage. Follow the phase order in the doc. Related: [[fix-in-code-verify-in-app]], [[organic-gestures]].
