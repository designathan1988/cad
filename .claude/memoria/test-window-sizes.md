---
name: test-window-sizes
description: "App tests must cover narrow windows (≤900 px, laptop with Windows zoom) and watch the drawing's position when selecting"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-27T18:49:05.377Z
---

When testing selection, panels or any UI change, repeat the gesture at narrow window widths (880–1100 px, as a laptop at 125–150 % Windows zoom gives), not only 1920×1080, and compare screenshots before/after to see whether the drawing moved.

**Why:** 2026-10-26 the user found that selecting a door or window made the screen jump; it only happened ≤900 px (panel becomes a drawer, 3D view offset shifted). My tests at 1920 never showed it and the user called it unacceptable.

On 2026-10-27 I left the test page at 880 × 800 after a narrow check and went on testing everything there for over an hour; the user asked "POR ACASO VOCÊ ESTÁ TESTANDO EM UMA RESOLUÇÃO DE BRINQUEDO?". The working resolution is 1920 × 1080; a narrow width is a check, done and put back at once (page.setViewportSize, not the OS window), and innerWidth confirmed before judging a screenshot.

**How to apply:** for every interaction test, also run it at ~880 px and ~1280 px, and check the view does not jump (positions of walls in before/after shots). Related: [[organic-gestures]], [[fix-in-code-verify-in-app]].
