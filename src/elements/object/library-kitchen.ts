// The library's kitchen, dining and laundry (data only, as library.ts): an upholstered dining chair, a round
// table with its chairs round it, a bar stool, a kitchen island with its hob, sink and tap, a cooker hood, an
// oven tower, a dishwasher, a front-loading washer or dryer, a laundry tub and a wine cooler.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, derived, int, len, mat, num, w, yes } from './library-kit';

export const DINING_CHAIR: ObjectDefinition = {
  id: 'def_dining_chair',
  name: w('Cadeira estofada', 'Upholstered chair'),
  category: 'furniture',
  folder: 'Jantar',
  params: [
    len('largura', 'Largura', 'Width', 0.48, 0.4, 0.6),
    len('profundidade', 'Profundidade', 'Depth', 0.55, 0.45, 0.65),
    len('assento', 'Altura do assento', 'Seat height', 0.46, 0.42, 0.5),
    len('altura', 'Altura do encosto', 'Back height', 0.86, 0.75, 1.05),
    num('reclinado', 'Encosto reclinado (°)', 'Back recline (°)', 8, 0, 18, 1),
    yes('bracos', 'Com braços', 'With arms', 0),
    mat('matEstofado', 'Estofado', 'Upholstery', 'linen'),
    mat('matPes', 'Pés', 'Legs', 'walnut'),
  ],
  parts: [
    { kind: 'box', name: w('Assento', 'Seat'), x: '-largura/2', y: '-profundidade/2', z: 'assento - 0.07', w: 'largura', d: 'profundidade - 0.04', h: 0.07, material: 'matEstofado', round: 0.025 },
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2 + 0.01', y: 'profundidade/2 - 0.07', z: 'assento - 0.02', w: 'largura - 0.02', d: 0.06, h: 'altura - assento + 0.02', tilt: 'reclinado', material: 'matEstofado', round: 0.025 },
    // Front legs tapered and splayed a little; back legs leaning back with the back.
    { kind: 'cylinder', name: w('Pé dianteiro', 'Front leg'), repeat: { count: 2, dx: 'largura - 0.07' }, x: '-largura/2 + 0.035', y: '-profundidade/2 + 0.04', z: 0, r: 0.011, r2: 0.016, h: 'assento - 0.07', roll: 'if(i == 0, 4, -4)', tilt: 4, material: 'matPes' },
    { kind: 'cylinder', name: w('Pé traseiro', 'Back leg'), repeat: { count: 2, dx: 'largura - 0.07' }, x: '-largura/2 + 0.035', y: 'profundidade/2 - 0.03', z: 0, r: 0.011, r2: 0.016, h: 'assento - 0.07', roll: 'if(i == 0, 4, -4)', tilt: -8, material: 'matPes' },
    { kind: 'box', name: w('Braço', 'Arm'), when: 'bracos', repeat: { count: 2, dx: 'largura - 0.03' }, x: '-largura/2', y: '-profundidade/2 + 0.08', z: 'assento + 0.17', w: 0.03, d: 'profundidade - 0.13', h: 0.03, material: 'matPes', round: 0.012 },
    { kind: 'box', name: w('Apoio do braço', 'Arm post'), when: 'bracos', repeat: { count: 2, dx: 'largura - 0.025' }, x: '-largura/2 + 0.0025', y: '-profundidade/2 + 0.1', z: 'assento - 0.01', w: 0.02, d: 0.02, h: 0.18, material: 'matPes', round: 0.008 },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'assento'], shift: 0.5 },
    { param: 'altura', axis: 'z', at: [0, 'profundidade/2', 'altura'] },
  ],
  types: [
    { id: 'linen', name: w('Linho e nogueira', 'Linen and walnut'), values: {} },
    { id: 'arms', name: w('Com braços, couro', 'With arms, leather'), values: { bracos: 1, largura: 0.56, matEstofado: 'leather' } },
    { id: 'boucle', name: w('Bouclê e aço preto', 'Bouclé and black steel'), values: { matEstofado: 'boucle', matPes: 'blackSteel', altura: 0.8 } },
  ],
};

