// The library's lighting and decoration (data only, as library.ts): a table lamp, a chandelier, a track of
// spotlights, a suspended LED profile, an outdoor up-and-down wall light, an articulated desk lamp; curtains,
// a blind, framed pictures, a decorative vase, a large plant, a wall clock and a floating shelf with objects.
// Each light has its own power (W of LED, about 100 lm each) and colour temperature (K).

import type { ObjectDefinition, ParamDef } from './schema';
import { BUILD, choice, counted, int, len, mat, num, w, yes } from './library-kit';

/** A light's own parameters, as the other luminaires' (library-lights.ts). */
const light = (watts: number, kelvin: number): ParamDef[] => [
  { name: 'potencia', label: w('Potência (W, LED)', 'Power (W, LED)'), kind: 'number', default: watts, min: 1, max: 200, step: 0.5, group: w('Luz', 'Light') },
  { name: 'cor', label: w('Temperatura de cor (K)', 'Colour temperature (K)'), kind: 'integer', default: kelvin, min: 2200, max: 6500, step: 100, group: w('Luz', 'Light') },
];

export const TABLE_LAMP: ObjectDefinition = {
  id: 'def_table_lamp',
  name: w('Abajur', 'Table lamp'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    len('largura', 'Diâmetro da cúpula', 'Shade diameter', 0.36, 0.2, 0.6),
    len('altura', 'Altura', 'Height', 0.58, 0.3, 0.9),
    len('base', 'Altura do pé', 'Base height', 0.3, 0.12, 0.5, BUILD),
    ...light(8, 2700),
    mat('matBase', 'Pé', 'Base', 'ceramic'),
    mat('matCupula', 'Cúpula', 'Shade', 'linen'),
  ],
  parts: [
    // A turned gourd of a base, a brass stem to the shade, a drum of a shade.
    { kind: 'revolve', name: w('Pé', 'Base'), x: 0, y: 0, z: 0, points: [[0.05, 0], ['base * 0.22', 'base * 0.04'], ['base * 0.33', 'base * 0.14'], ['base * 0.39', 'base * 0.28'], ['base * 0.4', 'base * 0.42'], ['base * 0.36', 'base * 0.58'], ['base * 0.27', 'base * 0.72'], ['base * 0.16', 'base * 0.84'], ['base * 0.1', 'base * 0.94'], [0.025, 'base']], material: 'matBase' },
    { kind: 'cylinder', name: w('Haste', 'Stem'), x: 0, y: 0, z: 'base', r: 0.008, h: 'altura - base - (altura - base) * 0.6', material: 'brass' },
    { kind: 'revolve', name: w('Cúpula', 'Shade'), x: 0, y: 0, z: 'altura - (altura - base) * 0.75', points: [['largura/2', 0], ['largura * 0.42', '(altura - base) * 0.75'], ['largura * 0.42 - 0.004', '(altura - base) * 0.75'], [0.03, '(altura - base) * 0.75']], material: 'matCupula' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'gourd', name: w('Cerâmica e linho', 'Ceramic and linen'), values: {} },
    { id: 'terracotta', name: w('Terracota', 'Terracotta'), values: { matBase: 'lacquerTerracotta', matCupula: 'boucle' } },
    { id: 'marble', name: w('Mármore, cúpula preta', 'Marble, black shade'), values: { matBase: 'marble', matCupula: 'lacquerBlack', altura: 0.48 } },
  ],
  light: { x: 0, y: 0, z: 'altura - (altura - base) * 0.4', watts: 'potencia', kelvin: 'cor' },
};

