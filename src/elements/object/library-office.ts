// The library's office (data only, as library.ts): a swivel chair on its five-star base, a desk on legs,
// panels, a trestle or a sit-stand frame, monitors with keyboard and mouse, a mobile pedestal, a meeting
// table with its chairs, an industrial shelf with its books and a steel filing cabinet.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, int, len, mat, num, w, yes } from './library-kit';

export const OFFICE_CHAIR: ObjectDefinition = {
  id: 'def_office_chair',
  name: w('Cadeira giratória', 'Swivel chair'),
  category: 'furniture',
  folder: 'Escritório',
  params: [
    len('largura', 'Diâmetro da base', 'Base diameter', 0.66, 0.55, 0.75),
    len('profundidade', 'Profundidade', 'Depth', 0.62, 0.5, 0.75),
    len('assento', 'Altura do assento', 'Seat height', 0.47, 0.4, 0.56),
    len('altura', 'Altura do encosto', 'Back height', 1.05, 0.85, 1.3),
    num('reclinado', 'Encosto reclinado (°)', 'Back recline (°)', 10, 0, 25, 1),
    yes('bracos', 'Com braços', 'With arms', 1),
    yes('cabeca', 'Apoio de cabeça', 'Headrest', 0),
    mat('matEstofado', 'Estofado', 'Upholstery', 'fabric'),
    mat('matBase', 'Base', 'Base', 'aluminium'),
  ],
  parts: [
    // The five-star base: arms on a turn of 72° each, a caster at the end of each.
    { kind: 'cylinder', name: w('Braço da base', 'Base arm'), repeat: { count: 5 }, x: 0, y: 0, z: 0.065, r: 0.022, r2: 0.014, h: 'largura/2 - 0.03', tilt: 88, turn: '72 * i', material: 'matBase' },
    { kind: 'sphere', name: w('Rodízio', 'Caster'), repeat: { count: 5 }, x: '-(largura/2 - 0.04) * sin(72 * i)', y: '(largura/2 - 0.04) * cos(72 * i)', z: 0, r: 0.028, h: 0.05, material: 'plasticBlack' },
    { kind: 'cylinder', name: w('Cubo', 'Hub'), x: 0, y: 0, z: 0.04, r: 0.045, r2: 0.035, h: 0.05, material: 'matBase' },
    { kind: 'cylinder', name: w('Pistão', 'Gas lift'), x: 0, y: 0, z: 0.09, r: 0.028, h: 'assento - 0.2', material: 'plasticBlack' },
    { kind: 'cylinder', name: w('Coluna', 'Column'), x: 0, y: 0, z: 'assento - 0.2', r: 0.02, h: 0.1, material: 'chrome' },
    { kind: 'box', name: w('Mecanismo', 'Mechanism'), x: -0.12, y: -0.12, z: 'assento - 0.12', w: 0.24, d: 0.26, h: 0.05, material: 'plasticBlack', round: 0.01 },
    { kind: 'box', name: w('Assento', 'Seat'), x: -0.25, y: '-profundidade/2 + 0.04', z: 'assento - 0.08', w: 0.5, d: 0.48, h: 0.08, material: 'matEstofado', round: 0.03 },
    // The back on a spine rising from behind the seat, leaning with it.
    { kind: 'box', name: w('Haste do encosto', 'Back spine'), x: -0.035, y: 'profundidade/2 - 0.12', z: 'assento - 0.1', w: 0.07, d: 0.025, h: 0.3, tilt: 'reclinado', material: 'plasticBlack', round: 0.008 },
    { kind: 'box', name: w('Encosto', 'Back'), x: -0.23, y: 'profundidade/2 - 0.15', z: 'assento + 0.08', w: 0.46, d: 0.06, h: 'altura - assento - 0.1 - cabeca * 0.16', tilt: 'reclinado', material: 'matEstofado', round: 0.028 },
    { kind: 'box', name: w('Apoio de cabeça', 'Headrest'), when: 'cabeca', x: -0.14, y: 'profundidade/2 - 0.15 + (altura - assento) * sin(reclinado)', z: 'altura - 0.17', w: 0.28, d: 0.07, h: 0.15, tilt: 'reclinado', material: 'matEstofado', round: 0.03 },
    // Arms: a post each side of the seat, a pad on top.
    { kind: 'box', name: w('Suporte do braço', 'Arm post'), when: 'bracos', repeat: { count: 2, dx: 0.52 }, x: -0.29, y: -0.03, z: 'assento - 0.08', w: 0.03, d: 0.05, h: 0.22, material: 'plasticBlack', round: 0.01 },
    { kind: 'box', name: w('Apoio do braço', 'Arm pad'), when: 'bracos', repeat: { count: 2, dx: 0.52 }, x: -0.3, y: -0.16, z: 'assento + 0.14', w: 0.06, d: 0.26, h: 0.03, material: 'plasticBlack', round: 0.012 },
  ],
  handles: [
    { param: 'assento', axis: 'z', at: [0, 0, 'assento'] },
    { param: 'altura', axis: 'z', at: [0, 'profundidade/2', 'altura'] },
  ],
  types: [
    { id: 'task', name: w('Operacional, tecido', 'Task chair, fabric'), values: {} },
    { id: 'exec', name: w('Diretor, couro, apoio de cabeça', 'Executive, leather, headrest'), values: { cabeca: 1, altura: 1.22, matEstofado: 'leatherBlack', matBase: 'chrome' } },
    { id: 'armless', name: w('Sem braços, preta', 'Armless, black'), values: { bracos: 0, matEstofado: 'plasticBlack', matBase: 'plasticBlack', altura: 0.92 } },
  ],
};

