// The library's outdoors (data only, as library.ts): a sun lounger, a parasol, a slatted garden bench, a
// barbecue (built of brick or a kettle), a pergola, a planter with its plants, a bike rack and a fire pit.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, len, mat, num, w, yes } from './library-kit';

export const LOUNGER: ObjectDefinition = {
  id: 'def_lounger',
  name: w('Espreguiçadeira', 'Sun lounger'),
  category: 'furniture',
  folder: 'Área externa',
  params: [
    len('largura', 'Largura', 'Width', 0.7, 0.55, 0.9),
    len('profundidade', 'Comprimento', 'Length', 1.95, 1.7, 2.2),
    len('altura', 'Altura do assento', 'Seat height', 0.32, 0.2, 0.45),
    num('encosto', 'Encosto levantado (°)', 'Back raised (°)', 40, 0, 75, 5),
    yes('almofada', 'Almofada', 'Cushion', 1),
    mat('matEstrutura', 'Estrutura', 'Frame', 'freijo'),
    mat('matAlmofada', 'Almofada', 'Cushion', 'linen'),
  ],
  parts: [
    // Side rails on four legs, the slats of the seat between; the head part hinged, raised.
    { kind: 'box', name: w('Longarina', 'Side rail'), repeat: { count: 2, dx: 'largura - 0.04' }, x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.1', w: 0.04, d: 'profundidade * 0.62', h: 0.07, material: 'matEstrutura', round: 0.008 },
    { kind: 'box', name: w('Pé', 'Leg'), repeat: { count: 2, dx: 'largura - 0.04' }, x: '-largura/2', y: '-profundidade/2 + 0.04', z: 0, w: 0.04, d: 0.05, h: 'altura - 0.1', material: 'matEstrutura', round: 0.006 },
    // Wheels under the back's hinge, outside the rails, on an axle; the frame carried down to them.
    { kind: 'box', name: w('Suporte da roda', 'Wheel bracket'), repeat: { count: 2, dx: 'largura - 0.04' }, x: '-largura/2', y: '-profundidade/2 + profundidade * 0.62 - 0.12', z: 0.08, w: 0.04, d: 0.12, h: 'altura - 0.18', material: 'matEstrutura', round: 0.006 },
    { kind: 'cylinder', name: w('Roda', 'Wheel'), repeat: { count: 2, dx: 'largura + 0.035' }, x: '-largura/2 - 0.035', y: '-profundidade/2 + profundidade * 0.62 - 0.06', z: 0.08, r: 0.08, h: 0.03, roll: 90, material: 'rubber' },
    { kind: 'box', name: w('Ripa', 'Slat'), repeat: { count: 'floor(profundidade * 0.6 / 0.06)', dy: 0.06 }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.01', z: 'altura - 0.05', w: 'largura - 0.08', d: 0.045, h: 0.02, material: 'matEstrutura', round: 0.004 },
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2 + 0.04', y: '-profundidade/2 + profundidade * 0.62', z: 'altura - 0.05', w: 'largura - 0.08', d: 0.03, h: 'profundidade * 0.38', tilt: '90 - encosto', material: 'matEstrutura', round: 0.006 },
    { kind: 'box', name: w('Apoio do encosto', 'Back strut'), when: 'encosto > 5', repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.06', y: '-profundidade/2 + profundidade * 0.62 + profundidade * 0.38 * cos(encosto) * 0.6', z: 'altura - 0.1', w: 0.03, d: 0.03, h: 'profundidade * 0.38 * sin(encosto) * 0.6 + 0.04', material: 'matEstrutura' },
    { kind: 'box', name: w('Almofada', 'Cushion'), when: 'almofada', x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.02', z: 'altura - 0.03', w: 'largura - 0.06', d: 'profundidade * 0.6', h: 0.07, material: 'matAlmofada', round: 0.03 },
    { kind: 'box', name: w('Almofada do encosto', 'Back cushion'), when: 'almofada', x: '-largura/2 + 0.03', y: '-profundidade/2 + profundidade * 0.62 - 0.06 * sin(encosto)', z: 'altura - 0.02 + 0.06 * cos(encosto)', w: 'largura - 0.06', d: 0.07, h: 'profundidade * 0.36', tilt: '90 - encosto', material: 'matAlmofada', round: 0.03 },
  ],
  handles: [{ param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 }],
  types: [
    { id: 'wood', name: w('Freijó com almofada', 'Freijó with cushion'), values: {} },
    { id: 'flat', name: w('Deitada, sem almofada', 'Flat, no cushion'), values: { encosto: 0, almofada: 0, matEstrutura: 'pine' } },
    { id: 'white', name: w('Alumínio branco', 'White aluminium'), values: { matEstrutura: 'lacquerWhite', matAlmofada: 'velvet', encosto: 55 } },
  ],
};

export const PARASOL: ObjectDefinition = {
  id: 'def_parasol',
  name: w('Guarda-sol', 'Parasol'),
  category: 'furniture',
  folder: 'Área externa',
  params: [
    len('largura', 'Diâmetro', 'Diameter', 2.7, 1.8, 4),
    len('altura', 'Altura', 'Height', 2.5, 2.1, 3),
    yes('aberto', 'Aberto', 'Open', 1),
    mat('matLona', 'Lona', 'Canopy', 'linen'),
    mat('matEstrutura', 'Mastro e base', 'Pole and base', 'freijo'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Base', 'Base'), x: 0, y: 0, z: 0, r: 0.25, r2: 0.22, h: 0.08, material: 'concretePolished' },
    { kind: 'cylinder', name: w('Mastro', 'Pole'), x: 0, y: 0, z: 0.08, r: 0.022, h: 'altura - 0.08', material: 'matEstrutura' },
    // Open: a shallow cone of canvas, its valance round the rim, and the ribs under it.
    { kind: 'revolve', name: w('Lona', 'Canopy'), when: 'aberto', x: 0, y: 0, z: 'altura - 0.45', points: [['largura/2', 0], ['largura/2 - 0.02', 0.03], [0.03, 0.42], [0, 0.44]], material: 'matLona' },
    { kind: 'revolve', name: w('Babado', 'Valance'), when: 'aberto', x: 0, y: 0, z: 'altura - 0.55', points: [['largura/2 - 0.005', 0], ['largura/2', 0], ['largura/2', 0.1], ['largura/2 - 0.005', 0.1]], material: 'matLona' },
    { kind: 'box', name: w('Vareta', 'Rib'), when: 'aberto', repeat: { count: 8 }, x: '-(largura/2 - 0.03) / 2 * sin(45 * i) - 0.006', y: '(largura/2 - 0.03) / 2 * cos(45 * i) - (largura/2 - 0.03) / 2', z: 'altura - 0.46', w: 0.012, d: 'largura/2 - 0.03', h: 0.012, turn: '45 * i', material: 'matEstrutura' },
    // Closed: the canvas furled round the pole.
    { kind: 'revolve', name: w('Lona fechada', 'Furled canopy'), when: 'aberto == 0', x: 0, y: 0, z: 'altura - 1.3', points: [[0.03, 0], [0.09, 0.4], [0.07, 1.1], [0.03, 1.25]], material: 'matLona' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'open', name: w('Aberto 2,7 m', 'Open 2.7 m'), values: {} },
    { id: 'closed', name: w('Fechado', 'Closed'), values: { aberto: 0 } },
    { id: 'terracotta', name: w('Terracota 3,5 m', 'Terracotta 3.5 m'), values: { largura: 3.5, altura: 2.7, matLona: 'lacquerTerracotta' } },
  ],
};

export const GARDEN_BENCH: ObjectDefinition = {
  id: 'def_garden_bench',
  name: w('Banco de jardim', 'Garden bench'),
  category: 'furniture',
  folder: 'Área externa',
  params: [
    len('largura', 'Largura', 'Width', 1.5, 0.9, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.45, 0.7),
    len('altura', 'Altura do encosto', 'Back height', 0.8, 0.45, 0.95),
    yes('encosto', 'Com encosto', 'With a back', 1),
    counted('ripas', 'Ripas do assento', 'Seat slats', 'max(3, floor((profundidade - 0.12) / 0.07))'),
    mat('matRipas', 'Ripas', 'Slats', 'freijo'),
    mat('matLaterais', 'Laterais', 'Ends', 'blackSteel'),
  ],
  parts: [
    // Steel ends: a leg front and back, an arm over them, a stretcher under the seat.
    { kind: 'box', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.04, largura/2 - 0.08)', y: 'if(i < 2, -profundidade/2 + 0.04, profundidade/2 - 0.12)', z: 0, w: 0.04, d: 0.05, h: 0.43, material: 'matLaterais', round: 0.006 },
    { kind: 'box', name: w('Travessa', 'Stretcher'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.04', z: 0.36, w: 0.04, d: 'profundidade - 0.11', h: 0.04, material: 'matLaterais' },
    { kind: 'box', name: w('Braço', 'Arm'), when: 'encosto', repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.02', z: 0.62, w: 0.04, d: 'profundidade - 0.1', h: 0.03, material: 'matLaterais', round: 0.01 },
    { kind: 'box', name: w('Suporte do braço', 'Arm post'), when: 'encosto', repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.05', z: 0.43, w: 0.04, d: 0.03, h: 0.19, material: 'matLaterais' },
    { kind: 'box', name: w('Ripa', 'Slat'), repeat: { count: 'ripas', dy: '(profundidade - 0.1) / ripas' }, x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0.4, w: 'largura', d: '(profundidade - 0.1) / ripas - 0.012', h: 0.03, material: 'matRipas', round: 0.006 },
    // The back: slats leaning back 15°, on the rear legs carried up.
    { kind: 'box', name: w('Montante do encosto', 'Back post'), when: 'encosto', repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: 'profundidade/2 - 0.12', z: 0.43, w: 0.04, d: 0.04, h: 'altura - 0.43', tilt: 15, material: 'matLaterais' },
    { kind: 'box', name: w('Ripa do encosto', 'Back slat'), when: 'encosto', repeat: { count: 3 }, x: '-largura/2 + 0.01', y: 'profundidade/2 - 0.135 + (0.47 + i * 0.11 - 0.43) * sin(15)', z: '0.47 + i * 0.11 * cos(15)', w: 'largura - 0.02', d: 0.025, h: 0.08, tilt: 15, material: 'matRipas', round: 0.006 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'back', name: w('Com encosto, freijó', 'With back, freijó'), values: {} },
    { id: 'plain', name: w('Sem encosto, pinus', 'Backless, pine'), values: { encosto: 0, matRipas: 'pine' } },
  ],
};

export const BBQ: ObjectDefinition = {
  id: 'def_bbq',
  name: w('Churrasqueira', 'Barbecue'),
  category: 'equipment',
  folder: 'Área externa',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Alvenaria', 'Built of brick'], ['Bola (portátil)', 'Kettle']]),
    // The brick one's sizes and materials; the kettle has its own and takes none of them (nor their handle).
    { ...len('largura', 'Largura', 'Width', 1.2, 0.8, 2), when: 'modelo == 0' },
    { ...len('profundidade', 'Profundidade', 'Depth', 0.7, 0.55, 0.9), when: 'modelo == 0' },
    { ...len('altura', 'Altura até o teto', 'Height to ceiling', 2.6, 2.2, 3.2), when: 'modelo == 0' },
    { ...mat('matTijolo', 'Alvenaria', 'Brickwork', 'brick'), when: 'modelo == 0' },
    { ...mat('matBancada', 'Bancada', 'Counter', 'graniteBlack'), when: 'modelo == 0' },
  ],
  parts: [
    // Brick: a base with a niche for wood, the counter, the firebox's back and side walls (its mouth open),
    // the grill in it, the hood sloping back to the flue up to the ceiling.
    { kind: 'box', name: w('Base', 'Base'), when: 'modelo == 0', x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 0.85, material: 'matTijolo' },
    { kind: 'box', name: w('Nicho de lenha', 'Wood niche'), when: 'modelo == 0', cut: true, x: '-largura/2 + 0.12', y: '-profundidade/2 - 0.01', z: 0.1, w: 'largura - 0.24', d: 'profundidade - 0.1', h: 0.6 },
    { kind: 'cylinder', name: w('Lenha', 'Log'), when: 'modelo == 0', repeat: { count: 'floor((largura - 0.3) / 0.11)', dx: 0.11 }, x: '-largura/2 + 0.2', y: '-profundidade/2 + 0.08', z: 0.15, r: 0.05, h: 'profundidade - 0.25', tilt: 90, material: 'bark' },
    { kind: 'box', name: w('Bancada', 'Counter'), when: 'modelo == 0', x: '-largura/2 - 0.03', y: '-profundidade/2 - 0.03', z: 0.85, w: 'largura + 0.06', d: 'profundidade + 0.03', h: 0.04, material: 'matBancada' },
    { kind: 'box', name: w('Fundo da fornalha', 'Firebox back'), when: 'modelo == 0', x: '-largura/2 + 0.05', y: 'profundidade/2 - 0.12', z: 0.89, w: 'largura - 0.1', d: 0.12, h: 0.45, material: 'matTijolo' },
    { kind: 'box', name: w('Lateral da fornalha', 'Firebox side'), when: 'modelo == 0', repeat: { count: 2, dx: 'largura - 0.22' }, x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.05', z: 0.89, w: 0.12, d: 'profundidade - 0.05', h: 0.45, material: 'matTijolo' },
    { kind: 'box', name: w('Grelha', 'Grill'), when: 'modelo == 0', repeat: { count: 'floor((largura - 0.36) / 0.03)', dx: 0.03 }, x: '-largura/2 + 0.19', y: '-profundidade/2 + 0.08', z: 1.08, w: 0.006, d: 'profundidade - 0.22', h: 0.008, material: 'stainless' },
    { kind: 'box', name: w('Espeto', 'Skewer'), when: 'modelo == 0', repeat: { count: 3, dy: 0.12 }, x: '-largura/2 + 0.17', y: '-profundidade/2 + 0.14', z: 1.2, w: 'largura - 0.34', d: 0.01, h: 0.01, material: 'stainless' },
    { kind: 'box', name: w('Viga da boca', 'Lintel'), when: 'modelo == 0', x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.05', z: 1.34, w: 'largura - 0.1', d: 'profundidade - 0.05', h: 0.1, material: 'matTijolo' },
    { kind: 'box', name: w('Coifa', 'Hood'), when: 'modelo == 0', x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.05', z: 1.44, w: 'largura - 0.1', d: 0.12, h: 'sqrt((profundidade - 0.55) * (profundidade - 0.55) + 0.36)', tilt: 'atan2(profundidade - 0.55, 0.6)', material: 'matTijolo' },
    { kind: 'box', name: w('Corpo da coifa', 'Hood body'), when: 'modelo == 0', x: '-largura/2 + 0.05', y: 'profundidade/2 - 0.38', z: 1.44, w: 'largura - 0.1', d: 0.38, h: 0.6, material: 'matTijolo' },
    { kind: 'box', name: w('Chaminé', 'Flue'), when: 'modelo == 0', x: -0.22, y: 'profundidade/2 - 0.4', z: 2.04, w: 0.44, d: 0.4, h: 'altura - 2.04', material: 'matTijolo' },
    // Kettle: a bowl on three legs, its lid, a handle on top and a shelf below.
    { kind: 'revolve', name: w('Bacia', 'Bowl'), when: 'modelo == 1', x: 0, y: 0, z: 0.55, points: [[0.05, 0], [0.2, 0.05], [0.28, 0.16], [0.29, 0.28]], material: 'lacquerBlack' },
    { kind: 'revolve', name: w('Tampa', 'Lid'), when: 'modelo == 1', x: 0, y: 0, z: 0.835, points: [[0.295, 0], [0.27, 0.1], [0.17, 0.2], [0.04, 0.24], [0, 0.245]], material: 'lacquerBlack' },
    { kind: 'cylinder', name: w('Pegador', 'Handle'), when: 'modelo == 1', x: -0.06, y: 0, z: 1.1, r: 0.012, h: 0.12, roll: 90, material: 'freijo' },
    { kind: 'cylinder', name: w('Pé', 'Leg'), when: 'modelo == 1', repeat: { count: 3 }, x: '-0.2 * sin(120 * i)', y: '0.2 * cos(120 * i)', z: 0, r: 0.012, h: 0.6, material: 'aluminium' },
    { kind: 'cylinder', name: w('Bandeja', 'Tray'), when: 'modelo == 1', x: 0, y: 0, z: 0.22, r: 0.2, h: 0.008, material: 'aluminium' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 0.88], shift: 0.5 }],
  types: [
    { id: 'brick', name: w('Alvenaria 1,20 m', 'Brick 1.20 m'), values: {} },
    { id: 'kettle', name: w('Bola 57 cm', 'Kettle 57 cm'), values: { modelo: 1 } },
    { id: 'concrete', name: w('Concreto aparente', 'Fair-faced concrete'), values: { matTijolo: 'concretePolished', matBancada: 'stone', largura: 1.6 } },
  ],
};

export const PERGOLA: ObjectDefinition = {
  id: 'def_pergola',
  name: w('Pergolado', 'Pergola'),
  category: 'generic',
  folder: 'Área externa',
  params: [
    len('largura', 'Largura', 'Width', 4, 2, 8),
    len('profundidade', 'Profundidade', 'Depth', 3, 2, 6),
    len('altura', 'Altura', 'Height', 2.6, 2.2, 3.5),
    len('pilar', 'Seção dos pilares', 'Post size', 0.15, 0.1, 0.25, BUILD),
    len('espacamento', 'Espaçamento das ripas', 'Slat spacing', 0.3, 0.12, 0.6, BUILD),
    counted('ripas', 'Ripas', 'Slats', 'floor(largura / espacamento) + 1'),
    yes('cobertura', 'Cobertura de vidro', 'Glass cover', 0),
    mat('matMadeira', 'Madeira', 'Timber', 'freijo'),
  ],
  parts: [
    { kind: 'box', name: w('Pilar', 'Post'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2, largura/2 - pilar)', y: 'if(i < 2, -profundidade/2, profundidade/2 - pilar)', z: 0, w: 'pilar', d: 'pilar', h: 'altura', material: 'matMadeira' },
    // Two beams along the width over the posts, the slats across them overhanging.
    { kind: 'box', name: w('Viga', 'Beam'), repeat: { count: 2, dy: 'profundidade - pilar' }, x: '-largura/2 - 0.2', y: '-profundidade/2', z: 'altura', w: 'largura + 0.4', d: 'pilar', h: 0.2, material: 'matMadeira' },
    { kind: 'box', name: w('Ripa', 'Slat'), repeat: { count: 'ripas', dx: 'largura / (ripas - 1)' }, x: '-largura/2 - 0.025', y: '-profundidade/2 - 0.3', z: 'altura + 0.2', w: 0.05, d: 'profundidade + 0.6', h: 0.12, material: 'matMadeira' },
    { kind: 'box', name: w('Vidro', 'Glass'), when: 'cobertura', x: '-largura/2 - 0.2', y: '-profundidade/2 - 0.3', z: 'altura + 0.32', w: 'largura + 0.4', d: 'profundidade + 0.6', h: 0.01, material: 'glass' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'open', name: w('Aberto 4 × 3', 'Open 4 × 3'), values: {} },
    { id: 'glass', name: w('Com vidro 5 × 4', 'Glass-covered 5 × 4'), values: { cobertura: 1, largura: 5, profundidade: 4, espacamento: 0.5 } },
    { id: 'steel', name: w('Aço preto', 'Black steel'), values: { matMadeira: 'blackSteel', pilar: 0.1 } },
  ],
};

export const PLANTER: ObjectDefinition = {
  id: 'def_planter',
  name: w('Floreira', 'Planter'),
  category: 'plant',
  folder: 'Vegetação',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.4, 3),
    len('profundidade', 'Profundidade', 'Depth', 0.4, 0.25, 0.8),
    len('altura', 'Altura', 'Height', 0.45, 0.2, 0.9),
    counted('plantas', 'Plantas', 'Plants', 'max(1, round(largura / 0.3))'),
    num('porte', 'Porte das plantas (m)', 'Plant size (m)', 0.5, 0.2, 1.5, 0.05),
    mat('matVaso', 'Floreira', 'Planter', 'concretePolished'),
    mat('matPlanta', 'Plantas', 'Plants', 'foliage'),
  ],
  parts: [
    { kind: 'box', name: w('Floreira', 'Planter'), x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: 'matVaso', round: 0.008 },
    { kind: 'box', name: w('Vão', 'Inside'), cut: true, x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.03', z: 'altura - 0.06', w: 'largura - 0.06', d: 'profundidade - 0.06', h: 0.1 },
    { kind: 'box', name: w('Terra', 'Soil'), x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.03', z: 'altura - 0.07', w: 'largura - 0.06', d: 'profundidade - 0.06', h: 0.02, material: 'soil' },
    // Rounded shrubs along it, a little different each.
    { kind: 'sphere', name: w('Planta', 'Plant'), repeat: { count: 'plantas', dx: '(largura - 0.06) / plantas' }, x: '-largura/2 + 0.03 + (largura - 0.06) / plantas / 2', y: '((i * 7) % 3 - 1) * 0.03', z: 'altura - 0.07', r: 'min(profundidade * 0.55, (largura - 0.06) / plantas * 0.7) * (0.9 + ((i * 5) % 3) * 0.08)', h: 'porte * (0.85 + ((i * 3) % 4) * 0.08)', material: 'matPlanta' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'long', name: w('Concreto 1,20 m', 'Concrete 1.20 m'), values: {} },
    { id: 'wood', name: w('Madeira, alta', 'Timber, tall'), values: { matVaso: 'freijo', altura: 0.8, porte: 0.7 } },
    { id: 'square', name: w('Quadrada 50 cm', 'Square 50 cm'), values: { largura: 0.5, profundidade: 0.5, porte: 0.9 } },
  ],
};

export const BIKE_RACK: ObjectDefinition = {
  id: 'def_bike_rack',
  name: w('Bicicletário', 'Bike rack'),
  category: 'generic',
  folder: 'Área externa',
  params: [
    counted('vagas', 'Vagas', 'Places', 'max(1, floor(largura / 0.8) * 2)'),
    len('largura', 'Comprimento', 'Length', 2.4, 0.8, 8),
    len('altura', 'Altura', 'Height', 0.8, 0.7, 0.95),
    mat('matMetal', 'Metal', 'Metal', 'stainless'),
  ],
  parts: [
    // Inverted U's 80 cm apart, two bikes each: two legs and a top bar.
    { kind: 'cylinder', name: w('Montante', 'Leg'), repeat: { count: 'floor(largura / 0.8) * 2' }, x: '-largura/2 + 0.4 + floor(i / 2) * 0.8', y: 'if(i % 2 == 0, -0.3, 0.3)', z: 0, r: 0.025, h: 'altura - 0.025', material: 'matMetal' },
    { kind: 'cylinder', name: w('Barra', 'Top bar'), repeat: { count: 'floor(largura / 0.8)' }, x: '-largura/2 + 0.4 + i * 0.8', y: -0.325, z: 'altura - 0.025', r: 0.025, h: 0.65, tilt: 90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Canopla', 'Base plate'), repeat: { count: 'floor(largura / 0.8) * 2' }, x: '-largura/2 + 0.4 + floor(i / 2) * 0.8', y: 'if(i % 2 == 0, -0.3, 0.3)', z: 0, r: 0.06, h: 0.008, material: 'matMetal' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 }],
  types: [
    { id: 'six', name: w('6 vagas, inox', '6 places, stainless'), values: {} },
    { id: 'black', name: w('4 vagas, preto', '4 places, black'), values: { largura: 1.6, matMetal: 'blackSteel' } },
  ],
};

export const FIRE_PIT: ObjectDefinition = {
  id: 'def_fire_pit',
  name: w('Fogo de chão', 'Fire pit'),
  category: 'equipment',
  folder: 'Área externa',
  params: [
    len('largura', 'Diâmetro', 'Diameter', 1, 0.6, 1.8),
    // At least 15 cm: the cup's floor, the embers and the logs sit 12 cm under the rim, below the ground under that.
    len('altura', 'Altura da borda', 'Rim height', 0.35, 0.15, 0.5),
    yes('fogo', 'Aceso', 'Lit', 1),
    mat('matBorda', 'Borda', 'Rim', 'stone'),
  ],
  parts: [
    // A cup turned: out to its rim, down inside to its floor (a void would take the logs with it).
    { kind: 'revolve', name: w('Borda', 'Rim'), x: 0, y: 0, z: 0, points: [['largura/2', 0], ['largura/2', 'altura'], ['largura/2 - 0.1', 'altura'], ['largura/2 - 0.12', 'altura - 0.12'], [0, 'altura - 0.12']], material: 'matBorda' },
    { kind: 'cylinder', name: w('Brasas', 'Embers'), x: 0, y: 0, z: 'altura - 0.12', r: 'largura/2 - 0.13', h: 0.015, material: 'graniteBlack' },
    { kind: 'cylinder', name: w('Lenha', 'Log'), repeat: { count: 4 }, x: '-0.05 * sin(90 * i)', y: '0.05 * cos(90 * i)', z: 'altura - 0.1', r: 0.04, h: 'min(0.4, largura/2 - 0.16)', tilt: 80, turn: '90 * i + 30', material: 'bark' },
    { kind: 'revolve', name: w('Chama', 'Flame'), when: 'fogo', repeat: { count: 3 }, x: '0.06 * sin(120 * i)', y: '0.06 * cos(120 * i)', z: 'altura - 0.08', points: [[0.07, 0], [0.06, 0.1], [0.025, '0.22 + i * 0.06'], [0, '0.28 + i * 0.07']], material: 'lacquerTerracotta' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 }],
  types: [
    { id: 'stone', name: w('Pedra 1 m', 'Stone 1 m'), values: {} },
    { id: 'steel', name: w('Aço corten baixo', 'Low steel'), values: { matBorda: 'copper', altura: 0.2, fogo: 0 } },
  ],
};

export const LIBRARY_OUTDOOR: readonly ObjectDefinition[] = [LOUNGER, PARASOL, GARDEN_BENCH, BBQ, PERGOLA, PLANTER, BIKE_RACK, FIRE_PIT];
