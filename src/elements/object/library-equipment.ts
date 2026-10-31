// The library's equipment (data only, as library.ts): a split air conditioner (indoor and outdoor units,
// sized by its BTU), a ceiling fan with its light, a water heater (gas or a storage boiler), a distribution
// board, a piano (upright or grand, its curved case a profile), a treadmill, a water tank and a solar water
// heater.

import type { ObjectDefinition, ParamDef } from './schema';
import { BUILD, choice, derived, int, len, mat, num, w, yes } from './library-kit';
import type { DefinitionId } from './schema';

const light = (watts: number, kelvin: number): ParamDef[] => [
  { name: 'potencia', label: w('Potência (W, LED)', 'Power (W, LED)'), kind: 'number', default: watts, min: 1, max: 200, step: 0.5, group: w('Luz', 'Light') },
  { name: 'cor', label: w('Temperatura de cor (K)', 'Colour temperature (K)'), kind: 'integer', default: kelvin, min: 2200, max: 6500, step: 100, group: w('Luz', 'Light') },
];

export const SPLIT_AC: ObjectDefinition = {
  id: 'def_split_ac' as DefinitionId,
  name: w('Ar-condicionado split', 'Split air conditioner'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    choice('unidade', 'Unidade', 'Unit', [['Evaporadora (interna)', 'Indoor unit'], ['Condensadora (externa)', 'Outdoor unit']]),
    choice('btus', 'Capacidade', 'Capacity', [['9.000 BTU/h', '9,000 BTU/h'], ['12.000 BTU/h', '12,000 BTU/h'], ['18.000 BTU/h', '18,000 BTU/h'], ['24.000 BTU/h', '24,000 BTU/h']], 1),
    len('base', 'Altura de instalação', 'Mounting height', 2.2, 0, 2.8),
    derived('largura', 'Largura', 'Width', 'if(unidade == 0, 0.8 + btus * 0.12, 0.7 + btus * 0.1)'),
    derived('altura', 'Altura', 'Height', 'if(unidade == 0, 0.28 + btus * 0.02, 0.5 + btus * 0.06)'),
    derived('profundidade', 'Profundidade', 'Depth', 'if(unidade == 0, 0.2 + btus * 0.015, 0.28 + btus * 0.02)'),
    mat('matCorpo', 'Corpo', 'Body', 'plasticWhite'),
  ],
  parts: [
    // Indoor: a long rounded body, its louver tilted open, the display.
    { kind: 'box', name: w('Evaporadora', 'Indoor unit'), when: 'unidade == 0', x: '-largura/2', y: '-profundidade', z: 'base', w: 'largura', d: 'profundidade', h: 'altura', material: 'matCorpo', round: 0.04 },
    { kind: 'box', name: w('Aleta', 'Louver'), when: 'unidade == 0', x: '-largura/2 + 0.05', y: '-profundidade - 0.02', z: 'base + 0.02', w: 'largura - 0.1', d: 0.06, h: 0.006, tilt: -25, material: 'matCorpo', round: 0.002 },
    { kind: 'box', name: w('Visor', 'Display'), when: 'unidade == 0', x: 'largura/2 - 0.15', y: '-profundidade - 0.002', z: 'base + altura * 0.45', w: 0.06, d: 0.003, h: 0.02, material: 'screen' },
    // Outdoor: a cabinet on brackets off the wall, its fan behind a round grille, its side fins.
    { kind: 'box', name: w('Condensadora', 'Outdoor unit'), when: 'unidade == 1', x: '-largura/2', y: '-profundidade - 0.05', z: 'base', w: 'largura', d: 'profundidade', h: 'altura', material: 'matCorpo', round: 0.01 },
    { kind: 'cylinder', name: w('Grade do ventilador', 'Fan grille'), when: 'unidade == 1', x: '-largura * 0.12', y: '-profundidade - 0.05', z: 'base + altura/2', r: 'altura * 0.38', h: 0.01, tilt: -90, material: 'plasticBlack' },
    { kind: 'box', name: w('Pá', 'Blade'), when: 'unidade == 1', repeat: { count: 3 }, x: '-largura * 0.12 - 0.04', y: '-profundidade - 0.045', z: 'base + altura/2', w: 0.08, d: 0.005, h: 'altura * 0.34', roll: '120 * i + 20', material: 'aluminium' },
    { kind: 'box', name: w('Aletas', 'Fins'), when: 'unidade == 1', repeat: { count: 'floor(altura / 0.03)', dz: 0.03 }, x: 'largura/2 - 0.005', y: '-profundidade - 0.04', z: 'base + 0.02', w: 0.006, d: 'profundidade - 0.02', h: 0.004, material: 'aluminium' },
    { kind: 'box', name: w('Suporte', 'Bracket'), when: 'unidade == 1 && base > 0.3', repeat: { count: 2, dx: 'largura - 0.15' }, x: '-largura/2 + 0.05', y: '-profundidade - 0.1', z: 'base - 0.04', w: 0.05, d: 'profundidade + 0.1', h: 0.04, material: 'blackSteel' },
  ],
  handles: [{ param: 'base', axis: 'z', at: [0, 0, 'base'] }],
  types: [
    { id: 'indoor12', name: w('Evaporadora 12.000', 'Indoor 12,000'), values: {} },
    { id: 'indoor24', name: w('Evaporadora 24.000', 'Indoor 24,000'), values: { btus: 3 } },
    { id: 'outdoor12', name: w('Condensadora 12.000, na parede', 'Outdoor 12,000, on the wall'), values: { unidade: 1, base: 1.5 } },
    { id: 'outdoor24', name: w('Condensadora 24.000, no piso', 'Outdoor 24,000, on the ground'), values: { unidade: 1, btus: 3, base: 0.1 } },
  ],
};

