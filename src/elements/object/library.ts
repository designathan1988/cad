// The objects a project starts with (phase 3): data only, read by the same machine as any other
// definition (evaluate.ts). A table, a bookcase, a cabinet, a chair, and a dining set that nests the table
// and the chairs, the number of chairs by formula. Lengths in metres; x along the width and y along the
// depth from the centre, z up from the floor; the front faces −y.

import { LIBRARY_V50 } from './library-living';
import type { ObjectDefinition, ParamDef } from './schema';
import { LIBRARY_MORE } from './library-more';
import { LIBRARY_LIGHTS } from './library-lights';

const len = (name: string, pt: string, en: string, value: number, min: number, max: number, group?: [string, string]): ParamDef => ({
  name,
  label: { pt, en },
  kind: 'length',
  default: value,
  min,
  max,
  step: 0.005,
  ...(group ? { group: { pt: group[0], en: group[1] } } : {}),
});
const mat = (name: string, pt: string, en: string, value: string): ParamDef => ({ name, label: { pt, en }, kind: 'material', default: value, group: { pt: 'Materiais', en: 'Materials' } });
const DIM: [string, string] = ['Dimensões', 'Dimensions'];
const BUILD: [string, string] = ['Construção', 'Construction'];

export const TABLE: ObjectDefinition = {
  id: 'def_table',
  name: { pt: 'Mesa', en: 'Table' },
  category: 'furniture',
  params: [
    len('largura', 'Largura', 'Width', 1.6, 0.4, 4, DIM),
    len('profundidade', 'Profundidade', 'Depth', 0.9, 0.4, 2, DIM),
    len('altura', 'Altura', 'Height', 0.75, 0.3, 1.2, DIM),
    len('tampo', 'Espessura do tampo', 'Top thickness', 0.03, 0.012, 0.1, BUILD),
    len('pe', 'Seção do pé', 'Leg size', 0.06, 0.02, 0.2, BUILD),
    len('recuo', 'Recuo dos pés', 'Leg inset', 0.05, 0, 0.5, BUILD),
    mat('matTampo', 'Tampo', 'Top', 'woodVeneer'),
    mat('matPes', 'Pés', 'Legs', 'metal'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Tampo', en: 'Top' }, x: '-largura/2', y: '-profundidade/2', z: 'altura - tampo', w: 'largura', d: 'profundidade', h: 'tampo', material: 'matTampo' },
    {
      kind: 'box',
      name: { pt: 'Pé', en: 'Leg' },
      repeat: { count: 4 },
      x: 'if(i % 2 == 0, -largura/2 + recuo, largura/2 - recuo - pe)',
      y: 'if(i < 2, -profundidade/2 + recuo, profundidade/2 - recuo - pe)',
      z: 0,
      w: 'pe',
      d: 'pe',
      h: 'altura - tampo',
      material: 'matPes',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, 'profundidade/2', 'altura'], shift: 0.5 },
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'dining', name: { pt: 'Jantar 160 × 90', en: 'Dining 160 × 90' }, values: { largura: 1.6, profundidade: 0.9, altura: 0.75 } },
    { id: 'desk', name: { pt: 'Escrivaninha 120 × 60', en: 'Desk 120 × 60' }, values: { largura: 1.2, profundidade: 0.6, altura: 0.75 } },
    { id: 'coffee', name: { pt: 'Centro 100 × 60', en: 'Coffee 100 × 60' }, values: { largura: 1, profundidade: 0.6, altura: 0.4, recuo: 0.08 } },
  ],
  rules: [
    { when: '2 * (recuo + pe) >= min(largura, profundidade)', message: { pt: 'Os pés não cabem sob o tampo: reduza o recuo ou a seção do pé', en: 'The legs do not fit under the top: reduce the inset or the leg size' } },
    { when: 'largura - 2 * recuo > 2.4', message: { pt: 'Mais de 2,40 m entre pés: o tampo pode envergar', en: 'More than 2.40 m between legs: the top may sag' } },
  ],
};

