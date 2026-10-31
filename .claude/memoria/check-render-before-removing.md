Before taking a field out of a panel or dialog because "only a removed area used it", grep for every reader of that data in the render (plan-view, scene-3d, kinds' derive/solid/plan) and the geometry. Remove only what nothing in the app reads.

**Por quê:** on 2026-10-28 (F-0117) I removed a roof's "Covering" material field believing only the thermal simulation read it; kinds/roof.ts:43 draws the roof in 3D in that material, so the user lost a model choice. Found while fixing F-0058 and put back (132bdbc), with only the covering's thickness (really thermal-only) left hidden.

**Como aplicar:** for each field to remove, `grep -rn "<field>" src` and read every hit outside the removed area and the field's own panel; if a render or geometry hit exists, keep the field (relabel it if its label names the removed area).
