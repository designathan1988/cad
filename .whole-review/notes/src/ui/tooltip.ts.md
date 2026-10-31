# src/ui/tooltip.ts
Lines: 80
Summary: One custom tooltip for the whole interface: any element with a title has it moved into data-tip (so the browser's own tooltip never shows) and shown in a styled card after 450 ms of hover or at once on keyboard focus, placed under the element (beside tall narrow things at the left, to the left of the view corner panel), kept inside the window; hidden on leave, press, focus out, Escape or any scroll.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: one tooltip; title moved to data-tip; accessible names kept as set
- 6 DELAY_MS: 450 ms of hover before the card shows
- 8-15 installTooltips: the card (role tooltip, hidden), timer, current owner
- 17-23 textOf: title moved to data-tip (the title is removed, not linked: F-0132)
- 24-47 show: text, measured at the corner, placed under / beside / left of the owner, flipped above near the bottom, clamped inside
- 48-52 hide: timer cleared, card hidden
- 53-54 owner: the nearest element with title or data-tip
- 56-63 pointerover: a new owner starts the delay
- 64-67 pointerout: hides unless moving inside the owner (not onto the card, which takes no pointer: F-0132)
- 68 pointerdown hides
- 69-74 focusin shows at once for keyboard focus only; focusout hides
- 75-79 Escape hides; any scroll hides; the installer ends

## Contracts, state and data flow
- Global listeners installed once on the body; the card is a sibling of the app.

## Depends on / used by
- uses: nothing
- used by: app/boot or app.ts (installTooltips at start)

## Problems found (finding IDs)
- F-0132 (S4): title removed from AT, tooltip not hoverable
- F-0122 (Also): disabled buttons never show their reason

## To check in other files
- none

## Sources
- https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html : 1.4.13 dismissible, hoverable, persistent for author tooltips; the browser's title tooltip is exempt (lines 17-23, 64-67)
