// The library's bedroom (data only, as library.ts): a box bed with an upholstered headboard and its
// bedding, a nightstand, a chest of drawers, a wardrobe with hinged or sliding doors, a crib, a bunk bed,
// a dressing table with its round mirror and a bench for the foot of the bed.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, int, len, mat, w, yes } from './library-kit';

export const BOX_BED: ObjectDefinition = {
  id: 'def_box_bed',
  name: w('Cama box com cabeceira', 'Box bed with headboard'),
  category: 'furniture',
  folder: 'Quarto',
  params: [
    len('largura', 'Largura do colchão', 'Mattress width', 1.58, 0.78, 2.03),
    len('profundidade', 'Comprimento do colchão', 'Mattress length', 1.98, 1.88, 2.13),
    len('altura', 'Altura do colchão', 'Mattress top', 0.62, 0.45, 0.75),
    len('cabeceira', 'Altura da cabeceira', 'Headboard height', 1.25, 0.9, 1.7),
    len('aba', 'Aba da cabeceira (cada lado)', 'Headboard wing (each side)', 0.15, 0, 0.8, BUILD),
    counted('gomos', 'Gomos da cabeceira', 'Headboard panels', 'max(2, round((largura + 2 * aba) / 0.32))'),
    counted('travesseiros', 'Travesseiros', 'Pillows', 'if(largura > 1.2, 2, 1)'),
    yes('manta', 'Manta nos pés', 'Throw at the foot', 1),
    mat('matBase', 'Box', 'Base', 'linen'),
    mat('matCabeceira', 'Cabeceira', 'Headboard', 'velvet'),
    mat('matRoupa', 'Roupa de cama', 'Bedding', 'boucle'),
    mat('matManta', 'Manta', 'Throw', 'linen'),
  ],
  parts: [
    { kind: 'cylinder', name: w('Pé', 'Foot'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.08, largura/2 - 0.08)', y: 'if(i < 2, -profundidade/2 + 0.08, profundidade/2 - 0.08)', z: 0, r: 0.025, h: 0.08, material: 'blackSteel' },
    { kind: 'box', name: w('Box', 'Base'), x: '-largura/2', y: '-profundidade/2', z: 0.08, w: 'largura', d: 'profundidade', h: 'altura - 0.3', material: 'matBase', round: 0.02 },
    { kind: 'box', name: w('Colchão', 'Mattress'), x: '-largura/2 + 0.01', y: '-profundidade/2 + 0.01', z: 'altura - 0.22', w: 'largura - 0.02', d: 'profundidade - 0.02', h: 0.22, material: 'matRoupa', round: 0.06 },
    // The duvet, over two-thirds of the bed from its foot, falling a little over the sides.
    { kind: 'box', name: w('Edredom', 'Duvet'), x: '-largura/2 - 0.03', y: '-profundidade/2 - 0.03', z: 'altura - 0.17', w: 'largura + 0.06', d: 'profundidade * 0.72', h: 0.2, material: 'matRoupa', round: 0.06 },
    // The pillows, leaning on the headboard.
    {
      kind: 'box',
      name: w('Travesseiro', 'Pillow'),
      repeat: { count: 'travesseiros', dx: '(largura - 0.1) / travesseiros' },
      x: '-largura/2 + 0.07',
      y: 'profundidade/2 - 0.36',
      z: 'altura - 0.02',
      w: '(largura - 0.1) / travesseiros - 0.04',
      d: 0.14,
      h: 0.48,
      tilt: 62,
      material: 'matRoupa',
      round: 0.06,
    },
    { kind: 'box', name: w('Manta', 'Throw'), when: 'manta', x: '-largura/2 - 0.05', y: '-profundidade/2 + 0.1', z: 'altura + 0.03', w: 'largura + 0.1', d: 0.45, h: 0.025, material: 'matManta', round: 0.01 },
    { kind: 'box', name: w('Manta (caída)', 'Throw (hanging)'), when: 'manta', repeat: { count: 2, dx: 'largura + 0.075' }, x: '-largura/2 - 0.05', y: '-profundidade/2 + 0.1', z: 'altura - 0.25', w: 0.025, d: 0.45, h: 0.3, material: 'matManta', round: 0.01 },
    // The headboard: a board on the wall, its upholstered panels side by side in front of it.
    { kind: 'box', name: w('Painel da cabeceira', 'Headboard backing'), x: '-largura/2 - aba', y: 'profundidade/2 + 0.04', z: 0.08, w: 'largura + 2 * aba', d: 0.04, h: 'cabeceira - 0.08', material: 'matCabeceira', round: 0.01 },
    {
      kind: 'box',
      name: w('Gomo', 'Panel'),
      repeat: { count: 'gomos', dx: '(largura + 2 * aba) / gomos' },
      x: '-largura/2 - aba + 0.004',
      y: 'profundidade/2 - 0.04',
      z: 'altura - 0.1',
      w: '(largura + 2 * aba) / gomos - 0.008',
      d: 0.09,
      h: 'cabeceira - altura + 0.08',
      material: 'matCabeceira',
      round: 0.04,
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'cabeceira', axis: 'z', at: [0, 'profundidade/2', 'cabeceira'] },
  ],
  types: [
    { id: 'queen', name: w('Queen 158 × 198', 'Queen 158 × 198'), values: {} },
    { id: 'king', name: w('King 193 × 203', 'King 193 × 203'), values: { largura: 1.93, profundidade: 2.03, aba: 0.5, matCabeceira: 'linen' } },
    { id: 'double', name: w('Casal 138 × 188', 'Double 138 × 188'), values: { largura: 1.38, profundidade: 1.88, aba: 0, cabeceira: 1.1 } },
    { id: 'single', name: w('Solteiro 88 × 188', 'Single 88 × 188'), values: { largura: 0.88, profundidade: 1.88, aba: 0, cabeceira: 1, manta: 0, matCabeceira: 'boucle' } },
  ],
};

export const NIGHTSTAND: ObjectDefinition = {
  id: 'def_nightstand',
  name: w('Criado-mudo', 'Nightstand'),
  category: 'casework',
  folder: 'Quarto',
  params: [
    len('largura', 'Largura', 'Width', 0.5, 0.35, 0.8),
    len('profundidade', 'Profundidade', 'Depth', 0.4, 0.3, 0.55),
    len('altura', 'Altura', 'Height', 0.55, 0.4, 0.75),
    len('pe', 'Altura dos pés', 'Leg height', 0.16, 0, 0.3, BUILD),
    int('gavetas', 'Gavetas', 'Drawers', 2, 1, 3),
    mat('matCorpo', 'Corpo', 'Carcass', 'oak'),
    mat('matFrente', 'Frentes', 'Fronts', 'lacquerWhite'),
    mat('matPuxador', 'Puxadores', 'Knobs', 'brass'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2', z: 'pe', w: 'largura', d: 'profundidade', h: 'altura - pe', material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Gaveta', 'Drawer'), repeat: { count: 'gavetas', dz: '(altura - pe - 0.04) / gavetas' }, x: '-largura/2 + 0.02', y: '-profundidade/2 - 0.006', z: 'pe + 0.02 + 0.002', w: 'largura - 0.04', d: 0.02, h: '(altura - pe - 0.04) / gavetas - 0.004', material: 'matFrente', round: 0.003 },
    { kind: 'cylinder', name: w('Puxador', 'Knob'), repeat: { count: 'gavetas', dz: '(altura - pe - 0.04) / gavetas' }, x: 0, y: '-profundidade/2 - 0.005', z: 'pe + 0.02 + (altura - pe - 0.04) / gavetas / 2', r: 0.014, r2: 0.01, h: 0.028, tilt: -90, material: 'matPuxador' },
    { kind: 'cylinder', name: w('Pé', 'Leg'), when: 'pe > 0', repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.04, largura/2 - 0.04)', y: 'if(i < 2, -profundidade/2 + 0.04, profundidade/2 - 0.04)', z: 0, r: 0.01, r2: 0.016, h: 'pe + 0.004', roll: 'if(i % 2 == 0, 6, -6)', tilt: 'if(i < 2, 4, -4)', material: 'matCorpo' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'two', name: w('Duas gavetas, carvalho', 'Two drawers, oak'), values: {} },
    { id: 'one', name: w('Uma gaveta, suspenso', 'One drawer, wall-hung'), values: { gavetas: 1, pe: 0, altura: 0.2, matCorpo: 'walnut', matFrente: 'walnut' } },
    { id: 'three', name: w('Três gavetas, laca verde', 'Three drawers, sage'), values: { gavetas: 3, altura: 0.62, matFrente: 'lacquerSage', matCorpo: 'lacquerSage' } },
  ],
};