export const DESK: ObjectDefinition = {
  id: 'def_desk',
  name: w('Mesa de trabalho', 'Desk'),
  category: 'furniture',
  folder: 'Escritório',
  params: [
    len('largura', 'Largura', 'Width', 1.4, 0.8, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.7, 0.5, 0.9),
    len('altura', 'Altura', 'Height', 0.75, 0.65, 1.25),
    choice('base', 'Base', 'Base', [['Quatro pés', 'Four legs'], ['Painéis', 'Panels'], ['Cavalete', 'Trestle'], ['Regulável (em pé)', 'Sit-stand']]),
    yes('gaveteiro', 'Gaveteiro', 'Drawer unit', 1),
    yes('monitor', 'Monitor', 'Monitor', 1),
    mat('matTampo', 'Tampo', 'Top', 'oak'),
    mat('matBase', 'Base', 'Base', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.025', w: 'largura', d: 'profundidade', h: 0.025, material: 'matTampo', round: 0.004 },
    { kind: 'box', name: w('Pé', 'Leg'), when: 'base == 0', repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.03, largura/2 - 0.07)', y: 'if(i < 2, -profundidade/2 + 0.03, profundidade/2 - 0.07)', z: 0, w: 0.04, d: 0.04, h: 'altura - 0.025', material: 'matBase' },
    { kind: 'box', name: w('Painel', 'Panel'), when: 'base == 1', repeat: { count: 2, dx: 'largura - 0.03' }, x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0, w: 0.03, d: 'profundidade - 0.04', h: 'altura - 0.025', material: 'matTampo' },
    { kind: 'box', name: w('Painel frontal', 'Modesty panel'), when: 'base == 1', x: '-largura/2 + 0.03', y: 'profundidade/2 - 0.1', z: 'altura * 0.35', w: 'largura - 0.06', d: 0.018, h: 'altura * 0.6', material: 'matTampo' },
    // Trestles: each end two legs leaning to meet under the top, an A from the side, a stretcher between.
    { kind: 'box', name: w('Perna do cavalete', 'Trestle leg'), when: 'base == 2', repeat: { count: 2, dx: 'largura - 0.24' }, x: '-largura/2 + 0.1', y: '-profundidade/2 + 0.05', z: '0.04 * sin(atan2(profundidade/2 - 0.07, altura - 0.03))', w: 0.04, d: 0.04, h: 'sqrt((profundidade/2 - 0.07) * (profundidade/2 - 0.07) + (altura - 0.03) * (altura - 0.03))', tilt: 'atan2(profundidade/2 - 0.07, altura - 0.03)', material: 'matBase' },
    { kind: 'box', name: w('Perna do cavalete', 'Trestle leg'), when: 'base == 2', repeat: { count: 2, dx: 'largura - 0.24' }, x: '-largura/2 + 0.1', y: 'profundidade/2 - 0.09', z: 0, w: 0.04, d: 0.04, h: 'sqrt((profundidade/2 - 0.07) * (profundidade/2 - 0.07) + (altura - 0.03) * (altura - 0.03))', tilt: '-atan2(profundidade/2 - 0.07, altura - 0.03)', material: 'matBase' },
    { kind: 'box', name: w('Travessa', 'Stretcher'), when: 'base == 2', x: '-largura/2 + 0.1', y: -0.015, z: 'altura * 0.3', w: 'largura - 0.2', d: 0.03, h: 0.03, material: 'matBase' },
    // Sit-stand: a column each end on a foot, a frame under the top.
    { kind: 'box', name: w('Coluna', 'Column'), when: 'base == 3', repeat: { count: 2, dx: 'largura - 0.27' }, x: '-largura/2 + 0.1', y: -0.04, z: 0.03, w: 0.07, d: 0.08, h: 'altura - 0.1', material: 'matBase', round: 0.006 },
    { kind: 'box', name: w('Pé', 'Foot'), when: 'base == 3', repeat: { count: 2, dx: 'largura - 0.27' }, x: '-largura/2 + 0.1', y: '-profundidade/2 + 0.03', z: 0, w: 0.07, d: 'profundidade - 0.06', h: 0.03, material: 'matBase', round: 0.008 },
    { kind: 'box', name: w('Quadro', 'Frame'), when: 'base == 3', x: '-largura/2 + 0.1', y: -0.03, z: 'altura - 0.075', w: 'largura - 0.2', d: 0.06, h: 0.05, material: 'matBase' },
    { kind: 'box', name: w('Controle', 'Control'), when: 'base == 3', x: 'largura/2 - 0.25', y: '-profundidade/2 + 0.02', z: 'altura - 0.045', w: 0.12, d: 0.04, h: 0.02, material: 'plasticBlack', round: 0.006 },
    // A drawer unit under the right end: three drawers, a bar each.
    { kind: 'box', name: w('Gaveteiro', 'Drawer unit'), when: 'gaveteiro', x: 'largura/2 - 0.5', y: '-profundidade/2 + 0.05', z: 'altura - 0.025 - 0.36', w: 0.4, d: 'profundidade - 0.1', h: 0.36, material: 'matTampo' },
    { kind: 'box', name: w('Gaveta', 'Drawer'), when: 'gaveteiro', repeat: { count: 2, dz: 0.175 }, x: 'largura/2 - 0.498', y: '-profundidade/2 + 0.03', z: 'altura - 0.025 - 0.358', w: 0.396, d: 0.02, h: 0.171, material: 'matTampo' },
    { kind: 'cylinder', name: w('Puxador', 'Handle'), when: 'gaveteiro', repeat: { count: 2, dz: 0.175 }, x: 'largura/2 - 0.36', y: '-profundidade/2 + 0.025', z: 'altura - 0.025 - 0.21', r: 0.005, h: 0.12, roll: 90, material: 'matBase' },
    { kind: 'object', name: w('Monitor', 'Monitor'), definition: 'def_monitor', when: 'monitor', x: 0, y: 'profundidade/2 - 0.2', z: 'altura', values: {} },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'legs', name: w('Quatro pés, carvalho', 'Four legs, oak'), values: {} },
    { id: 'standing', name: w('Regulável, branca', 'Sit-stand, white'), values: { base: 3, matTampo: 'lacquerWhite', matBase: 'lacquerWhite', largura: 1.6, gaveteiro: 0 } },
    { id: 'trestle', name: w('Cavalete, nogueira', 'Trestle, walnut'), values: { base: 2, matTampo: 'walnut', gaveteiro: 0 } },
    { id: 'panels', name: w('Painéis, branca, sem monitor', 'Panels, white, no monitor'), values: { base: 1, matTampo: 'lacquerWhite', monitor: 0, largura: 1.2 } },
  ],
};