export const BOOKCASE: ObjectDefinition = {
  id: 'def_bookcase',
  name: { pt: 'Estante', en: 'Bookcase' },
  category: 'casework',
  params: [
    len('largura', 'Largura', 'Width', 0.8, 0.3, 3, DIM),
    len('profundidade', 'Profundidade', 'Depth', 0.3, 0.15, 0.8, DIM),
    len('altura', 'Altura', 'Height', 1.8, 0.3, 3, DIM),
    len('espessura', 'Espessura da chapa', 'Board thickness', 0.018, 0.012, 0.05, BUILD),
    len('vao', 'Vão entre prateleiras', 'Shelf spacing', 0.35, 0.18, 0.6, BUILD),
    { name: 'fundo', label: { pt: 'Com fundo', en: 'With back' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    { name: 'prateleiras', label: { pt: 'Prateleiras', en: 'Shelves' }, kind: 'integer', default: 0, formula: 'max(0, floor((altura - 2 * espessura) / vao) - 1)', group: { pt: 'Construção', en: 'Construction' } },
    mat('matChapa', 'Chapas', 'Boards', 'mdfWhite'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Lateral', en: 'Side' }, repeat: { count: 2, dx: 'largura - espessura' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'espessura', d: 'profundidade', h: 'altura', material: 'matChapa' },
    { kind: 'box', name: { pt: 'Base e topo', en: 'Base and top' }, repeat: { count: 2, dz: 'altura - espessura' }, x: '-largura/2 + espessura', y: '-profundidade/2', z: 0, w: 'largura - 2 * espessura', d: 'profundidade', h: 'espessura', material: 'matChapa' },
    { kind: 'box', name: { pt: 'Fundo', en: 'Back' }, when: 'fundo', x: '-largura/2 + espessura', y: 'profundidade/2 - 0.006', z: 'espessura', w: 'largura - 2 * espessura', d: 0.006, h: 'altura - 2 * espessura', material: 'matChapa' },
    {
      kind: 'box',
      name: { pt: 'Prateleira', en: 'Shelf' },
      repeat: { count: 'prateleiras' },
      x: '-largura/2 + espessura',
      y: '-profundidade/2',
      // Evenly between the base and the top.
      z: 'espessura + (i + 1) * (altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + i * espessura',
      w: 'largura - 2 * espessura',
      d: 'profundidade - if(fundo, 0.006, 0)',
      h: 'espessura',
      material: 'matChapa',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 'altura'], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'altura', axis: 'z', at: [0, 0, 'altura'] },
  ],
  types: [
    { id: 'b80', name: { pt: '80 × 30 × 180', en: '80 × 30 × 180' }, values: { largura: 0.8, profundidade: 0.3, altura: 1.8 } },
    { id: 'b120', name: { pt: '120 × 35 × 200', en: '120 × 35 × 200' }, values: { largura: 1.2, profundidade: 0.35, altura: 2 } },
    { id: 'low', name: { pt: 'Baixa 80 × 30 × 90', en: 'Low 80 × 30 × 90' }, values: { largura: 0.8, profundidade: 0.3, altura: 0.9 } },
  ],
  rules: [{ when: 'largura - 2 * espessura > 0.9', message: { pt: 'Prateleira com mais de 90 cm sem apoio: pode envergar com livros', en: 'A shelf over 90 cm without support may sag under books' } }],
};

export const CABINET: ObjectDefinition = {
  id: 'def_cabinet',
  name: { pt: 'Armário', en: 'Cabinet' },
  category: 'casework',
  params: [
    len('largura', 'Largura', 'Width', 1.2, 0.3, 4, DIM),
    len('profundidade', 'Profundidade', 'Depth', 0.55, 0.25, 0.8, DIM),
    len('altura', 'Altura', 'Height', 2.1, 0.4, 2.8, DIM),
    len('espessura', 'Espessura da chapa', 'Board thickness', 0.018, 0.012, 0.05, BUILD),
    len('rodape', 'Rodapé', 'Plinth', 0.1, 0, 0.25, BUILD),
    len('portaMax', 'Largura máxima da porta', 'Widest door', 0.6, 0.25, 1, BUILD),
    { name: 'puxador', label: { pt: 'Com puxadores', en: 'With handles' }, kind: 'bool', default: 1, group: { pt: 'Construção', en: 'Construction' } },
    { name: 'portas', label: { pt: 'Portas', en: 'Doors' }, kind: 'integer', default: 1, formula: 'max(1, ceil((largura - 2 * espessura) / portaMax))', group: { pt: 'Construção', en: 'Construction' } },
    { name: 'larguraPorta', label: { pt: 'Largura de cada porta', en: 'Each door’s width' }, kind: 'length', default: 0.6, formula: '(largura - 0.003 * (portas + 1)) / portas', group: { pt: 'Construção', en: 'Construction' } },
    mat('matCorpo', 'Corpo', 'Body', 'mdfWhite'),
    mat('matPortas', 'Portas', 'Doors', 'woodVeneer'),
    mat('matPuxador', 'Puxadores', 'Handles', 'metal'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Lateral', en: 'Side' }, repeat: { count: 2, dx: 'largura - espessura' }, x: '-largura/2', y: '-profundidade/2', z: 0, w: 'espessura', d: 'profundidade', h: 'altura', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Base e topo', en: 'Base and top' }, repeat: { count: 2, dz: 'altura - rodape - espessura' }, x: '-largura/2 + espessura', y: '-profundidade/2', z: 'rodape', w: 'largura - 2 * espessura', d: 'profundidade', h: 'espessura', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Fundo', en: 'Back' }, x: '-largura/2 + espessura', y: 'profundidade/2 - 0.006', z: 'rodape + espessura', w: 'largura - 2 * espessura', d: 0.006, h: 'altura - rodape - 2 * espessura', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Rodapé', en: 'Plinth' }, when: 'rodape > 0', x: '-largura/2 + espessura', y: '-profundidade/2 + 0.04', z: 0, w: 'largura - 2 * espessura', d: 'espessura', h: 'rodape', material: 'matCorpo' },
    { kind: 'box', name: { pt: 'Prateleira', en: 'Shelf' }, x: '-largura/2 + espessura', y: '-profundidade/2 + 0.02', z: 'rodape + (altura - rodape) * 0.55', w: 'largura - 2 * espessura', d: 'profundidade - 0.03', h: 'espessura', material: 'matCorpo' },
    {
      kind: 'box',
      name: { pt: 'Porta', en: 'Door' },
      repeat: { count: 'portas', dx: 'larguraPorta + 0.003' },
      x: '-largura/2 + 0.003',
      y: '-profundidade/2 - espessura',
      z: 'rodape + 0.003',
      w: 'larguraPorta',
      d: 'espessura',
      h: 'altura - rodape - 0.006',
      material: 'matPortas',
    },
    {
      kind: 'box',
      name: { pt: 'Puxador', en: 'Handle' },
      when: 'puxador',
      repeat: { count: 'portas', dx: 'larguraPorta + 0.003' },
      // On the side of the door away from its hinge: the right of an even one, the left of an odd one.
      x: '-largura/2 + 0.003 + if(i % 2 == 0, larguraPorta - 0.05, 0.035)',
      y: '-profundidade/2 - espessura - 0.025',
      z: 'rodape + min(1.0, (altura - rodape) / 2)',
      w: 0.012,
      d: 0.025,
      h: 0.2,
      material: 'matPuxador',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', '-profundidade/2', 'altura'], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', '-profundidade/2', 'altura'], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, 'profundidade/2', 'altura'], shift: 0.5 },
    { param: 'altura', axis: 'z', at: [0, '-profundidade/2', 'altura'] },
  ],
  types: [
    { id: 'c2', name: { pt: 'Duas portas 100', en: 'Two doors 100' }, values: { largura: 1, altura: 2.1 } },
    { id: 'c4', name: { pt: 'Quatro portas 200', en: 'Four doors 200' }, values: { largura: 2, altura: 2.1 } },
    { id: 'low', name: { pt: 'Gabinete baixo 120', en: 'Low unit 120' }, values: { largura: 1.2, altura: 0.85, profundidade: 0.55 } },
  ],
  rules: [{ when: 'profundidade < 0.5 && altura > 1.5', message: { pt: 'Menos de 50 cm de fundo: cabides não cabem', en: 'Less than 50 cm deep: hangers do not fit' } }],
};