export const CEILING_FAN: ObjectDefinition = {
  id: 'def_ceiling_fan' as DefinitionId,
  name: w('Ventilador de teto', 'Ceiling fan'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    len('largura', 'Diâmetro das pás', 'Blade span', 1.3, 0.8, 1.8),
    len('teto', 'Altura do teto', 'Ceiling height', 2.8, 2.5, 5),
    len('haste', 'Haste', 'Downrod', 0.25, 0.05, 1.2, BUILD),
    int('pas', 'Pás', 'Blades', 4, 3, 6),
    yes('luz', 'Com luminária', 'With a light', 1),
    ...light(15, 3000),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerWhite'),
    mat('matPas', 'Pás', 'Blades', 'oak'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Canopla', 'Canopy'), x: 0, y: 0, z: 'teto - 0.06', r: 0.06, r2: 0.045, h: 0.06, material: 'matCorpo' },
    { kind: 'cylinder', name: w('Haste', 'Downrod'), x: 0, y: 0, z: 'teto - 0.06 - haste', r: 0.012, h: 'haste', material: 'matCorpo' },
    { kind: 'revolve', name: w('Motor', 'Motor'), x: 0, y: 0, z: 'teto - 0.06 - haste - 0.12', points: [[0.05, 0], [0.1, 0.02], [0.11, 0.07], [0.07, 0.12], [0.02, 0.125]], material: 'matCorpo' },
    // Blades on arms, turned round the motor, pitched 12°.
    { kind: 'box', name: w('Braço da pá', 'Blade iron'), repeat: { count: 'pas' }, x: '-0.13 * sin(360 * i / pas) - 0.012', y: '0.13 * cos(360 * i / pas) - 0.07', z: 'teto - 0.06 - haste - 0.08', w: 0.024, d: 0.14, h: 0.008, turn: '360 * i / pas', material: 'matCorpo' },
    { kind: 'box', name: w('Pá', 'Blade'), repeat: { count: 'pas' }, x: '-(0.18 + (largura/2 - 0.18) / 2) * sin(360 * i / pas) - 0.07', y: '(0.18 + (largura/2 - 0.18) / 2) * cos(360 * i / pas) - (largura/2 - 0.18) / 2', z: 'teto - 0.06 - haste - 0.085', w: 0.14, d: 'largura/2 - 0.18', h: 0.008, turn: '360 * i / pas', roll: 8, material: 'matPas', round: 0.003 },
    { kind: 'sphere', name: w('Globo', 'Globe'), when: 'luz', x: 0, y: 0, z: 'teto - 0.06 - haste - 0.24', r: 0.1, h: 0.13, material: 'frostedGlass' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'teto - 0.06 - haste - 0.08'], shift: 0 }],
  types: [
    { id: 'white', name: w('Branco, pás de carvalho', 'White, oak blades'), values: {} },
    { id: 'black', name: w('Preto, 3 pás, sem luz', 'Black, 3 blades, no light'), values: { pas: 3, luz: 0, matCorpo: 'lacquerBlack', matPas: 'lacquerBlack' } },
    { id: 'tall', name: w('Pé-direito alto, haste longa', 'Tall ceiling, long rod'), values: { teto: 4, haste: 1, largura: 1.6, matPas: 'walnut' } },
  ],
  light: { x: 0, y: 0, z: 'teto - 0.06 - haste - 0.2', watts: 'potencia * luz', kelvin: 'cor' },
};

