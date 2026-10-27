---
name: no-visible-browser
description: cad2 browser tests run in ONE visible (headed) Playwright window kept open and reused; never the built-in pane or Claude in Chrome, never reopen or steal focus
metadata:
  node_type: memory
  type: feedback
  originSessionId: ef9b8065-dff0-4657-add5-91c73f5deabd
  modified: 2026-10-27T15:52:39.176Z
---

Browser tests in cad2 use the Playwright MCP only, now headed (`--headless` removed from .mcp.json on 2026-10-25), in a single window that stays open for the whole session. Reuse the same page (navigate or reload in it); never call browser_close, never open new tabs or windows, and never bring the window to front. Still never use mcp__Claude_Browser__* or claude-in-chrome tools.

**Why:** on 2026-10-24 the user said "PARE DE ABRIR O NAVEGADOR NA MINHA CARA" (windows popping up). On 2026-10-25 they asked "quero poder ver o navegador que está usando nos testes, mas sem ficar abrindo e fechando toda hora. abra e deixe aberto, se precisar atualizar use a mesma instancia sem chamar foco na tela."

On 2026-10-27, after I opened a second tab (the prototype, a PDF) and resized the window, the user said "nao abra mais o navegador na minha cara, estou fazendo outra coisa": from then on, no browser use at all while they work on something else — code, tests and reading files only, and say in the report what was not checked in the app. Minutes later they asked "Cade as fotos da aplicação? voce tem que ir tirando fotos e analiando": so the rule is not "no browser" but "no new tabs/windows, no resizing, no focus": keep driving the one open test page and keep taking and analysing screenshots at every step.

Later on 2026-10-27 I broke this: I resized the page (browser_resize) and reloaded it (browser_navigate) several times to test 1280/880 px, and the user said "PARE DE LANÇAR A JANELA DO CHROME NA MINHA VISTA". Resizing and navigating raise the Chrome window. Never call browser_resize or browser_navigate while the user is working. Test narrow widths only when the user asks for it. Wait for HMR instead of reloading. If a reload is unavoidable, stop and say so in the report.

Viewport: size it from the window itself (window.outerWidth/outerHeight): width − 16, height − 105 (a 1936×1100 window gives 1920×995; maximized 2560×943). A 1080-tall viewport cut the footer off ("NÃO CABE"). After the browser is restarted the viewport comes back at 1920×1080: set it once right after the page loads.

On 2026-10-27 the user rejected a run of my own headless Chromium (scratchpad drive.cjs, minutes of SwiftShader tracing) and said "CONTINUA": verify in the Playwright page, not in a separate headless browser. If that page is lost (about:blank), loading the app again in it is the only way back.

**How to apply:** open the test window once, then drive it with real gestures; refresh by navigating in the same page. A change to .mcp.json args only takes effect after the user reconnects the playwright server (/mcp) or restarts the session. Related: [[commit-push-github]].
