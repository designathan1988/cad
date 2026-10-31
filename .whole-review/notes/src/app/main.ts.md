# src/app/main.ts
Lines: 18
Summary: The entry module (index.html's script): the stylesheet, then boot() picks the project, then the App is built on it, input and tooltips wired, and library links opened.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 imports: the stylesheet (Vite injects it), App, boot, wireLibraryLinks, wireInput, installTooltips
- 8-9 the #app root; absent → throws (a broken index.html)
- 10-17 boot() then: App on the root with the boot result, input wired, tooltips, library links (after the project is restored, so a link merges into it). The chain is `void`: a rejection of boot() (listProjects/loadProject/saveProject) or a throw in new App leaves an empty page with only the console's unhandled-rejection message (F-0029)

## Contracts, state and data flow
- Order: project restored → App → input → tooltips → library links. Confirms library-link's merge targets the restored project.

## Depends on / used by
- uses: ui/styles.css, app/app.ts, app/boot.ts, app/library-link.ts, app/input.ts, ui/tooltip.ts
- used by: index.html (module script)

## Problems found (finding IDs)
- F-0029 a failure while starting leaves a blank page

## To check in other files
- io/project-db.ts: which calls can reject after openDb succeeded

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Window/unhandledrejection_event : a then() callback that throws, with the promise discarded by void, rejects unhandled; the default is only a console message (lines 11-17)
