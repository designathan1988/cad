# src/elements/object/formula.ts
Lines: 238
Summary: The parametric objects' formula language (never eval): numbers with a decimal point, lengths with mm/cm/m, parameter names, + − × ÷ %, comparisons, and/or/not, and functions (if, min, max, round, floor, ceil, abs, sqrt, trig in degrees, atan/atan2, clamp); parsed once (cached) into a tree, evaluated against the values; a failure is a returned error, never a thrown one.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-6 header: the language; an unknown name or division by zero fails the formula, never the app
- 8 Env: names → numbers
- 10-17 Node (number, name, unary, binary, function) and Formula (tree and names, or an error)
- 19-20 UNITS; FUNCTIONS with their arity (−1: one or more)
- 22-40 parseFormula: cached by text (cleared past 2000); parse errors — including a RangeError from very deep nesting, which try/catch takes — become a result
- 42-48 namesOf: every name the tree uses
- 50-61 evaluateFormula: a number as is; a parsed formula with every name known; a non-finite result fails
- 63-120 run: numbers, names, unary minus/not, short-circuit and/or, arithmetic, comparisons (== within 1e-9), functions (if lazy; round with a step; floor/ceil with 1e-9 slack; trig in degrees; clamp)
- 122-143 Parser: done, rest, skip whitespace, eat a token
- 145-159 or, and (|| / or, && / and), comparisons
- 160-173 sum: + and − (peekMinus)
- 174-182 product: * ×, / ÷, %
- 183-196 unary minus, ! / not; eatWord matches a whole word
- 197-216 atom: parentheses; a number with an optional unit (mm, cm, m not followed by a letter)
- 217-237 a name ([A-Za-z_À-ÿ][\wÀ-ÿ]*: the range takes × and ÷ too, so "largura×2" reads as one unknown name while "largura*2" works — the same defect as F-0044 in core/measure.ts); true/false; a function call with its arity checked (",", ";" between values)

## Contracts, state and data flow
- Pure; the cache keeps parsed trees across derivations.

## Depends on / used by
- uses: nothing
- used by: elements/object/evaluate.ts, the definition editor (validation), tests

## Problems found (finding IDs)
- F-0044 (the same character-range defect here at 217)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion : V8 throws RangeError "Maximum call stack size exceeded", catchable (lines 29-36)
