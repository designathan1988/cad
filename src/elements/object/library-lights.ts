// The library's lights (lighting): luminaires each with its own light, as the pendant lamp
// (library-more.ts), its power (W of LED, about 100 lm each) and its colour temperature (K) parameters
// of its own, so each one placed can be set brighter, dimmer, warmer or cooler. A recessed downlight, a
// wall sconce, a floor lamp, a garden post and a bare point of light. Data only; lengths in metres, x
// along the width and y along the depth from the centre, z up from the floor; the front faces −y.

import type { ObjectDefinition, ParamDef } from './schema';
import type { DefinitionId } from './schema';

const len = (name: string, pt: string, en: string, value: number, min: number, max: number): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'length',
  default: value,
  min,
  max,
  step: 0.005,
  group: { pt: 'Dimensões', en: 'Dimensions' },
});
const mat = (name: string, pt: string, en: string, value: string): ParamDef => ({ name, label: { pt, en }, kind: 'material', default: value, group: { pt: 'Materiais', en: 'Materials' } });
/** The light's own parameters: its power and its colour temperature. */
const light = (watts: number, kelvin: number): ParamDef[] => [
  { name: 'potencia', label: { pt: 'Potência (W, LED)', en: 'Power (W, LED)' }, kind: 'number', default: watts, min: 1, max: 200, step: 0.5, group: { pt: 'Luz', en: 'Light' } },
  { name: 'cor', label: { pt: 'Temperatura de cor (K)', en: 'Colour temperature (K)' }, kind: 'integer', default: kelvin, min: 2200, max: 6500, step: 100, group: { pt: 'Luz', en: 'Light' } },
];

export const DOWNLIGHT: ObjectDefinition = {
  id: 'def_downlight' as DefinitionId,
  name: { pt: 'Spot de embutir', en: 'Recessed downlight' },
  category: 'lighting',
  params: [len('largura', 'Diâmetro', 'Diameter', 0.1, 0.05, 0.3), len('teto', 'Altura do teto', 'Ceiling height', 2.7, 2.2, 6), ...light(7, 3000), mat('matAro', 'Aro', 'Trim', 'metal')],
  parts: [{ kind: 'cylinder', name: { pt: 'Aro', en: 'Trim' }, x: 0, y: 0, z: 'teto - 0.012', r: 'largura / 2', h: 0.012, material: 'matAro' }],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'teto'], shift: 0 }],
  types: [
    { id: 'warm', name: { pt: 'Branco quente', en: 'Warm white' }, values: {} },
    { id: 'neutral', name: { pt: 'Branco neutro', en: 'Neutral white' }, values: { cor: 4000 } },
  ],
  light: { x: 0, y: 0, z: 'teto - 0.05', watts: 'potencia', kelvin: 'cor' },
};