export const CHAIR: ObjectDefinition = {
  id: 'def_chair',
  name: { pt: 'Cadeira', en: 'Chair' },
  category: 'furniture',
  params: [
    len('largura', 'Largura', 'Width', 0.45, 0.35, 0.7, DIM),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.35, 0.7, DIM),
    len('assento', 'Altura do assento', 'Seat height', 0.45, 0.3, 0.8, DIM),
    len('encosto', 'Altura do encosto', 'Back height', 0.9, 0.5, 1.3, DIM),
    len('pe', 'Seção do pé', 'Leg size', 0.035, 0.015, 0.08, BUILD),
    mat('matAssento', 'Assento e encosto', 'Seat and back', 'woodVeneer'),
    mat('matPes', 'Pés', 'Legs', 'woodVeneer'),
  ],
  parts: [
    { kind: 'box', name: { pt: 'Assento', en: 'Seat' }, x: '-largura/2', y: '-profundidade/2', z: 'assento - 0.03', w: 'largura', d: 'profundidade', h: 0.03, material: 'matAssento', round: 0.008 },
    // The back between the rear legs, which rise as its posts: a backrest at the top, a rail below it.
    { kind: 'box', name: { pt: 'Encosto', en: 'Back' }, x: '-largura/2 + pe', y: 'profundidade/2 - pe/2 - 0.01', z: 'encosto - (encosto - assento) * 0.38', w: 'largura - 2 * pe', d: 0.02, h: '(encosto - assento) * 0.34', material: 'matAssento', round: 0.006 },
    { kind: 'box', name: { pt: 'Travessa do encosto', en: 'Back rail' }, x: '-largura/2 + pe', y: 'profundidade/2 - pe/2 - 0.01', z: 'assento + (encosto - assento) * 0.22', w: 'largura - 2 * pe', d: 0.02, h: 0.05, material: 'matAssento', round: 0.006 },
    {
      kind: 'box',
      name: { pt: 'Pé', en: 'Leg' },
      repeat: { count: 4 },
      x: 'if(i % 2 == 0, -largura/2, largura/2 - pe)',
      y: 'if(i < 2, -profundidade/2, profundidade/2 - pe)',
      z: 0,
      w: 'pe',
      d: 'pe',
      h: 'if(i < 2, assento - 0.03, encosto)',
      material: 'matPes',
    },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'assento'], shift: 0.5 },
    { param: 'encosto', axis: 'z', at: [0, 'profundidade/2', 'encosto'] },
  ],
  types: [{ id: 'standard', name: { pt: 'Padrão', en: 'Standard' }, values: {} }],
  rules: [{ when: 'assento < 0.4 || assento > 0.5', message: { pt: 'Assento fora de 40 a 50 cm, a faixa usual para mesa de 75 cm', en: 'Seat outside 40 to 50 cm, the usual range for a 75 cm table' } }],
};

