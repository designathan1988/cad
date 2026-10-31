# index.html
Lines: 17
Summary: The page Vite serves and builds from: charset, viewport, title, favicon from public/, the Inter font (400/500/600) from Google Fonts with preconnects, the #app root and the module entry src/app/main.ts.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 doctype; html lang="en" (the app rewrites document.documentElement.lang to the chosen language at start: app.ts)
- 3-11 head: UTF-8, viewport width=device-width initial-scale=1 (phones), title "cad2" (renderChrome sets "<project> · cad2"), favicon /favicon.svg (public/favicon.svg exists; Vite serves public/ at /)
- 8-10 preconnect to fonts.googleapis.com and fonts.gstatic.com (crossorigin: font files are CORS fetches), stylesheet Inter wght 400;500;600 with display=swap (fallback text at once, Inter swapped in when loaded)
- 12-16 body: <div id="app"> (the root main.ts mounts on); <script type="module" src="/src/app/main.ts"> (Vite resolves it as the entry of the module graph)

## Contracts, state and data flow
- The interface depends on a third-party CDN for its font; offline or blocked, the fallback font of --font in styles.css is used (display=swap). Not a defect, a dependency.

## Depends on / used by
- uses: public/favicon.svg, src/app/main.ts, fonts.googleapis.com
- used by: Vite dev server and build (the entry)

## Problems found (finding IDs)
- none in this file

## To check in other files
- src/ui/styles.css: --font names Inter first with a fallback stack
- src/app/main.ts: mounts on #app

## Sources
- https://vite.dev/guide/assets : public/ served at / and referenced by root-absolute path (/favicon.svg)
- https://developers.google.com/fonts/docs/css2 : wght@400;500;600 requests three weights; display sets font-display
- https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display : swap = tiny block period, infinite swap period
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect : preconnect starts DNS/TCP/TLS early for cross-origin requests