export const WATER_HEATER: ObjectDefinition = {
  id: 'def_water_heater' as DefinitionId,
  name: w('Aquecedor de água', 'Water heater'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    choice('modelo', 'Modelo', 'Model', [['A gás de passagem', 'Gas, tankless'], ['Boiler elétrico vertical', 'Electric boiler, upright'], ['Boiler horizontal', 'Boiler, horizontal']]),
    num('litros', 'Volume do boiler (L)', 'Boiler volume (L)', 200, 50, 600, 10),
    len('base', 'Altura de instalação', 'Mounting height', 1.4, 0, 2.4),
    derived('largura', 'Largura', 'Width', 'if(modelo == 0, 0.36, if(modelo == 1, 2 * sqrt(litros / 1000 / 3.14 / 1.4), litros / 1000 / 3.14 / 0.09))'),
    mat('matCorpo', 'Corpo', 'Body', 'plasticWhite'),
  ],
  parts: [
    // Gas: a wall box, its flue up, its display; the gas and water connections under it.
    { kind: 'box', name: w('Aquecedor', 'Heater'), when: 'modelo == 0', x: -0.18, y: -0.18, z: 'base', w: 0.36, d: 0.18, h: 0.58, material: 'matCorpo', round: 0.012 },
    { kind: 'cylinder', name: w('Chaminé', 'Flue'), when: 'modelo == 0', x: 0, y: -0.09, z: 'base + 0.58', r: 0.05, h: 0.35, material: 'aluminium' },
    { kind: 'box', name: w('Visor', 'Display'), when: 'modelo == 0', x: -0.05, y: -0.182, z: 'base + 0.2', w: 0.1, d: 0.003, h: 0.05, material: 'screen' },
    { kind: 'cylinder', name: w('Conexão', 'Connection'), when: 'modelo == 0', repeat: { count: 3, dx: 0.08 }, x: -0.08, y: -0.09, z: 'base - 0.1', r: 0.01, h: 0.1, material: 'copper' },
    // Upright boiler: a tall cylinder on the floor, its size by its volume.
    { kind: 'cylinder', name: w('Boiler', 'Boiler'), when: 'modelo == 1', x: 0, y: '-sqrt(litros / 1000 / 3.14 / 1.4) - 0.02', z: 0, r: 'sqrt(litros / 1000 / 3.14 / 1.4)', h: '1.4 + 0.1', material: 'matCorpo' },
    { kind: 'revolve', name: w('Tampo do boiler', 'Boiler top'), when: 'modelo == 1', x: 0, y: '-sqrt(litros / 1000 / 3.14 / 1.4) - 0.02', z: 1.5, points: [['sqrt(litros / 1000 / 3.14 / 1.4)', 0], ['sqrt(litros / 1000 / 3.14 / 1.4) * 0.8', 0.05], [0, 0.07]], material: 'matCorpo' },
    // Horizontal boiler (a solar heater's, a roof's): lying on two saddles.
    { kind: 'cylinder', name: w('Boiler', 'Boiler'), when: 'modelo == 2', x: '-(litros / 1000 / 3.14 / 0.09) / 2', y: -0.32, z: 'base + 0.32', r: 0.3, h: 'litros / 1000 / 3.14 / 0.09', roll: 90, material: 'stainless' },
    { kind: 'box', name: w('Berço', 'Saddle'), when: 'modelo == 2', repeat: { count: 2, dx: '(litros / 1000 / 3.14 / 0.09) * 0.7' }, x: '-(litros / 1000 / 3.14 / 0.09) * 0.35 - 0.03', y: -0.55, z: 'base', w: 0.06, d: 0.46, h: 0.08, material: 'blackSteel' },
  ],
  handles: [{ param: 'base', axis: 'z', at: [0, 0, 'base'] }],
  types: [
    { id: 'gas', name: w('A gás 20 L/min', 'Gas 20 L/min'), values: {} },
    { id: 'boiler', name: w('Boiler vertical 200 L', 'Upright boiler 200 L'), values: { modelo: 1 } },
    { id: 'roof', name: w('Boiler horizontal 300 L', 'Horizontal boiler 300 L'), values: { modelo: 2, litros: 300, base: 0 } },
  ],
};

