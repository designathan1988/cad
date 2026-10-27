---
name: playwright-occlusion-hang
description: Playwright MCP clicks hang for minutes when the headed Chrome window is small/covered (Windows occlusion); fixed by launch flags in playwright-mcp.config.json
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-26T15:12:24.904Z
---

On 2026-10-26 Playwright MCP clicks hung 2–7+ minutes after shrinking the viewport to 768/390 px (and with CDP touch emulation). Most likely cause: CDP touch emulation left on (it never really turned off); every hung click happened with it on, and in a fresh tab without it clicks took < 1 s. Windows occlusion was a first guess, flags added anyway. The user was furious about >1 h of no progress.

**Why:** a hung tool call looks like doing nothing; the user can't see progress.
**How to apply:** cad2/.mcp.json passes `--config playwright-mcp.config.json` with `--disable-features=CalculateNativeWinOcclusion` etc. (needs MCP restart). Never use CDP touch emulation (Emulation.setTouchEmulationEnabled / setEmitTouchEventsForMouse): the override sticks to the tab even after "disabling" from another CDP session; only closing the tab (browser_tabs new + close) clears it. If any Playwright call takes > ~30 s, stop it (TaskStop) at once and tell the user, don't queue more calls. Send screenshots to the user (SendUserFile) as you go. Related: [[no-visible-browser]].
