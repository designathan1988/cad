# tests/ui/search.test.ts
Lines: 45
Summary: Tests of the command palette search:
- An empty or blank query gives everything, in the given order.
- Case and accents are ignored.
- Every word must match, in any order, in the label or the keywords.
- A label starting with the query ranks before one that only contains it.
- The letters of one word may match in order with gaps (prd finds Parede), but never across words.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-2 imports: vitest, searchEntries
- 4-13 six entries (labels in Portuguese, keywords in English) and ids()
- 15-19 '' and '   ' → all ids in order
- 21-24 'terreo' and 'TÉRREO' → level
- 26-30 'escuro tema' and 'dark' → theme; 'tema janela' → none
- 32-36 'pa' → wall first; plan also found
- 38-44 'prd' → wall; 'jnl' → window; 'trro' → level only (not across the theme's words); suite closes (line 45 blank)

## Contracts, state and data flow
- searchEntries is pure: it normalises (case, accents), splits the query into words, requires every word to match by prefix, substring or in-word subsequence, and ranks prefix matches first. The store dialogs keep their own folds and do not use it (F-0126).

## Depends on / used by
- uses: src/ui/search
- used by: the test runner (not run here)

## Problems found (finding IDs)
- none

## To check in other files
- none

## Sources
- https://en.wikipedia.org/wiki/Approximate_string_matching : fuzzy (approximate) string search finds strings matching a pattern approximately; tools like fzf bring it to command lines (lines 38-43)