export const ROUND_TABLE: ObjectDefinition = {
  id: 'def_round_table',
  name: w('Mesa redonda com cadeiras', 'Round table with chairs'),
  category: 'furniture',
  folder: 'Jantar',
  params: [
    len('largura', 'Diâmetro', 'Diameter', 1.2, 0.7, 1.8),
    derived('profundidade', 'Profundidade', 'Depth', 'largura'),
    len('altura', 'Altura', 'Height', 0.75, 0.7, 0.78),
    choice('base', 'Base', 'Base', [['Pedestal', 'Pedestal'], ['Quatro pés', 'Four legs']]),
    int('cadeiras', 'Cadeiras', 'Chairs', 4, 0, 8),
    mat('matTampo', 'Tampo', 'Top', 'oak'),
    mat('matBase', 'Base', 'Base', 'oak'),
    mat('matCadeira', 'Estofado das cadeiras', 'Chairs\' upholstery', 'linen'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Tampo', 'Top'), x: 0, y: 0, z: 'altura - 0.03', r: 'largura/2', h: 0.03, material: 'matTampo' },
    { kind: 'cylinder', name: w('Borda do tampo', 'Top edge'), x: 0, y: 0, z: 'altura - 0.05', r: 'largura/2 - 0.04', h: 0.02, material: 'matTampo' },
    // A turned pedestal: a wide foot, a waisted column, a spreading head.
    {
      kind: 'revolve',
      name: w('Pedestal', 'Pedestal'),
      when: 'base == 0',
      x: 0,
      y: 0,
      z: 0,
      points: [
        ['largura * 0.27', 0],
        ['largura * 0.27', 0.02],
        ['largura * 0.1', 0.08],
        ['largura * 0.065', 'altura * 0.45'],
        ['largura * 0.085', 'altura - 0.12'],
        ['largura * 0.18', 'altura - 0.05'],
      ],
      material: 'matBase',
    },
    { kind: 'cylinder', name: w('Pé', 'Leg'), when: 'base == 1', repeat: { count: 4 }, x: 'largura * 0.28 * if(i % 2 == 0, -1, 1)', y: 'largura * 0.28 * if(i < 2, -1, 1)', z: 0, r: 0.016, r2: 0.022, h: 'altura - 0.045', roll: 'if(i % 2 == 0, 5, -5)', tilt: 'if(i < 2, 5, -5)', material: 'matBase' },
    // The chairs round it, each facing the centre (a chair faces −y: turned θ − 90°).
    {
      kind: 'object',
      name: w('Cadeira', 'Chair'),
      definition: 'def_dining_chair',
      repeat: { count: 'cadeiras' },
      x: '(largura/2 + 0.08) * cos(360 * i / cadeiras + 270)',
      y: '(largura/2 + 0.08) * sin(360 * i / cadeiras + 270)',
      z: 0,
      angle: '360 * i / cadeiras + 180',
      values: { matEstofado: 'matCadeira', matPes: 'matBase' },
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'four', name: w('4 lugares, carvalho', '4 seats, oak'), values: {} },
    { id: 'six', name: w('6 lugares, nogueira', '6 seats, walnut'), values: { largura: 1.5, cadeiras: 6, matTampo: 'walnut', matBase: 'walnut' } },
    { id: 'marble', name: w('Mármore, 4 pés, sem cadeiras', 'Marble, four legs, no chairs'), values: { matTampo: 'marble', matBase: 'blackSteel', base: 1, cadeiras: 0, largura: 1 } },
  ],
};

export const BAR_STOOL: ObjectDefinition = {
  id: 'def_bar_stool',
  name: w('Banqueta alta', 'Bar stool'),
  category: 'furniture',
  folder: 'Jantar',
  params: [
    len('largura', 'Diâmetro do assento', 'Seat diameter', 0.38, 0.3, 0.45),
    derived('profundidade', 'Profundidade', 'Depth', 'largura'),
    len('altura', 'Altura do assento', 'Seat height', 0.75, 0.6, 0.85),
    choice('base', 'Base', 'Base', [['Quatro pés', 'Four legs'], ['Coluna giratória', 'Swivel column']]),
    yes('encosto', 'Com encosto baixo', 'With a low back', 0),
    mat('matAssento', 'Assento', 'Seat', 'leatherBlack'),
    mat('matBase', 'Base', 'Base', 'blackSteel'),
  ],
  parts: [
    { kind: 'revolve', name: w('Assento', 'Seat'), x: 0, y: 0, z: 'altura - 0.07', points: [['largura/2 - 0.02', 0], ['largura/2', 0.02], ['largura/2', 0.05], ['largura/2 - 0.025', 0.07], [0, 0.072]], material: 'matAssento' },
    { kind: 'box', name: w('Encosto', 'Back'), when: 'encosto', x: '-largura/2 + 0.04', y: 'largura/2 - 0.06', z: 'altura - 0.01', w: 'largura - 0.08', d: 0.04, h: 0.2, tilt: 8, material: 'matAssento', round: 0.018 },
    // Four legs splayed out, a ring of rails for the feet.
    { kind: 'cylinder', name: w('Pé', 'Leg'), when: 'base == 0', repeat: { count: 4 }, x: 'largura * 0.42 * if(i % 2 == 0, -1, 1)', y: 'largura * 0.42 * if(i < 2, -1, 1)', z: 0, r: 0.012, h: 'altura - 0.065', roll: 'if(i % 2 == 0, 6, -6)', tilt: 'if(i < 2, 6, -6)', material: 'matBase' },
    { kind: 'box', name: w('Apoio de pés', 'Foot rail'), when: 'base == 0', repeat: { count: 2, dy: 'largura * 0.68' }, x: '-largura * 0.36', y: '-largura * 0.36 - 0.009', z: 0.3, w: 'largura * 0.72', d: 0.018, h: 0.018, material: 'matBase', round: 0.008 },
    { kind: 'box', name: w('Apoio de pés', 'Foot rail'), when: 'base == 0', repeat: { count: 2, dx: 'largura * 0.68' }, x: '-largura * 0.36 - 0.009', y: '-largura * 0.36', z: 0.3, w: 0.018, d: 'largura * 0.72', h: 0.018, material: 'matBase', round: 0.008 },
    // Swivel: a disc on the floor, a column, a footrest ring (a thin disc with its middle out) and the seat's plate.
    { kind: 'cylinder', name: w('Base', 'Base'), when: 'base == 1', x: 0, y: 0, z: 0, r: 0.22, r2: 0.2, h: 0.025, material: 'matBase' },
    { kind: 'cylinder', name: w('Coluna', 'Column'), when: 'base == 1', x: 0, y: 0, z: 0.025, r: 0.025, h: 'altura - 0.1', material: 'chrome' },
    { kind: 'cylinder', name: w('Aro de apoio', 'Foot ring'), when: 'base == 1', x: 0, y: 0, z: 0.3, r: 0.2, h: 0.016, material: 'chrome' },
    { kind: 'cylinder', name: w('Vão do aro', 'Ring opening'), when: 'base == 1', cut: true, x: 0, y: 0, z: 0.29, r: 0.185, h: 0.04 },
    { kind: 'cylinder', name: w('Prato', 'Plate'), when: 'base == 1', x: 0, y: 0, z: 'altura - 0.085', r: 0.12, h: 0.015, material: 'matBase' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'legs', name: w('Quatro pés, couro preto', 'Four legs, black leather'), values: {} },
    { id: 'swivel', name: w('Giratória, encosto, couro', 'Swivel, back, leather'), values: { base: 1, encosto: 1, matAssento: 'leather' } },
    { id: 'wood', name: w('Madeira, baixa (bancada 90)', 'Wood, counter height'), values: { altura: 0.65, matAssento: 'oak', matBase: 'oak' } },
  ],
};

export const ISLAND: ObjectDefinition = {
  id: 'def_kitchen_island',
  name: w('Ilha de cozinha', 'Kitchen island'),
  category: 'casework',
  folder: 'Cozinha',
  params: [
    len('largura', 'Largura', 'Width', 2.2, 1.2, 3.6),
    len('profundidade', 'Profundidade do corpo', 'Body depth', 0.9, 0.6, 1.2),
    len('altura', 'Altura da bancada', 'Worktop height', 0.9, 0.85, 1.05),
    len('balanco', 'Balanço para banquetas', 'Overhang for stools', 0.3, 0, 0.45, BUILD),
    len('rodape', 'Rodapé', 'Plinth', 0.1, 0.05, 0.15, BUILD),
    counted('modulos', 'Gaveteiros', 'Drawer units', 'max(2, round(largura / 0.6))'),
    yes('cooktop', 'Com cooktop', 'With a hob', 1),
    yes('cuba', 'Com cuba e torneira', 'With sink and tap', 1),
    int('banquetas', 'Banquetas', 'Stools', 3, 0, 6),
    mat('matCorpo', 'Corpo e frentes', 'Body and fronts', 'lacquerSage'),
    mat('matBancada', 'Bancada', 'Worktop', 'quartz'),
    mat('matMetal', 'Metais', 'Metalwork', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.05', z: 0, w: 'largura - 0.1', d: 'profundidade - 0.1', h: 'rodape', material: 'plasticBlack' },
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2', z: 'rodape', w: 'largura', d: 'profundidade', h: 'altura - rodape - 0.03', material: 'matCorpo' },
    // Drawer fronts on the cooking side (−y): three a unit, deeper toward the floor.
    {
      kind: 'box',
      name: w('Gaveta', 'Drawer'),
      repeat: { count: 'modulos * 3' },
      x: '-largura/2 + (i % modulos) * largura / modulos + 0.002',
      y: '-profundidade/2 - 0.02',
      z: 'rodape + if(floor(i / modulos) == 0, 0, if(floor(i / modulos) == 1, (altura - rodape - 0.03) * 0.4, (altura - rodape - 0.03) * 0.75)) + 0.002',
      w: 'largura / modulos - 0.004',
      d: 0.02,
      h: '(altura - rodape - 0.03) * if(floor(i / modulos) == 0, 0.4, if(floor(i / modulos) == 1, 0.35, 0.25)) - 0.004',
      material: 'matCorpo',
    },
    { kind: 'box', name: w('Puxador', 'Handle'), repeat: { count: 'modulos * 3' }, x: '-largura/2 + (i % modulos + 0.5) * largura / modulos - 0.1', y: '-profundidade/2 - 0.04', z: 'rodape + if(floor(i / modulos) == 0, (altura - rodape - 0.03) * 0.4, if(floor(i / modulos) == 1, (altura - rodape - 0.03) * 0.75, altura - rodape - 0.03)) - 0.035', w: 0.2, d: 0.016, h: 0.012, material: 'matMetal', round: 0.005 },
    // The worktop, over the body and out over the stools' side (+y).
    { kind: 'box', name: w('Bancada', 'Worktop'), x: '-largura/2 - 0.02', y: '-profundidade/2 - 0.03', z: 'altura - 0.03', w: 'largura + 0.04', d: 'profundidade + 0.03 + balanco', h: 0.03, material: 'matBancada', round: 0.003 },
    // The hob: a black glass, its rings.
    { kind: 'box', name: w('Cooktop', 'Hob'), when: 'cooktop', x: '-largura/2 + 0.12', y: '-profundidade/2 + 0.08', z: 'altura - 0.002', w: 0.6, d: 0.52, h: 0.006, material: 'graniteBlack', round: 0.002 },
    { kind: 'cylinder', name: w('Boca', 'Burner'), when: 'cooktop', repeat: { count: 4 }, x: '-largura/2 + 0.12 + if(i % 2 == 0, 0.16, 0.44)', y: '-profundidade/2 + 0.08 + if(i < 2, 0.14, 0.38)', z: 'altura + 0.004', r: 'if(i == 1, 0.11, 0.085)', h: 0.001, material: 'aluminium' },
    { kind: 'cylinder', name: w('Centro da boca', 'Burner centre'), when: 'cooktop', repeat: { count: 4 }, x: '-largura/2 + 0.12 + if(i % 2 == 0, 0.16, 0.44)', y: '-profundidade/2 + 0.08 + if(i < 2, 0.14, 0.38)', z: 'altura + 0.0045', r: 'if(i == 1, 0.1, 0.075)', h: 0.001, material: 'graniteBlack' },
    // The sink: its bowl cut into the worktop and the body under it, a steel lining, the tap behind.
    { kind: 'box', name: w('Bojo da cuba', 'Sink bowl'), when: 'cuba', cut: true, x: 'largura/2 - 0.72', y: '-profundidade/2 + 0.1', z: 'altura - 0.22', w: 0.56, d: 0.42, h: 0.25 },
    { kind: 'box', name: w('Fundo da cuba', 'Sink bottom'), when: 'cuba', x: 'largura/2 - 0.72', y: '-profundidade/2 + 0.1', z: 'altura - 0.225', w: 0.56, d: 0.42, h: 0.005, material: 'matMetal' },
    { kind: 'cylinder', name: w('Torneira', 'Tap'), when: 'cuba', x: 'largura/2 - 0.44', y: '-profundidade/2 + 0.58', z: 'altura', r: 0.016, h: 0.34, material: 'matMetal' },
    { kind: 'cylinder', name: w('Bica', 'Spout'), when: 'cuba', x: 'largura/2 - 0.44', y: '-profundidade/2 + 0.58', z: 'altura + 0.33', r: 0.012, h: 0.24, tilt: -100, material: 'matMetal' },
    { kind: 'cylinder', name: w('Alavanca', 'Lever'), when: 'cuba', x: 'largura/2 - 0.44', y: '-profundidade/2 + 0.58', z: 'altura + 0.2', r: 0.006, h: 0.08, roll: 80, material: 'matMetal' },
    // The stools on the overhang's side, facing the island (a stool faces −y as placed).
    { kind: 'object', name: w('Banqueta', 'Stool'), definition: 'def_bar_stool', when: 'balanco > 0.15', repeat: { count: 'banquetas', dx: 'largura / max(1, banquetas)' }, x: '-largura/2 + largura / max(1, banquetas) / 2', y: 'profundidade/2 + balanco - 0.05', z: 0, values: { altura: 'altura - 0.25' } },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'sage', name: w('Verde-sálvia e quartzo', 'Sage and quartz'), values: {} },
    { id: 'walnut', name: w('Nogueira e mármore', 'Walnut and marble'), values: { matCorpo: 'walnut', matBancada: 'marble', matMetal: 'brass' } },
    { id: 'plain', name: w('Branca, só bancada', 'White, worktop only'), values: { matCorpo: 'lacquerWhite', cooktop: 0, cuba: 0, banquetas: 2, largura: 1.6 } },
  ],
};

export const HOOD: ObjectDefinition = {
  id: 'def_hood',
  name: w('Coifa', 'Cooker hood'),
  category: 'equipment',
  folder: 'Cozinha',
  params: [
    len('largura', 'Largura', 'Width', 0.9, 0.6, 1.2),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.4, 0.6),
    len('altura', 'Altura do teto', 'Ceiling height', 2.6, 2.3, 3.2),
    len('base', 'Altura da coifa', 'Hood height', 1.55, 1.45, 1.75),
    choice('modelo', 'Modelo', 'Model', [['Parede, pirâmide', 'Wall, pyramid'], ['Ilha, pirâmide', 'Island, pyramid'], ['Parede, vidro inclinado', 'Wall, slanted glass']]),
    mat('matCorpo', 'Corpo', 'Body', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2', z: 'base', w: 'largura', d: 'profundidade', h: 0.06, material: 'matCorpo', round: 0.004 },
    // The pyramid: four sloping sides up to the chimney, as two pairs of leaning panels.
    { kind: 'box', name: w('Pirâmide', 'Pyramid'), when: 'modelo < 2', x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.03', z: 'base + 0.06', w: 'largura - 0.06', d: 0.012, h: 'sqrt(((profundidade - 0.36) / 2) * ((profundidade - 0.36) / 2) + 0.04)', tilt: 'atan2((profundidade - 0.36) / 2, 0.2)', material: 'matCorpo' },
    { kind: 'box', name: w('Pirâmide', 'Pyramid'), when: 'modelo < 2', x: '-largura/2 + 0.03', y: 'profundidade/2 - 0.042', z: 'base + 0.06', w: 'largura - 0.06', d: 0.012, h: 'sqrt(((profundidade - 0.36) / 2) * ((profundidade - 0.36) / 2) + 0.04)', tilt: '-atan2((profundidade - 0.36) / 2, 0.2)', material: 'matCorpo' },
    { kind: 'box', name: w('Topo da pirâmide', 'Pyramid top'), when: 'modelo < 2', x: '-largura/2 + 0.03', y: '-0.15', z: 'base + 0.26', w: 'largura - 0.06', d: 0.3, h: 0.012, material: 'matCorpo' },
    // The chimney to the ceiling (against the wall for a wall hood, in the middle for an island one).
    { kind: 'box', name: w('Chaminé', 'Chimney'), x: -0.14, y: 'if(modelo == 0 || modelo == 2, profundidade/2 - 0.28, -0.14)', z: 'base + if(modelo < 2, 0.27, 0.06)', w: 0.28, d: 0.28, h: 'altura - base - if(modelo < 2, 0.27, 0.06)', material: 'matCorpo' },
    // Slanted glass: a black glass front leaning back from the body's front.
    { kind: 'box', name: w('Vidro', 'Glass'), when: 'modelo == 2', x: '-largura/2', y: '-profundidade/2', z: 'base + 0.06', w: 'largura', d: 0.008, h: 0.4, tilt: 40, material: 'graniteBlack' },
    { kind: 'box', name: w('Lateral', 'Side'), when: 'modelo == 2', repeat: { count: 2, dx: 'largura - 0.01' }, x: '-largura/2', y: '-profundidade/2 + 0.02', z: 'base + 0.06', w: 0.01, d: 'profundidade - 0.04', h: 0.3, material: 'matCorpo' },
    // The filters under it.
    { kind: 'box', name: w('Filtro', 'Filter'), repeat: { count: 2, dx: '(largura - 0.06) / 2' }, x: '-largura/2 + 0.035', y: '-profundidade/2 + 0.04', z: 'base - 0.002', w: '(largura - 0.06) / 2 - 0.01', d: 'profundidade - 0.08', h: 0.003, material: 'aluminium' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'base'], shift: 0.5 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'wall', name: w('Parede 90 cm', 'Wall 90 cm'), values: {} },
    { id: 'island', name: w('Ilha 90 cm', 'Island 90 cm'), values: { modelo: 1, profundidade: 0.6 } },
    { id: 'glass', name: w('Vidro inclinado 60 cm', 'Slanted glass 60 cm'), values: { modelo: 2, largura: 0.6, matCorpo: 'plasticBlack' } },
  ],
  rules: [{ when: 'base - 0.9 < 0.65', message: w('Menos de 65 cm acima da bancada: fica baixa sobre o fogão', 'Under 65 cm above the worktop: low over the hob') }],
};

export const OVEN_TOWER: ObjectDefinition = {
  id: 'def_oven_tower',
  name: w('Torre de forno e micro-ondas', 'Oven tower'),
  category: 'casework',
  folder: 'Cozinha',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.6, 0.9),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.55, 0.65),
    len('altura', 'Altura', 'Height', 2.2, 1.9, 2.5),
    len('forno', 'Altura do forno', 'Oven height', 0.85, 0.6, 1.1, BUILD),
    mat('matCorpo', 'Corpo e portas', 'Body and doors', 'lacquerWhite'),
    mat('matAparelho', 'Aparelhos', 'Appliances', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0, w: 'largura', d: 'profundidade - 0.02', h: 'altura', material: 'matCorpo' },
    { kind: 'box', name: w('Porta de baixo', 'Lower door'), x: '-largura/2 + 0.002', y: '-profundidade/2', z: 0.1, w: 'largura - 0.004', d: 0.02, h: 'forno - 0.1 - 0.004', material: 'matCorpo' },
    // The oven: its stainless face, its window, its handle bar and its control strip.
    { kind: 'box', name: w('Forno', 'Oven'), x: '-largura/2 + 0.01', y: '-profundidade/2 - 0.005', z: 'forno', w: 'largura - 0.02', d: 0.025, h: 0.595, material: 'matAparelho' },
    { kind: 'box', name: w('Visor do forno', 'Oven window'), x: '-largura/2 + 0.07', y: '-profundidade/2 - 0.007', z: 'forno + 0.08', w: 'largura - 0.14', d: 0.004, h: 0.3, material: 'graniteBlack' },
    { kind: 'cylinder', name: w('Puxador do forno', 'Oven handle'), x: '-largura/2 + 0.08', y: '-profundidade/2 - 0.04', z: 'forno + 0.44', r: 0.009, h: 'largura - 0.16', roll: 90, material: 'matAparelho' },
    { kind: 'box', name: w('Painel', 'Controls'), x: '-largura/2 + 0.01', y: '-profundidade/2 - 0.008', z: 'forno + 0.5', w: 'largura - 0.02', d: 0.004, h: 0.08, material: 'plasticBlack' },
    { kind: 'cylinder', name: w('Botão', 'Knob'), repeat: { count: 2, dx: 'largura - 0.2' }, x: '-largura/2 + 0.1', y: '-profundidade/2 - 0.008', z: 'forno + 0.54', r: 0.018, h: 0.02, tilt: -90, material: 'matAparelho' },
    // The microwave over it.
    { kind: 'box', name: w('Micro-ondas', 'Microwave'), x: '-largura/2 + 0.01', y: '-profundidade/2 - 0.005', z: 'forno + 0.61', w: 'largura - 0.02', d: 0.025, h: 0.38, material: 'matAparelho' },
    { kind: 'box', name: w('Visor do micro-ondas', 'Microwave window'), x: '-largura/2 + 0.04', y: '-profundidade/2 - 0.007', z: 'forno + 0.65', w: 'largura - 0.2', d: 0.004, h: 0.3, material: 'graniteBlack' },
    { kind: 'box', name: w('Porta de cima', 'Upper door'), x: '-largura/2 + 0.002', y: '-profundidade/2', z: 'forno + 1.002', w: 'largura - 0.004', d: 0.02, h: 'altura - forno - 1.004', material: 'matCorpo' },
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.002', y: '-profundidade/2 + 0.05', z: 0, w: 'largura - 0.004', d: 0.02, h: 0.1, material: 'plasticBlack' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'white', name: w('Branca, inox', 'White, stainless'), values: {} },
    { id: 'black', name: w('Preta, inox', 'Black, stainless'), values: { matCorpo: 'lacquerBlack' } },
    { id: 'oak', name: w('Carvalho, aparelhos pretos', 'Oak, black appliances'), values: { matCorpo: 'oak', matAparelho: 'blackSteel' } },
  ],
};