export const CHANDELIER: ObjectDefinition = {
  id: 'def_chandelier',
  name: w('Lustre de braços', 'Arm chandelier'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    len('largura', 'Diâmetro', 'Diameter', 0.9, 0.4, 1.6),
    len('teto', 'Altura do teto', 'Ceiling height', 2.8, 2.4, 5),
    len('pendente', 'Altura da lâmpada (do piso)', 'Bulb height (from floor)', 2.1, 1.6, 4),
    int('bracos', 'Braços', 'Arms', 8, 3, 16),
    ...light(4, 2700),
    mat('matMetal', 'Metal', 'Metal', 'brass'),
    mat('matGlobo', 'Globos', 'Globes', 'frostedGlass'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Canopla', 'Canopy'), x: 0, y: 0, z: 'teto - 0.03', r: 0.07, h: 0.03, material: 'matMetal' },
    { kind: 'cylinder', name: w('Haste', 'Rod'), x: 0, y: 0, z: 'pendente + 0.02', r: 0.008, h: 'teto - pendente - 0.05', material: 'matMetal' },
    { kind: 'sphere', name: w('Cubo', 'Hub'), x: 0, y: 0, z: 'pendente - 0.03', r: 0.04, h: 0.08, material: 'matMetal' },
    // Arms out from the hub on a turn each, a globe at each end.
    { kind: 'cylinder', name: w('Braço', 'Arm'), repeat: { count: 'bracos' }, x: 0, y: 0, z: 'pendente', r: 0.006, h: 'largura/2 - 0.06', tilt: 90, turn: '360 * i / bracos', material: 'matMetal' },
    { kind: 'cylinder', name: w('Soquete', 'Socket'), repeat: { count: 'bracos' }, x: '-(largura/2 - 0.06) * sin(360 * i / bracos)', y: '(largura/2 - 0.06) * cos(360 * i / bracos)', z: 'pendente - 0.01', r: 0.014, h: 0.035, material: 'matMetal' },
    { kind: 'sphere', name: w('Globo', 'Globe'), repeat: { count: 'bracos' }, x: '-(largura/2 - 0.06) * sin(360 * i / bracos)', y: '(largura/2 - 0.06) * cos(360 * i / bracos)', z: 'pendente + 0.02', r: 0.055, h: 0.11, material: 'matGlobo' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'pendente'], shift: 0 }, { param: 'pendente', axis: 'z', at: [0, 0, 'pendente'] }],
  types: [
    { id: 'brass8', name: w('Latão, 8 braços', 'Brass, 8 arms'), values: {} },
    { id: 'black12', name: w('Preto, 12 braços', 'Black, 12 arms'), values: { bracos: 12, largura: 1.2, matMetal: 'blackSteel' } },
    { id: 'small', name: w('Pequeno, 5 braços', 'Small, 5 arms'), values: { bracos: 5, largura: 0.55 } },
  ],
  light: { x: 0, y: 0, z: 'pendente', watts: 'potencia * bracos', kelvin: 'cor' },
};

export const TRACK_LIGHT: ObjectDefinition = {
  id: 'def_track_light',
  name: w('Trilho com spots', 'Track with spotlights'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    len('largura', 'Comprimento', 'Length', 2, 0.5, 6),
    len('teto', 'Altura do teto', 'Ceiling height', 2.8, 2.4, 5),
    counted('spots', 'Spots', 'Spots', 'max(1, round(largura / 0.5))'),
    num('inclinacao', 'Inclinação dos spots (°)', 'Spot tilt (°)', 30, 0, 80, 5),
    ...light(7, 3000),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerBlack'),
  ],
  parts: [
    { kind: 'box', name: w('Trilho', 'Track'), x: '-largura/2', y: -0.018, z: 'teto - 0.035', w: 'largura', d: 0.036, h: 0.035, material: 'matCorpo' },
    // Each spot: its adapter in the track, a short stem, the can turned down and aimed.
    { kind: 'box', name: w('Adaptador', 'Adapter'), repeat: { count: 'spots', dx: 'largura / spots' }, x: '-largura/2 + largura / spots / 2 - 0.025', y: -0.02, z: 'teto - 0.06', w: 0.05, d: 0.04, h: 0.03, material: 'matCorpo', round: 0.006 },
    { kind: 'cylinder', name: w('Haste', 'Stem'), repeat: { count: 'spots', dx: 'largura / spots' }, x: '-largura/2 + largura / spots / 2', y: 0, z: 'teto - 0.11', r: 0.006, h: 0.05, material: 'matCorpo' },
    { kind: 'cylinder', name: w('Spot', 'Spot'), repeat: { count: 'spots', dx: 'largura / spots' }, x: '-largura/2 + largura / spots / 2', y: '-0.07 * sin(inclinacao)', z: 'teto - 0.12 - 0.12 * cos(inclinacao)', r: 0.032, r2: 0.035, h: 0.13, tilt: 'inclinacao', material: 'matCorpo' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'teto'], shift: 0.5 }],
  types: [
    { id: 'black', name: w('Preto, 2 m', 'Black, 2 m'), values: {} },
    { id: 'white', name: w('Branco, 3 m', 'White, 3 m'), values: { largura: 3, matCorpo: 'lacquerWhite' } },
  ],
  light: { x: 0, y: -0.2, z: 'teto - 0.3', watts: 'potencia * spots', kelvin: 'cor' },
};