export const MONITOR: ObjectDefinition = {
  id: 'def_monitor',
  name: w('Monitor', 'Monitor'),
  category: 'equipment',
  folder: 'Escritório',
  params: [
    num('polegadas', 'Tela (polegadas)', 'Screen (inches)', 27, 19, 49, 1, ['Dimensões', 'Dimensions']),
    int('telas', 'Telas', 'Screens', 1, 1, 3),
    yes('teclado', 'Teclado e mouse', 'Keyboard and mouse', 1),
    mat('matCorpo', 'Corpo', 'Body', 'plasticBlack'),
  ],
  parts: [
    // Each screen on its stand; the side ones turned in toward the user.
    { kind: 'box', name: w('Tela', 'Screen'), repeat: { count: 'telas' }, x: '(i - (telas - 1) / 2) * (polegadas * 0.0254 * 0.8716 + 0.03) - polegadas * 0.0254 * 0.8716 / 2', y: '-0.01 + abs(i - (telas - 1) / 2) * 0.08', z: 0.12, w: 'polegadas * 0.0254 * 0.8716 + 0.01', d: 0.02, h: 'polegadas * 0.0254 * 0.4903 + 0.01', turn: '(i - (telas - 1) / 2) * -18', material: 'matCorpo', round: 0.004 },
    { kind: 'box', name: w('Imagem', 'Picture'), repeat: { count: 'telas' }, x: '(i - (telas - 1) / 2) * (polegadas * 0.0254 * 0.8716 + 0.03) - polegadas * 0.0254 * 0.8716 / 2 + 0.005', y: '-0.012 + abs(i - (telas - 1) / 2) * 0.08', z: 0.125, w: 'polegadas * 0.0254 * 0.8716', d: 0.002, h: 'polegadas * 0.0254 * 0.4903', turn: '(i - (telas - 1) / 2) * -18', material: 'screen' },
    { kind: 'box', name: w('Haste', 'Neck'), repeat: { count: 'telas' }, x: '(i - (telas - 1) / 2) * (polegadas * 0.0254 * 0.8716 + 0.03) - 0.025', y: '0.02 + abs(i - (telas - 1) / 2) * 0.08', z: 0.01, w: 0.05, d: 0.025, h: 0.2, tilt: -8, material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Base', 'Stand base'), repeat: { count: 'telas' }, x: '(i - (telas - 1) / 2) * (polegadas * 0.0254 * 0.8716 + 0.03) - 0.11', y: '-0.07 + abs(i - (telas - 1) / 2) * 0.08', z: 0, w: 0.22, d: 0.17, h: 0.012, material: 'matCorpo', round: 0.005 },
    { kind: 'box', name: w('Teclado', 'Keyboard'), when: 'teclado', x: -0.22, y: -0.42, z: 0, w: 0.44, d: 0.14, h: 0.02, material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Teclas', 'Keys'), when: 'teclado', x: -0.21, y: -0.415, z: 0.02, w: 0.42, d: 0.12, h: 0.004, material: 'aluminium' },
    { kind: 'sphere', name: w('Mouse', 'Mouse'), when: 'teclado', x: 0.32, y: -0.36, z: 0, r: 0.03, h: 0.035, material: 'matCorpo' },
  ],
  handles: [],
  types: [
    { id: 'one', name: w('27" com teclado', '27" with keyboard'), values: {} },
    { id: 'two', name: w('Dois 24"', 'Two 24"'), values: { telas: 2, polegadas: 24 } },
    { id: 'three', name: w('Três 24"', 'Three 24"'), values: { telas: 3, polegadas: 24 } },
    { id: 'wide', name: w('Ultrawide 34", branco', 'Ultrawide 34", white'), values: { polegadas: 34, matCorpo: 'plasticWhite' } },
  ],
};

export const PEDESTAL: ObjectDefinition = {
  id: 'def_pedestal',
  name: w('Gaveteiro volante', 'Mobile pedestal'),
  category: 'casework',
  folder: 'Escritório',
  params: [
    len('largura', 'Largura', 'Width', 0.4, 0.3, 0.5),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.4, 0.6),
    len('altura', 'Altura', 'Height', 0.6, 0.5, 0.7),
    int('gavetas', 'Gavetas', 'Drawers', 3, 2, 4),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerWhite'),
    mat('matPuxador', 'Puxadores', 'Handles', 'aluminium'),
  ],
  parts: [
    { kind: 'sphere', name: w('Rodízio', 'Caster'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.04, largura/2 - 0.04)', y: 'if(i < 2, -profundidade/2 + 0.04, profundidade/2 - 0.04)', z: 0, r: 0.022, h: 0.04, material: 'plasticBlack' },
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0.045, w: 'largura', d: 'profundidade - 0.02', h: 'altura - 0.045', material: 'matCorpo', round: 0.004 },
    // A shallow pencil drawer on top, the others sharing the rest.
    { kind: 'box', name: w('Gaveta de lápis', 'Pencil drawer'), x: '-largura/2 + 0.002', y: '-profundidade/2', z: 'altura - 0.1', w: 'largura - 0.004', d: 0.02, h: 0.096, material: 'matCorpo' },
    { kind: 'box', name: w('Gaveta', 'Drawer'), repeat: { count: 'gavetas - 1', dz: '(altura - 0.15) / (gavetas - 1)' }, x: '-largura/2 + 0.002', y: '-profundidade/2', z: 0.05, w: 'largura - 0.004', d: 0.02, h: '(altura - 0.15) / (gavetas - 1) - 0.004', material: 'matCorpo' },
    { kind: 'box', name: w('Puxador', 'Handle'), repeat: { count: 'gavetas' }, x: '-largura/2 + 0.06', y: '-profundidade/2 - 0.012', z: 'min(0.05 + (i + 1) * (altura - 0.15) / (gavetas - 1) - 0.03, altura - 0.03)', w: 'largura - 0.12', d: 0.012, h: 0.012, material: 'matPuxador', round: 0.005 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'white', name: w('Branco, 3 gavetas', 'White, 3 drawers'), values: {} },
    { id: 'black', name: w('Grafite, 4 gavetas', 'Graphite, 4 drawers'), values: { gavetas: 4, matCorpo: 'lacquerBlack', altura: 0.65 } },
  ],
};

export const MEETING_TABLE: ObjectDefinition = {
  id: 'def_meeting_table',
  name: w('Mesa de reunião', 'Meeting table'),
  category: 'furniture',
  folder: 'Escritório',
  params: [
    len('largura', 'Comprimento', 'Length', 2.4, 1.6, 5),
    len('profundidade', 'Largura', 'Width', 1.1, 0.9, 1.6),
    len('altura', 'Altura', 'Height', 0.75, 0.72, 0.78),
    counted('porLado', 'Cadeiras por lado', 'Chairs a side', 'max(1, floor((largura - 0.3) / 0.7))'),
    yes('cadeiras', 'Com cadeiras', 'With chairs', 1),
    mat('matTampo', 'Tampo', 'Top', 'walnut'),
    mat('matBase', 'Base', 'Base', 'blackSteel'),
  ],
  parts: [
    // A boat-shaped top: rounded corners as large as half its width allows.
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.035', w: 'largura', d: 'profundidade', h: 0.035, material: 'matTampo', round: 0.017 },
    { kind: 'box', name: w('Pedestal', 'Pedestal'), repeat: { count: 2, dx: 'largura * 0.5' }, x: '-largura * 0.25 - 0.1', y: '-profundidade * 0.3', z: 0, w: 0.2, d: 'profundidade * 0.6', h: 'altura - 0.035', material: 'matBase', round: 0.006 },
    { kind: 'box', name: w('Calha de cabos', 'Cable trough'), x: '-largura * 0.25', y: -0.07, z: 'altura - 0.035 - 0.08', w: 'largura * 0.5', d: 0.14, h: 0.08, material: 'matBase' },
    { kind: 'box', name: w('Tomada de mesa', 'Table socket'), x: -0.12, y: -0.05, z: 'altura - 0.002', w: 0.24, d: 0.1, h: 0.004, material: 'aluminium', round: 0.002 },
    { kind: 'object', name: w('Cadeira', 'Chair'), definition: 'def_office_chair', when: 'cadeiras', repeat: { count: 'porLado', dx: '(largura - 0.3) / porLado' }, x: '-largura/2 + 0.15 + (largura - 0.3) / porLado / 2', y: '-profundidade/2 - 0.18', z: 0, angle: 180, values: { bracos: 1 } },
    { kind: 'object', name: w('Cadeira', 'Chair'), definition: 'def_office_chair', when: 'cadeiras', repeat: { count: 'porLado', dx: '(largura - 0.3) / porLado' }, x: '-largura/2 + 0.15 + (largura - 0.3) / porLado / 2', y: 'profundidade/2 + 0.18', z: 0, values: { bracos: 1 } },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'eight', name: w('2,40 m, 6 cadeiras', '2.40 m, 6 chairs'), values: {} },
    // 4 chairs a side at 3.60 m (porLado): named by what it makes, not 10.
    { id: 'long', name: w('3,60 m, 8 cadeiras, carvalho', '3.60 m, 8 chairs, oak'), values: { largura: 3.6, profundidade: 1.3, matTampo: 'oak' } },
    { id: 'bare', name: w('Só a mesa, branca', 'Table only, white'), values: { cadeiras: 0, matTampo: 'lacquerWhite', matBase: 'lacquerWhite' } },
  ],
};