export const DRESSER: ObjectDefinition = {
  id: 'def_dresser',
  name: w('Cômoda', 'Chest of drawers'),
  category: 'casework',
  folder: 'Quarto',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.6, 2),
    len('profundidade', 'Profundidade', 'Depth', 0.48, 0.38, 0.6),
    len('altura', 'Altura', 'Height', 0.86, 0.6, 1.3),
    len('rodape', 'Rodapé', 'Plinth', 0.08, 0.04, 0.2, BUILD),
    counted('colunas', 'Colunas de gavetas', 'Columns of drawers', 'max(1, round(largura / 0.6))'),
    int('gavetas', 'Gavetas por coluna', 'Drawers a column', 4, 2, 7),
    mat('matCorpo', 'Corpo', 'Carcass', 'walnut'),
    mat('matFrente', 'Frentes', 'Fronts', 'walnut'),
    mat('matPuxador', 'Puxadores', 'Handles', 'brass'),
  ],
  parts: [
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.03', z: 0, w: 'largura - 0.06', d: 'profundidade - 0.06', h: 'rodape', material: 'matCorpo' },
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2', z: 'rodape', w: 'largura', d: 'profundidade', h: 'altura - rodape', material: 'matCorpo', round: 0.008 },
    // Each drawer by its column (i % colunas) and row (floor(i / colunas)).
    {
      kind: 'box',
      name: w('Gaveta', 'Drawer'),
      repeat: { count: 'colunas * gavetas' },
      x: '-largura/2 + 0.02 + (i % colunas) * (largura - 0.04) / colunas + 0.002',
      y: '-profundidade/2 - 0.004',
      z: 'rodape + 0.02 + floor(i / colunas) * (altura - rodape - 0.04) / gavetas + 0.002',
      w: '(largura - 0.04) / colunas - 0.004',
      d: 0.02,
      h: '(altura - rodape - 0.04) / gavetas - 0.004',
      material: 'matFrente',
      round: 0.003,
    },
    // A bar pull centred on each drawer, toward its top.
    {
      kind: 'cylinder',
      name: w('Puxador', 'Handle'),
      repeat: { count: 'colunas * gavetas' },
      x: '-largura/2 + 0.02 + (i % colunas + 0.5) * (largura - 0.04) / colunas - 0.08',
      y: '-profundidade/2 - 0.022',
      z: 'rodape + 0.02 + (floor(i / colunas) + 0.62) * (altura - rodape - 0.04) / gavetas',
      r: 0.006,
      h: 0.16,
      roll: 90,
      material: 'matPuxador',
    },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'walnut', name: w('Nogueira, 2 × 4 gavetas', 'Walnut, 2 × 4 drawers'), values: {} },
    { id: 'tall', name: w('Alta, 1 × 6, laca branca', 'Tall, 1 × 6, white'), values: { largura: 0.6, altura: 1.25, gavetas: 6, matCorpo: 'lacquerWhite', matFrente: 'lacquerWhite', matPuxador: 'blackSteel' } },
    { id: 'wide', name: w('Larga, 3 × 3, carvalho', 'Wide, 3 × 3, oak'), values: { largura: 1.8, altura: 0.78, gavetas: 3, matCorpo: 'oak', matFrente: 'oak' } },
  ],
};