export const LED_PROFILE: ObjectDefinition = {
  id: 'def_led_profile',
  name: w('Perfil de LED pendente', 'Suspended LED profile'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    len('largura', 'Comprimento', 'Length', 1.6, 0.6, 4),
    len('teto', 'Altura do teto', 'Ceiling height', 2.8, 2.4, 5),
    len('pendente', 'Altura do perfil (do piso)', 'Profile height (from floor)', 1.8, 1.5, 4),
    ...light(30, 3000),
    mat('matCorpo', 'Perfil', 'Profile', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Perfil', 'Profile'), x: '-largura/2', y: -0.025, z: 'pendente', w: 'largura', d: 0.05, h: 0.07, material: 'matCorpo', round: 0.004 },
    { kind: 'box', name: w('Difusor', 'Diffuser'), x: '-largura/2 + 0.01', y: -0.02, z: 'pendente - 0.004', w: 'largura - 0.02', d: 0.04, h: 0.006, material: 'frostedGlass' },
    { kind: 'cylinder', name: w('Cabo', 'Cable'), repeat: { count: 2, dx: 'largura - 0.2' }, x: '-largura/2 + 0.1', y: 0, z: 'pendente + 0.07', r: 0.0015, h: 'teto - pendente - 0.07', material: 'aluminium' },
    { kind: 'cylinder', name: w('Canopla', 'Canopy'), repeat: { count: 2, dx: 'largura - 0.2' }, x: '-largura/2 + 0.1', y: 0, z: 'teto - 0.015', r: 0.03, h: 0.015, material: 'matCorpo' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'pendente'], shift: 0.5 }, { param: 'pendente', axis: 'z', at: [0, 0, 'pendente'] }],
  types: [
    { id: 'black', name: w('Preto 1,6 m', 'Black 1.6 m'), values: {} },
    { id: 'brass', name: w('Latão 1,2 m, sobre a mesa', 'Brass 1.2 m, over a table'), values: { largura: 1.2, matCorpo: 'brass', pendente: 1.55 } },
  ],
  light: { x: 0, y: 0, z: 'pendente - 0.05', watts: 'potencia', kelvin: 'cor' },
};

export const OUTDOOR_WALL_LIGHT: ObjectDefinition = {
  id: 'def_outdoor_wall_light',
  name: w('Arandela externa', 'Outdoor wall light'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    choice('facho', 'Facho', 'Beam', [['Para cima e para baixo', 'Up and down'], ['Só para baixo', 'Down only']]),
    len('altura', 'Altura de instalação', 'Mounting height', 2.2, 1.5, 4),
    ...light(10, 3000),
    mat('matCorpo', 'Corpo', 'Body', 'graniteBlack'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: -0.045, y: -0.07, z: 'altura - 0.1', w: 0.09, d: 0.07, h: 0.2, material: 'matCorpo', round: 0.01 },
    { kind: 'cylinder', name: w('Facho de baixo', 'Lower aperture'), x: 0, y: -0.035, z: 'altura - 0.102', r: 0.025, h: 0.004, material: 'frostedGlass' },
    { kind: 'cylinder', name: w('Facho de cima', 'Upper aperture'), when: 'facho == 0', x: 0, y: -0.035, z: 'altura + 0.098', r: 0.025, h: 0.004, material: 'frostedGlass' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'updown', name: w('Para cima e para baixo', 'Up and down'), values: {} },
    { id: 'down', name: w('Só para baixo, corten', 'Down only, copper'), values: { facho: 1, matCorpo: 'copper' } },
  ],
  light: { x: 0, y: -0.15, z: 'altura', watts: 'potencia', kelvin: 'cor' },
};

