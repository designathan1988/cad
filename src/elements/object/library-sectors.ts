// The library's other sectors (data only, as library.ts): children's rooms (a table with little chairs, a toy
// chest, a Montessori house bed, a chest with a changing top), shops and restaurants (a reception desk, a
// shelving gondola with goods, a restaurant booth, a clothes rack), health (a hospital bed, an examination
// couch, a wheelchair at NBR 9050's reference size) and schools (desks in rows, a whiteboard, lockers, a
// teacher's desk).

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, counted, derived, int, len, mat, num, w, yes } from './library-kit';

// ---------- Children ----------

export const KIDS_TABLE: ObjectDefinition = {
  id: 'def_kids_table',
  name: w('Mesa infantil com cadeirinhas', 'Children\'s table with chairs'),
  category: 'furniture',
  folder: 'Infantil',
  params: [
    len('largura', 'Largura', 'Width', 0.7, 0.5, 1.2),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.4, 0.8),
    len('altura', 'Altura', 'Height', 0.48, 0.4, 0.6),
    int('cadeiras', 'Cadeirinhas', 'Little chairs', 2, 0, 4),
    mat('matTampo', 'Tampo', 'Top', 'lacquerWhite'),
    mat('matPes', 'Pés', 'Legs', 'pine'),
    mat('matAssento', 'Assentos', 'Seats', 'lacquerSage'),
  ],
  parts: [
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.022', w: 'largura', d: 'profundidade', h: 0.022, material: 'matTampo', round: 0.01 },
    { kind: 'cylinder', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.06, largura/2 - 0.06)', y: 'if(i < 2, -profundidade/2 + 0.06, profundidade/2 - 0.06)', z: 0, r: 0.016, r2: 0.022, h: 'altura - 0.022', roll: 'if(i % 2 == 0, 5, -5)', tilt: 'if(i < 2, 5, -5)', material: 'matPes' },
    // Little chairs at the long sides, facing the table: two each side at most.
    { kind: 'object', name: w('Cadeirinha', 'Little chair'), definition: 'def_dining_chair', repeat: { count: 'cadeiras' }, x: 'if(cadeiras > 2, (i % 2 - 0.5) * largura * 0.5, 0)', y: 'if(i < max(1, cadeiras / 2), -profundidade/2 - 0.12, profundidade/2 + 0.12)', z: 0, angle: 'if(i < max(1, cadeiras / 2), 180, 0)', values: { largura: 0.32, profundidade: 0.32, assento: 0.28, altura: 0.55, reclinado: 4, matEstofado: 'matAssento', matPes: 'matPes' } },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'two', name: w('Duas cadeirinhas, verde', 'Two chairs, sage'), values: {} },
    { id: 'four', name: w('Quatro cadeirinhas, terracota', 'Four chairs, terracotta'), values: { cadeiras: 4, largura: 0.9, profundidade: 0.6, matAssento: 'lacquerTerracotta' } },
  ],
};

export const TOY_CHEST: ObjectDefinition = {
  id: 'def_toy_chest',
  name: w('Baú de brinquedos', 'Toy chest'),
  category: 'casework',
  folder: 'Infantil',
  params: [
    len('largura', 'Largura', 'Width', 0.8, 0.5, 1.2),
    len('profundidade', 'Profundidade', 'Depth', 0.42, 0.3, 0.55),
    len('altura', 'Altura', 'Height', 0.45, 0.3, 0.6),
    num('tampa', 'Tampa aberta (°)', 'Lid open (°)', 70, 0, 100, 5),
    yes('brinquedos', 'Com brinquedos', 'With toys', 1),
    mat('matCorpo', 'Corpo', 'Body', 'pine'),
    mat('matTampa', 'Tampa', 'Lid', 'lacquerSage'),
  ],
  parts: [
    // The box as its bottom and four sides (a cut would take the toys inside with it).
    { kind: 'box', name: w('Fundo', 'Bottom'), x: '-largura/2', y: '-profundidade/2', z: 0.04, w: 'largura', d: 'profundidade', h: 0.018, material: 'matCorpo' },
    { kind: 'box', name: w('Frente e fundo', 'Front and back'), repeat: { count: 2, dy: 'profundidade - 0.018' }, x: '-largura/2', y: '-profundidade/2', z: 0.04, w: 'largura', d: 0.018, h: 'altura - 0.06', material: 'matCorpo', round: 0.004 },
    { kind: 'box', name: w('Lateral', 'Side'), repeat: { count: 2, dx: 'largura - 0.018' }, x: '-largura/2', y: '-profundidade/2 + 0.018', z: 0.04, w: 0.018, d: 'profundidade - 0.036', h: 'altura - 0.06', material: 'matCorpo', round: 0.004 },
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.03', z: 0, w: 'largura - 0.06', d: 'profundidade - 0.06', h: 0.04, material: 'matCorpo' },
    // The lid hinged at the back, raised.
    { kind: 'box', name: w('Tampa', 'Lid'), x: '-largura/2', y: 'profundidade/2 - 0.02', z: 'altura - 0.02', w: 'largura', d: 'profundidade', h: 0.02, tilt: '-tampa', material: 'matTampa', round: 0.008 },
    // Toys showing over the rim: blocks and a ball.
    ...['lacquerTerracotta', 'lacquerSage', 'brass'].map((material, k) => ({
      kind: 'box' as const,
      name: w('Bloco', 'Block'),
      when: 'brinquedos && tampa > 10',
      repeat: { count: 2 },
      x: `-largura/2 + 0.08 + ${k} * (largura - 0.2) / 3`,
      y: '-profundidade/2 + 0.07 + i * 0.14',
      z: `altura - 0.05 + ((i + ${k}) % 2) * 0.025`,
      w: 0.08,
      d: 0.08,
      h: 0.08,
      turn: `(i * 3 + ${k}) * 23`,
      material,
      round: 0.008,
    })),
    { kind: 'sphere', name: w('Bola', 'Ball'), when: 'brinquedos && tampa > 10', x: 'largura/2 - 0.14', y: 0, z: 'altura - 0.1', r: 0.09, h: 0.18, material: 'lacquerTerracotta' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'open', name: w('Aberto, com brinquedos', 'Open, with toys'), values: {} },
    { id: 'closed', name: w('Fechado, branco', 'Closed, white'), values: { tampa: 0, matCorpo: 'lacquerWhite', matTampa: 'lacquerWhite' } },
  ],
};