export const WARDROBE: ObjectDefinition = {
  id: 'def_wardrobe',
  name: w('Guarda-roupa', 'Wardrobe'),
  category: 'casework',
  folder: 'Quarto',
  params: [
    choice('abertura', 'Portas', 'Doors', [['De abrir', 'Hinged'], ['De correr', 'Sliding']]),
    len('largura', 'Largura', 'Width', 2.4, 0.8, 4),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.5, 0.7),
    len('altura', 'Altura', 'Height', 2.45, 1.8, 2.8),
    len('rodape', 'Rodapé', 'Plinth', 0.08, 0.04, 0.15, BUILD),
    yes('maleiro', 'Com maleiro', 'With top cupboards', 1),
    len('alturaMaleiro', 'Altura do maleiro', 'Top cupboards height', 0.45, 0.3, 0.7, BUILD),
    yes('espelho', 'Espelho numa porta', 'Mirror on a door', 1),
    counted('portas', 'Portas', 'Doors', 'if(abertura == 0, max(2, round(largura / 0.5)), if(largura > 2.6, 3, 2))'),
    mat('matCorpo', 'Corpo', 'Carcass', 'lacquerWhite'),
    mat('matPortas', 'Portas', 'Doors', 'freijo'),
    mat('matPuxador', 'Puxadores e perfis', 'Handles and profiles', 'blackSteel'),
  ],
  parts: [
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.04', z: 0, w: 'largura - 0.04', d: 'profundidade - 0.04', h: 'rodape', material: 'matCorpo' },
    { kind: 'box', name: w('Corpo', 'Carcass'), x: '-largura/2', y: '-profundidade/2 + 0.03', z: 'rodape', w: 'largura', d: 'profundidade - 0.03', h: 'altura - rodape', material: 'matCorpo', round: 0.004 },
    // Hinged: a door a module, from the plinth to the top cupboards; a bar handle by each meeting edge.
    {
      kind: 'box',
      name: w('Porta', 'Door'),
      when: 'abertura == 0',
      repeat: { count: 'portas', dx: 'largura / portas' },
      x: '-largura/2 + 0.0015',
      y: '-profundidade/2 + 0.01',
      z: 'rodape + 0.003',
      w: 'largura / portas - 0.003',
      d: 0.02,
      h: 'altura - rodape - 0.006 - maleiro * alturaMaleiro',
      material: 'matPortas',
    },
    {
      kind: 'box',
      name: w('Puxador', 'Handle'),
      when: 'abertura == 0',
      repeat: { count: 'portas', dx: 'largura / portas' },
      x: '-largura/2 + if(i % 2 == 0, largura / portas - 0.05, 0.035)',
      y: '-profundidade/2 - 0.012',
      z: '(altura - maleiro * alturaMaleiro) / 2 - 0.25',
      w: 0.015,
      d: 0.022,
      h: 0.5,
      material: 'matPuxador',
      round: 0.006,
    },
    // Sliding: doors overlapping 2 cm on two tracks, an aluminium pull up each edge.
    {
      kind: 'box',
      name: w('Porta de correr', 'Sliding door'),
      when: 'abertura == 1',
      repeat: { count: 'portas', dx: '(largura - 0.04) / portas' },
      x: '-largura/2 + 0.02 - if(i > 0, 0.01, 0)',
      y: '-profundidade/2 + if(i % 2 == 0, 0.0, 0.03)',
      z: 'rodape + 0.003',
      w: '(largura - 0.04) / portas + if(i > 0 && i < portas - 1, 0.02, 0.01)',
      d: 0.025,
      h: 'altura - rodape - 0.006 - maleiro * alturaMaleiro',
      material: 'matPortas',
    },
    {
      kind: 'box',
      name: w('Perfil', 'Pull profile'),
      when: 'abertura == 1',
      repeat: { count: 'portas', dx: '(largura - 0.04) / portas' },
      x: '-largura/2 + 0.02 + if(i == 0, (largura - 0.04) / portas - 0.02, 0)',
      y: '-profundidade/2 - 0.006 + if(i % 2 == 0, 0, 0.03)',
      z: 'rodape + 0.003',
      w: 0.02,
      d: 0.012,
      h: 'altura - rodape - 0.006 - maleiro * alturaMaleiro',
      material: 'matPuxador',
    },
    // The mirror on the first door.
    {
      kind: 'box',
      name: w('Espelho', 'Mirror'),
      when: 'espelho',
      x: '-largura/2 + 0.06',
      y: '-profundidade/2 + if(abertura == 0, 0.01, 0) - 0.004',
      z: 'rodape + 0.15',
      w: 'if(abertura == 0, largura / portas, (largura - 0.04) / portas) - 0.12',
      d: 0.006,
      h: 'altura - rodape - 0.3 - maleiro * alturaMaleiro',
      material: 'mirror',
    },
    // The top cupboards: a door each, a recessed pull under each.
    { kind: 'box', name: w('Porta do maleiro', 'Top cupboard door'), when: 'maleiro', repeat: { count: 'portas', dx: 'largura / portas' }, x: '-largura/2 + 0.0015', y: '-profundidade/2 + 0.01', z: 'altura - alturaMaleiro + 0.003', w: 'largura / portas - 0.003', d: 0.02, h: 'alturaMaleiro - 0.006', material: 'matPortas' },
    { kind: 'box', name: w('Cava do maleiro', 'Top cupboard pull'), when: 'maleiro', cut: true, repeat: { count: 'portas', dx: 'largura / portas' }, x: '-largura/2 + largura / portas / 2 - 0.08', y: '-profundidade/2 + 0.005', z: 'altura - alturaMaleiro + 0.003', w: 0.16, d: 0.03, h: 0.025 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'hinged', name: w('Portas de abrir, freijó', 'Hinged doors, freijó'), values: {} },
    { id: 'sliding', name: w('Portas de correr, espelho', 'Sliding doors, mirror'), values: { abertura: 1, matPortas: 'lacquerWhite', matPuxador: 'aluminium' } },
    { id: 'narrow', name: w('Estreito 1,2 m sem maleiro', 'Narrow 1.2 m, no top'), values: { largura: 1.2, maleiro: 0, altura: 2.1, espelho: 0, matPortas: 'oak' } },
  ],
};

