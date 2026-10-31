# src/ui/fields.ts
Lines: 249
Summary: The one renderer of every element's field schema (elements/*/fields.ts): the Field type (number, text, select/segmented/search, readout, note, action, with when/own/reset/icon/sub/wide), the common value of a selection ("varies" when they differ), the side panel's section of rows (with the own-over-type mark and the way back), the ribbon's rows (a reduced form), the control per kind, a per-id icon table and the text field.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-5 header: panels generated from field schemas; common value or varies; when; own value with a way back
- 7-9 imports: shared controls, i18n, icons
- 11-29 Common: id, label and its variables, icon, wide, sub, when, own, reset, ownWords
- 31-32 FieldOption: value, label, short, icon, thumb, keywords
- 34-59 Field union: number (get/set/min/unit/decimals), text (placeholder), select/segmented/search (options, labelled), readout, note, action (run, enabled)
- 61-65 FieldState: the field and its common value
- 67-79 fieldStates: the fields whose `when` holds; readouts/notes their text; actions enabled or not; others the first item's value when every item's JSON equals it, else null
- 81-135 FIELD_ICONS: the icon per field id, alike in every panel
- 137-141 labelled: icon + words, or words
- 143-184 fieldsSection: rows per state; notes and actions across the row; a control per field; number labels scrub; an own value gets the mark, aria-describedby to the note, and a reset button; the note added once; a remembered section
- 186-205 ribbonFieldRows: label (icon + words) and control per editable field; readouts/notes/actions and the own mark/reset left out; scrub on a span label (no live preview) (F-0030 Also)
- 207-208 minOf: the fixed or selection-dependent minimum
- 210-227 controlFor: numberField, textField, select, segmented (labelled when none has an icon), searchSelect, readout div
- 229-248 textField: one-line input, varies placeholder, commit on blur when changed, Enter blurs, Esc restores (F-0059 Also)

## Contracts, state and data flow
- Pure description → DOM; set callbacks dispatch through the element's commands. The same field list feeds both the panel and the ribbon through two renderers that differ (F-0030 Also).

## Depends on / used by
- uses: ui/controls, ui/i18n, ui/icons
- used by: every element's panel (elements/*/panel.ts, kinds via the registry), app/ribbon-tabs.ts and app/chrome.ts (ribbonFieldRows), app/next-element.ts (Field type), elements/*/fields.ts (Field type)

## Problems found (finding IDs)
- F-0030 (Also): the ribbon and the panel render the same fields differently
- F-0059 (Also): text fields are one-line inputs

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-describedby : a list of ids of elements in the same document whose text describes the control (lines 168-182: the own-value note)
