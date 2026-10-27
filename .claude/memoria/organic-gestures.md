---
name: organic-gestures
description: "app tests must use organic, imprecise mouse movement (Playwright Chrome), photos always analysed"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-26T18:17:33.301Z
---

The only tests allowed are using the app in Chrome via Playwright, as an end user: clicks, drags, releases, keyboard. Mouse movement must be organic, not robotic: approach in several steps, land a bit off target, wander regionally, drag in steps. Always take screenshots and analyse them for functional and interface problems, then fix in code.

**Why:** the user said the real user never lands the mouse on the exact point; precise robotic gestures hide problems.

**How to apply:** use mouse_move_xy in several intermediate steps before mouse_down/up, aim a few px off targets, never only browser_mouse_click_xy at exact coordinates. Pairs with [[fix-in-code-verify-in-app]] and [[no-visible-browser]].