export const DISHWASHER: ObjectDefinition = {
  id: 'def_dishwasher',
  name: w('Lava-louças', 'Dishwasher'),
  category: 'equipment',
  folder: 'Cozinha',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.45, 0.6),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.55, 0.65),
    len('altura', 'Altura', 'Height', 0.85, 0.82, 0.9),
    mat('matCorpo', 'Corpo', 'Body', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: 'matCorpo', round: 0.01 },
    { kind: 'box', name: w('Painel', 'Control panel'), x: '-largura/2 + 0.01', y: '-profundidade/2 - 0.004', z: 'altura - 0.1', w: 'largura - 0.02', d: 0.006, h: 0.08, material: 'plasticBlack', round: 0.003 },
    { kind: 'cylinder', name: w('Botão', 'Button'), repeat: { count: 4, dx: 0.05 }, x: 'largura/2 - 0.22', y: '-profundidade/2 - 0.005', z: 'altura - 0.06', r: 0.009, h: 0.004, tilt: -90, material: 'chrome' },
    { kind: 'box', name: w('Puxador', 'Handle'), x: '-largura/2 + 0.08', y: '-profundidade/2 - 0.035', z: 'altura - 0.16', w: 'largura - 0.16', d: 0.02, h: 0.02, material: 'chrome', round: 0.008 },
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.01', y: '-profundidade/2 + 0.04', z: 0, w: 'largura - 0.02', d: 0.02, h: 0.08, material: 'plasticBlack' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'steel', name: w('Inox 60 cm', 'Stainless 60 cm'), values: {} },
    { id: 'slim', name: w('Inox 45 cm', 'Stainless 45 cm'), values: { largura: 0.45 } },
    { id: 'white', name: w('Branca 60 cm', 'White 60 cm'), values: { matCorpo: 'plasticWhite' } },
  ],
};