export const SCONCE: ObjectDefinition = {
  id: 'def_sconce' as DefinitionId,
  name: { pt: 'Arandela', en: 'Wall sconce' },
  category: 'lighting',
  params: [len('largura', 'Largura', 'Width', 0.15, 0.08, 0.5), len('altura', 'Altura de instalação', 'Mounting height', 1.8, 0.3, 3), ...light(6, 2700), mat('matCorpo', 'Corpo', 'Body', 'metal'), mat('matDifusor', 'Difusor', 'Diffuser', 'glass')],
  parts: [
    { kind: 'box', name: { pt: 'Base', en: 'Back plate' }, x: '-largura/2', y: 0.07, z: 'altura - 0.08', w: 'largura', d: 0.015, h: 0.16, material: 'matCorpo' },
    { kind: 'cylinder', name: { pt: 'Difusor', en: 'Diffuser' }, x: 0, y: 0, z: 'altura - 0.06', r: 'largura / 2 * 0.8', r2: 'largura / 2', h: 0.12, material: 'matDifusor' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [{ id: 'std', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
  light: { x: 0, y: 0, z: 'altura', watts: 'potencia', kelvin: 'cor' },
};

export const FLOOR_LAMP: ObjectDefinition = {
  id: 'def_floor_lamp' as DefinitionId,
  name: { pt: 'Luminária de piso', en: 'Floor lamp' },
  category: 'lighting',
  params: [len('largura', 'Diâmetro da cúpula', 'Shade diameter', 0.4, 0.2, 0.8), len('altura', 'Altura', 'Height', 1.6, 0.8, 2.2), ...light(10, 2700), mat('matHaste', 'Haste e base', 'Stem and base', 'metal'), mat('matCupula', 'Cúpula', 'Shade', 'fabric')],
  parts: [
    { kind: 'cylinder', name: { pt: 'Base', en: 'Base' }, x: 0, y: 0, z: 0, r: 'largura / 2 * 0.7', h: 0.025, material: 'matHaste' },
    { kind: 'cylinder', name: { pt: 'Haste', en: 'Stem' }, x: 0, y: 0, z: 0.025, r: 0.012, h: 'altura - 0.33', material: 'matHaste' },
    { kind: 'cylinder', name: { pt: 'Cúpula', en: 'Shade' }, x: 0, y: 0, z: 'altura - 0.3', r: 'largura / 2', r2: 'largura / 2 * 0.75', h: 0.3, material: 'matCupula' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura - 0.3'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [{ id: 'std', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
  light: { x: 0, y: 0, z: 'altura - 0.15', watts: 'potencia', kelvin: 'cor' },
};

export const GARDEN_POST: ObjectDefinition = {
  id: 'def_garden_post' as DefinitionId,
  name: { pt: 'Poste de jardim', en: 'Garden post light' },
  category: 'lighting',
  params: [len('altura', 'Altura', 'Height', 0.9, 0.3, 4), len('largura', 'Largura da lanterna', 'Lantern width', 0.18, 0.08, 0.5), ...light(12, 3000), mat('matPoste', 'Poste', 'Post', 'metal'), mat('matLanterna', 'Lanterna', 'Lantern', 'glass')],
  parts: [
    { kind: 'cylinder', name: { pt: 'Poste', en: 'Post' }, x: 0, y: 0, z: 0, r: 0.035, h: 'altura - largura', material: 'matPoste' },
    { kind: 'box', name: { pt: 'Lanterna', en: 'Lantern' }, x: '-largura/2', y: '-largura/2', z: 'altura - largura', w: 'largura', d: 'largura', h: 'largura * 0.85', material: 'matLanterna' },
    { kind: 'box', name: { pt: 'Tampa', en: 'Cap' }, x: '-largura/2 - 0.015', y: '-largura/2 - 0.015', z: 'altura - largura * 0.15', w: 'largura + 0.03', d: 'largura + 0.03', h: 'largura * 0.15', material: 'matPoste' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'low', name: { pt: 'Baixo (balizador)', en: 'Low (bollard)' }, values: {} },
    { id: 'high', name: { pt: 'Alto (3 m)', en: 'Tall (3 m)' }, values: { altura: 3, largura: 0.3, potencia: 30 } },
  ],
  light: { x: 0, y: 0, z: 'altura - largura / 2', watts: 'potencia', kelvin: 'cor' },
};

export const POINT_LIGHT: ObjectDefinition = {
  id: 'def_point_light' as DefinitionId,
  name: { pt: 'Ponto de luz', en: 'Point of light' },
  category: 'lighting',
  params: [len('altura', 'Altura', 'Height', 2.4, 0.1, 10), ...light(10, 3000), mat('matBulbo', 'Bulbo', 'Bulb', 'glass'), mat('matSoquete', 'Soquete', 'Socket', 'ceramic')],
  // A bulb, round, hanging from its socket.
  parts: [
    { kind: 'sphere', name: { pt: 'Bulbo', en: 'Bulb' }, x: 0, y: 0, z: 'altura - 0.035', r: 0.03, h: 0.07, material: 'matBulbo' },
    { kind: 'cylinder', name: { pt: 'Soquete', en: 'Socket' }, x: 0, y: 0, z: 'altura + 0.03', r: 0.014, h: 0.035, material: 'matSoquete' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [{ id: 'std', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
  light: { x: 0, y: 0, z: 'altura', watts: 'potencia', kelvin: 'cor' },
};

/** The lights, in the order the library lists them; added to a file from before them (project-file.ts). */
export const LIBRARY_LIGHTS: readonly ObjectDefinition[] = [DOWNLIGHT, SCONCE, FLOOR_LAMP, GARDEN_POST, POINT_LIGHT];
