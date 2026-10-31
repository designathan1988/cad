# src/app/library-link.ts
Lines: 63
Summary: Libraries (object definitions and materials) shared by link: copying a library's link to the clipboard (refused past 100 kB), and opening a link from the address (at start or on hashchange) as one undo step, the hash taken off the address first.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: link from the objects'/materials' dialog; opened here or in an open tab; one undo step; hash removed so a reload does not repeat it
- 5-7 imports: library-file (LibraryFile, libraryFromHash, libraryHash, LINK_KEY, mergeLibrary), i18n, App type
- 9-10 LINK_MAX: 100,000 characters, past which mail/chat cut links
- 12-26 copyLibraryLink: origin + path + the encoded hash (awaited); too long → toast with kB; writeText; success toast with counts; a refusal (NotAllowedError, insecure context) logged and said in a toast
- 28-41 openLibraryLink: only when the hash holds LINK_KEY; the hash removed with replaceState (fires no hashchange, so no loop); decoded (async); a failure logged and toasted
- 42-46 a first merge to validate and count; not ok → toast
- 47-54 the dispatch: one command that merges into the document as it is when applied (so undo/redo re-merge against the current doc)
- 55-56 the toast with definitions, materials, bad and same counts (from the first merge)
- 58-62 wireLibraryLinks: at start and on every hashchange (fire-and-forget; openLibraryLink catches its own errors except mergeLibrary/dispatch throws)

## Contracts, state and data flow
- writeText runs after an await (libraryHash); browsers that require the user's activation still active may refuse after the async gap; handled by the catch with a toast.
- Opening a link at start runs before or after the project restore depending on boot order (boot.ts: to check), since the merge targets the document open at that moment.

## Depends on / used by
- uses: io/library-file.ts, ui/i18n.ts, app/app.ts (store, toast)
- used by: app/boot.ts or app.ts (wireLibraryLinks), ui object/material dialogs (copyLibraryLink): to confirm when read

## Problems found (finding IDs)
- none

## To check in other files
- boot.ts: wireLibraryLinks called after the stored project is restored (else the merge lands in the blank doc and is then replaced)

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState : same-origin URL, no load; fires neither popstate nor hashchange (line 33)
- https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText : secure context only; rejects with NotAllowedError when not allowed (lines 19-25)