export const DESK_LAMP: ObjectDefinition = {
  id: 'def_desk_lamp',
  name: w('Luminária articulada', 'Articulated desk lamp'),
  category: 'lighting',
  folder: 'Iluminação',
  params: [
    len('braco', 'Comprimento dos braços', 'Arm length', 0.38, 0.25, 0.5),
    num('abertura', 'Abertura do braço (°)', 'Arm angle (°)', 35, 10, 70, 5),
    ...light(5, 3000),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerBlack'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Base', 'Base'), x: 0, y: 0, z: 0, r: 0.08, r2: 0.075, h: 0.02, material: 'matCorpo' },
    // Lower arm leaning back, upper arm reaching forward from its top, the head at the end pointing down.
    { kind: 'cylinder', name: w('Braço inferior', 'Lower arm'), x: 0, y: 0.02, z: 0.02, r: 0.008, h: 'braco', tilt: '-abertura', material: 'matCorpo' },
    { kind: 'sphere', name: w('Articulação', 'Joint'), x: 0, y: '0.02 - braco * sin(abertura)', z: '0.01 + braco * cos(abertura)', r: 0.014, h: 0.028, material: 'aluminium' },
    { kind: 'cylinder', name: w('Braço superior', 'Upper arm'), x: 0, y: '0.02 - braco * sin(abertura)', z: '0.02 + braco * cos(abertura)', r: 0.007, h: 'braco', tilt: '-(90 + abertura - 45)', material: 'matCorpo' },
    { kind: 'sphere', name: w('Articulação da cúpula', 'Head joint'), x: 0, y: '0.02 - braco * sin(abertura) - braco * sin(45 + abertura)', z: '0.02 + braco * cos(abertura) + braco * cos(45 + abertura) - 0.012', r: 0.012, h: 0.024, material: 'aluminium' },
    { kind: 'cylinder', name: w('Cúpula', 'Head'), x: 0, y: '0.02 - braco * sin(abertura) - braco * sin(45 + abertura)', z: '0.02 + braco * cos(abertura) + braco * cos(45 + abertura) - 0.12', r: 0.065, r2: 0.02, h: 0.11, material: 'matCorpo' },
  ],
  handles: [],
  types: [
    { id: 'black', name: w('Preta', 'Black'), values: {} },
    { id: 'white', name: w('Branca', 'White'), values: { matCorpo: 'lacquerWhite' } },
    { id: 'brass', name: w('Latão, braço aberto', 'Brass, arm out'), values: { matCorpo: 'brass', abertura: 55 } },
  ],
  light: { x: 0, y: '0.02 - braco * sin(abertura) - braco * sin(45 + abertura)', z: '0.02 + braco * cos(abertura) + braco * cos(45 + abertura) - 0.13', watts: 'potencia', kelvin: 'cor' },
};

