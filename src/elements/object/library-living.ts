// The library's living room (data only, as library.ts): an armchair, a sofa with a chaise, coffee and side
// tables, a television, a TV unit with its slatted panel, a sideboard, a rug and a pouf. Each family has its
// sizes, materials and build as parameters, and types ready to place.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, derived, len, mat, num, w, yes } from './library-kit';
import type { DefinitionId } from './schema';

export const ARMCHAIR: ObjectDefinition = {
  id: 'def_armchair' as DefinitionId,
  name: w('Poltrona', 'Armchair'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    len('largura', 'Largura', 'Width', 0.82, 0.6, 1.2),
    len('profundidade', 'Profundidade', 'Depth', 0.86, 0.65, 1.1),
    len('altura', 'Altura do encosto', 'Back height', 0.84, 0.65, 1.25),
    len('assento', 'Altura do assento', 'Seat height', 0.43, 0.35, 0.52),
    len('braco', 'Largura do braço', 'Arm width', 0.15, 0, 0.3, BUILD),
    len('pe', 'Altura dos pés', 'Leg height', 0.15, 0.05, 0.3, BUILD),
    num('reclinado', 'Encosto reclinado (°)', 'Back recline (°)', 10, 0, 25, 1),
    mat('matEstofado', 'Estofado', 'Upholstery', 'linen'),
    mat('matPes', 'Pés', 'Legs', 'walnut'),
  ],
  parts: [
    // The shell: from the legs to under the seat, all round.
    { kind: 'box', name: w('Base', 'Base'), x: '-largura/2', y: '-profundidade/2', z: 'pe', w: 'largura', d: 'profundidade', h: 'assento - pe - 0.1', material: 'matEstofado', round: 0.025 },
    { kind: 'box', name: w('Almofada do assento', 'Seat cushion'), x: '-largura/2 + braco + 0.008', y: '-profundidade/2 + 0.02', z: 'assento - 0.12', w: 'largura - 2 * braco - 0.016', d: 'profundidade - 0.2', h: 0.13, material: 'matEstofado', round: 0.045 },
    // The back, leaning back from its foot, and its cushion in front of it.
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2 + braco', y: 'profundidade/2 - 0.11', z: 'assento - 0.1', w: 'largura - 2 * braco', d: 0.1, h: 'altura - assento + 0.1', tilt: 'reclinado', material: 'matEstofado', round: 0.04 },
    { kind: 'box', name: w('Almofada do encosto', 'Back cushion'), x: '-largura/2 + braco + 0.01', y: 'profundidade/2 - 0.24', z: 'assento + 0.01', w: 'largura - 2 * braco - 0.02', d: 0.14, h: 'altura - assento - 0.06', tilt: 'reclinado', material: 'matEstofado', round: 0.055 },
    { kind: 'box', name: w('Braço', 'Arm'), when: 'braco > 0', repeat: { count: 2, dx: 'largura - braco' }, x: '-largura/2', y: '-profundidade/2', z: 'pe', w: 'braco', d: 'profundidade', h: 'assento + 0.18 - pe', material: 'matEstofado', round: 0.05 },
    // Tapered legs, splayed out 6°.
    {
      kind: 'cylinder',
      name: w('Pé', 'Leg'),
      repeat: { count: 4 },
      x: 'if(i % 2 == 0, -largura/2 + 0.05, largura/2 - 0.05)',
      y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.05)',
      z: 0,
      r: 0.013,
      r2: 0.02,
      h: 'pe + 0.005',
      roll: 'if(i % 2 == 0, 6, -6)',
      tilt: 'if(i < 2, 6, -6)',
      material: 'matPes',
    },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'linen', name: w('Linho, pés de nogueira', 'Linen, walnut legs'), values: {} },
    { id: 'leather', name: w('Couro, encosto alto', 'Leather, high back'), values: { matEstofado: 'leather', altura: 1.02, reclinado: 14, matPes: 'blackSteel' } },
    { id: 'armless', name: w('Sem braços', 'Armless'), values: { braco: 0, largura: 0.66, matEstofado: 'velvet' } },
  ],
  rules: [{ when: 'assento > 0.48', message: w('Assento acima de 48 cm: alto para uma poltrona', 'Seat over 48 cm: high for an armchair') }],
};

