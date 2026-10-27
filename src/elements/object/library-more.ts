// The library's other categories (phase 8): a sofa and a bed, modular kitchen units, a toilet, a
// washbasin with its tap, a shower, a fridge, a cooker, a pendant lamp that lights the room, a tree and
// a potted plant. Data only, as library.ts; each with handles for its main sizes. Lengths in metres; x
// along the width and y along the depth from the centre, z up from the floor; the front faces −y.

import type { ObjectDefinition, ParamDef } from './schema';

const len = (name: string, pt: string, en: string, value: number, min: number, max: number, group: [string, string] = ['Dimensões', 'Dimensions']): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'length',
  default: value,
  min,
  max,
  step: 0.005,
  group: { pt: group[0], en: group[1] },
});
const mat = (name: string, pt: string, en: string, value: string): ParamDef => ({ name, label: { pt, en }, kind: 'material', default: value, group: { pt: 'Materiais', en: 'Materials' } });
const BUILD: [string, string] = ['Construção', 'Construction'];
const LIGHT: [string, string] = ['Luz', 'Light'];

/** The handles of an object centred on its origin: both sides in width, the front in depth, the top. */
const boxHandles = (top: string, front = '-profundidade/2') => [
  { param: 'largura', axis: 'x' as const, at: ['largura/2', 0, top] as [string, number, string], shift: 0.5 },
  { param: 'largura', axis: 'x' as const, at: ['-largura/2', 0, top] as [string, number, string], shift: 0.5, sign: -1 as const },
  { param: 'profundidade', axis: 'y' as const, at: [0, front, top] as [number, string, string], shift: 0.5, sign: -1 as const },
  { param: 'altura', axis: 'z' as const, at: [0, 0, top] as [number, number, string] },
];

