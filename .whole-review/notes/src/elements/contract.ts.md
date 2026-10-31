# src/elements/contract.ts
Lines: 206
Summary: The element contract: what each kind of element tells the app (prefix, category, level, drawing layer, panel title, validator, derivation and its memo, holders, Modify-tool behaviour, plan painting, 3D solid, caps for sections, outlines/hit/pick for selection, moved/mapped/copied, select-similar, fields), with the helper interfaces the plan, the panel and the Modify tools lend it; plus DXF/GLB export members left from the exports taken out.

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1-4 header: kinds go through the registry instead of hand-written lists; a new kind is one file and one registry line
- 6-17 type imports: three, Doc, Material, Detail/PenRole, Category/DerivedGeometry, UprightPrism, Command, Point2, Transform, Field, MessageKey, IconName
- 19-20 KindKey: the document lists kinds keep (measures … walls)
- 22-23 BaseGeometry: derived geometry before the kinds
- 25-41 PlanPaint: context, transform, colour tokens, scale, fonts, endless line, pen widths, detail
- 43-54 DxfOut: line, polyline, text, dimension writers (the DXF EXPORT, taken out in step 1: nothing creates a DxfOut now)
- 56-66 KindSolid: a three.js geometry at height y, its material, edges, lights
- 68-70 PickOrder: first, beforeWalls, walls, afterWalls, last
- 72-87 TransformContext: the transform, the id after, selected/copy, going(id), to(id), the doc and geometry before
- 89-103 KindFieldContext: dispatch, doc, start a floor hole, open a section, interior elevations, calibrate, geometry
- 105-109 KeepOut: boxes and lines room tags avoid
- 111-124 ElementKind: key, prefix, category, everyLevel, walled, levelOf, levelIn
- 125-140 layer, endless, icon, one/many titles, dynamic title, hint, warning
- 141-145 dropped (file reader's word), exportName and exportColour (GLB export, taken out: no reader)
- 146-158 valid, derive, memo, holders, transformed
- 159-170 keepOut, follows, released, span, surface, caps
- 171-193 element, outlines, hit, distance, extent, grab, pick, moved, mapped, copied, onGrid, similar
- 194-201 plan, solid, dxfLayers and dxf (DXF export, no reader), fields
- 203-205 AnyKind: ElementKind<any, any> with a biome-ignore

## Contracts, state and data flow
- exportName, exportColour (required), dxfLayers and dxf (optional) and DxfOut have no reader anywhere in src (grep `.dxf(`, `.dxfLayers`, `.exportName`, `.exportColour`: none), yet 20 kinds implement them: code of the exports the owner had taken out (F-0047).

## Depends on / used by
- uses: types only (three, app/document, material, drawing, geometry, section-box, store, vector, transform, ui/fields, i18n, icons)
- used by: elements/registry.ts and every elements/kinds/*.ts, app modules typing kinds

## Problems found (finding IDs)
- F-0047 export members left in the contract and in every kind

## To check in other files
- each kinds/*.ts: the dxf/export code to remove with F-0047

## Sources
- https://www.typescriptlang.org/docs/handbook/2/objects.html : optional and readonly properties; a value of an object type must have every required property (exportName/exportColour force every kind to keep them) (lines 111-201)
