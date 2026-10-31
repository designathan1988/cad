# src/elements/object/valid.ts
Lines: 80
Summary: Guards for reading parametric objects from a file: the shape of a part, a mesh, a definition and an instance. Formulas are not checked here (a failing one is reported on evaluation).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: what a file may hold of objects, pure guards
- 5-6 imports: finite, isObject, isPoint; schema types
- 8-10 isWords, isExpr (finite number or any string), the six param kinds
- 12-26 isPart: x, y, z; when, material, repeat.count, cut types; per kind its sizes and optional angles (box, cylinder, sphere), points of revolve (≥ 2) and profile (≥ 3), nested object's definition and values, mesh's id and sizes; unknown kinds refused
- 28-40 isMesh: positions in threes within the unit box, indices in threes pointing at vertices, outline in pairs of finite numbers
- 42-64 isDefinition: id, name, category, folder; params (name pattern with À-ÿ, label, kind, default type); parts; handles (param, axis, at only); at least one type; rules; light; meshes; each mesh part's mesh present
- 66-79 isObjectInstance: ids, level, definition, type, point, finite angle and elevation, values finite numbers or strings

## Contracts, state and data flow
- Pure. Not checked: repeat dx/dy/dz (formulas fail safely: formula.ts:25-36 parses inside try), param min/max/step/options/when, handle shift/sign, uniqueness of param names, type values' keys, counts or nesting depth.
- The name pattern is by code point: À-ÿ includes × and ÷ (F-0044); \w is ASCII only.

## Depends on / used by
- uses: core/guards.ts, elements/object/schema.ts (types)
- used by: io/project-file.ts (reading definitions and instances), library links and the definition import (their callers check with isDefinition)

## Problems found (finding IDs)
- F-0066 (S4): handles' shift/sign unchecked; no count limits (F-0060)
- F-0044 (added proof): param names may hold × and ÷

## To check in other files
- none

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_class : a range matches code points inclusive; [À-ÿ] includes × (U+00D7) and ÷ (U+00F7) (line 50)