export const SOFA: ObjectDefinition = {
  id: 'def_sofa',
  name: { pt: 'Sofá', en: 'Sofa' },
  category: 'furniture',
  params: [
    len('largura', 'Largura', 'Width', 2.1, 0.8, 4),
    len('profundidade', 'Profundidade', 'Depth', 0.9, 0.6, 1.4),
    len('altura', 'Altura do encosto', 'Back height', 0.8, 0.6, 1.2),
    len('assento', 'Altura do assento', 'Seat height', 0.42, 0.3, 0.55),
    len('braco', 'Largura do braço', 'Arm width', 0.18, 0, 0.35, BUILD),
    { name: 'lugares', label: { pt: 'Lugares', en: 'Seats' }, kind: 'integer', default: 3, formula: 'max(1, round((largura - 2 * braco) / 0.6))', group: { pt: 'Construção', en: 'Construction' } },
    mat('matEstofado', 'Estofado', 'Upholstery', 'fabric'),
    mat('matPes', 'Pés', 'Legs', 'wood'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Base', en: 'Base' }, x: '-largura/2', y: '-profundidade/2', z: 0.08, w: 'largura', d: 'profundidade', h: 'assento - 0.2', material: 'matEstofado' },
    {
      kind: 'box',
      name: { pt: 'Almofada', en: 'Cushion' },
      repeat: { count: 'lugares', dx: '(largura - 2 * braco) / lugares' },
      x: '-largura/2 + braco + 0.005',
      y: '-profundidade/2 + 0.02',
      z: 'assento - 0.12',
      w: '(largura - 2 * braco) / lugares - 0.01',
      d: 'profundidade - 0.24',
      h: 0.12,
      material: 'matEstofado',
    },
    { kind: 'box', name: { pt: 'Encosto', en: 'Back' }, x: '-largura/2 + braco', y: 'profundidade/2 - 0.2', z: 'assento - 0.12', w: 'largura - 2 * braco', d: 0.2, h: 'altura - assento + 0.12', material: 'matEstofado' },
    { kind: 'box', name: { pt: 'Braço', en: 'Arm' }, when: 'braco > 0', repeat: { count: 2, dx: 'largura - braco' }, x: '-largura/2', y: '-profundidade/2', z: 0.08, w: 'braco', d: 'profundidade', h: 'assento + 0.2 - 0.08', material: 'matEstofado' },
    { kind: 'cylinder', name: { pt: 'Pé', en: 'Leg' }, repeat: { count: 4 }, x: 'if(i % 2 == 0, -largura/2 + 0.06, largura/2 - 0.06)', y: 'if(i < 2, -profundidade/2 + 0.06, profundidade/2 - 0.06)', z: 0, r: 0.02, h: 0.08, material: 'matPes' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 's3', name: { pt: 'Três lugares', en: 'Three seats' }, values: { largura: 2.1 } },
    { id: 's2', name: { pt: 'Dois lugares', en: 'Two seats' }, values: { largura: 1.5 } },
  ],
  rules: [{ when: 'profundidade < 0.75', message: { pt: 'Menos de 75 cm de fundo: o assento fica raso', en: 'Less than 75 cm deep: a shallow seat' } }],
};

export const BED: ObjectDefinition = {
  id: 'def_bed',
  name: { pt: 'Cama', en: 'Bed' },
  category: 'furniture',
  params: [
    len('largura', 'Largura', 'Width', 1.6, 0.8, 2.2),
    len('profundidade', 'Comprimento', 'Length', 2.05, 1.8, 2.3),
    len('altura', 'Altura do colchão', 'Mattress top', 0.55, 0.3, 0.8),
    len('cabeceira', 'Altura da cabeceira', 'Headboard height', 1.1, 0, 1.6, BUILD),
    { name: 'travesseiros', label: { pt: 'Travesseiros', en: 'Pillows' }, kind: 'integer', default: 2, formula: 'if(largura > 1.2, 2, 1)', group: { pt: 'Construção', en: 'Construction' } },
    mat('matEstrutura', 'Estrutura', 'Frame', 'wood'),
    mat('matColchao', 'Colchão', 'Mattress', 'fabric'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Estrado', en: 'Frame' }, x: '-largura/2', y: '-profundidade/2', z: 0.1, w: 'largura', d: 'profundidade', h: 'altura - 0.3', material: 'matEstrutura' },
    { kind: 'box', name: { pt: 'Colchão', en: 'Mattress' }, x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.02', z: 'altura - 0.22', w: 'largura - 0.04', d: 'profundidade - 0.06', h: 0.22, material: 'matColchao' },
    { kind: 'box', name: { pt: 'Cabeceira', en: 'Headboard' }, when: 'cabeceira > 0', x: '-largura/2', y: 'profundidade/2', z: 0, w: 'largura', d: 0.05, h: 'cabeceira', material: 'matEstrutura' },
    {
      kind: 'box',
      name: { pt: 'Travesseiro', en: 'Pillow' },
      repeat: { count: 'travesseiros', dx: '(largura - 0.1) / travesseiros' },
      x: '-largura/2 + 0.07',
      y: 'profundidade/2 - 0.4',
      z: 'altura',
      w: '(largura - 0.1) / travesseiros - 0.04',
      d: 0.32,
      h: 0.1,
      material: 'matColchao',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
    // Its foot: the headboard stays against the wall.
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'cabeceira', axis: 'z', at: [0, 'profundidade/2', 'cabeceira'] },
  ],
  types: [
    { id: 'queen', name: { pt: 'Casal 160 × 205', en: 'Queen 160 × 205' }, values: { largura: 1.6 } },
    { id: 'double', name: { pt: 'Casal 138 × 188', en: 'Double 138 × 188' }, values: { largura: 1.38, profundidade: 1.88 } },
    { id: 'single', name: { pt: 'Solteiro 88 × 188', en: 'Single 88 × 188' }, values: { largura: 0.88, profundidade: 1.88 } },
  ],
};

export const KITCHEN: ObjectDefinition = {
  id: 'def_kitchen',
  name: { pt: 'Armário de cozinha', en: 'Kitchen units' },
  category: 'casework',
  params: [
    len('largura', 'Largura', 'Width', 2.4, 0.4, 6),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.45, 0.75),
    len('altura', 'Altura da bancada', 'Worktop height', 0.9, 0.75, 1),
    len('moduloMax', 'Largura máxima do módulo', 'Widest unit', 0.8, 0.3, 1.2, BUILD),
    len('rodape', 'Rodapé', 'Plinth', 0.1, 0.05, 0.2, BUILD),
    { name: 'aereo', label: { pt: 'Com armário aéreo', en: 'With wall units' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    { name: 'modulos', label: { pt: 'Módulos', en: 'Units' }, kind: 'integer', default: 3, formula: 'max(1, ceil(largura / moduloMax))', group: { pt: 'Construção', en: 'Construction' } },
    mat('matCorpo', 'Corpo', 'Body', 'mdfWhite'),
    mat('matPortas', 'Portas', 'Doors', 'wood'),
    mat('matBancada', 'Bancada', 'Worktop', 'concrete'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Rodapé', en: 'Plinth' }, x: '-largura/2', y: '-profundidade/2 + 0.05', z: 0, w: 'largura', d: 'profundidade - 0.05', h: 'rodape', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Corpo', en: 'Carcass' }, x: '-largura/2', y: '-profundidade/2 + 0.02', z: 'rodape', w: 'largura', d: 'profundidade - 0.02', h: 'altura - rodape - 0.03', material: 'matCorpo' },
    {
      kind: 'box',
      name: { pt: 'Porta', en: 'Door' },
      repeat: { count: 'modulos', dx: 'largura / modulos' },
      x: '-largura/2 + 0.002',
      y: '-profundidade/2',
      z: 'rodape + 0.003',
      w: 'largura / modulos - 0.004',
      d: 0.018,
      h: 'altura - rodape - 0.036',
      material: 'matPortas',
    },
    { kind: 'box', name: { pt: 'Bancada', en: 'Worktop' }, x: '-largura/2', y: '-profundidade/2 - 0.02', z: 'altura - 0.03', w: 'largura', d: 'profundidade + 0.02', h: 0.03, material: 'matBancada' },
    // Wall units over it, 60 cm above the worktop, 35 cm deep.
    { kind: 'box', name: { pt: 'Aéreo', en: 'Wall unit' }, when: 'aereo', x: '-largura/2', y: 'profundidade/2 - 0.35', z: 'altura + 0.6', w: 'largura', d: 0.35, h: 0.7, material: 'matCorpo' },
    {
      kind: 'box',
      name: { pt: 'Porta do aéreo', en: 'Wall unit door' },
      when: 'aereo',
      repeat: { count: 'modulos', dx: 'largura / modulos' },
      x: '-largura/2 + 0.002',
      y: 'profundidade/2 - 0.35 - 0.018',
      z: 'altura + 0.603',
      w: 'largura / modulos - 0.004',
      d: 0.018,
      h: 0.694,
      material: 'matPortas',
    },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'k240', name: { pt: 'Linear 240', en: 'Straight 240' }, values: { largura: 2.4 } },
    { id: 'k180', name: { pt: 'Linear 180 sem aéreo', en: 'Straight 180, no wall units' }, values: { largura: 1.8, aereo: 0 } },
  ],
  rules: [{ when: 'altura < 0.85', message: { pt: 'Bancada abaixo de 85 cm: baixa para trabalhar em pé', en: 'Worktop under 85 cm: low to work standing' } }],
};

export const TOILET: ObjectDefinition = {
  id: 'def_toilet',
  name: { pt: 'Bacia sanitária', en: 'Toilet' },
  category: 'fixture',
  params: [
    len('largura', 'Largura', 'Width', 0.38, 0.32, 0.5),
    len('profundidade', 'Projeção', 'Projection', 0.66, 0.5, 0.8),
    len('altura', 'Altura do assento', 'Seat height', 0.4, 0.36, 0.48),
    { name: 'caixa', label: { pt: 'Com caixa acoplada', en: 'With cistern' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    mat('matLouca', 'Louça', 'China', 'ceramic'),
  ],
  parts: [
    { kind: 'cylinder', name: { pt: 'Pé', en: 'Foot' }, x: 0, y: '-profundidade/2 + largura/2 + 0.04', z: 0, r: 'largura * 0.3', r2: 'largura * 0.42', h: 'altura - 0.06', material: 'matLouca' },
    { kind: 'cylinder', name: { pt: 'Bacia', en: 'Bowl' }, x: 0, y: '-profundidade/2 + largura/2 + 0.02', z: 'altura - 0.08', r: 'largura / 2', h: 0.08, material: 'matLouca' },
    { kind: 'box', name: { pt: 'Caixa acoplada', en: 'Cistern' }, when: 'caixa', x: '-largura/2 - 0.02', y: 'profundidade/2 - 0.18', z: 'altura - 0.06', w: 'largura + 0.04', d: 0.18, h: 0.4, material: 'matLouca' },
    { kind: 'box', name: { pt: 'Base', en: 'Base' }, x: '-largura * 0.3', y: '-profundidade/2 + 0.1', z: 0, w: 'largura * 0.6', d: 'profundidade - 0.12', h: 'altura - 0.06', material: 'matLouca' },
  ],
  handles: [
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'std', name: { pt: 'Com caixa acoplada', en: 'With cistern' }, values: {} },
    { id: 'pne', name: { pt: 'Acessível (46 cm)', en: 'Accessible (46 cm)' }, values: { altura: 0.46 } },
  ],
};

export const WASHBASIN: ObjectDefinition = {
  id: 'def_washbasin',
  name: { pt: 'Lavatório com bancada', en: 'Washbasin and counter' },
  category: 'fixture',
  params: [
    len('largura', 'Largura da bancada', 'Counter width', 1, 0.45, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.35, 0.65),
    len('altura', 'Altura', 'Height', 0.85, 0.7, 0.95),
    len('cuba', 'Diâmetro da cuba', 'Basin diameter', 0.4, 0.28, 0.6, BUILD),
    { name: 'gabinete', label: { pt: 'Com gabinete', en: 'With cabinet' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    mat('matBancada', 'Bancada', 'Counter', 'concrete'),
    mat('matLouca', 'Cuba', 'Basin', 'ceramic'),
    mat('matMetal', 'Torneira', 'Tap', 'metal'),
    mat('matGabinete', 'Gabinete', 'Cabinet', 'wood'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Bancada', en: 'Counter' }, x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.03', w: 'largura', d: 'profundidade', h: 0.03, material: 'matBancada' },
    { kind: 'cylinder', name: { pt: 'Cuba', en: 'Basin' }, x: 0, y: '-0.03', z: 'altura', r: 'cuba / 2 * 0.7', r2: 'cuba / 2', h: 0.14, material: 'matLouca' },
    // The tap (metais): a column at the back, its spout over the basin.
    { kind: 'cylinder', name: { pt: 'Torneira', en: 'Tap' }, x: 0, y: 'cuba / 2 + 0.03 - 0.03', z: 'altura', r: 0.018, h: 0.24, material: 'matMetal' },
    { kind: 'box', name: { pt: 'Bica', en: 'Spout' }, x: -0.012, y: 'cuba / 2 - 0.12', z: 'altura + 0.2', w: 0.024, d: 0.15, h: 0.024, material: 'matMetal' },
    { kind: 'box', name: { pt: 'Gabinete', en: 'Cabinet' }, when: 'gabinete', x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.03', z: 0.15, w: 'largura - 0.04', d: 'profundidade - 0.05', h: 'altura - 0.18', material: 'matGabinete' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'w100', name: { pt: 'Bancada 100', en: 'Counter 100' }, values: {} },
    { id: 'w60', name: { pt: 'Bancada 60 sem gabinete', en: 'Counter 60, no cabinet' }, values: { largura: 0.6, gabinete: 0 } },
  ],
};

export const SHOWER: ObjectDefinition = {
  id: 'def_shower',
  name: { pt: 'Chuveiro com box', en: 'Shower' },
  category: 'fixture',
  params: [
    len('largura', 'Largura do box', 'Enclosure width', 0.9, 0.7, 1.6),
    len('profundidade', 'Profundidade do box', 'Enclosure depth', 0.9, 0.7, 1.6),
    len('altura', 'Altura do chuveiro', 'Shower head height', 2.1, 1.8, 2.4),
    { name: 'box', label: { pt: 'Com box de vidro', en: 'With glass screen' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    mat('matMetal', 'Metais', 'Fittings', 'metal'),
    mat('matVidro', 'Box', 'Screen', 'glass'),
    mat('matPiso', 'Piso do box', 'Shower floor', 'tile'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Piso', en: 'Floor' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 0.01, material: 'matPiso' },
    // Against the back wall: the pipe up, the arm out, the head.
    { kind: 'cylinder', name: { pt: 'Cano', en: 'Pipe' }, x: 0, y: 'profundidade/2 - 0.03', z: 0.9, r: 0.012, h: 'altura - 0.9 + 0.1', material: 'matMetal' },
    { kind: 'box', name: { pt: 'Braço', en: 'Arm' }, x: -0.01, y: 'profundidade/2 - 0.3', z: 'altura + 0.08', w: 0.02, d: 0.28, h: 0.02, material: 'matMetal' },
    { kind: 'cylinder', name: { pt: 'Ducha', en: 'Head' }, x: 0, y: 'profundidade/2 - 0.3', z: 'altura', r: 0.1, r2: 0.04, h: 0.08, material: 'matMetal' },
    { kind: 'cylinder', name: { pt: 'Registro', en: 'Valve' }, x: 0, y: 'profundidade/2 - 0.03', z: 1.1, r: 0.035, h: 0.03, material: 'matMetal' },
    { kind: 'box', name: { pt: 'Box', en: 'Screen' }, when: 'box', x: '-largura/2', y: '-profundidade/2', z: 0.01, w: 'largura', d: 0.008, h: 1.9, material: 'matVidro' },
    { kind: 'box', name: { pt: 'Box lateral', en: 'Side screen' }, when: 'box', x: '-largura/2', y: '-profundidade/2', z: 0.01, w: 0.008, d: 'profundidade', h: 1.9, material: 'matVidro' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 0.01], shift: 0.5 },
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 0.01], shift: 0.5, sign: -1 },
    { param: 'altura', axis: 'z', at: [0, 'profundidade/2 - 0.3', 'altura'] },
  ],
  types: [
    { id: 'b90', name: { pt: 'Box 90 × 90', en: 'Enclosure 90 × 90' }, values: {} },
    { id: 'b120', name: { pt: 'Box 120 × 90', en: 'Enclosure 120 × 90' }, values: { largura: 1.2 } },
  ],
  rules: [{ when: 'largura < 0.8 || profundidade < 0.8', message: { pt: 'Box com menos de 80 cm: apertado para o banho', en: 'An enclosure under 80 cm: tight to shower in' } }],
};

export const FRIDGE: ObjectDefinition = {
  id: 'def_fridge',
  name: { pt: 'Geladeira', en: 'Fridge' },
  category: 'equipment',
  params: [
    len('largura', 'Largura', 'Width', 0.7, 0.5, 1),
    len('profundidade', 'Profundidade', 'Depth', 0.72, 0.55, 0.85),
    len('altura', 'Altura', 'Height', 1.85, 1.2, 2.1),
    len('congelador', 'Altura do congelador', 'Freezer height', 0.55, 0.3, 0.9, BUILD),
    mat('matCorpo', 'Corpo', 'Body', 'mdfWhite'),
    mat('matMetal', 'Puxadores', 'Handles', 'metal'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Corpo', en: 'Body' }, x: '-largura/2', y: '-profundidade/2 + 0.05', z: 0, w: 'largura', d: 'profundidade - 0.05', h: 'altura', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Porta de baixo', en: 'Lower door' }, x: '-largura/2', y: '-profundidade/2', z: 0.05, w: 'largura', d: 0.045, h: 'altura - congelador - 0.06', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Porta do congelador', en: 'Freezer door' }, x: '-largura/2', y: '-profundidade/2', z: 'altura - congelador', w: 'largura', d: 0.045, h: 'congelador - 0.01', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Puxador', en: 'Handle' }, repeat: { count: 2 }, x: 'largura/2 - 0.06', y: '-profundidade/2 - 0.03', z: 'if(i == 0, 0.5, altura - congelador + 0.1)', w: 0.02, d: 0.03, h: 'if(i == 0, 0.6, 0.3)', material: 'matMetal' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'duplex', name: { pt: 'Duplex 70', en: 'Two doors 70' }, values: {} },
    { id: 'big', name: { pt: 'Duplex 90', en: 'Two doors 90' }, values: { largura: 0.9, altura: 1.9 } },
  ],
};

export const COOKER: ObjectDefinition = {
  id: 'def_cooker',
  name: { pt: 'Fogão', en: 'Cooker' },
  category: 'equipment',
  params: [
    len('largura', 'Largura', 'Width', 0.55, 0.45, 0.9),
    len('profundidade', 'Profundidade', 'Depth', 0.6, 0.5, 0.7),
    len('altura', 'Altura', 'Height', 0.85, 0.8, 0.95),
    { name: 'bocas', label: { pt: 'Bocas', en: 'Burners' }, kind: 'integer', default: 4, min: 2, max: 6, group: { pt: 'Construção', en: 'Construction' } },
    { name: 'porLinha', label: { pt: 'Bocas por fileira', en: 'Burners per row' }, kind: 'integer', default: 2, formula: 'ceil(bocas / 2)', group: { pt: 'Construção', en: 'Construction' } },
    mat('matCorpo', 'Corpo', 'Body', 'metal'),
    mat('matMesa', 'Mesa', 'Top', 'glass'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Corpo', en: 'Body' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura - 0.01', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Mesa', en: 'Top' }, x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.01', w: 'largura', d: 'profundidade', h: 0.01, material: 'matMesa' },
    {
      kind: 'cylinder',
      name: { pt: 'Boca', en: 'Burner' },
      repeat: { count: 'bocas' },
      x: '-largura/2 + largura / porLinha * ((i % porLinha) + 0.5)',
      y: 'if(i < porLinha, -profundidade/4, profundidade/4)',
      z: 'altura',
      r: 'min(0.05, largura / porLinha / 4)',
      h: 0.025,
      material: 'matCorpo',
    },
    { kind: 'box', name: { pt: 'Porta do forno', en: 'Oven door' }, x: '-largura/2 + 0.03', y: '-profundidade/2 - 0.02', z: 0.12, w: 'largura - 0.06', d: 0.02, h: 'altura - 0.3', material: 'matMesa' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'f4', name: { pt: 'Quatro bocas', en: 'Four burners' }, values: {} },
    { id: 'f5', name: { pt: 'Cinco bocas', en: 'Five burners' }, values: { largura: 0.75, bocas: 5 } },
  ],
};

export const PENDANT: ObjectDefinition = {
  id: 'def_pendant',
  name: { pt: 'Luminária pendente', en: 'Pendant lamp' },
  category: 'lighting',
  params: [
    len('largura', 'Diâmetro da cúpula', 'Shade diameter', 0.4, 0.12, 1.2),
    len('profundidade', 'Altura da cúpula', 'Shade height', 0.25, 0.05, 0.6),
    len('altura', 'Altura da cúpula ao piso', 'Shade above the floor', 1.75, 1, 2.6),
    len('teto', 'Altura do teto', 'Ceiling height', 2.7, 2.2, 4),
    { name: 'potencia', label: { pt: 'Potência (W, LED)', en: 'Power (W, LED)' }, kind: 'number', default: 9, min: 1, max: 60, step: 0.5, group: { pt: 'Luz', en: 'Light' } },
    { name: 'cor', label: { pt: 'Temperatura de cor (K)', en: 'Colour temperature (K)' }, kind: 'integer', default: 3000, min: 2200, max: 6500, step: 100, group: { pt: LIGHT[0], en: LIGHT[1] } },
    mat('matCupula', 'Cúpula', 'Shade', 'metal'),
  ],
  parts: [
    { kind: 'cylinder', name: { pt: 'Cúpula', en: 'Shade' }, x: 0, y: 0, z: 'altura', r: 'largura / 2', r2: 'largura / 6', h: 'profundidade', material: 'matCupula' },
    { kind: 'cylinder', name: { pt: 'Cabo', en: 'Cord' }, x: 0, y: 0, z: 'altura + profundidade', r: 0.004, h: 'max(0.01, teto - altura - profundidade)', material: 'matCupula' },
    { kind: 'cylinder', name: { pt: 'Canopla', en: 'Canopy' }, x: 0, y: 0, z: 'teto - 0.03', r: 0.06, h: 0.03, material: 'matCupula' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'p40', name: { pt: 'Cúpula 40', en: 'Shade 40' }, values: {} },
    { id: 'p25', name: { pt: 'Cúpula 25 sobre a bancada', en: 'Shade 25 over the counter' }, values: { largura: 0.25, altura: 1.6 } },
  ],
  light: { x: 0, y: 0, z: 'altura + 0.02', watts: 'potencia', kelvin: 'cor' },
  rules: [{ when: 'altura < 1.6', message: { pt: 'Cúpula abaixo de 1,60 m: atrapalha quem passa (fora de sobre mesa ou bancada)', en: 'Shade under 1.60 m: in the way (unless over a table or counter)' } }],
};

export const TREE: ObjectDefinition = {
  id: 'def_tree',
  name: { pt: 'Árvore', en: 'Tree' },
  category: 'plant',
  params: [
    len('largura', 'Diâmetro da copa', 'Crown diameter', 3, 0.8, 15),
    len('altura', 'Altura', 'Height', 5, 1.5, 25),
    len('tronco', 'Diâmetro do tronco', 'Trunk diameter', 0.25, 0.05, 1.5, BUILD),
    len('fuste', 'Altura do fuste', 'Clear trunk', 1.8, 0.3, 10, BUILD),
    mat('matCopa', 'Copa', 'Crown', 'foliage'),
    mat('matTronco', 'Tronco', 'Trunk', 'bark'),
  ],
  // A trunk narrowing up into the crown, and the crown as masses of leaves: a core, a ring of six lower
  // ones round it, three higher, a top; each rounded, as foliage reads from afar.
  parts: [
    { kind: 'cylinder', name: { pt: 'Tronco', en: 'Trunk' }, x: 0, y: 0, z: 0, r: 'tronco / 2', r2: 'tronco / 2 * 0.55', h: 'fuste + (altura - fuste) * 0.45', material: 'matTronco' },
    { kind: 'sphere', name: { pt: 'Copa', en: 'Crown' }, x: 0, y: 0, z: 'fuste + (altura - fuste) * 0.1', r: 'largura * 0.36', h: '(altura - fuste) * 0.72', material: 'matCopa' },
    {
      kind: 'sphere',
      name: { pt: 'Copa (lados)', en: 'Crown (sides)' },
      repeat: { count: 6 },
      x: 'largura * 0.25 * cos(i * 60 + 20)',
      y: 'largura * 0.25 * sin(i * 60 + 20)',
      z: 'fuste + (altura - fuste) * (0.12 + 0.07 * (i % 2))',
      r: 'largura * 0.25',
      h: '(altura - fuste) * 0.45',
      material: 'matCopa',
    },
    {
      kind: 'sphere',
      name: { pt: 'Copa (alto)', en: 'Crown (upper)' },
      repeat: { count: 3 },
      x: 'largura * 0.15 * cos(i * 120 + 50)',
      y: 'largura * 0.15 * sin(i * 120 + 50)',
      z: 'fuste + (altura - fuste) * 0.4',
      r: 'largura * 0.24',
      h: '(altura - fuste) * 0.42',
      material: 'matCopa',
    },
    { kind: 'sphere', name: { pt: 'Copa (topo)', en: 'Crown (top)' }, x: 0, y: 0, z: 'altura - (altura - fuste) * 0.4', r: 'largura * 0.22', h: '(altura - fuste) * 0.4', material: 'matCopa' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'fuste + (altura - fuste) * 0.45'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'small', name: { pt: 'Pequena (5 m)', en: 'Small (5 m)' }, values: {} },
    { id: 'big', name: { pt: 'Grande (10 m)', en: 'Large (10 m)' }, values: { largura: 7, altura: 10, tronco: 0.45, fuste: 2.5 } },
  ],
};

export const POT_PLANT: ObjectDefinition = {
  id: 'def_pot_plant',
  name: { pt: 'Vaso com planta', en: 'Potted plant' },
  category: 'plant',
  params: [
    len('largura', 'Diâmetro do vaso', 'Pot diameter', 0.4, 0.15, 1.2),
    len('altura', 'Altura total', 'Overall height', 1.2, 0.3, 3),
    len('vaso', 'Altura do vaso', 'Pot height', 0.4, 0.1, 1, BUILD),
    mat('matVaso', 'Vaso', 'Pot', 'ceramic'),
    mat('matPlanta', 'Planta', 'Plant', 'foliage'),
  ],
  parts: [
    { kind: 'cylinder', name: { pt: 'Vaso', en: 'Pot' }, x: 0, y: 0, z: 0, r: 'largura / 2 * 0.75', r2: 'largura / 2', h: 'vaso', material: 'matVaso' },
    // Leaves in rounded tufts over the pot: a core and three round it, a little lower.
    { kind: 'sphere', name: { pt: 'Folhagem', en: 'Foliage' }, x: 0, y: 0, z: 'vaso * 0.9', r: 'largura * 0.5', h: '(altura - vaso) * 1.05', material: 'matPlanta' },
    {
      kind: 'sphere',
      name: { pt: 'Folhagem (tufos)', en: 'Foliage (tufts)' },
      repeat: { count: 3 },
      x: 'largura * 0.28 * cos(i * 120 + 30)',
      y: 'largura * 0.28 * sin(i * 120 + 30)',
      z: 'vaso * 0.95',
      r: 'largura * 0.36',
      h: '(altura - vaso) * 0.7',
      material: 'matPlanta',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'vaso'], shift: 0 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [{ id: 'std', name: { pt: 'Médio', en: 'Medium' }, values: {} }],
};

/** Phase 8's definitions, in the order the ribbon and the library list them. */
export const LIBRARY_MORE: readonly ObjectDefinition[] = [SOFA, BED, KITCHEN, TOILET, WASHBASIN, SHOWER, FRIDGE, COOKER, PENDANT, TREE, POT_PLANT];
