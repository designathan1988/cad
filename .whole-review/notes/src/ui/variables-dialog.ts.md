# src/ui/variables-dialog.ts
Lines: 83
Summary: The project variables dialog: named lengths typed by name in any measure; a row per variable with its name (renamed in place, refused when not a valid or a taken name), its length and a remove button; Add creates vN = 1 m; the setProjectVariables command (validated, removes the field when empty).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: named lengths typed by name; one command each; kept in the file, read by core/measure
- 5-13 imports: App, Doc, isVariableName, Command, controls, dialog, textField, i18n, icons
- 15-26 setProjectVariables: every name valid and value finite, else unchanged; equal → unchanged; empty → field removed
- 28-32 showVariables: the status text; the current variables and the setter
- 33-46 a row's name: renamed in place keeping the order; a bad or taken name (checked with `in`: F-0134) said in the status
- 47-49 its length field, labelled
- 50-58 remove button; the row
- 59-67 Add: the first free vN, 1 m
- 68-79 Close, column heads, empty note, the dialog with the status (or the note)
- 80-82 opened; focus on Add

## Contracts, state and data flow
- Through openProjectDialog; the document's variables are pushed to core/measure by the app.

## Depends on / used by
- uses: core/measure (isVariableName), core/store, ui/controls, ui/dialog, ui/fields (textField), ui/i18n, ui/icons
- used by: app (variables action)

## Problems found (finding IDs)
- F-0134 (S4): names checked with `in`

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in : `in` is true for inherited properties; Object.hasOwn for own ones (line 37, F-0134)
