# src/elements/object/commands.ts
Lines: 117
Summary: Parametric object commands: place one (its definition must exist), a value held to its parameter, set values (and position/elevation) on several in one step, change type (own values dropped), reset one value to the type's, add/update/delete a definition (objects of an updated definition keep valid types and values).

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-3 header: values held to range and step here, so what is kept is what is drawn; no change → same doc
- 5-8 imports: Doc, Command, held, schema types
- 10-13 addObject: a new id of a known definition
- 15-22 valueFor: the parameter (none or a formula → null); a material any non-empty string (not checked against the materials: materialIn's fallback later); a number held by `held`
- 24-48 setObjectValues: per change, values held and merged, position and elevation (elevation not checked for being finite); unchanged (JSON) → the same object
- 50-63 setObjectType: a type of its definition; own values cleared (Revit's way)
- 65-78 resetObjectValue: the value removed when present (`name in o.values` also sees Object.prototype names: a parameter called "toString" would make an empty step)
- 80-84 addDefinition: a new id
- 86-104 updateDefinition: replaced; objects of it keep their type (else the first type; a definition without types would throw at def.types[0]!: the validator must forbid that) and only values whose parameter still exists without a formula (a value whose parameter changed kind is kept with the old kind)
- 106-111 definitionDeleteBlocker: objects placed, or nested in another definition
- 113-116 deleteDefinition: when nothing blocks it

## Contracts, state and data flow
- Pure commands; the definition editor saves through updateDefinition.

## Depends on / used by
- uses: elements/object/evaluate.ts (held), schema.ts, app/document.ts, core/store.ts
- used by: app/kind-tools.ts (addObject), app/object-handles.ts (setObjectValues), elements/object/fields.ts, the objects dialog / definition editor, app/model-import.ts (definitions)

## Problems found (finding IDs)
- none (edge cases noted)

## To check in other files
- elements/object/valid.ts: definitions require at least one type

## Sources
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries : builds an object from pairs, the reverse of Object.entries (line 99)