export const ELECTRIC_PANEL: ObjectDefinition = {
  id: 'def_electric_panel' as DefinitionId,
  name: w('Quadro de distribuição', 'Distribution board'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    int('disjuntores', 'Disjuntores (posições DIN)', 'Breakers (DIN modules)', 24, 6, 72),
    len('base', 'Altura de instalação', 'Mounting height', 1.3, 0.4, 1.8),
    yes('aberto', 'Porta aberta', 'Door open', 0),
    yes('sobrepor', 'De sobrepor', 'Surface-mounted', 0),
    derived('largura', 'Largura', 'Width', '0.1 + min(disjuntores, 18) * 0.018'),
    derived('altura', 'Altura', 'Height', '0.12 + ceil(disjuntores / 18) * 0.14'),
    mat('matPorta', 'Porta', 'Door', 'lacquerWhite'),
  ],
  parts: [
    { kind: 'box', name: w('Caixa', 'Box'), x: '-largura/2', y: 'if(sobrepor, -0.1, -0.02)', z: 'base', w: 'largura', d: 'if(sobrepor, 0.1, 0.02)', h: 'altura', material: 'matPorta', round: 0.004 },
    // Closed, its door with a small window; open, the rows of breakers in their rails.
    { kind: 'box', name: w('Porta', 'Door'), when: 'aberto == 0', x: '-largura/2 + 0.01', y: 'if(sobrepor, -0.104, -0.024)', z: 'base + 0.01', w: 'largura - 0.02', d: 0.004, h: 'altura - 0.02', material: 'matPorta' },
    { kind: 'box', name: w('Visor', 'Window'), when: 'aberto == 0', x: '-largura/2 + 0.04', y: 'if(sobrepor, -0.106, -0.026)', z: 'base + altura * 0.4', w: 'largura - 0.08', d: 0.002, h: 0.05, material: 'frostedGlass' },
    { kind: 'box', name: w('Disjuntor', 'Breaker'), when: 'aberto', repeat: { count: 'disjuntores' }, x: '-largura/2 + 0.04 + (i % 18) * 0.018', y: 'if(sobrepor, -0.13, -0.05)', z: 'base + 0.07 + floor(i / 18) * 0.14', w: 0.017, d: 0.06, h: 0.09, material: 'plasticWhite', round: 0.002 },
    { kind: 'box', name: w('Alavanca', 'Toggle'), when: 'aberto', repeat: { count: 'disjuntores' }, x: '-largura/2 + 0.045 + (i % 18) * 0.018', y: 'if(sobrepor, -0.14, -0.06)', z: 'base + 0.11 + floor(i / 18) * 0.14', w: 0.007, d: 0.012, h: 0.012, material: 'lacquerBlack' },
  ],
  handles: [{ param: 'base', axis: 'z', at: [0, 0, 'base'] }],
  types: [
    { id: 'flush24', name: w('Embutir, 24 posições', 'Flush, 24 modules'), values: {} },
    { id: 'open36', name: w('Aberto, 36 posições', 'Open, 36 modules'), values: { disjuntores: 36, aberto: 1 } },
    { id: 'surface12', name: w('Sobrepor, 12 posições', 'Surface, 12 modules'), values: { disjuntores: 12, sobrepor: 1, matPorta: 'aluminium' } },
  ],
};