export const HOUSE_BED: ObjectDefinition = {
  id: 'def_house_bed',
  name: w('Cama casinha (montessoriana)', 'House bed (Montessori)'),
  category: 'furniture',
  folder: 'Infantil',
  params: [
    len('largura', 'Largura do colchão', 'Mattress width', 0.88, 0.7, 1.4),
    len('profundidade', 'Comprimento do colchão', 'Mattress length', 1.88, 1.5, 2),
    len('altura', 'Altura da cumeeira', 'Ridge height', 1.6, 1.3, 2),
    yes('telhado', 'Ripas do telhado', 'Roof slats', 1),
    mat('matEstrutura', 'Estrutura', 'Frame', 'pine'),
    mat('matColchao', 'Colchão', 'Mattress', 'linen'),
  ],
  parts: [
    // A low frame on the floor, its mattress.
    { kind: 'box', name: w('Estrado', 'Base'), x: '-largura/2 - 0.04', y: '-profundidade/2 - 0.04', z: 0, w: 'largura + 0.08', d: 'profundidade + 0.08', h: 0.12, material: 'matEstrutura' },
    { kind: 'box', name: w('Colchão', 'Mattress'), x: '-largura/2', y: '-profundidade/2', z: 0.1, w: 'largura', d: 'profundidade', h: 0.14, material: 'matColchao', round: 0.04 },
    // The house: four posts, two rafters at each end meeting at the ridge, the ridge along it.
    { kind: 'box', name: w('Pilar', 'Post'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 - 0.04, largura/2)', y: 'if(i < 2, -profundidade/2 - 0.04, profundidade/2)', z: 0.12, w: 0.04, d: 0.04, h: 'altura * 0.55', material: 'matEstrutura' },
    { kind: 'box', name: w('Caibro', 'Rafter'), repeat: { count: 2, dy: 'profundidade + 0.04' }, x: '-largura/2 - 0.04', y: '-profundidade/2 - 0.04', z: '0.12 + altura * 0.55', w: 0.04, d: 0.04, h: 'sqrt((largura/2 + 0.04) * (largura/2 + 0.04) + (altura * 0.45 - 0.12) * (altura * 0.45 - 0.12))', roll: 'atan2(largura/2 + 0.02, altura * 0.45 - 0.12)', material: 'matEstrutura' },
    { kind: 'box', name: w('Caibro', 'Rafter'), repeat: { count: 2, dy: 'profundidade + 0.04' }, x: 'largura/2', y: '-profundidade/2 - 0.04', z: '0.12 + altura * 0.55 + 0.04 * sin(atan2(largura/2 + 0.02, altura * 0.45 - 0.12))', w: 0.04, d: 0.04, h: 'sqrt((largura/2 + 0.04) * (largura/2 + 0.04) + (altura * 0.45 - 0.12) * (altura * 0.45 - 0.12))', roll: '-atan2(largura/2 + 0.02, altura * 0.45 - 0.12)', material: 'matEstrutura' },
    { kind: 'box', name: w('Cumeeira', 'Ridge'), x: -0.02, y: '-profundidade/2 - 0.04', z: 'altura - 0.04', w: 0.04, d: 'profundidade + 0.08', h: 0.04, material: 'matEstrutura' },
    { kind: 'box', name: w('Travessa', 'Eaves rail'), repeat: { count: 2, dx: 'largura + 0.04' }, x: '-largura/2 - 0.04', y: '-profundidade/2', z: '0.12 + altura * 0.55 - 0.04', w: 0.04, d: 'profundidade', h: 0.04, material: 'matEstrutura' },
  ],
  handles: [{ param: 'altura', axis: 'z', at: [0, 0, 'altura'] }],
  types: [
    { id: 'single', name: w('Solteiro, pinus', 'Single, pine'), values: {} },
    { id: 'white', name: w('Branca, berço 70', 'White, cot 70'), values: { largura: 0.7, profundidade: 1.5, altura: 1.4, matEstrutura: 'lacquerWhite' } },
  ],
};

export const CHANGING_DRESSER: ObjectDefinition = {
  id: 'def_changing_dresser',
  name: w('Cômoda com trocador', 'Chest with changing top'),
  category: 'casework',
  folder: 'Infantil',
  params: [
    len('largura', 'Largura', 'Width', 0.9, 0.7, 1.2),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.45, 0.6),
    len('altura', 'Altura', 'Height', 0.86, 0.8, 0.95),
    int('gavetas', 'Gavetas', 'Drawers', 3, 2, 4),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerWhite'),
    mat('matTrocador', 'Trocador', 'Changing pad', 'boucle'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2', z: 0.06, w: 'largura', d: 'profundidade', h: 'altura - 0.06', material: 'matCorpo', round: 0.006 },
    { kind: 'box', name: w('Gaveta', 'Drawer'), repeat: { count: 'gavetas', dz: '(altura - 0.1) / gavetas' }, x: '-largura/2 + 0.015', y: '-profundidade/2 - 0.004', z: 0.075, w: 'largura - 0.03', d: 0.02, h: '(altura - 0.1) / gavetas - 0.006', material: 'matCorpo', round: 0.003 },
    { kind: 'cylinder', name: w('Puxador', 'Knob'), repeat: { count: 'gavetas', dz: '(altura - 0.1) / gavetas' }, x: 0, y: '-profundidade/2 - 0.004', z: '0.075 + (altura - 0.1) / gavetas / 2', r: 0.016, r2: 0.012, h: 0.025, tilt: -90, material: 'oak' },
    { kind: 'box', name: w('Pé', 'Foot'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.03, largura/2 - 0.07)', y: 'if(i < 2, -profundidade/2 + 0.03, profundidade/2 - 0.07)', z: 0, w: 0.04, d: 0.04, h: 0.06, material: 'oak' },
    // The changing top: a raised rim on three sides round a padded mat.
    { kind: 'box', name: w('Borda', 'Rim'), x: '-largura/2', y: 'profundidade/2 - 0.03', z: 'altura', w: 'largura', d: 0.03, h: 0.1, material: 'matCorpo' },
    { kind: 'box', name: w('Borda', 'Rim'), repeat: { count: 2, dx: 'largura - 0.03' }, x: '-largura/2', y: '-profundidade/2', z: 'altura', w: 0.03, d: 'profundidade - 0.03', h: 0.1, material: 'matCorpo' },
    { kind: 'box', name: w('Colchonete', 'Pad'), x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.01', z: 'altura', w: 'largura - 0.08', d: 'profundidade - 0.05', h: 0.06, material: 'matTrocador', round: 0.025 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'white', name: w('Branca, 3 gavetas', 'White, 3 drawers'), values: {} },
    { id: 'oak', name: w('Carvalho, 4 gavetas', 'Oak, 4 drawers'), values: { gavetas: 4, matCorpo: 'oak' } },
  ],
};

// ---------- Commerce ----------

export const RECEPTION_DESK: ObjectDefinition = {
  id: 'def_reception_desk',
  name: w('Balcão de recepção', 'Reception desk'),
  category: 'casework',
  folder: 'Comercial',
  params: [
    len('largura', 'Largura', 'Width', 2.2, 1.2, 4),
    len('profundidade', 'Profundidade', 'Depth', 0.75, 0.6, 0.9),
    len('altura', 'Altura do balcão', 'Counter height', 1.1, 1, 1.2),
    yes('lateral', 'Com retorno lateral (L)', 'With a return (L)', 1),
    len('retorno', 'Comprimento do retorno', 'Return length', 1.2, 0.6, 2, BUILD),
    yes('acessivel', 'Trecho rebaixado acessível', 'Lowered accessible part', 1),
    mat('matFrente', 'Frente', 'Front', 'woodSlats'),
    mat('matTampo', 'Tampos', 'Tops', 'quartz'),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerWhite'),
  ],
  parts: [
    // The front panel to the visitors (−y), its raised top; the lower work top behind it.
    { kind: 'box', name: w('Painel frontal', 'Front panel'), x: '-largura/2', y: '-profundidade/2', z: 0.05, w: 'largura - acessivel * 0.9', d: 0.05, h: 'altura - 0.07', material: 'matFrente' },
    { kind: 'box', name: w('Tampo alto', 'Transaction top'), x: '-largura/2 - 0.02', y: '-profundidade/2 - 0.06', z: 'altura - 0.025', w: 'largura - acessivel * 0.9 + 0.02', d: 0.3, h: 0.025, material: 'matTampo' },
    { kind: 'box', name: w('Rodapé', 'Plinth'), x: '-largura/2', y: '-profundidade/2 + 0.04', z: 0, w: 'largura', d: 0.04, h: 0.05, material: 'plasticBlack' },
    // The accessible part, 90 cm wide at 75 cm (NBR 9050), at the right end.
    { kind: 'box', name: w('Painel rebaixado', 'Lowered panel'), when: 'acessivel', x: 'largura/2 - 0.9', y: '-profundidade/2', z: 0.05, w: 0.9, d: 0.05, h: 0.68, material: 'matFrente' },
    { kind: 'box', name: w('Tampo rebaixado', 'Lowered top'), when: 'acessivel', x: 'largura/2 - 0.9', y: '-profundidade/2 - 0.06', z: 0.73, w: 0.92, d: 'profundidade + 0.06', h: 0.025, material: 'matTampo' },
    { kind: 'box', name: w('Tampo de trabalho', 'Work top'), x: '-largura/2', y: '-profundidade/2 + 0.05', z: 0.73, w: 'largura - acessivel * 0.9', d: 'profundidade - 0.05', h: 0.025, material: 'matTampo' },
    { kind: 'box', name: w('Gaveteiro', 'Drawer unit'), x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.1', z: 0.05, w: 0.45, d: 'profundidade - 0.15', h: 0.68, material: 'matCorpo' },
    // The return, on the left, at the work top's height.
    { kind: 'box', name: w('Retorno', 'Return'), when: 'lateral', x: '-largura/2', y: 'profundidade/2', z: 0.05, w: 0.05, d: 'retorno', h: 0.68, material: 'matFrente' },
    { kind: 'box', name: w('Tampo do retorno', 'Return top'), when: 'lateral', x: '-largura/2', y: 'profundidade/2', z: 0.73, w: 0.6, d: 'retorno', h: 0.025, material: 'matTampo' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'l', name: w('Em L, ripado, acessível', 'L-shaped, slatted, accessible'), values: {} },
    { id: 'straight', name: w('Reto, branco', 'Straight, white'), values: { lateral: 0, matFrente: 'lacquerWhite', matTampo: 'marble' } },
  ],
  rules: [{ when: 'acessivel == 0', message: w('NBR 9050: balcão de atendimento precisa de trecho a até 90 cm (75 a 85)', 'NBR 9050: a service counter needs a part no higher than 90 cm (75 to 85)') }],
};

export const GONDOLA: ObjectDefinition = {
  id: 'def_gondola',
  name: w('Gôndola com produtos', 'Shop gondola with goods'),
  category: 'casework',
  folder: 'Comercial',
  params: [
    len('largura', 'Comprimento', 'Length', 1.8, 0.9, 3.6),
    len('profundidade', 'Profundidade (dois lados)', 'Depth (both sides)', 0.9, 0.4, 1.2),
    len('altura', 'Altura', 'Height', 1.6, 1.2, 2.2),
    counted('prateleiras', 'Prateleiras', 'Shelves', 'max(3, floor((altura - 0.15) / 0.35))'),
    yes('produtos', 'Com produtos', 'With goods', 1),
    mat('matEstrutura', 'Estrutura', 'Frame', 'lacquerWhite'),
  ],
  parts: [
    { kind: 'box', name: w('Base', 'Base'), x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 0.12, material: 'matEstrutura' },
    { kind: 'box', name: w('Painel central', 'Back panel'), x: '-largura/2', y: -0.02, z: 0.12, w: 'largura', d: 0.04, h: 'altura - 0.12', material: 'matEstrutura' },
    // Shelves both sides, sloping down a little to the front.
    { kind: 'box', name: w('Prateleira', 'Shelf'), repeat: { count: 'prateleiras * 2' }, x: '-largura/2', y: 'if(i % 2 == 0, -profundidade/2, 0.02)', z: '0.12 + (floor(i / 2) + 1) * (altura - 0.15) / (prateleiras + 0.3)', w: 'largura', d: 'profundidade/2 - 0.02', h: 0.02, material: 'matEstrutura' },
    // Goods: rows of packs on each shelf, of varied sizes, in three colours.
    ...[0, 1, 2].map((k) => ({
      kind: 'box' as const,
      name: w('Produto', 'Product'),
      when: `produtos && i % 3 == ${k}`,
      repeat: { count: 'floor(largura / 0.12) * (prateleiras * 2 + 2)' },
      x: '-largura/2 + 0.02 + (i % floor(largura / 0.12)) * 0.12',
      y: 'if(floor(i / floor(largura / 0.12)) % 2 == 0, -profundidade/2 + 0.04, 0.06)',
      z: '0.12 + floor(floor(i / floor(largura / 0.12)) / 2) * (altura - 0.15) / (prateleiras + 0.3) + if(floor(i / floor(largura / 0.12)) < 2, 0, 0.02)',
      w: '0.09 + ((i * 7) % 3) * 0.008',
      d: 'profundidade/2 - 0.12',
      // No taller than the gap to the shelf above, nor, on the top shelf, than the frame.
      h: 'min(0.14 + ((i * 5) % 4) * 0.03, (altura - 0.15) / (prateleiras + 0.3) - 0.05, altura - 0.15 - floor(floor(i / floor(largura / 0.12)) / 2) * (altura - 0.15) / (prateleiras + 0.3))',
      material: ['lacquerTerracotta', 'lacquerSage', 'plasticWhite'][k]!,
      round: 0.006,
    })),
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'goods', name: w('Com produtos', 'With goods'), values: {} },
    { id: 'empty', name: w('Vazia, simples (parede)', 'Empty, single-sided'), values: { produtos: 0, profundidade: 0.45 } },
  ],
};

export const BOOTH: ObjectDefinition = {
  id: 'def_booth',
  name: w('Mesa de restaurante com bancos', 'Restaurant booth'),
  category: 'furniture',
  folder: 'Comercial',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.8, 2),
    len('profundidade', 'Profundidade total', 'Overall depth', 1.8, 1.5, 2.2),
    len('altura', 'Altura do encosto', 'Back height', 1.1, 0.9, 1.4),
    mat('matEstofado', 'Estofado', 'Upholstery', 'leather'),
    mat('matTampo', 'Tampo', 'Top', 'walnut'),
    mat('matBase', 'Base', 'Base', 'blackSteel'),
  ],
  parts: [
    // Two benches back to back with the table, each a seat and a tall back.
    { kind: 'box', name: w('Banco', 'Bench'), repeat: { count: 2, dy: 'profundidade - 0.5' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 0.5, h: 0.32, material: 'matBase' },
    { kind: 'box', name: w('Assento', 'Seat'), repeat: { count: 2, dy: 'profundidade - 0.5' }, x: '-largura/2 + 0.01', y: '-profundidade/2 + 0.01', z: 0.32, w: 'largura - 0.02', d: 0.46, h: 0.12, material: 'matEstofado', round: 0.04 },
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2', y: '-profundidade/2', z: 0.32, w: 'largura', d: 0.12, h: 'altura - 0.32', tilt: -6, material: 'matEstofado', round: 0.04 },
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2', y: 'profundidade/2 - 0.12', z: 0.32, w: 'largura', d: 0.12, h: 'altura - 0.32', tilt: 6, material: 'matEstofado', round: 0.04 },
    // Capitonné lines down the backs.
    { kind: 'box', name: w('Gomo', 'Channel'), repeat: { count: 'floor(largura / 0.2) * 2' }, x: '-largura/2 + 0.1 + (i % floor(largura / 0.2)) * 0.2', y: 'if(i < floor(largura / 0.2), -profundidade/2 + 0.125, profundidade/2 - 0.135)', z: 0.47, w: 0.008, d: 0.012, h: 'altura - 0.52', tilt: 'if(i < floor(largura / 0.2), -6, 6)', material: 'graniteBlack' },
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2 + 0.05', y: -0.35, z: 0.72, w: 'largura - 0.1', d: 0.7, h: 0.03, material: 'matTampo', round: 0.006 },
    { kind: 'cylinder', name: w('Coluna', 'Column'), x: 0, y: 0, z: 0.02, r: 0.04, h: 0.7, material: 'matBase' },
    { kind: 'box', name: w('Pé', 'Foot'), x: -0.25, y: -0.25, z: 0, w: 0.5, d: 0.5, h: 0.02, material: 'matBase', round: 0.006 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'leather', name: w('Couro e nogueira', 'Leather and walnut'), values: {} },
    { id: 'velvet', name: w('Veludo verde, mármore', 'Green velvet, marble'), values: { matEstofado: 'velvet', matTampo: 'marble', matBase: 'brass' } },
  ],
};

export const CLOTHES_RACK: ObjectDefinition = {
  id: 'def_clothes_rack',
  name: w('Arara de roupas', 'Clothes rack'),
  category: 'furniture',
  folder: 'Comercial',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.6, 2),
    len('altura', 'Altura', 'Height', 1.6, 1.3, 1.9),
    derived('profundidade', 'Profundidade', 'Depth', '0.45'),
    counted('pecas', 'Peças penduradas', 'Garments', 'floor((largura - 0.1) / 0.07)'),
    mat('matMetal', 'Metal', 'Metal', 'brass'),
  ],
  parts: [
    // Two uprights on feet, the rail between them.
    { kind: 'cylinder', name: w('Montante', 'Upright'), repeat: { count: 2, dx: 'largura' }, x: '-largura/2', y: 0, z: 0, r: 0.012, h: 'altura', material: 'matMetal' },
    { kind: 'box', name: w('Pé', 'Foot'), repeat: { count: 2, dx: 'largura' }, x: '-largura/2 - 0.012', y: -0.22, z: 0, w: 0.024, d: 0.44, h: 0.02, material: 'matMetal', round: 0.008 },
    { kind: 'cylinder', name: w('Barra', 'Rail'), x: '-largura/2', y: 0, z: 'altura - 0.01', r: 0.011, h: 'largura', roll: 90, material: 'matMetal' },
    // Garments on hangers: the hook over the rail, the hanger's two sloping arms, the garment's rounded
    // shoulders, its body and its two sleeves hanging at the sides (long and short, three colours).
    { kind: 'cylinder', name: w('Gancho', 'Hook'), repeat: { count: 'pecas', dx: 0.07 }, x: '-largura/2 + 0.0525', y: 0, z: 'altura - 0.075', r: 0.003, h: 0.075, material: 'chrome' },
    { kind: 'box', name: w('Braço do cabide', 'Hanger arm'), repeat: { count: 'pecas * 2' }, x: '-largura/2 + 0.0495 + floor(i / 2) * 0.07', y: 'if(i % 2 == 0, -0.2, 0)', z: 'altura - 0.1 + if(i % 2 == 0, 0, 0.018)', w: 0.006, d: 0.2, h: 0.012, tilt: 'if(i % 2 == 0, -5, 5)', material: 'oak', round: 0.003 },
    ...[0, 1, 2].flatMap((k) => {
      const material = ['linen', 'lacquerTerracotta', 'velvet'][k]!;
      const when = `i % 3 == ${k}`;
      const long = '(0.55 + ((i * 7) % 4) * 0.12)';
      return [
        { kind: 'sphere' as const, name: w('Ombros', 'Shoulders'), when, repeat: { count: 'pecas', dx: 0.07 }, x: '-largura/2 + 0.0525', y: 0, z: 'altura - 0.2', r: 0.017, d: 0.2, h: 0.1, material },
        { kind: 'box' as const, name: w('Peça', 'Garment'), when, repeat: { count: 'pecas', dx: 0.07 }, x: '-largura/2 + 0.037', y: -0.17, z: `altura - 0.15 - ${long}`, w: 0.031, d: 0.34, h: `${long} - 0.02`, material, round: 0.012 },
        { kind: 'box' as const, name: w('Manga', 'Sleeve'), when: `floor(i / 2) % 3 == ${k}`, repeat: { count: 'pecas * 2' }, x: '-largura/2 + 0.04 + floor(i / 2) * 0.07', y: 'if(i % 2 == 0, -0.215, 0.155)', z: `altura - 0.17 - ${long} * 0.55`.replace(/\bi\b/g, 'floor(i / 2)'), w: 0.025, d: 0.06, h: `${long} * 0.55`.replace(/\bi\b/g, 'floor(i / 2)'), tilt: 'if(i % 2 == 0, -3, 3)', material, round: 0.01 },
      ];
    }),
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 }],
  types: [
    { id: 'brass', name: w('Latão com roupas', 'Brass with clothes'), values: {} },
    { id: 'black', name: w('Preta 1,8 m', 'Black 1.8 m'), values: { largura: 1.8, matMetal: 'blackSteel' } },
  ],
};