export const WASHER: ObjectDefinition = {
  id: 'def_washer',
  name: w('Lavadora / secadora', 'Washer / dryer'),
  category: 'equipment',
  folder: 'Lavanderia',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.55, 0.7),
    len('profundidade', 'Profundidade', 'Depth', 0.62, 0.5, 0.75),
    len('altura', 'Altura', 'Height', 0.85, 0.82, 0.95),
    yes('torre', 'Secadora empilhada', 'Dryer stacked on top', 0),
    mat('matCorpo', 'Corpo', 'Body', 'plasticWhite'),
    mat('matPorta', 'Aro da porta', 'Door ring', 'chrome'),
  ],
  parts: [
    // Each machine: its body, the round door (a ring, its glass), the detergent drawer and the dial; two when stacked.
    { kind: 'box', name: w('Corpo', 'Body'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: 'matCorpo', round: 0.015 },
    { kind: 'cylinder', name: w('Aro da porta', 'Door ring'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: 0, y: '-profundidade/2 + 0.002', z: 'altura * 0.42', r: 'largura * 0.32', h: 0.035, tilt: -90, material: 'matPorta' },
    { kind: 'cylinder', name: w('Vidro da porta', 'Door glass'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: 0, y: '-profundidade/2 - 0.03', z: 'altura * 0.42', r: 'largura * 0.25', r2: 'largura * 0.22', h: 0.012, tilt: -90, material: 'graniteBlack' },
    { kind: 'box', name: w('Gaveta do sabão', 'Detergent drawer'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: '-largura/2 + 0.03', y: '-profundidade/2 - 0.004', z: 'altura - 0.12', w: 'largura * 0.3', d: 0.006, h: 0.08, material: 'matCorpo', round: 0.003 },
    { kind: 'cylinder', name: w('Seletor', 'Dial'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: 'largura/2 - 0.1', y: '-profundidade/2 + 0.002', z: 'altura - 0.08', r: 0.03, h: 0.025, tilt: -90, material: 'matPorta' },
    { kind: 'box', name: w('Visor', 'Display'), repeat: { count: 'if(torre, 2, 1)', dz: 'altura + 0.01' }, x: '-0.04', y: '-profundidade/2 - 0.002', z: 'altura - 0.11', w: 0.12, d: 0.004, h: 0.05, material: 'screen' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'washer', name: w('Lavadora frontal branca', 'White front-loader'), values: {} },
    { id: 'tower', name: w('Lava e seca empilhadas', 'Washer and dryer stacked'), values: { torre: 1 } },
    { id: 'graphite', name: w('Grafite', 'Graphite'), values: { matCorpo: 'plasticBlack', matPorta: 'aluminium' } },
  ],
};

export const LAUNDRY_TUB: ObjectDefinition = {
  id: 'def_laundry_tub',
  name: w('Tanque', 'Laundry tub'),
  category: 'fixture',
  folder: 'Lavanderia',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.45, 1),
    len('profundidade', 'Profundidade', 'Depth', 0.55, 0.45, 0.65),
    len('altura', 'Altura', 'Height', 0.85, 0.8, 0.95),
    yes('gabinete', 'Com gabinete', 'With a cabinet', 1),
    mat('matCuba', 'Cuba', 'Tub', 'ceramic'),
    mat('matGabinete', 'Gabinete', 'Cabinet', 'plasticWhite'),
  ],
  parts: [
    // The tub: a deep basin, its bowl cut out; a washboard sloping into it at the front.
    { kind: 'box', name: w('Cuba', 'Tub'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.32', w: 'largura', d: 'profundidade', h: 0.32, material: 'matCuba', round: 0.02 },
    { kind: 'box', name: w('Bojo', 'Bowl'), cut: true, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.05', z: 'altura - 0.29', w: 'largura - 0.08', d: 'profundidade - 0.15', h: 0.32 },
    { kind: 'box', name: w('Esfregador', 'Washboard'), x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.06', z: 'altura - 0.26', w: 'largura - 0.1', d: 0.012, h: 0.24, tilt: 35, material: 'matCuba' },
    { kind: 'box', name: w('Gabinete', 'Cabinet'), when: 'gabinete', x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.02', z: 0, w: 'largura - 0.04', d: 'profundidade - 0.04', h: 'altura - 0.32', material: 'matGabinete' },
    { kind: 'box', name: w('Porta', 'Door'), when: 'gabinete', repeat: { count: 2, dx: '(largura - 0.04) / 2' }, x: '-largura/2 + 0.022', y: '-profundidade/2 + 0.005', z: 0.04, w: '(largura - 0.04) / 2 - 0.004', d: 0.016, h: 'altura - 0.38', material: 'matGabinete' },
    { kind: 'cylinder', name: w('Coluna', 'Pedestal'), when: 'gabinete == 0', x: 0, y: 0.04, z: 0, r: 0.09, r2: 0.07, h: 'altura - 0.32', material: 'matCuba' },
    // The tap on the wall behind.
    { kind: 'cylinder', name: w('Torneira', 'Tap'), x: 0, y: 'profundidade/2 + 0.04', z: 'altura + 0.12', r: 0.012, h: 0.18, tilt: -90, material: 'chrome' },
    { kind: 'cylinder', name: w('Registro', 'Handle'), x: 0, y: 'profundidade/2 + 0.02', z: 'altura + 0.14', r: 0.025, h: 0.03, material: 'chrome' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'cabinet', name: w('Louça com gabinete', 'China with cabinet'), values: {} },
    { id: 'column', name: w('Louça com coluna', 'China on a pedestal'), values: { gabinete: 0 } },
    { id: 'steel', name: w('Inox duplo', 'Stainless, double'), values: { largura: 0.9, matCuba: 'stainless' } },
  ],
};

export const WINE_COOLER: ObjectDefinition = {
  id: 'def_wine_cooler',
  name: w('Adega climatizada', 'Wine cooler'),
  category: 'equipment',
  folder: 'Cozinha',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.3, 0.7),
    len('profundidade', 'Profundidade', 'Depth', 0.58, 0.5, 0.68),
    len('altura', 'Altura', 'Height', 0.85, 0.82, 1.8),
    counted('prateleiras', 'Prateleiras', 'Shelves', 'max(3, floor((altura - 0.15) / 0.11))'),
    counted('garrafas', 'Garrafas por prateleira', 'Bottles a shelf', 'max(1, floor((largura - 0.06) / 0.085))'),
    mat('matCorpo', 'Corpo', 'Body', 'plasticBlack'),
    mat('matPorta', 'Moldura da porta', 'Door frame', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2 + 0.04', z: 0, w: 'largura', d: 'profundidade - 0.04', h: 'altura', material: 'matCorpo' },
    // The bottles lying on their shelves, seen through the glass door.
    { kind: 'box', name: w('Prateleira', 'Shelf'), repeat: { count: 'prateleiras', dz: '(altura - 0.15) / prateleiras' }, x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.06', z: 0.12, w: 'largura - 0.04', d: 'profundidade - 0.12', h: 0.012, material: 'oak' },
    {
      kind: 'cylinder',
      name: w('Garrafa', 'Bottle'),
      repeat: { count: 'prateleiras * garrafas' },
      x: '-largura/2 + 0.03 + (i % garrafas + 0.5) * (largura - 0.06) / garrafas',
      y: '-profundidade/2 + 0.14',
      z: '0.12 + floor(i / garrafas) * (altura - 0.15) / prateleiras + 0.048',
      r: 0.037,
      h: 0.22,
      tilt: 90,
      material: 'bottleGlass',
    },
    // Each bottle's neck, toward the door.
    {
      kind: 'cylinder',
      name: w('Gargalo', 'Neck'),
      repeat: { count: 'prateleiras * garrafas' },
      x: '-largura/2 + 0.03 + (i % garrafas + 0.5) * (largura - 0.06) / garrafas',
      y: '-profundidade/2 + 0.14',
      z: '0.12 + floor(i / garrafas) * (altura - 0.15) / prateleiras + 0.048',
      r: 0.014,
      r2: 0.012,
      h: 0.08,
      tilt: -90,
      material: 'bottleGlass',
    },
    // The door: a steel frame round a glass, its handle bar.
    { kind: 'box', name: w('Porta', 'Door'), x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 0.04, h: 'altura', material: 'matPorta', round: 0.004 },
    { kind: 'box', name: w('Vão da porta', 'Door opening'), cut: true, x: '-largura/2 + 0.035', y: '-profundidade/2 - 0.01', z: 0.1, w: 'largura - 0.07', d: 0.07, h: 'altura - 0.14' },
    { kind: 'box', name: w('Vidro', 'Glass'), x: '-largura/2 + 0.035', y: '-profundidade/2 + 0.015', z: 0.1, w: 'largura - 0.07', d: 0.008, h: 'altura - 0.14', material: 'glass' },
    { kind: 'cylinder', name: w('Puxador', 'Handle'), x: 'largura/2 - 0.03', y: '-profundidade/2 - 0.03', z: 0.2, r: 0.008, h: 'altura - 0.35', material: 'matPorta' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'under', name: w('Sob bancada 60 cm', 'Under-counter 60 cm'), values: {} },
    { id: 'slim', name: w('Estreita 30 cm', 'Slim 30 cm'), values: { largura: 0.3 } },
    { id: 'tall', name: w('Coluna 1,80 m', 'Tall 1.80 m'), values: { altura: 1.8 } },
  ],
};

export const LIBRARY_KITCHEN: readonly ObjectDefinition[] = [DINING_CHAIR, ROUND_TABLE, BAR_STOOL, ISLAND, HOOD, OVEN_TOWER, DISHWASHER, WASHER, LAUNDRY_TUB, WINE_COOLER];
