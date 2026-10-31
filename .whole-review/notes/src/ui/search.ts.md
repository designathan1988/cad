# src/ui/search.ts
Lines: 46
Summary: The fuzzy search used by the palette, menus' typeahead and the search-select: case and accents folded, every query word must match; label start ranks highest, then a word start, then anywhere, then keywords (word start, anywhere), then letters in order within one word; the whole multi-word query starting the label gets a bonus; ties keep the list order.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: the ranking rules
- 6-10 Searchable: label and hidden keywords
- 12 fold: lower case, NFD, every Unicode mark removed (\p{M} with the u flag)
- 14-27 score: 4 label start, 3 word start, 2 inside, 1.5 keyword word start, 1 keyword inside, 0.5 letters in order inside one word, else 0
- 29-45 searchEntries: query words; empty → all; per entry its scores, all must be positive, summed plus 2 when the whole query starts the label; sorted by total then original order

## Contracts, state and data flow
- Pure; stable for ties.

## Depends on / used by
- uses: nothing
- used by: ui/palette.ts, ui/controls.ts (searchSelect), ui/menu-keys.ts (fold)

## Problems found (finding IDs)
- none (the stores' own folds that differ from this one: F-0126)

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Unicode_character_class_escape : \p{...} property escapes need the u or v flag; \p{M} is the Mark category (line 12)