// ---------- Health ----------

export const HOSPITAL_BED: ObjectDefinition = {
  id: 'def_hospital_bed',
  name: w('Cama hospitalar', 'Hospital bed'),
  category: 'furniture',
  folder: 'Saúde',
  params: [
    len('largura', 'Largura', 'Width', 1, 0.9, 1.1),
    len('profundidade', 'Comprimento', 'Length', 2.15, 2, 2.3),
    len('altura', 'Altura do colchão', 'Mattress height', 0.6, 0.4, 0.85),
    num('cabeceira', 'Elevação do encosto (°)', 'Backrest raised (°)', 30, 0, 70, 5),
    yes('grades', 'Grades laterais', 'Side rails', 1),
    yes('suporte', 'Suporte de soro', 'IV pole', 1),
    mat('matEstrutura', 'Estrutura', 'Frame', 'plasticWhite'),
    mat('matColchao', 'Colchão', 'Mattress', 'velvet'),
  ],
  parts: [
    { kind: 'sphere', name: w('Rodízio', 'Caster'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.08, largura/2 - 0.08)', y: 'if(i < 2, -profundidade/2 + 0.12, profundidade/2 - 0.12)', z: 0, r: 0.06, h: 0.12, material: 'plasticBlack' },
    { kind: 'box', name: w('Chassi', 'Base frame'), x: '-largura/2 + 0.05', y: '-profundidade/2 + 0.08', z: 0.12, w: 'largura - 0.1', d: 'profundidade - 0.16', h: 0.1, material: 'aluminium', round: 0.02 },
    { kind: 'box', name: w('Coluna', 'Lift'), repeat: { count: 2, dy: 'profundidade * 0.5' }, x: -0.08, y: '-profundidade * 0.3', z: 0.22, w: 0.16, d: 0.12, h: 'altura - 0.38', material: 'aluminium' },
    { kind: 'box', name: w('Estrado', 'Deck'), x: '-largura/2', y: '-profundidade/2 + 0.05', z: 'altura - 0.16', w: 'largura', d: 'profundidade - 0.1', h: 0.04, material: 'matEstrutura' },
    // The mattress: its foot part flat, its back part raised with the backrest.
    { kind: 'box', name: w('Colchão (pés)', 'Mattress (legs)'), x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.06', z: 'altura - 0.12', w: 'largura - 0.06', d: 'profundidade * 0.55', h: 0.12, material: 'matColchao', round: 0.04 },
    { kind: 'box', name: w('Colchão (encosto)', 'Mattress (back)'), x: '-largura/2 + 0.03', y: '-profundidade/2 + 0.06 + profundidade * 0.55', z: 'altura - 0.12', w: 'largura - 0.06', d: 0.12, h: 'profundidade * 0.38', tilt: '90 - cabeceira', material: 'matColchao', round: 0.04 },
    // Head and foot boards, the side rails.
    { kind: 'box', name: w('Cabeceira', 'Headboard'), x: '-largura/2', y: 'profundidade/2 - 0.05', z: 'altura - 0.2', w: 'largura', d: 0.04, h: 0.6, material: 'matEstrutura', round: 0.015 },
    { kind: 'box', name: w('Peseira', 'Footboard'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.2', w: 'largura', d: 0.04, h: 0.45, material: 'matEstrutura', round: 0.015 },
    // Side rails as frames each side: two posts and three tubes between them.
    { kind: 'box', name: w('Montante da grade', 'Side rail post'), when: 'grades', repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 - 0.03, largura/2 + 0.01)', y: '-profundidade/2 + profundidade * 0.5 + floor(i / 2) * (profundidade * 0.4 - 0.025)', z: 'altura - 0.12', w: 0.02, d: 0.025, h: 0.4, material: 'matEstrutura', round: 0.008 },
    { kind: 'box', name: w('Tubo da grade', 'Side rail tube'), when: 'grades', repeat: { count: 6 }, x: 'if(i % 2 == 0, -largura/2 - 0.03, largura/2 + 0.01)', y: '-profundidade/2 + profundidade * 0.5', z: 'altura + 0.02 + floor(i / 2) * 0.11', w: 0.02, d: 'profundidade * 0.4', h: 0.02, material: 'matEstrutura', round: 0.009 },
    // The IV pole at the head, its hooks.
    { kind: 'cylinder', name: w('Suporte de soro', 'IV pole'), when: 'suporte', x: 'largura/2 - 0.02', y: 'profundidade/2 - 0.03', z: 'altura - 0.2', r: 0.01, h: 1.4, material: 'stainless' },
    { kind: 'box', name: w('Gancho', 'Hook'), when: 'suporte', x: 'largura/2 - 0.12', y: 'profundidade/2 - 0.035', z: 'altura + 1.18', w: 0.2, d: 0.01, h: 0.01, material: 'stainless' },
    { kind: 'box', name: w('Bolsa de soro', 'IV bag'), when: 'suporte', x: 'largura/2 - 0.11', y: 'profundidade/2 - 0.045', z: 'altura + 0.95', w: 0.08, d: 0.03, h: 0.2, material: 'frostedGlass', round: 0.012 },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'std', name: w('Encosto elevado, com soro', 'Back raised, IV pole'), values: {} },
    { id: 'flat', name: w('Plana, sem grades', 'Flat, no rails'), values: { cabeceira: 0, grades: 0, suporte: 0 } },
  ],
};

export const EXAM_COUCH: ObjectDefinition = {
  id: 'def_exam_couch',
  name: w('Maca de exame', 'Examination couch'),
  category: 'furniture',
  folder: 'Saúde',
  params: [
    len('largura', 'Largura', 'Width', 0.6, 0.55, 0.75),
    len('profundidade', 'Comprimento', 'Length', 1.85, 1.7, 2),
    len('altura', 'Altura', 'Height', 0.8, 0.7, 0.9),
    num('cabeceira', 'Elevação da cabeceira (°)', 'Head raised (°)', 25, 0, 60, 5),
    yes('escada', 'Escada de dois degraus', 'Two-step stool', 1),
    mat('matEstofado', 'Estofado', 'Padding', 'leatherBlack'),
    mat('matEstrutura', 'Estrutura', 'Frame', 'stainless'),
  ],
  parts: [
    { kind: 'box', name: w('Pé', 'Leg'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.02, largura/2 - 0.05)', y: 'if(i < 2, -profundidade/2 + 0.05, profundidade/2 - 0.08)', z: 0, w: 0.03, d: 0.03, h: 'altura - 0.08', material: 'matEstrutura' },
    { kind: 'box', name: w('Travessa', 'Stretcher'), repeat: { count: 2, dx: 'largura - 0.07' }, x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.05', z: 0.15, w: 0.03, d: 'profundidade - 0.1', h: 0.03, material: 'matEstrutura' },
    { kind: 'box', name: w('Estofado', 'Pad'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.08', w: 'largura', d: 'profundidade * 0.7', h: 0.08, material: 'matEstofado', round: 0.02 },
    { kind: 'box', name: w('Cabeceira', 'Head section'), x: '-largura/2', y: '-profundidade/2 + profundidade * 0.7', z: 'altura - 0.08', w: 'largura', d: 0.08, h: 'profundidade * 0.3', tilt: '90 - cabeceira', material: 'matEstofado', round: 0.02 },
    // A two-step stool at the foot: the low step out in front on short legs, the high step behind it on
    // tall legs, each a frame with a rubber tread; rails tie the legs low down.
    { kind: 'box', name: w('Degrau', 'Step'), when: 'escada', repeat: { count: 2, dz: 0.2 }, x: -0.2, y: '-profundidade/2 - 0.47 + i * 0.16', z: 0.18, w: 0.4, d: 0.16, h: 0.025, material: 'matEstrutura', round: 0.006 },
    { kind: 'box', name: w('Piso do degrau', 'Tread'), when: 'escada', repeat: { count: 2, dz: 0.2 }, x: -0.185, y: '-profundidade/2 - 0.46 + i * 0.16', z: 0.205, w: 0.37, d: 0.14, h: 0.006, material: 'rubber' },
    { kind: 'box', name: w('Pé da escada', 'Stool leg'), when: 'escada', repeat: { count: 6 }, x: 'if(i % 2 == 0, -0.2, 0.18)', y: '-profundidade/2 - 0.47 + floor(i / 2) * 0.14', z: 0, w: 0.02, d: 0.02, h: 'if(floor(i / 2) == 0, 0.18, 0.38)', material: 'matEstrutura' },
    { kind: 'box', name: w('Travessa da escada', 'Stool rail'), when: 'escada', repeat: { count: 2, dx: 0.38 }, x: -0.2, y: '-profundidade/2 - 0.47', z: 0.06, w: 0.02, d: 0.3, h: 0.02, material: 'matEstrutura' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'std', name: w('Courvin preto, com escada', 'Black leatherette, with stool'), values: {} },
    { id: 'white', name: w('Branca, sem escada', 'White, no stool'), values: { escada: 0, matEstofado: 'plasticWhite' } },
  ],
};

export const WHEELCHAIR: ObjectDefinition = {
  id: 'def_wheelchair',
  name: w('Cadeira de rodas', 'Wheelchair'),
  category: 'equipment',
  folder: 'Saúde',
  params: [
    len('largura', 'Largura', 'Width', 0.65, 0.55, 0.75),
    len('profundidade', 'Comprimento', 'Length', 1.05, 0.9, 1.2),
    yes('modulo', 'Mostrar módulo de referência (0,80 × 1,20)', 'Show the reference module (0.80 × 1.20)', 1),
    mat('matEstofado', 'Assento e encosto', 'Seat and back', 'fabric'),
    mat('matEstrutura', 'Estrutura', 'Frame', 'aluminium'),
  ],
  parts: [
    // Big rear wheels with their push rims, small front casters.
    { kind: 'cylinder', name: w('Roda', 'Wheel'), repeat: { count: 2, dx: 'largura - 0.025' }, x: '-largura/2', y: 'profundidade/2 - 0.3', z: 0.3, r: 0.3, h: 0.025, roll: 90, material: 'rubber' },
    { kind: 'cylinder', name: w('Aro', 'Push rim'), repeat: { count: 2, dx: 'largura + 0.035' }, x: '-largura/2 - 0.03', y: 'profundidade/2 - 0.3', z: 0.3, r: 0.27, h: 0.008, roll: 90, material: 'matEstrutura' },
    { kind: 'cylinder', name: w('Cubo', 'Hub'), repeat: { count: 2, dx: 'largura - 0.05' }, x: '-largura/2 - 0.005', y: 'profundidade/2 - 0.3', z: 0.3, r: 0.04, h: 0.06, roll: 90, material: 'matEstrutura' },
    { kind: 'cylinder', name: w('Rodízio', 'Caster'), repeat: { count: 2, dx: 'largura - 0.17' }, x: '-largura/2 + 0.07', y: '-profundidade/2 + 0.15', z: 0.08, r: 0.08, h: 0.03, roll: 90, material: 'rubber' },
    // The frame: side tubes, the seat sling, the back, the footrests.
    { kind: 'box', name: w('Tubo lateral', 'Side tube'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.12', z: 0.48, w: 0.025, d: 'profundidade - 0.3', h: 0.025, material: 'matEstrutura', round: 0.012 },
    { kind: 'box', name: w('Assento', 'Seat'), x: '-largura/2 + 0.06', y: '-profundidade/2 + 0.32', z: 0.48, w: 'largura - 0.12', d: 0.44, h: 0.03, material: 'matEstofado', round: 0.01 },
    { kind: 'box', name: w('Encosto', 'Back'), x: '-largura/2 + 0.06', y: 'profundidade/2 - 0.32', z: 0.5, w: 'largura - 0.12', d: 0.03, h: 0.42, tilt: 8, material: 'matEstofado', round: 0.01 },
    { kind: 'box', name: w('Manopla', 'Push handle'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: 'profundidade/2 - 0.3', z: 0.5, w: 0.025, d: 0.025, h: 0.48, tilt: 8, material: 'matEstrutura' },
    { kind: 'box', name: w('Apoio de pés', 'Footplate'), repeat: { count: 2, dx: '(largura - 0.14) / 2' }, x: '-largura/2 + 0.07', y: '-profundidade/2 + 0.02', z: 0.12, w: '(largura - 0.14) / 2 - 0.02', d: 0.14, h: 0.015, material: 'plasticBlack' },
    { kind: 'box', name: w('Haste do apoio', 'Footrest hanger'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.1', z: 0.13, w: 0.02, d: 0.02, h: 0.38, tilt: 18, material: 'matEstrutura' },
    { kind: 'box', name: w('Tubo dianteiro', 'Front post'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.04', y: '-profundidade/2 + 0.14', z: 0.12, w: 0.025, d: 0.025, h: 0.38, material: 'matEstrutura' },
    { kind: 'box', name: w('Braço', 'Armrest'), repeat: { count: 2, dx: 'largura - 0.12' }, x: '-largura/2 + 0.035', y: '-profundidade/2 + 0.34', z: 0.7, w: 0.035, d: 0.36, h: 0.04, material: 'plasticBlack', round: 0.012 },
    { kind: 'box', name: w('Suporte do braço', 'Armrest post'), repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.04, largura/2 - 0.065)', y: 'if(i < 2, -profundidade/2 + 0.36, -profundidade/2 + 0.66)', z: 0.5, w: 0.025, d: 0.025, h: 0.2, material: 'matEstrutura' },
    // The NBR 9050 reference module on the floor, faint.
    { kind: 'box', name: w('Módulo de referência', 'Reference module'), when: 'modulo', x: -0.4, y: -0.6, z: 0, w: 0.8, d: 1.2, h: 0.002, material: 'frostedGlass' },
  ],
  handles: [],
  types: [
    { id: 'module', name: w('Com módulo de referência', 'With reference module'), values: {} },
    { id: 'chair', name: w('Só a cadeira', 'Chair only'), values: { modulo: 0 } },
  ],
};

// ---------- School ----------

export const SCHOOL_DESKS: ObjectDefinition = {
  id: 'def_school_desks',
  name: w('Carteiras escolares', 'School desks'),
  category: 'furniture',
  folder: 'Escolar',
  params: [
    int('fileiras', 'Fileiras', 'Rows', 1, 1, 8),
    int('colunas', 'Carteiras por fileira', 'Desks a row', 1, 1, 8),
    len('espacoX', 'Distância entre carteiras', 'Desk spacing', 0.75, 0.6, 1.2, BUILD),
    len('espacoY', 'Distância entre fileiras', 'Row spacing', 1.2, 0.9, 1.6, BUILD),
    derived('largura', 'Largura total', 'Overall width', '0.6 + (colunas - 1) * espacoX'),
    derived('profundidade', 'Profundidade total', 'Overall depth', '0.9 + (fileiras - 1) * espacoY'),
    mat('matTampo', 'Tampo e assento', 'Top and seat', 'oak'),
    mat('matEstrutura', 'Estrutura', 'Frame', 'lacquerSage'),
  ],
  parts: [
    // Each desk at its row and column, facing the front (−y): a top on four tubular legs joined by rails, a
    // book tray under the top; its chair behind it on four legs, the back legs rising to carry the backrest.
    { kind: 'box', name: w('Tampo', 'Top'), repeat: { count: 'fileiras * colunas' }, x: '-largura/2 + (i % colunas) * espacoX + 0', y: '-profundidade/2 + floor(i / colunas) * espacoY + 0', z: 0.74, w: 0.6, d: 0.45, h: 0.018, material: 'matTampo', round: 0.006 },
    { kind: 'box', name: w('Pé da mesa', 'Desk leg'), repeat: { count: 'fileiras * colunas * 4' }, x: '-largura/2 + (floor(i / 4) % colunas) * espacoX + 0.03 + (i % 2) * 0.515', y: '-profundidade/2 + floor(floor(i / 4) / colunas) * espacoY + 0.03 + floor((i % 4) / 2) * 0.365', z: 0, w: 0.025, d: 0.025, h: 0.74, material: 'matEstrutura', round: 0.005 },
    { kind: 'box', name: w('Travessa da mesa', 'Desk rail'), repeat: { count: 'fileiras * colunas * 2' }, x: '-largura/2 + (floor(i / 2) % colunas) * espacoX + 0.0325 + (i % 2) * 0.515', y: '-profundidade/2 + floor(floor(i / 2) / colunas) * espacoY + 0.055', z: 0.12, w: 0.02, d: 0.34, h: 0.02, material: 'matEstrutura', round: 0.005 },
    { kind: 'box', name: w('Porta-livros', 'Book tray'), repeat: { count: 'fileiras * colunas' }, x: '-largura/2 + (i % colunas) * espacoX + 0.055', y: '-profundidade/2 + floor(i / colunas) * espacoY + 0.055', z: 0.62, w: 0.49, d: 0.34, h: 0.012, material: 'matEstrutura' },
    { kind: 'box', name: w('Lateral do porta-livros', 'Book tray side'), repeat: { count: 'fileiras * colunas * 2' }, x: '-largura/2 + (floor(i / 2) % colunas) * espacoX + 0.055 + (i % 2) * 0.47', y: '-profundidade/2 + floor(floor(i / 2) / colunas) * espacoY + 0.055', z: 0.632, w: 0.02, d: 0.34, h: 0.1, material: 'matEstrutura' },
    // Closed at the front; open only to the chair (+y), where the pupil reaches in.
    { kind: 'box', name: w('Frente do porta-livros', 'Book tray front'), repeat: { count: 'fileiras * colunas' }, x: '-largura/2 + (i % colunas) * espacoX + 0.055', y: '-profundidade/2 + floor(i / colunas) * espacoY + 0.055', z: 0.632, w: 0.49, d: 0.02, h: 0.1, material: 'matEstrutura' },
    { kind: 'box', name: w('Assento', 'Seat'), repeat: { count: 'fileiras * colunas' }, x: '-largura/2 + (i % colunas) * espacoX + 0.1', y: '-profundidade/2 + floor(i / colunas) * espacoY + 0.5', z: 0.43, w: 0.4, d: 0.38, h: 0.015, material: 'matTampo', round: 0.006 },
    { kind: 'box', name: w('Pé da cadeira', 'Chair leg'), repeat: { count: 'fileiras * colunas * 4' }, x: '-largura/2 + (floor(i / 4) % colunas) * espacoX + 0.11 + (i % 2) * 0.36', y: '-profundidade/2 + floor(floor(i / 4) / colunas) * espacoY + 0.51 + floor((i % 4) / 2) * 0.34', z: 0, w: 0.02, d: 0.02, h: 0.43, material: 'matEstrutura', round: 0.004 },
    { kind: 'box', name: w('Travessa da cadeira', 'Chair rail'), repeat: { count: 'fileiras * colunas * 2' }, x: '-largura/2 + (floor(i / 2) % colunas) * espacoX + 0.11 + (i % 2) * 0.36', y: '-profundidade/2 + floor(floor(i / 2) / colunas) * espacoY + 0.53', z: 0.15, w: 0.02, d: 0.32, h: 0.015, material: 'matEstrutura', round: 0.004 },
    { kind: 'box', name: w('Haste do encosto', 'Back post'), repeat: { count: 'fileiras * colunas * 2' }, x: '-largura/2 + (floor(i / 2) % colunas) * espacoX + 0.11 + (i % 2) * 0.36', y: '-profundidade/2 + floor(floor(i / 2) / colunas) * espacoY + 0.85', z: 0.43, w: 0.02, d: 0.02, h: 0.42, tilt: 8, material: 'matEstrutura', round: 0.004 },
    { kind: 'box', name: w('Encosto', 'Back'), repeat: { count: 'fileiras * colunas' }, x: '-largura/2 + (i % colunas) * espacoX + 0.09', y: '-profundidade/2 + floor(i / colunas) * espacoY + 0.868', z: 0.6, w: 0.42, d: 0.014, h: 0.2, tilt: 8, material: 'matTampo', round: 0.005 },
  ],
  handles: [],
  types: [
    { id: 'one', name: w('Uma carteira', 'One desk'), values: {} },
    { id: 'class30', name: w('Sala com 30 (5 × 6)', 'Classroom of 30 (5 × 6)'), values: { fileiras: 6, colunas: 5 } },
    { id: 'class20', name: w('Sala com 20 (4 × 5)', 'Classroom of 20 (4 × 5)'), values: { fileiras: 5, colunas: 4 } },
  ],
};

export const WHITEBOARD: ObjectDefinition = {
  id: 'def_whiteboard',
  name: w('Lousa / quadro branco', 'Whiteboard'),
  category: 'equipment',
  folder: 'Escolar',
  params: [
    choice('tipo', 'Tipo', 'Kind', [['Quadro branco', 'Whiteboard'], ['Lousa verde', 'Chalkboard']]),
    len('largura', 'Largura', 'Width', 3, 0.9, 6),
    len('altura', 'Altura', 'Height', 1.2, 0.6, 1.5),
    len('base', 'Altura da borda inferior', 'Lower edge height', 0.9, 0.6, 1.1),
    mat('matMoldura', 'Moldura', 'Frame', 'aluminium'),
  ],
  parts: [
    { kind: 'box', name: w('Moldura', 'Frame'), x: '-largura/2', y: -0.03, z: 'base', w: 'largura', d: 0.03, h: 'altura', material: 'matMoldura', round: 0.006 },
    ...[['tipo == 0', 'lacquerWhite'], ['tipo == 1', 'lacquerSage']].map(([when, material]) => ({ kind: 'box' as const, name: w('Superfície', 'Surface'), when: when!, x: '-largura/2 + 0.025', y: -0.032, z: 'base + 0.025', w: 'largura - 0.05', d: 0.003, h: 'altura - 0.05', material: material! })),
    { kind: 'box', name: w('Bandeja', 'Tray'), x: '-largura/2 + 0.1', y: -0.1, z: 'base - 0.02', w: 'largura - 0.2', d: 0.08, h: 0.02, material: 'matMoldura' },
    ...['lacquerTerracotta', 'lacquerBlack', 'velvet'].map((material, k) => ({ kind: 'cylinder' as const, name: w('Marcador', 'Marker'), x: `-largura/2 + 0.3 + ${k} * 0.06`, y: -0.07, z: 'base + 0.01', r: 0.009, h: 0.13, roll: 90, material })),
    { kind: 'box', name: w('Apagador', 'Eraser'), x: 'largura/2 - 0.4', y: -0.09, z: 'base', w: 0.15, d: 0.05, h: 0.035, material: 'plasticBlack', round: 0.006 },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', 0, 'base + altura/2'], shift: 0.5 }],
  types: [
    { id: 'white', name: w('Quadro branco 3 m', 'Whiteboard 3 m'), values: {} },
    { id: 'chalk', name: w('Lousa verde 4 m, moldura de madeira', 'Chalkboard 4 m, timber frame'), values: { tipo: 1, largura: 4, matMoldura: 'oak' } },
  ],
};

export const LOCKERS: ObjectDefinition = {
  id: 'def_lockers',
  name: w('Armário de vestiário', 'Lockers'),
  category: 'casework',
  folder: 'Escolar',
  params: [
    int('colunas', 'Colunas', 'Columns', 4, 1, 10),
    int('portas', 'Portas por coluna', 'Doors a column', 2, 1, 4),
    len('profundidade', 'Profundidade', 'Depth', 0.45, 0.35, 0.55),
    len('altura', 'Altura', 'Height', 1.9, 0.9, 2),
    derived('largura', 'Largura', 'Width', 'colunas * 0.32'),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerBlack'),
    mat('matPortas', 'Portas', 'Doors', 'lacquerSage'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2 + 0.02', z: 0, w: 'largura', d: 'profundidade - 0.02', h: 'altura', material: 'matCorpo' },
    { kind: 'box', name: w('Porta', 'Door'), repeat: { count: 'colunas * portas' }, x: '-largura/2 + (i % colunas) * 0.32 + 0.004', y: '-profundidade/2', z: '0.1 + floor(i / colunas) * (altura - 0.12) / portas + 0.004', w: 0.312, d: 0.02, h: '(altura - 0.12) / portas - 0.008', material: 'matPortas' },
    // Vent slots near each door's top, a lock, a number plate.
    { kind: 'box', name: w('Ventilação', 'Vent slot'), cut: true, repeat: { count: 'colunas * portas * 4' }, x: '-largura/2 + (floor(i / 4) % colunas) * 0.32 + 0.08', y: '-profundidade/2 - 0.01', z: '0.1 + floor(floor(i / 4) / colunas) * (altura - 0.12) / portas + (altura - 0.12) / portas - 0.1 + (i % 4) * 0.018', w: 0.16, d: 0.04, h: 0.008 },
    { kind: 'cylinder', name: w('Cadeado', 'Lock'), repeat: { count: 'colunas * portas' }, x: '-largura/2 + (i % colunas) * 0.32 + 0.27', y: '-profundidade/2 - 0.001', z: '0.1 + floor(i / colunas) * (altura - 0.12) / portas + (altura - 0.12) / portas / 2', r: 0.012, h: 0.012, tilt: -90, material: 'chrome' },
    { kind: 'box', name: w('Número', 'Number plate'), repeat: { count: 'colunas * portas' }, x: '-largura/2 + (i % colunas) * 0.32 + 0.12', y: '-profundidade/2 - 0.002', z: '0.1 + floor(i / colunas) * (altura - 0.12) / portas + (altura - 0.12) / portas - 0.17', w: 0.08, d: 0.002, h: 0.04, material: 'aluminium' },
  ],
  handles: [],
  types: [
    { id: 'two', name: w('4 colunas × 2 portas', '4 columns × 2 doors'), values: {} },
    { id: 'four', name: w('6 colunas × 4 portas, cinza', '6 columns × 4 doors, grey'), values: { colunas: 6, portas: 4, matPortas: 'aluminium' } },
    { id: 'tall', name: w('3 colunas, portas inteiras', '3 columns, full-height doors'), values: { colunas: 3, portas: 1, matPortas: 'lacquerTerracotta' } },
  ],
};

export const TEACHER_DESK: ObjectDefinition = {
  id: 'def_teacher_desk',
  name: w('Mesa do professor', 'Teacher\'s desk'),
  category: 'furniture',
  folder: 'Escolar',
  params: [
    len('largura', 'Largura', 'Width', 1.4, 1, 1.8),
    len('profundidade', 'Profundidade', 'Depth', 0.7, 0.6, 0.8),
    len('altura', 'Altura', 'Height', 0.76, 0.72, 0.78),
    mat('matTampo', 'Tampo', 'Top', 'oak'),
    mat('matCorpo', 'Corpo', 'Body', 'lacquerSage'),
  ],
  parts: [
    { kind: 'box', name: w('Tampo', 'Top'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.025', w: 'largura', d: 'profundidade', h: 0.025, material: 'matTampo', round: 0.004 },
    { kind: 'box', name: w('Painel frontal', 'Modesty panel'), x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.02', z: 0.2, w: 'largura - 0.04', d: 0.018, h: 'altura - 0.225', material: 'matCorpo' },
    { kind: 'box', name: w('Gaveteiro', 'Pedestal'), x: 'largura/2 - 0.42', y: '-profundidade/2 + 0.04', z: 0, w: 0.4, d: 'profundidade - 0.06', h: 'altura - 0.025', material: 'matCorpo' },
    { kind: 'box', name: w('Gaveta', 'Drawer'), repeat: { count: 3, dz: '(altura - 0.04) / 3' }, x: 'largura/2 - 0.418', y: 'profundidade/2 - 0.012', z: 0.01, w: 0.396, d: 0.012, h: '(altura - 0.04) / 3 - 0.006', material: 'matCorpo' },
    { kind: 'box', name: w('Lateral', 'End panel'), x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.04', z: 0, w: 0.03, d: 'profundidade - 0.06', h: 'altura - 0.025', material: 'matCorpo' },
  ],
  handles: boxHandles('altura'),
  types: [{ id: 'std', name: w('Padrão', 'Standard'), values: {} }],
};

export const LIBRARY_SECTORS: readonly ObjectDefinition[] = [KIDS_TABLE, TOY_CHEST, HOUSE_BED, CHANGING_DRESSER, RECEPTION_DESK, GONDOLA, BOOTH, CLOTHES_RACK, HOSPITAL_BED, EXAM_COUCH, WHEELCHAIR, SCHOOL_DESKS, WHITEBOARD, LOCKERS, TEACHER_DESK];