export const SHELF_BOOKS: ObjectDefinition = {
  id: 'def_shelf_books',
  name: w('Estante industrial com livros', 'Industrial shelf with books'),
  category: 'casework',
  folder: 'Escritório',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.6, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.35, 0.25, 0.45),
    len('altura', 'Altura', 'Height', 1.9, 0.9, 2.4),
    counted('prateleiras', 'Prateleiras', 'Shelves', 'max(2, round(altura / 0.38))'),
    yes('livros', 'Com livros', 'With books', 1),
    counted('porPrateleira', 'Livros por prateleira', 'Books a shelf', 'floor((largura - 0.1) * 0.65 / 0.034)', BUILD),
    mat('matEstrutura', 'Estrutura', 'Frame', 'blackSteel'),
    mat('matPrateleira', 'Prateleiras', 'Shelves', 'oak'),
    mat('matLivros1', 'Livros (1)', 'Books (1)', 'lacquerTerracotta'),
    mat('matLivros2', 'Livros (2)', 'Books (2)', 'lacquerSage'),
    mat('matLivros3', 'Livros (3)', 'Books (3)', 'linen'),
  ],
  parts: [
    // A steel frame: four uprights, an X brace at the back.
    { kind: 'box', name: w('Montante', 'Upright'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2, largura/2 - 0.025)', y: 'if(i < 2, -profundidade/2, profundidade/2 - 0.025)', z: 0, w: 0.025, d: 0.025, h: 'altura', material: 'matEstrutura' },
    { kind: 'box', name: w('Contraventamento', 'Brace'), x: '-largura/2 + 0.02', y: 'profundidade/2 - 0.01', z: 0.05, w: 0.008, d: 0.006, h: 'sqrt(largura * largura + (altura - 0.1) * (altura - 0.1)) - 0.04', roll: 'atan2(largura - 0.04, altura - 0.1)', material: 'matEstrutura' },
    { kind: 'box', name: w('Contraventamento', 'Brace'), x: 'largura/2 - 0.028', y: 'profundidade/2 - 0.01', z: 0.05, w: 0.008, d: 0.006, h: 'sqrt(largura * largura + (altura - 0.1) * (altura - 0.1)) - 0.04', roll: '-atan2(largura - 0.04, altura - 0.1)', material: 'matEstrutura' },
    { kind: 'box', name: w('Prateleira', 'Shelf'), repeat: { count: 'prateleiras', dz: '(altura - 0.07) / (prateleiras - 1)' }, x: '-largura/2', y: '-profundidade/2', z: 0.05, w: 'largura', d: 'profundidade', h: 0.025, material: 'matPrateleira' },
    // Books on each shelf but the top, standing at varied heights and thicknesses, in three colours.
    ...[0, 1, 2].map((k) => ({
      kind: 'box' as const,
      name: w('Livro', 'Book'),
      when: `livros && i % 3 == ${k}`,
      repeat: { count: 'porPrateleira * (prateleiras - 1)' },
      x: '-largura/2 + 0.05 + (i % porPrateleira) * 0.034',
      y: '-profundidade/2 + 0.04 + ((i * 7) % 5) * 0.006',
      z: '0.075 + floor(i / porPrateleira) * (altura - 0.07) / (prateleiras - 1)',
      w: '0.022 + ((i * 13) % 4) * 0.003',
      d: 'min(profundidade - 0.08, 0.17 + ((i * 3) % 4) * 0.02)',
      h: 'min((altura - 0.07) / (prateleiras - 1) - 0.05, 0.19 + ((i * 11) % 7) * 0.012)',
      material: `matLivros${k + 1}`,
      round: 0.002,
    })),
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'books', name: w('Com livros', 'With books'), values: {} },
    { id: 'empty', name: w('Vazia, nogueira', 'Empty, walnut'), values: { livros: 0, matPrateleira: 'walnut' } },
    { id: 'low', name: w('Baixa 2 m × 0,9', 'Low 2 m × 0.9'), values: { largura: 2, altura: 0.9 } },
  ],
};