export const CRIB: ObjectDefinition = {
  id: 'def_crib',
  name: w('Berço', 'Crib'),
  category: 'furniture',
  folder: 'Quarto',
  params: [
    len('largura', 'Comprimento', 'Length', 1.42, 1.1, 1.6),
    len('profundidade', 'Largura', 'Width', 0.76, 0.6, 0.9),
    len('altura', 'Altura', 'Height', 0.92, 0.8, 1.05),
    len('colchao', 'Altura do colchão', 'Mattress height', 0.42, 0.2, 0.6, BUILD),
    counted('grades', 'Grades (cada lado)', 'Bars (each side)', 'floor((largura - 0.12) / 0.075)'),
    mat('matEstrutura', 'Estrutura', 'Frame', 'lacquerWhite'),
    mat('matColchao', 'Colchão', 'Mattress', 'linen'),
  ],
  parts: [
    { kind: 'box', name: w('Coluna', 'Post'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2, largura/2 - 0.045)', y: 'if(i < 2, -profundidade/2, profundidade/2 - 0.045)', z: 0, w: 0.045, d: 0.045, h: 'altura', material: 'matEstrutura', round: 0.008 },
    // Rails top and bottom of the long sides; the ends solid.
    { kind: 'box', name: w('Travessa', 'Rail'), repeat: { count: 4 }, x: '-largura/2 + 0.045', y: 'if(i < 2, -profundidade/2 + 0.005, profundidade/2 - 0.04)', z: 'if(i % 2 == 0, colchao - 0.08, altura - 0.04)', w: 'largura - 0.09', d: 0.035, h: 0.04, material: 'matEstrutura', round: 0.008 },
    { kind: 'box', name: w('Cabeceira', 'End panel'), repeat: { count: 2, dx: 'largura - 0.065' }, x: '-largura/2 + 0.01', y: '-profundidade/2 + 0.045', z: 'colchao - 0.08', w: 0.025, d: 'profundidade - 0.09', h: 'altura - colchao + 0.04', material: 'matEstrutura', round: 0.006 },
    { kind: 'cylinder', name: w('Grade', 'Bar'), repeat: { count: 'grades', dx: '(largura - 0.12) / grades' }, x: '-largura/2 + 0.06 + (largura - 0.12) / grades / 2', y: '-profundidade/2 + 0.0225', z: 'colchao - 0.04', r: 0.011, h: 'altura - colchao', material: 'matEstrutura' },
    { kind: 'cylinder', name: w('Grade', 'Bar'), repeat: { count: 'grades', dx: '(largura - 0.12) / grades' }, x: '-largura/2 + 0.06 + (largura - 0.12) / grades / 2', y: 'profundidade/2 - 0.0225', z: 'colchao - 0.04', r: 0.011, h: 'altura - colchao', material: 'matEstrutura' },
    { kind: 'box', name: w('Estrado', 'Base'), x: '-largura/2 + 0.035', y: '-profundidade/2 + 0.035', z: 'colchao - 0.1', w: 'largura - 0.07', d: 'profundidade - 0.07', h: 0.02, material: 'matEstrutura' },
    { kind: 'box', name: w('Colchão', 'Mattress'), x: '-largura/2 + 0.045', y: '-profundidade/2 + 0.045', z: 'colchao - 0.08', w: 'largura - 0.09', d: 'profundidade - 0.09', h: 0.12, material: 'matColchao', round: 0.03 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'white', name: w('Branco, padrão americano', 'White, US standard'), values: {} },
    { id: 'oak', name: w('Carvalho, mini', 'Oak, mini'), values: { largura: 1.2, profundidade: 0.66, matEstrutura: 'oak' } },
  ],
  rules: [{ when: '(largura - 0.12) / grades - 0.022 > 0.065', message: w('Vão entre grades acima de 6,5 cm (NBR 15860)', 'Gap between bars over 6.5 cm (NBR 15860)') }],
};

export const BUNK_BED: ObjectDefinition = {
  id: 'def_bunk_bed',
  name: w('Beliche', 'Bunk bed'),
  category: 'furniture',
  folder: 'Quarto',
  params: [
    len('largura', 'Comprimento', 'Length', 2.05, 1.95, 2.15),
    len('profundidade', 'Largura', 'Width', 0.98, 0.9, 1.45),
    len('altura', 'Altura', 'Height', 1.65, 1.5, 1.9),
    len('cama1', 'Altura da cama de baixo', 'Lower bed height', 0.3, 0.2, 0.45, BUILD),
    len('cama2', 'Altura da cama de cima', 'Upper bed height', 1.18, 1, 1.4, BUILD),
    counted('degraus', 'Degraus', 'Rungs', 'max(3, round((cama2 + 0.1) / 0.28))'),
    mat('matEstrutura', 'Estrutura', 'Frame', 'pine'),
    mat('matColchao', 'Colchões', 'Mattresses', 'linen'),
  ],
  parts: [
    { kind: 'box', name: w('Coluna', 'Post'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2, largura/2 - 0.06)', y: 'if(i < 2, -profundidade/2, profundidade/2 - 0.06)', z: 0, w: 0.06, d: 0.06, h: 'altura', material: 'matEstrutura', round: 0.008 },
    // Each bed: its frame all round and its mattress; the upper one with a guard rail along its open side.
    { kind: 'box', name: w('Longarina', 'Side rail'), repeat: { count: 4 }, x: '-largura/2 + 0.06', y: 'if(i % 2 == 0, -profundidade/2, profundidade/2 - 0.03)', z: 'if(i < 2, cama1, cama2)', w: 'largura - 0.12', d: 0.03, h: 0.14, material: 'matEstrutura', round: 0.006 },
    { kind: 'box', name: w('Cabeceira', 'End rail'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.015, largura/2 - 0.045)', y: '-profundidade/2 + 0.06', z: 'if(i < 2, cama1, cama2)', w: 0.03, d: 'profundidade - 0.12', h: 0.3, material: 'matEstrutura', round: 0.006 },
    { kind: 'box', name: w('Colchão', 'Mattress'), repeat: { count: 2, dz: 'cama2 - cama1' }, x: '-largura/2 + 0.07', y: '-profundidade/2 + 0.035', z: 'cama1 + 0.04', w: 'largura - 0.14', d: 'profundidade - 0.07', h: 0.15, material: 'matColchao', round: 0.04 },
    { kind: 'box', name: w('Guarda-corpo', 'Guard rail'), x: '-largura/2 + 0.06', y: '-profundidade/2', z: 'cama2 + 0.32', w: 'largura - 0.6', d: 0.03, h: 0.1, material: 'matEstrutura', round: 0.006 },
    // The ladder at the foot, on the open side: two stiles and its rungs.
    { kind: 'box', name: w('Montante da escada', 'Ladder stile'), repeat: { count: 2, dx: 0.4 }, x: 'largura/2 - 0.54', y: '-profundidade/2 - 0.05', z: 0, w: 0.04, d: 0.04, h: 'cama2 + 0.42', material: 'matEstrutura', round: 0.006 },
    { kind: 'cylinder', name: w('Degrau', 'Rung'), repeat: { count: 'degraus', dz: '(cama2 + 0.1) / degraus' }, x: 'largura/2 - 0.5', y: '-profundidade/2 - 0.03', z: '(cama2 + 0.1) / degraus', r: 0.016, h: 0.36, roll: 90, material: 'matEstrutura' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'pine', name: w('Pinus, solteiro', 'Pine, single'), values: {} },
    { id: 'white', name: w('Branco', 'White'), values: { matEstrutura: 'lacquerWhite' } },
  ],
  rules: [{ when: 'altura - cama2 - 0.19 < 0.16', message: w('Proteção da cama de cima menor que 16 cm acima do colchão', 'Upper guard less than 16 cm above the mattress') }],
};

export const VANITY: ObjectDefinition = {
  id: 'def_vanity',
  name: w('Penteadeira', 'Dressing table'),
  category: 'furniture',
  folder: 'Quarto',
  params: [
    len('largura', 'Largura', 'Width', 1, 0.6, 1.6),
    len('profundidade', 'Profundidade', 'Depth', 0.45, 0.35, 0.6),
    len('altura', 'Altura', 'Height', 0.76, 0.7, 0.8),
    len('espelho', 'Diâmetro do espelho', 'Mirror diameter', 0.7, 0.4, 1),
    mat('matCorpo', 'Corpo', 'Body', 'oak'),
    mat('matPes', 'Pés e moldura', 'Legs and frame', 'brass'),
  ],
  parts: [
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.025', w: 'largura', d: 'profundidade', h: 0.025, material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Gaveta', 'Drawer'), x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.01', z: 'altura - 0.16', w: 'largura - 0.08', d: 'profundidade - 0.04', h: 0.135, material: 'matCorpo', round: 0.006 },
    { kind: 'cylinder', name: w('Puxador', 'Knob'), x: 0, y: '-profundidade/2 + 0.012', z: 'altura - 0.095', r: 0.012, h: 0.026, tilt: -90, material: 'matPes' },
    { kind: 'cylinder', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.05, largura/2 - 0.05)', y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.05)', z: 0, r: 0.012, r2: 0.016, h: 'altura - 0.025', material: 'matPes' },
    // The round mirror standing on the back of the top, in a thin frame.
    { kind: 'cylinder', name: w('Moldura', 'Frame'), x: 0, y: 'profundidade/2 - 0.05', z: 'altura + espelho / 2 + 0.03', r: 'espelho / 2 + 0.012', h: 0.02, tilt: 90, material: 'matPes' },
    { kind: 'cylinder', name: w('Espelho', 'Mirror'), x: 0, y: 'profundidade/2 - 0.051', z: 'altura + espelho / 2 + 0.03', r: 'espelho / 2', h: 0.004, tilt: 90, material: 'mirror' },
    { kind: 'box', name: w('Suporte do espelho', 'Mirror stand'), x: -0.02, y: 'profundidade/2 - 0.04', z: 'altura', w: 0.04, d: 0.02, h: 0.06, material: 'matPes' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'oak', name: w('Carvalho e latão', 'Oak and brass'), values: {} },
    { id: 'white', name: w('Laca branca e cromado', 'White lacquer and chrome'), values: { matCorpo: 'lacquerWhite', matPes: 'chrome', largura: 1.2 } },
  ],
};

export const BENCH: ObjectDefinition = {
  id: 'def_bed_bench',
  name: w('Recamier', 'Bed bench'),
  category: 'furniture',
  folder: 'Quarto',
  params: [
    len('largura', 'Largura', 'Width', 1.4, 0.8, 2),
    len('profundidade', 'Profundidade', 'Depth', 0.42, 0.35, 0.55),
    len('altura', 'Altura', 'Height', 0.45, 0.38, 0.5),
    mat('matEstofado', 'Estofado', 'Upholstery', 'velvet'),
    mat('matPes', 'Pés', 'Legs', 'brass'),
  ],
  parts: [
    { kind: 'box', name: w('Assento', 'Seat'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.16', w: 'largura', d: 'profundidade', h: 0.16, material: 'matEstofado', round: 0.05 },
    { kind: 'box', name: w('Quadro', 'Frame'), x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.02', z: 'altura - 0.2', w: 'largura - 0.04', d: 'profundidade - 0.04', h: 0.04, material: 'matPes' },
    { kind: 'cylinder', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.05, largura/2 - 0.05)', y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.05)', z: 0, r: 0.012, h: 'altura - 0.2', material: 'matPes' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'velvet', name: w('Veludo e latão', 'Velvet and brass'), values: {} },
    { id: 'linen', name: w('Linho e aço preto', 'Linen and black steel'), values: { matEstofado: 'linen', matPes: 'blackSteel' } },
  ],
};

export const LIBRARY_BEDROOM: readonly ObjectDefinition[] = [BOX_BED, NIGHTSTAND, DRESSER, WARDROBE, CRIB, BUNK_BED, VANITY, BENCH];
