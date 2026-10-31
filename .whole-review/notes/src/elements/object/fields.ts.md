# src/elements/object/fields.ts
Lines: 152
Summary: The parametric object's panel: its definition (readout), type, each parameter (lengths, numbers, integers, yes/no, choices, materials; calculated ones as readouts) read from the evaluation and written as the instance's own with a way back to the type's, and the elevation (not below the floor with collisions on); words in the interface's language.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: values read from the evaluation, written as the instance's own (one step), back to the type's; several of one definition together; of several definitions only their place
- 6-15 imports: collisionsOn, LENGTH_LIMITS/sizeParams, types, Field, i18n, lengthText, object commands, schema types
- 17-22 ObjectItem: instance, definition, evaluation
- 24 words: a definition's Words in the interface language
- 26-38 verticalParams: lengths used in upright parts' z/height or dragged vertically (height icon); found by a regex \bname\b over the formulas' text — \b knows only ASCII letters, so a parameter named with an accent (altura_útil) is matched wrongly, and a name with regex metacharacters would make a bad pattern (names are not escaped)
- 40-47 objectFields: ids; the definition readout
- 48-60 one definition: its type select
- 61-70 per parameter shown (its `when` condition holding for all): a raw label (calculated marked), own/reset, a setter of the instance's value
- 71-72 calculated: a readout
- 73-87 lengths/numbers/integers: number field; icon by direction; min (a size's least, else 1 mm; counts their own; numbers 0 when their range starts there); decimals by step
- 88-101 yes/no: segmented
- 102-112 choice: its options by index
- 113-126 material: a select of the project's materials
- 127-138 elevation: min 0 with collisions on (module flag core/collisions.ts), else unbounded
- 140-145 shown: a calculated value, "varies", a length in the project unit or a number with the language's decimal mark
- 147-151 stepDecimals: decimals a step needs (at most 3)

## Contracts, state and data flow
- The panel's values come from the evaluation (held values), so what is shown is what is drawn.

## Depends on / used by
- uses: core/collisions.ts, elements/object/evaluate.ts, commands.ts, schema.ts, ui/i18n.ts, ui/units.ts, ui/fields.ts (type)
- used by: elements/kinds/object.ts (fields), app/kind-tools.ts and model-import.ts (words), app/next-element.ts (via kind)

## Problems found (finding IDs)
- none (the \b classification affects only the icon)

## To check in other files
- elements/object/valid.ts: parameter name rules

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Word_boundary_assertion : \b word characters are [A-Za-z0-9_] only; accented letters are non-word (line 37)
