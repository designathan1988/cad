// The wall types a project starts with besides the first four (app/document.ts), and an older file gets
// (io/project-file.ts, version 57): Brazilian construction's usual walls, each of its real layers in
// their materials (element/material/schema.ts), named in English in the document as the first ones are
// (ui/i18n.ts ptNames gives their Portuguese).

import type { MaterialId, WallType } from './schema';
import type { WallTypeId } from './schema';

const plaster = (thickness: number, side: 'finish1' | 'finish2') => ({ thickness, function: side, materialId: 'plaster' as MaterialId }) as const;

export const MORE_WALL_TYPES: readonly WallType[] = [
  { id: 'wt_ceramicBlock9' as WallTypeId, name: 'Ceramic block 9 cm', layers: [plaster(0.02, 'finish1'), { thickness: 0.09, function: 'structure', materialId: 'ceramicBlock' as MaterialId }, plaster(0.02, 'finish2')] },
  { id: 'wt_ceramicBlock14' as WallTypeId, name: 'Ceramic block 14 cm', layers: [plaster(0.02, 'finish1'), { thickness: 0.14, function: 'structure', materialId: 'ceramicBlock' as MaterialId }, plaster(0.02, 'finish2')] },
  { id: 'wt_concreteBlock14' as WallTypeId, name: 'Concrete block 14 cm', layers: [plaster(0.015, 'finish1'), { thickness: 0.14, function: 'structure', materialId: 'concreteBlock' as MaterialId }, plaster(0.015, 'finish2')] },
  { id: 'wt_concreteBlock19' as WallTypeId, name: 'Concrete block 19 cm (structural)', layers: [plaster(0.015, 'finish1'), { thickness: 0.19, function: 'structure', materialId: 'concreteBlock' as MaterialId }, plaster(0.015, 'finish2')] },
  { id: 'wt_brickExposed' as WallTypeId, name: 'Exposed brick 11 cm', layers: [{ thickness: 0.11, function: 'structure', materialId: 'brick' as MaterialId }] },
  {
    id: 'wt_bathroom15' as WallTypeId,
    name: 'Masonry 15 cm, tiled one side',
    layers: [{ thickness: 0.008, function: 'finish1', materialId: 'subwayTile' as MaterialId }, plaster(0.015, 'finish1'), { thickness: 0.12, function: 'structure', materialId: 'ceramicBlock' as MaterialId }, plaster(0.015, 'finish2')],
  },
  { id: 'wt_concreteExposed15' as WallTypeId, name: 'Fair-faced concrete 15 cm', layers: [{ thickness: 0.15, function: 'structure', materialId: 'concretePolished' as MaterialId }] },
  {
    id: 'wt_drywallWet' as WallTypeId,
    name: 'Drywall 10 cm, moisture-resistant',
    layers: [{ thickness: 0.0125, function: 'finish1', materialId: 'gypsumGreen' as MaterialId }, { thickness: 0.075, function: 'thermal', materialId: 'insulation' as MaterialId }, { thickness: 0.0125, function: 'finish2', materialId: 'gypsumGreen' as MaterialId }],
  },
  {
    id: 'wt_drywallAcoustic' as WallTypeId,
    name: 'Drywall 15 cm, acoustic double',
    layers: [
      { thickness: 0.0125, function: 'finish1', materialId: 'gypsum' as MaterialId },
      { thickness: 0.0125, function: 'substrate', materialId: 'gypsum' as MaterialId },
      { thickness: 0.1, function: 'thermal', materialId: 'insulation' as MaterialId },
      { thickness: 0.0125, function: 'substrate', materialId: 'gypsum' as MaterialId },
      { thickness: 0.0125, function: 'finish2', materialId: 'gypsum' as MaterialId },
    ],
  },
  {
    id: 'wt_steelFrame' as WallTypeId,
    name: 'Steel frame 16 cm, external',
    layers: [
      { thickness: 0.012, function: 'finish1', materialId: 'cementBoard' as MaterialId },
      { thickness: 0.011, function: 'substrate', materialId: 'osb' as MaterialId },
      { thickness: 0.09, function: 'thermal', materialId: 'insulation' as MaterialId },
      { thickness: 0.0125, function: 'substrate', materialId: 'gypsum' as MaterialId },
      { thickness: 0.0125, function: 'finish2', materialId: 'gypsum' as MaterialId },
    ],
  },
  {
    id: 'wt_etics' as WallTypeId,
    name: 'Masonry 20 cm, external insulation',
    layers: [{ thickness: 0.005, function: 'finish1', materialId: 'plaster' as MaterialId }, { thickness: 0.05, function: 'thermal', materialId: 'eps' as MaterialId }, { thickness: 0.14, function: 'structure', materialId: 'ceramicBlock' as MaterialId }, plaster(0.015, 'finish2')],
  },
  { id: 'wt_stone30' as WallTypeId, name: 'Stone 30 cm', layers: [{ thickness: 0.3, function: 'structure', materialId: 'stone' as MaterialId }] },
  {
    id: 'wt_stoneClad' as WallTypeId,
    name: 'Masonry 15 cm, stone cladding',
    layers: [{ thickness: 0.025, function: 'finish1', materialId: 'stoneCladding' as MaterialId }, plaster(0.015, 'finish1'), { thickness: 0.12, function: 'structure', materialId: 'ceramicBlock' as MaterialId }, plaster(0.015, 'finish2')],
  },
  {
    id: 'wt_slatted' as WallTypeId,
    name: 'Drywall 10 cm, wood slats',
    layers: [{ thickness: 0.02, function: 'finish1', materialId: 'woodSlats' as MaterialId }, { thickness: 0.0125, function: 'substrate', materialId: 'gypsum' as MaterialId }, { thickness: 0.05, function: 'thermal', materialId: 'insulation' as MaterialId }, { thickness: 0.0125, function: 'finish2', materialId: 'gypsum' as MaterialId }],
  },
  { id: 'wt_boundary' as WallTypeId, name: 'Boundary wall 15 cm', layers: [{ thickness: 0.01, function: 'finish1', materialId: 'plaster' as MaterialId }, { thickness: 0.14, function: 'structure', materialId: 'concreteBlock' as MaterialId }] },
];