export const DINING_SET: ObjectDefinition = {
  id: 'def_dining_set',
  name: { pt: 'Conjunto de jantar', en: 'Dining set' },
  category: 'furniture',
  params: [
    len('largura', 'Largura da mesa', 'Table width', 1.6, 0.6, 4, DIM),
    len('profundidade', 'Profundidade da mesa', 'Table depth', 0.9, 0.6, 1.4, DIM),
    len('espaco', 'Espaço por cadeira', 'Room per chair', 0.6, 0.45, 0.9, DIM),
    { name: 'cabeceiras', label: { pt: 'Cadeiras nas cabeceiras', en: 'Chairs at the ends' }, kind: 'bool', default: 0, group: { pt: 'Cadeiras', en: 'Chairs' } },
    { name: 'porLado', label: { pt: 'Cadeiras por lado', en: 'Chairs per side' }, kind: 'integer', default: 2, formula: 'max(1, floor((largura + 0.1) / espaco))', group: { pt: 'Cadeiras', en: 'Chairs' } },
    mat('matTampo', 'Tampo', 'Top', 'woodVeneer'),
  ],
  parts: [
    { kind: 'object', name: { pt: 'Mesa', en: 'Table' }, definition: 'def_table', x: 0, y: 0, z: 0, values: { largura: 'largura', profundidade: 'profundidade', matTampo: 'matTampo' } },
    // One row of chairs on each long side, facing the table, spread over its width.
    {
      kind: 'object',
      name: { pt: 'Cadeira', en: 'Chair' },
      definition: 'def_chair',
      repeat: { count: 'porLado', dx: 'largura / porLado' },
      x: '-largura/2 + largura / porLado / 2',
      y: '-profundidade/2 - 0.12',
      z: 0,
      angle: 180,
    },
    {
      kind: 'object',
      name: { pt: 'Cadeira', en: 'Chair' },
      definition: 'def_chair',
      repeat: { count: 'porLado', dx: 'largura / porLado' },
      x: '-largura/2 + largura / porLado / 2',
      y: 'profundidade/2 + 0.12',
      z: 0,
    },
    { kind: 'object', name: { pt: 'Cadeira da cabeceira', en: 'End chair' }, definition: 'def_chair', when: 'cabeceiras', repeat: { count: 2, dx: 'largura + 0.24' }, x: '-largura/2 - 0.12', y: 0, z: 0, angle: 'if(i == 0, 90, -90)' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 0.75], shift: 0.5 },
    { param: 'largura', axis: 'x', at: ['-largura/2', 0, 0.75], shift: 0.5, sign: -1 },
    { param: 'profundidade', axis: 'y', at: [0, 'profundidade/2', 0.75], shift: 0.5 },
  ],
  types: [
    { id: 'four', name: { pt: 'Quatro lugares', en: 'Four seats' }, values: { largura: 1.2, profundidade: 0.8 } },
    { id: 'six', name: { pt: 'Seis lugares', en: 'Six seats' }, values: { largura: 1.8, profundidade: 0.9 } },
  ],
};

/** The definitions a new project has, and those an older file gets: one of each category at least (phase 8). */
export const LIBRARY: readonly ObjectDefinition[] = [TABLE, CHAIR, DINING_SET, BOOKCASE, CABINET, ...LIBRARY_MORE, ...LIBRARY_LIGHTS, ...LIBRARY_V50];