export const CURTAIN: ObjectDefinition = {
  id: 'def_curtain',
  name: w('Cortina', 'Curtain'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    len('largura', 'Largura do vão', 'Width', 2.4, 0.8, 6),
    len('altura', 'Altura (até o trilho)', 'Height (to the rail)', 2.6, 1.5, 3.5),
    num('aberta', 'Aberta (%)', 'Open (%)', 60, 0, 90, 5),
    counted('pregas', 'Pregas (cada folha)', 'Pleats (each side)', 'max(3, round(largura * (1 - aberta / 100) / 2 / 0.09))'),
    yes('blackout', 'Blackout atrás', 'Blackout behind', 0),
    mat('matTecido', 'Tecido', 'Fabric', 'linen'),
    mat('matTrilho', 'Varão', 'Rod', 'blackSteel'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Varão', 'Rod'), x: '-largura/2 - 0.15', y: -0.08, z: 'altura', r: 0.012, h: 'largura + 0.3', roll: 90, material: 'matTrilho' },
    { kind: 'sphere', name: w('Ponteira', 'Finial'), repeat: { count: 2, dx: 'largura + 0.34' }, x: '-largura/2 - 0.17', y: -0.08, z: 'altura - 0.02', r: 0.02, h: 0.04, material: 'matTrilho' },
    // Two sides drawn to the ends, each of soft pleats (rounded panels in and out) from the rod to the floor.
    {
      kind: 'box',
      name: w('Prega', 'Pleat'),
      repeat: { count: 'pregas * 2' },
      x: 'if(i < pregas, -largura/2 - 0.12 + i * 0.09 * (1 - aberta / 100 * 0.6), largura/2 + 0.12 - (i - pregas + 1) * 0.09 * (1 - aberta / 100 * 0.6))',
      y: '-0.1 + if(i % 2 == 0, -0.025, 0)',
      z: 0.01,
      w: 0.09,
      d: 0.03,
      h: 'altura - 0.04',
      material: 'matTecido',
      round: 0.014,
    },
    { kind: 'box', name: w('Blackout', 'Blackout'), when: 'blackout', x: '-largura/2 - 0.1', y: -0.05, z: 0.02, w: 'largura + 0.2', d: 0.01, h: 'altura - 0.05', material: 'lacquerBlack' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', -0.08, 'altura'], shift: 0.5 }],
  types: [
    { id: 'linen', name: w('Linho, aberta', 'Linen, open'), values: {} },
    { id: 'closed', name: w('Fechada, com blackout', 'Closed, blackout'), values: { aberta: 0, blackout: 1, matTecido: 'velvet' } },
  ],
};

export const BLIND: ObjectDefinition = {
  id: 'def_blind',
  name: w('Persiana', 'Blind'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Rolô', 'Roller'], ['Lâminas horizontais', 'Venetian']]),
    len('largura', 'Largura', 'Width', 1.2, 0.4, 3),
    len('altura', 'Altura da janela', 'Window height', 1.2, 0.5, 2.6),
    len('base', 'Peitoril', 'Sill height', 1, 0, 1.5),
    num('aberta', 'Recolhida (%)', 'Raised (%)', 30, 0, 95, 5),
    mat('matTecido', 'Tela / lâminas', 'Fabric / slats', 'linen'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Rolo', 'Roller'), when: 'modelo == 0', x: '-largura/2', y: -0.05, z: 'base + altura + 0.04', r: '0.025 + aberta / 100 * 0.02', h: 'largura', roll: 90, material: 'matTecido' },
    { kind: 'box', name: w('Tela', 'Fabric'), when: 'modelo == 0', x: '-largura/2 + 0.01', y: -0.03, z: 'base + altura * aberta / 100', w: 'largura - 0.02', d: 0.003, h: 'altura * (1 - aberta / 100) + 0.04', material: 'matTecido' },
    { kind: 'box', name: w('Barra inferior', 'Bottom bar'), x: '-largura/2 + 0.01', y: -0.04, z: 'base + altura * aberta / 100 - 0.02', w: 'largura - 0.02', d: 0.02, h: 0.025, material: 'aluminium', round: 0.006 },
    { kind: 'box', name: w('Caixa', 'Headrail'), when: 'modelo == 1', x: '-largura/2', y: -0.06, z: 'base + altura + 0.01', w: 'largura', d: 0.05, h: 0.04, material: 'aluminium', round: 0.004 },
    { kind: 'box', name: w('Lâmina', 'Slat'), when: 'modelo == 1', repeat: { count: 'floor(altura * (1 - aberta / 100) / 0.025)', dz: 0.025 }, x: '-largura/2 + 0.005', y: -0.045, z: 'base + altura * aberta / 100 + 0.005', w: 'largura - 0.01', d: 0.025, h: 0.002, tilt: 20, material: 'matTecido' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'base + altura'], shift: 0.5 }],
  types: [
    { id: 'roller', name: w('Rolô linho', 'Linen roller'), values: {} },
    { id: 'venetian', name: w('Lâminas de madeira', 'Wooden slats'), values: { modelo: 1, matTecido: 'oak' } },
    { id: 'blackout', name: w('Rolô blackout fechado', 'Blackout roller, down'), values: { aberta: 0, matTecido: 'lacquerBlack' } },
  ],
};

export const WALL_ART: ObjectDefinition = {
  id: 'def_wall_art',
  name: w('Quadros', 'Framed pictures'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    int('quadros', 'Quadros', 'Pictures', 1, 1, 3),
    len('largura', 'Largura de cada', 'Each width', 0.6, 0.2, 1.5),
    len('altura', 'Altura de cada', 'Each height', 0.8, 0.2, 1.8),
    len('base', 'Centro a (do piso)', 'Centre at (from floor)', 1.55, 0.8, 2.2),
    len('passe', 'Passe-partout', 'Mat border', 0.06, 0, 0.15, BUILD),
    mat('matMoldura', 'Moldura', 'Frame', 'oak'),
    mat('matObra', 'Obra', 'Artwork', 'lacquerTerracotta'),
  ],
  parts: [
    // Each picture: a frame, a white mat, the work; spread 8 cm apart.
    { kind: 'box', name: w('Moldura', 'Frame'), repeat: { count: 'quadros', dx: 'largura + 0.08' }, x: '-(quadros * largura + (quadros - 1) * 0.08) / 2', y: -0.03, z: 'base - altura/2', w: 'largura', d: 0.03, h: 'altura', material: 'matMoldura', round: 0.004 },
    { kind: 'box', name: w('Passe-partout', 'Mat'), repeat: { count: 'quadros', dx: 'largura + 0.08' }, x: '-(quadros * largura + (quadros - 1) * 0.08) / 2 + 0.02', y: -0.032, z: 'base - altura/2 + 0.02', w: 'largura - 0.04', d: 0.004, h: 'altura - 0.04', material: 'lacquerWhite' },
    { kind: 'box', name: w('Obra', 'Artwork'), repeat: { count: 'quadros', dx: 'largura + 0.08' }, x: '-(quadros * largura + (quadros - 1) * 0.08) / 2 + 0.02 + passe', y: -0.034, z: 'base - altura/2 + 0.02 + passe', w: 'largura - 0.04 - 2 * passe', d: 0.004, h: 'altura - 0.04 - 2 * passe', material: 'matObra' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['(quadros * largura + (quadros - 1) * 0.08) / 2', -0.03, 'base'], shift: 0 }],
  types: [
    { id: 'one', name: w('Um, 60 × 80', 'One, 60 × 80'), values: {} },
    { id: 'three', name: w('Trio 40 × 50', 'Trio 40 × 50'), values: { quadros: 3, largura: 0.4, altura: 0.5, matMoldura: 'blackSteel', matObra: 'lacquerSage' } },
    { id: 'large', name: w('Grande 1,2 × 0,9 sem passe', 'Large 1.2 × 0.9, no mat'), values: { largura: 1.2, altura: 0.9, passe: 0, matObra: 'velvet' } },
  ],
};

export const VASE: ObjectDefinition = {
  id: 'def_vase',
  name: w('Vaso decorativo', 'Decorative vase'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    choice('forma', 'Forma', 'Shape', [['Ânfora', 'Amphora'], ['Bojudo', 'Round-bellied'], ['Cilindro', 'Cylinder']]),
    len('altura', 'Altura', 'Height', 0.45, 0.15, 1.2),
    len('largura', 'Diâmetro', 'Diameter', 0.22, 0.08, 0.6),
    yes('galhos', 'Com galhos', 'With branches', 1),
    mat('matVaso', 'Vaso', 'Vase', 'lacquerTerracotta'),
  ],
  parts: [
    { kind: 'revolve', name: w('Vaso', 'Vase'), when: 'forma == 0', x: 0, y: 0, z: 0, points: [['largura * 0.3', 0], ['largura * 0.5', 'altura * 0.35'], ['largura * 0.42', 'altura * 0.62'], ['largura * 0.18', 'altura * 0.85'], ['largura * 0.24', 'altura']], material: 'matVaso' },
    { kind: 'revolve', name: w('Vaso', 'Vase'), when: 'forma == 1', x: 0, y: 0, z: 0, points: [['largura * 0.25', 0], ['largura * 0.5', 'altura * 0.3'], ['largura * 0.48', 'altura * 0.6'], ['largura * 0.2', 'altura * 0.88'], ['largura * 0.16', 'altura']], material: 'matVaso' },
    { kind: 'cylinder', name: w('Vaso', 'Vase'), when: 'forma == 2', x: 0, y: 0, z: 0, r: 'largura/2', h: 'altura', material: 'matVaso' },
    // Dried branches fanning out of its neck.
    { kind: 'cylinder', name: w('Galho', 'Branch'), when: 'galhos', repeat: { count: 5 }, x: 0, y: 0, z: 'altura * 0.85', r: 0.004, r2: 0.0015, h: 'altura * (0.9 + (i % 3) * 0.2)', tilt: '8 + (i % 3) * 7', turn: '72 * i + 15', material: 'bark' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'amphora', name: w('Ânfora terracota com galhos', 'Terracotta amphora, branches'), values: {} },
    { id: 'round', name: w('Bojudo branco', 'Round white'), values: { forma: 1, galhos: 0, matVaso: 'ceramic', altura: 0.3, largura: 0.26 } },
    { id: 'tall', name: w('Cilindro alto preto', 'Tall black cylinder'), values: { forma: 2, altura: 0.8, largura: 0.2, matVaso: 'lacquerBlack' } },
  ],
};

export const LARGE_PLANT: ObjectDefinition = {
  id: 'def_large_plant',
  name: w('Planta grande em vaso', 'Large potted plant'),
  category: 'plant',
  folder: 'Vegetação',
  params: [
    len('altura', 'Altura da planta', 'Plant height', 1.5, 0.6, 2.5),
    len('largura', 'Diâmetro do vaso', 'Pot diameter', 0.4, 0.2, 0.7),
    int('folhas', 'Folhas', 'Leaves', 11, 5, 24),
    mat('matVaso', 'Vaso', 'Pot', 'concretePolished'),
    mat('matFolha', 'Folhas', 'Leaves', 'foliage'),
  ],
  parts: [
    { kind: 'revolve', name: w('Vaso', 'Pot'), x: 0, y: 0, z: 0, points: [['largura * 0.4', 0], ['largura * 0.5', 'largura * 0.95'], ['largura * 0.47', 'largura * 0.95'], ['largura * 0.45', 'largura * 0.88'], [0, 'largura * 0.88']], material: 'matVaso' },
    // Stems up from the soil in a spray, each ending in a broad leaf leaning out, on a turn round the pot.
    { kind: 'cylinder', name: w('Haste', 'Stem'), repeat: { count: 'folhas' }, x: 0, y: 0, z: 'largura * 0.88', r: 0.006, h: '(altura - largura) * (0.55 + ((i * 7) % 5) * 0.08)', tilt: '10 + ((i * 3) % 4) * 6', turn: '360 * i / folhas * 1.62', material: 'matFolha' },
    {
      kind: 'sphere',
      name: w('Folha', 'Leaf'),
      repeat: { count: 'folhas' },
      x: '-((altura - largura) * (0.55 + ((i * 7) % 5) * 0.08) * sin(10 + ((i * 3) % 4) * 6) + 0.15) * sin(360 * i / folhas * 1.62)',
      y: '((altura - largura) * (0.55 + ((i * 7) % 5) * 0.08) * sin(10 + ((i * 3) % 4) * 6) + 0.15) * cos(360 * i / folhas * 1.62)',
      z: 'largura * 0.88 + (altura - largura) * (0.55 + ((i * 7) % 5) * 0.08) * cos(10 + ((i * 3) % 4) * 6) - 0.02',
      r: '0.07 + ((i * 5) % 3) * 0.012',
      d: '0.17 + ((i * 5) % 3) * 0.025',
      h: 0.012,
      tilt: '-12 - ((i * 3) % 4) * 6',
      turn: '(360 * i / folhas * 1.62)',
      material: 'matFolha',
    },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'tall', name: w('Folhas largas 1,5 m', 'Broad leaves 1.5 m'), values: {} },
    { id: 'small', name: w('Pequena, vaso de cerâmica', 'Small, ceramic pot'), values: { altura: 0.8, largura: 0.28, folhas: 8, matVaso: 'ceramic' } },
    { id: 'big', name: w('Grande 2,2 m, vaso de fibra preto', 'Big 2.2 m, black pot'), values: { altura: 2.2, largura: 0.55, folhas: 18, matVaso: 'lacquerBlack' } },
  ],
};

export const WALL_CLOCK: ObjectDefinition = {
  id: 'def_wall_clock',
  name: w('Relógio de parede', 'Wall clock'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    len('largura', 'Diâmetro', 'Diameter', 0.4, 0.2, 1),
    len('base', 'Centro a (do piso)', 'Centre at (from floor)', 1.9, 1.2, 2.6),
    num('horas', 'Hora', 'Hour', 10, 0, 12, 0.25),
    mat('matAro', 'Aro', 'Rim', 'oak'),
    mat('matMostrador', 'Mostrador', 'Dial', 'lacquerWhite'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Aro', 'Rim'), x: 0, y: 0, z: 'base', r: 'largura/2', h: 0.035, tilt: -90, material: 'matAro' },
    { kind: 'cylinder', name: w('Mostrador', 'Dial'), x: 0, y: -0.035, z: 'base', r: 'largura/2 - 0.015', h: 0.002, tilt: -90, material: 'matMostrador' },
    // Twelve marks round the dial, the hands at the hour asked.
    { kind: 'box', name: w('Marca', 'Mark'), repeat: { count: 12 }, x: '-0.004 + (largura/2 - 0.05) * sin(30 * i)', y: -0.04, z: 'base + (largura/2 - 0.05) * cos(30 * i) - 0.012', w: 0.008, d: 0.003, h: 0.024, material: 'lacquerBlack' },
    { kind: 'box', name: w('Ponteiro das horas', 'Hour hand'), x: -0.006, y: -0.043, z: 'base', w: 0.012, d: 0.003, h: 'largura * 0.25', roll: 'horas * 30', material: 'lacquerBlack' },
    { kind: 'box', name: w('Ponteiro dos minutos', 'Minute hand'), x: -0.004, y: -0.046, z: 'base', w: 0.008, d: 0.003, h: 'largura * 0.38', roll: '(horas - floor(horas)) * 360', material: 'lacquerBlack' },
    { kind: 'cylinder', name: w('Eixo', 'Pin'), x: 0, y: -0.035, z: 'base', r: 0.008, h: 0.014, tilt: -90, material: 'brass' },
  ],
  handles: [],
  types: [
    { id: 'oak', name: w('Carvalho 40 cm', 'Oak 40 cm'), values: {} },
    { id: 'black', name: w('Preto 60 cm', 'Black 60 cm'), values: { largura: 0.6, matAro: 'blackSteel' } },
  ],
};

export const FLOATING_SHELF: ObjectDefinition = {
  id: 'def_floating_shelf',
  name: w('Prateleira com objetos', 'Floating shelf with objects'),
  category: 'casework',
  folder: 'Decoração',
  params: [
    len('largura', 'Largura', 'Width', 1, 0.4, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.22, 0.15, 0.35),
    len('base', 'Altura do piso', 'Height above floor', 1.4, 0.3, 2.2),
    yes('objetos', 'Com objetos', 'With objects', 1),
    mat('matPrateleira', 'Prateleira', 'Shelf', 'walnut'),
  ],
  parts: [
    { kind: 'box', name: w('Prateleira', 'Shelf'), x: '-largura/2', y: '-profundidade', z: 'base', w: 'largura', d: 'profundidade', h: 0.04, material: 'matPrateleira', round: 0.004 },
    // A few books lying, a small vase, a candle and a bowl.
    { kind: 'box', name: w('Livros', 'Books'), when: 'objetos', repeat: { count: 3, dz: 0.03 }, x: '-largura/2 + 0.08 + i * 0.01', y: '-profundidade + 0.03', z: 'base + 0.04', w: '0.22 - i * 0.02', d: 'profundidade - 0.06', h: 0.028, material: 'linen', round: 0.003 },
    { kind: 'revolve', name: w('Vaso pequeno', 'Small vase'), when: 'objetos', x: 'largura/2 - 0.15', y: '-profundidade/2', z: 'base + 0.04', points: [[0.03, 0], [0.05, 0.06], [0.03, 0.15], [0.02, 0.18]], material: 'lacquerTerracotta' },
    { kind: 'cylinder', name: w('Vela', 'Candle'), when: 'objetos', x: 0.05, y: '-profundidade/2', z: 'base + 0.04', r: 0.035, h: 0.09, material: 'boucle' },
    { kind: 'revolve', name: w('Tigela', 'Bowl'), when: 'objetos && largura > 0.7', x: -0.12, y: '-profundidade/2', z: 'base + 0.04', points: [[0.03, 0], [0.08, 0.04], [0.085, 0.05]], material: 'ceramic' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', '-profundidade/2', 'base'], shift: 0.5 }],
  types: [
    { id: 'walnut', name: w('Nogueira com objetos', 'Walnut, with objects'), values: {} },
    { id: 'white', name: w('Branca, vazia', 'White, empty'), values: { objetos: 0, matPrateleira: 'lacquerWhite' } },
  ],
};

export const LIBRARY_DECOR: readonly ObjectDefinition[] = [TABLE_LAMP, CHANDELIER, TRACK_LIGHT, LED_PROFILE, OUTDOOR_WALL_LIGHT, DESK_LAMP, CURTAIN, BLIND, WALL_ART, VASE, LARGE_PLANT, WALL_CLOCK, FLOATING_SHELF];