export const FILING_CABINET: ObjectDefinition = {
  id: 'def_filing_cabinet',
  name: w('Arquivo de aço', 'Steel filing cabinet'),
  category: 'casework',
  folder: 'Escritório',
  params: [
    len('largura', 'Largura', 'Width', 0.47, 0.4, 0.6),
    len('profundidade', 'Profundidade', 'Depth', 0.65, 0.5, 0.7),
    len('altura', 'Altura', 'Height', 1.33, 0.7, 1.5),
    counted('gavetas', 'Gavetas', 'Drawers', 'max(2, round(altura / 0.33))'),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerBlack'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0, w: 'largura', d: 'profundidade - 0.02', h: 'altura', material: 'matCorpo', round: 0.004 },
    { kind: 'box', name: w('Gaveta', 'Drawer'), repeat: { count: 'gavetas', dz: '(altura - 0.04) / gavetas' }, x: '-largura/2 + 0.01', y: '-profundidade/2', z: 0.03, w: 'largura - 0.02', d: 0.02, h: '(altura - 0.04) / gavetas - 0.008', material: 'matCorpo', round: 0.003 },
    { kind: 'box', name: w('Puxador', 'Handle'), repeat: { count: 'gavetas', dz: '(altura - 0.04) / gavetas' }, x: -0.07, y: '-profundidade/2 - 0.02', z: '0.03 + (altura - 0.04) / gavetas * 0.55', w: 0.14, d: 0.02, h: 0.02, material: 'chrome', round: 0.008 },
    { kind: 'box', name: w('Porta-etiqueta', 'Label holder'), repeat: { count: 'gavetas', dz: '(altura - 0.04) / gavetas' }, x: -0.05, y: '-profundidade/2 - 0.004', z: '0.03 + (altura - 0.04) / gavetas * 0.72', w: 0.1, d: 0.004, h: 0.03, material: 'chrome' },
    { kind: 'cylinder', name: w('Fechadura', 'Lock'), x: 'largura/2 - 0.05', y: '-profundidade/2', z: 'altura - 0.05', r: 0.01, h: 0.006, tilt: -90, material: 'chrome' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'four', name: w('4 gavetas, grafite', '4 drawers, graphite'), values: {} },
    { id: 'two', name: w('2 gavetas, cinza', '2 drawers, grey'), values: { altura: 0.72, matCorpo: 'aluminium' } },
  ],
};

export const LIBRARY_OFFICE: readonly ObjectDefinition[] = [OFFICE_CHAIR, DESK, MONITOR, PEDESTAL, MEETING_TABLE, SHELF_BOOKS, FILING_CABINET];