export const CHAISE_SOFA: ObjectDefinition = {
  id: 'def_chaise_sofa' as DefinitionId,
  name: w('Sofá com chaise', 'Sofa with chaise'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    len('largura', 'Largura', 'Width', 2.9, 2, 4.2),
    len('profundidade', 'Profundidade', 'Depth', 0.95, 0.8, 1.15),
    len('chaise', 'Comprimento da chaise', 'Chaise length', 1.65, 1.2, 2.2),
    len('larguraChaise', 'Largura da chaise', 'Chaise width', 0.95, 0.75, 1.2),
    len('altura', 'Altura do encosto', 'Back height', 0.8, 0.65, 1),
    len('assento', 'Altura do assento', 'Seat height', 0.42, 0.35, 0.5),
    len('braco', 'Largura do braço', 'Arm width', 0.16, 0.08, 0.3, BUILD),
    yes('direita', 'Chaise à direita', 'Chaise on the right', 1),
    counted('lugares', 'Lugares (sem a chaise)', 'Seats (besides the chaise)', 'max(1, round((largura - braco - larguraChaise) / 0.62))'),
    mat('matEstofado', 'Estofado', 'Upholstery', 'boucle'),
    mat('matAlmofadas', 'Almofadas soltas', 'Throw cushions', 'velvet'),
    mat('matPes', 'Pés', 'Legs', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Base', 'Base'), x: '-largura/2', y: '-profundidade/2', z: 0.08, w: 'largura', d: 'profundidade', h: 'assento - 0.22', material: 'matEstofado', round: 0.03 },
    // The chaise's base, forward of the sofa's, at the side it is on.
    { kind: 'box', name: w('Base da chaise', 'Chaise base'), x: 'if(direita, largura/2 - larguraChaise, -largura/2)', y: 'profundidade/2 - chaise', z: 0.08, w: 'larguraChaise', d: 'chaise - profundidade + 0.04', h: 'assento - 0.22', material: 'matEstofado', round: 0.03 },
    {
      kind: 'box',
      name: w('Almofada do assento', 'Seat cushion'),
      repeat: { count: 'lugares', dx: '(largura - braco - larguraChaise) / lugares' },
      x: 'if(direita, -largura/2 + braco, -largura/2 + larguraChaise) + 0.005',
      y: '-profundidade/2 + 0.02',
      z: 'assento - 0.14',
      w: '(largura - braco - larguraChaise) / lugares - 0.01',
      d: 'profundidade - 0.24',
      h: 0.14,
      material: 'matEstofado',
      round: 0.05,
    },
    { kind: 'box', name: w('Almofada da chaise', 'Chaise cushion'), x: 'if(direita, largura/2 - larguraChaise, -largura/2) + 0.01', y: 'profundidade/2 - chaise + 0.02', z: 'assento - 0.14', w: 'larguraChaise - 0.02', d: 'chaise - 0.24', h: 0.14, material: 'matEstofado', round: 0.05 },
    // The back along the whole sofa, the arm's side apart.
    { kind: 'box', name: w('Encosto', 'Back'), x: 'if(direita, -largura/2 + braco, -largura/2)', y: 'profundidade/2 - 0.2', z: 'assento - 0.14', w: 'largura - braco', d: 0.2, h: 'altura - assento + 0.14', tilt: 6, material: 'matEstofado', round: 0.06 },
    { kind: 'box', name: w('Braço', 'Arm'), x: 'if(direita, -largura/2, largura/2 - braco)', y: '-profundidade/2', z: 0.08, w: 'braco', d: 'profundidade', h: 'assento + 0.14', material: 'matEstofado', round: 0.06 },
    // Throw cushions: one by the arm, one at the chaise's back corner.
    { kind: 'box', name: w('Almofada solta', 'Throw cushion'), x: 'if(direita, -largura/2 + braco + 0.06, largura/2 - braco - 0.51)', y: 'profundidade/2 - 0.36', z: 'assento', w: 0.45, d: 0.14, h: 0.42, tilt: 18, material: 'matAlmofadas', round: 0.06 },
    { kind: 'box', name: w('Almofada solta', 'Throw cushion'), x: 'if(direita, largura/2 - 0.53, -largura/2 + 0.08)', y: 'profundidade/2 - 0.36', z: 'assento', w: 0.45, d: 0.14, h: 0.42, tilt: 22, material: 'matEstofado', round: 0.06 },
    {
      kind: 'cylinder',
      name: w('Pé', 'Leg'),
      repeat: { count: 6 },
      x: 'if(i % 3 == 0, -largura/2 + 0.07, if(i % 3 == 1, 0, largura/2 - 0.07))',
      y: 'if(i < 3, -profundidade/2 + 0.07, profundidade/2 - 0.07)',
      z: 0,
      r: 0.018,
      h: 0.08,
      material: 'matPes',
    },
    { kind: 'cylinder', name: w('Pé da chaise', 'Chaise leg'), repeat: { count: 2, dx: 'larguraChaise - 0.14' }, x: 'if(direita, largura/2 - larguraChaise + 0.07, -largura/2 + 0.07)', y: 'profundidade/2 - chaise + 0.07', z: 0, r: 0.018, h: 0.08, material: 'matPes' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
    { param: 'chaise', axis: 'y', at: ['if(direita, largura/2 - larguraChaise/2, -largura/2 + larguraChaise/2)', 'profundidade/2 - chaise', 'assento'], sign: -1 },
    { param: 'altura', axis: 'z', at: [0, 'profundidade/2', 'altura'] },
  ],
  types: [
    { id: 'right', name: w('Chaise à direita', 'Chaise on the right'), values: {} },
    { id: 'left', name: w('Chaise à esquerda', 'Chaise on the left'), values: { direita: 0 } },
    { id: 'large', name: w('Grande, em linho', 'Large, linen'), values: { largura: 3.6, chaise: 1.85, matEstofado: 'linen', matAlmofadas: 'boucle' } },
  ],
};

export const COFFEE_TABLE: ObjectDefinition = {
  id: 'def_coffee_table' as DefinitionId,
  name: w('Mesa de centro', 'Coffee table'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    choice('forma', 'Forma', 'Shape', [['Retangular', 'Rectangular'], ['Redonda', 'Round']]),
    len('largura', 'Largura (ou diâmetro)', 'Width (or diameter)', 1.1, 0.5, 2),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.4, 1.2),
    len('altura', 'Altura', 'Height', 0.38, 0.25, 0.5),
    len('tampo', 'Espessura do tampo', 'Top thickness', 0.03, 0.012, 0.08, BUILD),
    yes('prateleira', 'Com prateleira', 'With a shelf', 1),
    mat('matTampo', 'Tampo', 'Top', 'oak'),
    mat('matBase', 'Base', 'Base', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Tampo', 'Top'), when: 'forma == 0', x: '-largura/2', y: '-profundidade/2', z: 'altura - tampo', w: 'largura', d: 'profundidade', h: 'tampo', material: 'matTampo', round: 'min(0.01, tampo/2)' },
    // Square steel legs, a little in, and a shelf between them.
    { kind: 'box', name: w('Pé', 'Leg'), when: 'forma == 0', repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.04, largura/2 - 0.07)', y: 'if(i < 2, -profundidade/2 + 0.04, profundidade/2 - 0.07)', z: 0, w: 0.03, d: 0.03, h: 'altura - tampo', material: 'matBase' },
    { kind: 'box', name: w('Prateleira', 'Shelf'), when: 'forma == 0 && prateleira', x: '-largura/2 + 0.07', y: '-profundidade/2 + 0.07', z: 0.1, w: 'largura - 0.14', d: 'profundidade - 0.14', h: 0.018, material: 'matTampo' },
    { kind: 'box', name: w('Travessa', 'Rail'), when: 'forma == 0', repeat: { count: 2, dy: 'profundidade - 0.11' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.04', z: 'altura - tampo - 0.04', w: 'largura - 0.08', d: 0.03, h: 0.03, material: 'matBase' },
    // Round: a turned pedestal on a disc, under a round top.
    { kind: 'cylinder', name: w('Tampo', 'Top'), when: 'forma == 1', x: 0, y: 0, z: 'altura - tampo', r: 'largura/2', h: 'tampo', material: 'matTampo' },
    {
      kind: 'revolve',
      name: w('Pedestal', 'Pedestal'),
      when: 'forma == 1',
      x: 0,
      y: 0,
      z: 0,
      points: [
        ['largura * 0.22', 0],
        ['largura * 0.22', 0.015],
        ['largura * 0.07', 0.05],
        ['largura * 0.05', '(altura - tampo) * 0.5'],
        ['largura * 0.07', 'altura - tampo - 0.02'],
        ['largura * 0.12', 'altura - tampo'],
      ],
      material: 'matBase',
    },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'oak', name: w('Retangular, carvalho e aço', 'Rectangular, oak and steel'), values: {} },
    { id: 'marble', name: w('Redonda, mármore e latão', 'Round, marble and brass'), values: { forma: 1, largura: 0.9, matTampo: 'marble', matBase: 'brass' } },
    { id: 'low', name: w('Baixa, nogueira, sem prateleira', 'Low, walnut, no shelf'), values: { altura: 0.3, largura: 1.3, profundidade: 0.7, prateleira: 0, matTampo: 'walnut', tampo: 0.05 } },
  ],
};

export const SIDE_TABLE: ObjectDefinition = {
  id: 'def_side_table' as DefinitionId,
  name: w('Mesa lateral', 'Side table'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    len('largura', 'Diâmetro do tampo', 'Top diameter', 0.45, 0.3, 0.7),
    len('altura', 'Altura', 'Height', 0.55, 0.4, 0.75),
    derived('profundidade', 'Profundidade', 'Depth', 'largura'),
    yes('bandeja', 'Tampo bandeja (com borda)', 'Tray top (rimmed)', 0),
    mat('matTampo', 'Tampo', 'Top', 'marble'),
    mat('matBase', 'Base', 'Base', 'brass'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Base', 'Base'), x: 0, y: 0, z: 0, r: 'largura * 0.33', r2: 'largura * 0.31', h: 0.015, material: 'matBase' },
    { kind: 'cylinder', name: w('Haste', 'Stem'), x: 0, y: 0, z: 0.015, r: 0.013, h: 'altura - 0.035', material: 'matBase' },
    { kind: 'cylinder', name: w('Tampo', 'Top'), x: 0, y: 0, z: 'altura - 0.02', r: 'largura/2', h: 0.02, material: 'matTampo' },
    // A tray: a rim around the top, the top a little lower inside it.
    { kind: 'revolve', name: w('Borda', 'Rim'), when: 'bandeja', x: 0, y: 0, z: 'altura - 0.02', points: [['largura/2 - 0.008', 0], ['largura/2', 0], ['largura/2', 0.045], ['largura/2 - 0.008', 0.045]], material: 'matBase' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }, { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'] }],
  types: [
    { id: 'marble', name: w('Mármore e latão', 'Marble and brass'), values: {} },
    { id: 'tray', name: w('Bandeja preta', 'Black tray'), values: { bandeja: 1, matTampo: 'lacquerBlack', matBase: 'blackSteel', largura: 0.5, altura: 0.5 } },
    { id: 'tall', name: w('Alta, nogueira', 'Tall, walnut'), values: { altura: 0.68, largura: 0.38, matTampo: 'walnut', matBase: 'blackSteel' } },
  ],
};

export const TELEVISION: ObjectDefinition = {
  id: 'def_tv' as DefinitionId,
  name: w('Televisão', 'Television'),
  category: 'equipment',
  folder: 'Sala',
  params: [
    num('polegadas', 'Tela (polegadas)', 'Screen (inches)', 55, 24, 100, 1, ['Dimensões', 'Dimensions']),
    yes('parede', 'Na parede (sem pés)', 'On the wall (no feet)', 0),
    derived('largura', 'Largura', 'Width', 'polegadas * 0.0254 * 0.8716 + 0.02'),
    derived('altura', 'Altura da tela', 'Screen height', 'polegadas * 0.0254 * 0.4903 + 0.02'),
    derived('profundidade', 'Profundidade', 'Depth', 'if(parede, 0.05, 0.25)'),
    mat('matMoldura', 'Moldura', 'Frame', 'plasticBlack'),
    mat('matTela', 'Tela', 'Screen', 'screen'),
  ],
  parts: [
    { kind: 'box', name: w('Painel', 'Panel'), x: '-largura/2', y: -0.015, z: 'if(parede, 0, 0.075)', w: 'largura', d: 0.025, h: 'altura', material: 'matMoldura', round: 0.004 },
    { kind: 'box', name: w('Tela', 'Screen'), x: '-largura/2 + 0.008', y: -0.017, z: 'if(parede, 0, 0.075) + 0.008', w: 'largura - 0.016', d: 0.003, h: 'altura - 0.024', material: 'matTela' },
    // The electronics behind the lower half.
    { kind: 'box', name: w('Corpo traseiro', 'Back casing'), x: '-largura * 0.3', y: 0.01, z: 'if(parede, 0, 0.075) + altura * 0.1', w: 'largura * 0.6', d: 0.035, h: 'altura * 0.5', material: 'matMoldura', round: 0.01 },
    // Two blade feet, leaning out, toward the ends.
    { kind: 'box', name: w('Pé', 'Foot'), when: 'parede == 0', repeat: { count: 2, dx: 'largura * 0.72' }, x: '-largura * 0.37', y: -0.12, z: 0, w: 0.02, d: 0.24, h: 0.085, material: 'matMoldura', round: 0.005 },
  ],
  handles: [],
  types: [
    { id: 'tv55', name: w('55 polegadas', '55 inches'), values: {} },
    { id: 'tv43', name: w('43 polegadas', '43 inches'), values: { polegadas: 43 } },
    { id: 'tv65', name: w('65 polegadas', '65 inches'), values: { polegadas: 65 } },
    { id: 'tv75', name: w('75 polegadas, na parede', '75 inches, on the wall'), values: { polegadas: 75, parede: 1 } },
    { id: 'tv85', name: w('85 polegadas, na parede', '85 inches, on the wall'), values: { polegadas: 85, parede: 1 } },
  ],
  rules: [{ when: 'polegadas > 90', message: w('Mais de 90": confira a distância do sofá (cerca de 1,5 × a diagonal)', 'Over 90": check the distance to the sofa (about 1.5 × the diagonal)') }],
};

export const TV_UNIT: ObjectDefinition = {
  id: 'def_tv_unit' as DefinitionId,
  name: w('Rack de TV', 'TV unit'),
  category: 'casework',
  folder: 'Sala',
  params: [
    len('largura', 'Largura', 'Width', 1.8, 0.9, 3.2),
    len('profundidade', 'Profundidade', 'Depth', 0.42, 0.3, 0.55),
    len('altura', 'Altura', 'Height', 0.5, 0.3, 0.7),
    len('pe', 'Altura dos pés', 'Leg height', 0.12, 0, 0.25, BUILD),
    counted('modulos', 'Portas', 'Doors', 'max(2, round(largura / 0.6))'),
    yes('painel', 'Painel ripado atrás', 'Slatted panel behind', 1),
    len('alturaPainel', 'Altura do painel', 'Panel height', 1.9, 1, 2.8, BUILD),
    counted('ripas', 'Ripas', 'Slats', 'floor(largura / 0.05)'),
    mat('matCorpo', 'Corpo', 'Carcass', 'freijo'),
    mat('matPortas', 'Portas', 'Doors', 'lacquerSage'),
    mat('matPainel', 'Ripas', 'Slats', 'freijo'),
    mat('matFundo', 'Fundo do painel', 'Panel backing', 'lacquerBlack'),
    mat('matPes', 'Pés', 'Legs', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2', z: 'pe', w: 'largura', d: 'profundidade', h: 'altura - pe', material: 'matCorpo', round: 0.004 },
    {
      kind: 'box',
      name: w('Porta', 'Door'),
      repeat: { count: 'modulos', dx: '(largura - 0.04) / modulos' },
      x: '-largura/2 + 0.02 + 0.002',
      y: '-profundidade/2 - 0.004',
      z: 'pe + 0.02',
      w: '(largura - 0.04) / modulos - 0.004',
      d: 0.02,
      h: 'altura - pe - 0.04',
      material: 'matPortas',
    },
    // A finger pull cut into each door's top.
    { kind: 'box', name: w('Cava', 'Finger pull'), cut: true, repeat: { count: 'modulos', dx: '(largura - 0.04) / modulos' }, x: '-largura/2 + 0.02 + (largura - 0.04) / modulos / 2 - 0.08', y: '-profundidade/2 - 0.01', z: 'altura - 0.045', w: 0.16, d: 0.022, h: 0.03 },
    { kind: 'cylinder', name: w('Pé', 'Leg'), when: 'pe > 0', repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.06, largura/2 - 0.06)', y: 'if(i < 2, -profundidade/2 + 0.06, profundidade/2 - 0.06)', z: 0, r: 0.012, r2: 0.016, h: 'pe', material: 'matPes' },
    // The panel on the wall behind, of vertical slats on a backing.
    { kind: 'box', name: w('Fundo do painel', 'Panel backing'), when: 'painel', x: '-largura/2', y: 'profundidade/2 + 0.022', z: 0, w: 'largura', d: 0.015, h: 'alturaPainel', material: 'matFundo' },
    { kind: 'box', name: w('Ripa', 'Slat'), when: 'painel', repeat: { count: 'ripas', dx: 'largura / ripas' }, x: '-largura/2 + (largura / ripas - 0.03) / 2', y: 'profundidade/2 + 0.002', z: 0, w: 0.03, d: 0.02, h: 'alturaPainel', material: 'matPainel', round: 0.003 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'panel', name: w('Com painel ripado', 'With slatted panel'), values: {} },
    { id: 'plain', name: w('Só o rack, nogueira', 'Unit only, walnut'), values: { painel: 0, matCorpo: 'walnut', matPortas: 'walnut' } },
    { id: 'floating', name: w('Suspenso, laca branca', 'Wall-hung, white lacquer'), values: { pe: 0, painel: 0, altura: 0.35, matCorpo: 'lacquerWhite', matPortas: 'lacquerWhite' } },
  ],
};

export const SIDEBOARD: ObjectDefinition = {
  id: 'def_sideboard' as DefinitionId,
  name: w('Aparador', 'Sideboard'),
  category: 'casework',
  folder: 'Sala',
  params: [
    len('largura', 'Largura', 'Width', 1.6, 0.8, 2.6),
    len('profundidade', 'Profundidade', 'Depth', 0.45, 0.35, 0.55),
    len('altura', 'Altura', 'Height', 0.8, 0.6, 1),
    len('pe', 'Altura dos pés', 'Leg height', 0.18, 0.08, 0.3, BUILD),
    counted('portas', 'Portas', 'Doors', 'max(2, round(largura / 0.42))'),
    yes('frisado', 'Portas frisadas', 'Reeded doors', 1),
    mat('matCorpo', 'Corpo', 'Carcass', 'walnut'),
    mat('matTampo', 'Tampo', 'Top', 'marble'),
    mat('matPes', 'Pés', 'Legs', 'brass'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2', z: 'pe', w: 'largura', d: 'profundidade', h: 'altura - pe - 0.02', material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2 - 0.01', y: '-profundidade/2 - 0.01', z: 'altura - 0.02', w: 'largura + 0.02', d: 'profundidade + 0.01', h: 0.02, material: 'matTampo', round: 0.004 },
    { kind: 'box', name: w('Porta', 'Door'), repeat: { count: 'portas', dx: '(largura - 0.03) / portas' }, x: '-largura/2 + 0.015 + 0.0015', y: '-profundidade/2 - 0.003', z: 'pe + 0.015', w: '(largura - 0.03) / portas - 0.003', d: 0.018, h: 'altura - pe - 0.05', material: 'matCorpo' },
    // Reeds down each door: half-round strips, a few centimetres apart.
    {
      kind: 'cylinder',
      name: w('Friso', 'Reed'),
      when: 'frisado',
      repeat: { count: 'floor((largura - 0.05) / 0.028)', dx: 0.028 },
      x: '-largura/2 + 0.03',
      y: '-profundidade/2 - 0.003',
      z: 'pe + 0.03',
      r: 0.008,
      h: 'altura - pe - 0.08',
      material: 'matCorpo',
    },
    // Brass knobs, one a door, toward its middle.
    { kind: 'cylinder', name: w('Puxador', 'Knob'), repeat: { count: 'portas', dx: '(largura - 0.03) / portas' }, x: '-largura/2 + 0.015 + (largura - 0.03) / portas * if(i % 2 == 0, 0.85, 0.15)', y: '-profundidade/2 - 0.004', z: '(altura + pe) / 2', r: 0.012, h: 0.03, tilt: -90, material: 'matPes' },
    // Splayed round legs.
    { kind: 'cylinder', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.05, largura/2 - 0.05)', y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.05)', z: 0, r: 0.011, r2: 0.017, h: 'pe + 0.005', roll: 'if(i % 2 == 0, 7, -7)', tilt: 'if(i < 2, 5, -5)', material: 'matPes' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'reeded', name: w('Nogueira frisada, mármore', 'Reeded walnut, marble'), values: {} },
    { id: 'black', name: w('Laca preta lisa', 'Plain black lacquer'), values: { frisado: 0, matCorpo: 'lacquerBlack', matTampo: 'graniteBlack', matPes: 'blackSteel' } },
    { id: 'oak', name: w('Carvalho, 4 portas', 'Oak, 4 doors'), values: { largura: 1.9, matCorpo: 'oak', matTampo: 'oak' } },
  ],
};

export const RUG: ObjectDefinition = {
  id: 'def_rug' as DefinitionId,
  name: w('Tapete', 'Rug'),
  category: 'furniture',
  folder: 'Decoração',
  params: [
    choice('forma', 'Forma', 'Shape', [['Retangular', 'Rectangular'], ['Redondo', 'Round']]),
    len('largura', 'Largura (ou diâmetro)', 'Width (or diameter)', 2, 0.6, 5),
    len('profundidade', 'Comprimento', 'Length', 3, 0.6, 6),
    len('espessura', 'Espessura', 'Thickness', 0.012, 0.004, 0.04, BUILD),
    len('borda', 'Faixa da borda', 'Border band', 0.12, 0, 0.4, BUILD),
    mat('matTapete', 'Tapete', 'Rug', 'jute'),
    mat('matBorda', 'Borda', 'Border', 'linen'),
  ],
  parts: [
    { kind: 'box', name: w('Tapete', 'Rug'), when: 'forma == 0', x: '-largura/2 + borda', y: '-profundidade/2 + borda', z: 0, w: 'largura - 2 * borda', d: 'profundidade - 2 * borda', h: 'espessura', material: 'matTapete', round: 'espessura * 0.3' },
    // The border band, all round: its long sides, then its short ones between them.
    { kind: 'box', name: w('Borda', 'Border'), when: 'forma == 0 && borda > 0', repeat: { count: 2, dx: 'largura - borda' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'borda', d: 'profundidade', h: 'espessura', material: 'matBorda', round: 'espessura * 0.3' },
    { kind: 'box', name: w('Borda', 'Border'), when: 'forma == 0 && borda > 0', repeat: { count: 2, dy: 'profundidade - borda' }, x: '-largura/2 + borda', y: '-profundidade/2', z: 0, w: 'largura - 2 * borda', d: 'borda', h: 'espessura', material: 'matBorda', round: 'espessura * 0.3' },
    { kind: 'cylinder', name: w('Tapete', 'Rug'), when: 'forma == 1', x: 0, y: 0, z: 0, r: 'largura/2 - borda', h: 'espessura', material: 'matTapete' },
    { kind: 'revolve', name: w('Borda', 'Border'), when: 'forma == 1 && borda > 0', x: 0, y: 0, z: 0, points: [['largura/2 - borda', 0], ['largura/2', 0], ['largura/2', 'espessura'], ['largura/2 - borda', 'espessura']], material: 'matBorda' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'espessura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'espessura'], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'espessura'], shift: 0.5, sign: -1 },
  ],
  types: [
    { id: 'jute', name: w('Juta com borda de linho 2 × 3', 'Jute, linen border 2 × 3'), values: {} },
    { id: 'round', name: w('Redondo 2,0 m', 'Round 2.0 m'), values: { forma: 1, borda: 0, matTapete: 'carpet' } },
    { id: 'large', name: w('Grande 3 × 4, sem borda', 'Large 3 × 4, no border'), values: { largura: 3, profundidade: 4, borda: 0, matTapete: 'carpet' } },
  ],
};

export const POUF: ObjectDefinition = {
  id: 'def_pouf' as DefinitionId,
  name: w('Puff', 'Pouf'),
  category: 'furniture',
  folder: 'Sala',
  params: [
    choice('forma', 'Forma', 'Shape', [['Redondo', 'Round'], ['Quadrado', 'Square']]),
    len('largura', 'Largura (ou diâmetro)', 'Width (or diameter)', 0.5, 0.35, 1),
    len('altura', 'Altura', 'Height', 0.42, 0.3, 0.5),
    derived('profundidade', 'Profundidade', 'Depth', 'largura'),
    mat('matEstofado', 'Revestimento', 'Cover', 'boucle'),
  ],
  parts: [
    // A cushion turned: straight sides, its top and bottom edges rounded over.
    {
      kind: 'revolve',
      name: w('Puff', 'Pouf'),
      when: 'forma == 0',
      x: 0,
      y: 0,
      z: 0,
      points: [
        ['largura/2 - 0.03', 0],
        ['largura/2 - 0.008', 0.008],
        ['largura/2', 0.035],
        ['largura/2', 'altura - 0.05'],
        ['largura/2 - 0.012', 'altura - 0.015'],
        ['largura/2 - 0.045', 'altura'],
        ['0', 'altura - 0.004'],
      ],
      material: 'matEstofado',
    },
    { kind: 'box', name: w('Puff', 'Pouf'), when: 'forma == 1', x: '-largura/2', y: '-largura/2', z: 0, w: 'largura', d: 'largura', h: 'altura', material: 'matEstofado', round: 0.06 },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'] },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'round', name: w('Redondo, bouclê', 'Round, bouclé'), values: {} },
    { id: 'leather', name: w('Quadrado, couro', 'Square, leather'), values: { forma: 1, largura: 0.55, matEstofado: 'leather' } },
    { id: 'rattan', name: w('Redondo, palhinha', 'Round, rattan'), values: { matEstofado: 'rattan', altura: 0.4, largura: 0.45 } },
  ],
};

export const LIBRARY_LIVING: readonly ObjectDefinition[] = [ARMCHAIR, CHAISE_SOFA, COFFEE_TABLE, SIDE_TABLE, TELEVISION, TV_UNIT, SIDEBOARD, RUG, POUF];