export const PIANO: ObjectDefinition = {
  id: 'def_piano' as DefinitionId,
  name: w('Piano', 'Piano'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Vertical', 'Upright'], ['De cauda', 'Grand']]),
    len('largura', 'Largura', 'Width', 1.5, 1.4, 1.6),
    len('profundidade', 'Comprimento (cauda)', 'Length (grand)', 1.8, 1.5, 2.8),
    yes('banqueta', 'Com banqueta', 'With a bench', 1),
    mat('matCorpo', 'Corpo', 'Case', 'lacquerBlack'),
  ],
  parts: [
    // Upright: its case, the keyboard on its keybed, the music desk.
    { kind: 'box', name: w('Caixa', 'Case'), when: 'modelo == 0', x: '-largura/2', y: 0, z: 0.05, w: 'largura', d: 0.6, h: 1.2, material: 'matCorpo', round: 0.01 },
    { kind: 'box', name: w('Tampa do teclado', 'Keybed'), when: 'modelo == 0', x: '-largura/2 + 0.04', y: -0.17, z: 0.62, w: 'largura - 0.08', d: 0.2, h: 0.08, material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Teclado', 'Keyboard'), when: 'modelo == 0', x: '-largura/2 + 0.1', y: -0.16, z: 0.7, w: 'largura - 0.2', d: 0.15, h: 0.02, material: 'lacquerWhite' },
    { kind: 'box', name: w('Tecla preta', 'Black key'), when: 'modelo == 0', repeat: { count: 36 }, x: '-largura/2 + 0.12 + (floor(i / 5) * 7 + if(i % 5 < 2, i % 5 + 0.6, i % 5 + 1.6)) * (largura - 0.2) / 52', y: -0.1, z: 0.72, w: 0.011, d: 0.09, h: 0.012, material: 'lacquerBlack' },
    { kind: 'box', name: w('Estante', 'Music desk'), when: 'modelo == 0', x: '-largura/2 + 0.2', y: -0.02, z: 0.86, w: 'largura - 0.4', d: 0.02, h: 0.3, tilt: -10, material: 'matCorpo' },
    { kind: 'box', name: w('Pé', 'Toe'), when: 'modelo == 0', repeat: { count: 2, dx: 'largura - 0.06' }, x: '-largura/2', y: -0.2, z: 0, w: 0.06, d: 0.8, h: 0.05, material: 'matCorpo' },
    // Grand: its curved rim as a profile (bentside and tail), on three legs, the lid raised on its stick.
    {
      kind: 'profile',
      name: w('Caixa', 'Rim'),
      when: 'modelo == 1',
      x: 0,
      y: 0,
      z: 0.6,
      h: 0.32,
      points: [
        ['-largura/2', 0],
        ['largura/2', 0],
        ['largura/2', 'profundidade * 0.35'],
        ['largura * 0.2', 'profundidade * 0.55'],
        ['largura * 0.05', 'profundidade * 0.8'],
        ['-largura * 0.1', 'profundidade'],
        ['-largura * 0.35', 'profundidade * 0.98'],
        ['-largura/2', 'profundidade * 0.85'],
      ],
      material: 'matCorpo',
    },
    { kind: 'box', name: w('Teclado', 'Keyboard'), when: 'modelo == 1', x: '-largura/2 + 0.08', y: -0.22, z: 0.7, w: 'largura - 0.16', d: 0.22, h: 0.02, material: 'lacquerWhite' },
    { kind: 'box', name: w('Tecla preta', 'Black key'), when: 'modelo == 1', repeat: { count: 36 }, x: '-largura/2 + 0.1 + (floor(i / 5) * 7 + if(i % 5 < 2, i % 5 + 0.6, i % 5 + 1.6)) * (largura - 0.16) / 52', y: -0.12, z: 0.72, w: 0.011, d: 0.1, h: 0.012, material: 'lacquerBlack' },
    { kind: 'box', name: w('Banco do teclado', 'Key slip'), when: 'modelo == 1', x: '-largura/2', y: -0.24, z: 0.6, w: 'largura', d: 0.24, h: 0.1, material: 'matCorpo' },
    { kind: 'cylinder', name: w('Perna', 'Leg'), when: 'modelo == 1', repeat: { count: 3 }, x: 'if(i == 0, -largura/2 + 0.1, if(i == 1, largura/2 - 0.1, -largura * 0.15))', y: 'if(i < 2, 0.1, profundidade * 0.85)', z: 0, r: 0.045, r2: 0.06, h: 0.6, material: 'matCorpo' },
    { kind: 'box', name: w('Tampa', 'Lid'), when: 'modelo == 1', x: '-largura/2 + 0.02', y: 0.05, z: 0.92, w: 'largura - 0.04', d: 'profundidade * 0.9', h: 0.02, roll: -22, material: 'matCorpo' },
  ],
  handles: [],
  types: [
    { id: 'upright', name: w('Vertical preto', 'Black upright'), values: {} },
    { id: 'grand', name: w('De cauda 1,80', 'Grand 1.80'), values: { modelo: 1 } },
    { id: 'walnut', name: w('Vertical nogueira', 'Walnut upright'), values: { matCorpo: 'walnut' } },
  ],
};

export const TREADMILL: ObjectDefinition = {
  id: 'def_treadmill' as DefinitionId,
  name: w('Esteira', 'Treadmill'),
  category: 'equipment',
  folder: 'Academia',
  params: [
    len('largura', 'Largura', 'Width', 0.8, 0.7, 0.95),
    len('profundidade', 'Comprimento', 'Length', 1.9, 1.6, 2.2),
    mat('matCorpo', 'Corpo', 'Body', 'plasticBlack'),
  ],
  parts: [
    { kind: 'box', name: w('Base', 'Deck'), x: '-largura/2', y: '-profundidade/2', z: 0.03, w: 'largura', d: 'profundidade', h: 0.15, material: 'matCorpo', round: 0.03 },
    { kind: 'box', name: w('Lona', 'Belt'), x: '-largura/2 + 0.1', y: '-profundidade/2 + 0.08', z: 0.18, w: 'largura - 0.2', d: 'profundidade - 0.4', h: 0.006, material: 'rubber' },
    { kind: 'box', name: w('Pé', 'Foot'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.05, largura/2 - 0.1)', y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.15)', z: 0, w: 0.05, d: 0.1, h: 0.03, material: 'rubber' },
    // Uprights from the front of the deck, leaning back; the console with its screen; handrails.
    { kind: 'box', name: w('Coluna', 'Upright'), repeat: { count: 2, dx: 'largura - 0.07' }, x: '-largura/2', y: 'profundidade/2 - 0.32', z: 0.1, w: 0.07, d: 0.08, h: 1.3, tilt: -12, material: 'aluminium', round: 0.01 },
    { kind: 'box', name: w('Painel', 'Console'), x: '-largura/2', y: 'profundidade/2 - 0.36 - 1.3 * sin(12)', z: 1.3, w: 'largura', d: 0.18, h: 0.3, tilt: -35, material: 'matCorpo', round: 0.02 },
    { kind: 'box', name: w('Tela', 'Screen'), x: '-0.15', y: 'profundidade/2 - 0.364 - 1.3 * sin(12)', z: 1.35, w: 0.3, d: 0.004, h: 0.18, tilt: -35, material: 'screen' },
    { kind: 'cylinder', name: w('Corrimão', 'Handrail'), repeat: { count: 2, dx: 'largura - 0.07' }, x: '-largura/2 + 0.035', y: 'profundidade/2 - 0.28 - 0.95 * sin(12)', z: 1.05, r: 0.018, h: 0.4, tilt: -90, material: 'aluminium' },
  ],
  handles: [],
  types: [{ id: 'std', name: w('Padrão', 'Standard'), values: {} }],
};

export const WATER_TANK: ObjectDefinition = {
  id: 'def_water_tank' as DefinitionId,
  name: w('Caixa d\'água', 'Water tank'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    choice('litros', 'Capacidade', 'Capacity', [['500 L', '500 L'], ['1.000 L', '1,000 L'], ['2.000 L', '2,000 L'], ['5.000 L', '5,000 L']], 1),
    derived('largura', 'Diâmetro do topo', 'Top diameter', 'if(litros == 0, 1.22, if(litros == 1, 1.52, if(litros == 2, 1.93, 2.6)))'),
    derived('altura', 'Altura', 'Height', 'if(litros == 0, 0.58, if(litros == 1, 0.88, if(litros == 2, 1.08, 1.6)))'),
    mat('matTanque', 'Tanque', 'Tank', 'velvet'),
  ],
  parts: [
    // A truncated cone, wider at the top, its rim and lid.
    { kind: 'cylinder', name: w('Tanque', 'Tank'), x: 0, y: 0, z: 0, r: 'largura * 0.4', r2: 'largura * 0.47', h: 'altura - 0.05', material: 'matTanque' },
    { kind: 'cylinder', name: w('Borda', 'Rim'), x: 0, y: 0, z: 'altura - 0.07', r: 'largura/2', h: 0.04, material: 'matTanque' },
    { kind: 'revolve', name: w('Tampa', 'Lid'), x: 0, y: 0, z: 'altura - 0.03', points: [['largura/2 - 0.01', 0], ['largura * 0.35', 0.08], ['largura * 0.08', 0.14], [0, 0.15]], material: 'matTanque' },
    { kind: 'cylinder', name: w('Entrada', 'Inlet'), x: 'largura * 0.42', y: 0, z: 'altura - 0.18', r: 0.02, h: 0.15, roll: 90, material: 'plasticWhite' },
    { kind: 'cylinder', name: w('Saída', 'Outlet'), x: 'largura * 0.35', y: 0, z: 0.06, r: 0.025, h: 0.2, roll: 90, material: 'plasticWhite' },
  ],
  handles: [],
  types: [
    { id: 'l1000', name: w('1.000 L azul', '1,000 L blue'), values: {} },
    { id: 'l500', name: w('500 L', '500 L'), values: { litros: 0 } },
    { id: 'l5000', name: w('5.000 L (cisterna)', '5,000 L (cistern)'), values: { litros: 3, matTanque: 'plasticBlack' } },
  ],
};

export const SOLAR_HEATER: ObjectDefinition = {
  id: 'def_solar_heater' as DefinitionId,
  name: w('Aquecedor solar', 'Solar water heater'),
  category: 'equipment',
  folder: 'Equipamentos',
  params: [
    int('placas', 'Coletores', 'Collectors', 2, 1, 8),
    num('inclinacao', 'Inclinação (°)', 'Tilt (°)', 30, 10, 60, 1),
    derived('largura', 'Largura', 'Width', 'placas * 1.02'),
    yes('reservatorio', 'Com reservatório', 'With storage tank', 1),
    mat('matMoldura', 'Moldura', 'Frame', 'aluminium'),
  ],
  parts: [
    // The collectors: a frame tilted to the sun, its dark glazing and its riser tubes.
    { kind: 'box', name: w('Coletor', 'Collector'), repeat: { count: 'placas', dx: 1.02 }, x: '-largura/2 + 0.01', y: -1, z: 0.1, w: 1, d: 0.08, h: 2, tilt: '90 - inclinacao', material: 'matMoldura' },
    { kind: 'box', name: w('Vidro', 'Glazing'), repeat: { count: 'placas', dx: 1.02 }, x: '-largura/2 + 0.04', y: -1.004, z: 0.1, w: 0.94, d: 0.004, h: 1.94, tilt: '90 - inclinacao', material: 'graniteBlack' },
    { kind: 'box', name: w('Suporte', 'Stand'), repeat: { count: 'placas + 1', dx: 1.02 }, x: '-largura/2 - 0.015', y: '-1 + 2 * cos(inclinacao) - 0.04', z: 0, w: 0.03, d: 0.04, h: '0.1 + 2 * sin(inclinacao)', material: 'matMoldura' },
    // The tank above, lying on its saddles, where the hot water rises to.
    { kind: 'object', name: w('Reservatório', 'Storage tank'), definition: 'def_water_heater' as DefinitionId, when: 'reservatorio', x: 0, y: '-1 + 2 * cos(inclinacao) + 0.6', z: '0.1 + 2 * sin(inclinacao) + 0.1', values: { modelo: 2, litros: 'placas * 100 + 100', base: 0 } },
  ],
  handles: [],
  types: [
    { id: 'two', name: w('2 coletores, reservatório 300 L', '2 collectors, 300 L tank'), values: {} },
    { id: 'four', name: w('4 coletores', '4 collectors'), values: { placas: 4 } },
    { id: 'panels', name: w('Só coletores, 20°', 'Collectors only, 20°'), values: { reservatorio: 0, inclinacao: 20, placas: 3 } },
  ],
};

export const LIBRARY_EQUIPMENT: readonly ObjectDefinition[] = [SPLIT_AC, CEILING_FAN, WATER_HEATER, ELECTRIC_PANEL, PIANO, TREADMILL, WATER_TANK, SOLAR_HEATER];
