// The library's bathroom (data only, as library.ts): a vanity with its basin (on top, inset or carved), a
// bathtub (built in or freestanding), a glass shower enclosure, towel rails, mirrors, a urinal and the grab
// bars NBR 9050 asks for. Wall-hung pieces carry their height above the floor as a parameter.

import type { ObjectDefinition } from './schema';
import { boxHandles, BUILD, choice, len, mat, w, yes } from './library-kit';

export const VANITY_SINK: ObjectDefinition = {
  id: 'def_vanity_sink',
  name: w('Bancada com cuba', 'Vanity with basin'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    choice('cuba', 'Cuba', 'Basin', [['De apoio', 'Vessel'], ['Embutida', 'Inset'], ['Esculpida', 'Carved']]),
    len('largura', 'Largura', 'Width', 1, 0.5, 2.4),
    len('profundidade', 'Profundidade', 'Depth', 0.5, 0.4, 0.6),
    len('altura', 'Altura da bancada', 'Counter height', 0.9, 0.78, 0.95),
    yes('gabinete', 'Gabinete suspenso', 'Wall-hung cabinet', 1),
    yes('duas', 'Duas cubas', 'Two basins', 0),
    yes('espelho', 'Espelho', 'Mirror', 1),
    mat('matBancada', 'Bancada', 'Counter', 'quartz'),
    mat('matCuba', 'Cuba', 'Basin', 'ceramic'),
    mat('matGabinete', 'Gabinete', 'Cabinet', 'freijo'),
    mat('matMetal', 'Metais', 'Fittings', 'chrome'),
  ],
  parts: [
    { kind: 'box', name: w('Bancada', 'Counter'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.03', w: 'largura', d: 'profundidade', h: 0.03, material: 'matBancada', round: 0.003 },
    { kind: 'box', name: w('Saia', 'Apron'), when: 'gabinete == 0', x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.12', w: 'largura', d: 0.03, h: 0.09, material: 'matBancada' },
    { kind: 'box', name: w('Gabinete', 'Cabinet'), when: 'gabinete', x: '-largura/2 + 0.02', y: '-profundidade/2 + 0.03', z: 'altura - 0.5', w: 'largura - 0.04', d: 'profundidade - 0.03', h: 0.47, material: 'matGabinete' },
    { kind: 'box', name: w('Gaveta', 'Drawer'), when: 'gabinete', repeat: { count: 2, dz: 0.235 }, x: '-largura/2 + 0.022', y: '-profundidade/2 + 0.012', z: 'altura - 0.498', w: 'largura - 0.044', d: 0.02, h: 0.231, material: 'matGabinete' },
    { kind: 'box', name: w('Cava', 'Pull'), when: 'gabinete', cut: true, repeat: { count: 2, dz: 0.235 }, x: '-0.12', y: '-profundidade/2 + 0.005', z: 'altura - 0.285', w: 0.24, d: 0.03, h: 0.022 },
    // A vessel: a turned bowl sitting on the counter, its inside hollowed.
    {
      kind: 'revolve',
      name: w('Cuba de apoio', 'Vessel'),
      when: 'cuba == 0',
      repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' },
      x: 'if(duas, -largura/4, 0)',
      y: 0,
      z: 'altura',
      points: [[0.12, 0], [0.19, 0.04], [0.205, 0.13], [0.2, 0.14]],
      material: 'matCuba',
    },
    { kind: 'revolve', name: w('Bojo', 'Bowl'), when: 'cuba == 0', cut: true, repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0)', y: 0, z: 'altura + 0.02', points: [[0.06, 0], [0.17, 0.04], [0.19, 0.13]] },
    // Inset: a bowl dropped into the counter (its void through the counter, its rim a little proud).
    { kind: 'box', name: w('Borda da cuba', 'Basin rim'), when: 'cuba == 1', repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) - 0.25', y: '-profundidade/2 + 0.06', z: 'altura', w: 0.5, d: 0.36, h: 0.008, material: 'matCuba', round: 0.003 },
    { kind: 'box', name: w('Bojo', 'Bowl'), when: 'cuba == 1', cut: true, repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) - 0.21', y: '-profundidade/2 + 0.09', z: 'altura - 0.15', w: 0.42, d: 0.3, h: 0.17 },
    { kind: 'box', name: w('Fundo da cuba', 'Basin bottom'), when: 'cuba == 1', repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) - 0.21', y: '-profundidade/2 + 0.09', z: 'altura - 0.16', w: 0.42, d: 0.3, h: 0.012, material: 'matCuba', round: 0.004 },
    // Carved: the counter thickened, a sloping trough cut into it toward a slot at the back.
    { kind: 'box', name: w('Bancada esculpida', 'Carved block'), when: 'cuba == 2', x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.15', w: 'largura', d: 'profundidade', h: 0.12, material: 'matBancada' },
    { kind: 'box', name: w('Rampa', 'Trough'), when: 'cuba == 2', cut: true, repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) - 0.25', y: '-profundidade/2 + 0.07', z: 'altura - 0.075', w: 0.5, d: 'profundidade - 0.14', h: 0.2, tilt: 5 },
    // The slot the water runs into at the trough's low back end.
    { kind: 'box', name: w('Ralo linear', 'Drain slot'), when: 'cuba == 2', repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) - 0.22', y: 'profundidade/2 - 0.1', z: 'altura - 0.072 - (profundidade - 0.17) * 0.0875', w: 0.44, d: 0.025, h: 0.004, material: 'plasticBlack' },
    // The tap on the wall above each basin, its lever.
    { kind: 'cylinder', name: w('Bica', 'Spout'), repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0)', y: 'profundidade/2 + 0.01', z: 'altura + if(cuba == 0, 0.27, 0.16)', r: 0.011, h: 'if(cuba == 0, 0.2, 0.17)', tilt: -90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Registro', 'Lever'), repeat: { count: 'if(duas, 2, 1)', dx: 'largura / 2' }, x: 'if(duas, -largura/4, 0) + 0.12', y: 'profundidade/2 + 0.01', z: 'altura + if(cuba == 0, 0.27, 0.16)', r: 0.024, h: 0.03, tilt: -90, material: 'matMetal' },
    // The mirror over it, as wide as the counter less a margin.
    { kind: 'box', name: w('Espelho', 'Mirror'), when: 'espelho', x: '-largura/2 + 0.05', y: 'profundidade/2 - 0.005', z: 'altura + 0.35', w: 'largura - 0.1', d: 0.006, h: 0.8, material: 'mirror' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'vessel', name: w('Cuba de apoio, gabinete', 'Vessel basin, cabinet'), values: {} },
    { id: 'inset2', name: w('Duas cubas embutidas 1,60', 'Two inset basins 1.60'), values: { cuba: 1, duas: 1, largura: 1.6, matGabinete: 'lacquerWhite' } },
    { id: 'carved', name: w('Cuba esculpida em mármore', 'Carved marble basin'), values: { cuba: 2, gabinete: 0, matBancada: 'marble', matMetal: 'brass', largura: 0.8 } },
  ],
};

export const BATHTUB: ObjectDefinition = {
  id: 'def_bathtub',
  name: w('Banheira', 'Bathtub'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Embutida', 'Built-in'], ['De apoio', 'Freestanding']]),
    len('largura', 'Comprimento', 'Length', 1.7, 1.4, 2),
    len('profundidade', 'Largura', 'Width', 0.75, 0.65, 0.95),
    len('altura', 'Altura', 'Height', 0.58, 0.45, 0.65),
    mat('matBanheira', 'Banheira', 'Tub', 'plasticWhite'),
    mat('matCaixa', 'Revestimento da caixa', 'Surround', 'tile'),
    mat('matMetal', 'Metais', 'Fittings', 'chrome'),
  ],
  parts: [
    // Built in: a tiled box, the tub's rim on top, its basin cut through both.
    { kind: 'box', name: w('Caixa', 'Surround'), when: 'modelo == 0', x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura - 0.02', material: 'matCaixa' },
    { kind: 'box', name: w('Borda', 'Rim'), when: 'modelo == 0', x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.02', w: 'largura', d: 'profundidade', h: 0.02, material: 'matBanheira', round: 0.006 },
    // Freestanding: a deep rounded tub on the floor.
    { kind: 'box', name: w('Banheira', 'Tub'), when: 'modelo == 1', x: '-largura/2', y: '-profundidade/2', z: 0, w: 'largura', d: 'profundidade', h: 'altura', material: 'matBanheira', round: 'min(0.16, profundidade * 0.22)' },
    { kind: 'box', name: w('Bojo', 'Basin'), cut: true, x: '-largura/2 + 0.07', y: '-profundidade/2 + 0.07', z: 0.08, w: 'largura - 0.14', d: 'profundidade - 0.14', h: 'altura', round: 'min(0.14, profundidade * 0.18)' },
    { kind: 'cylinder', name: w('Ralo', 'Drain'), x: '-largura/2 + 0.2', y: 0, z: 0.081, r: 0.03, h: 0.003, material: 'matMetal' },
    // The filler: on the rim for a built-in one, a floor-standing column for a freestanding one.
    { kind: 'cylinder', name: w('Bica', 'Spout'), when: 'modelo == 0', x: '-largura/2 + 0.04', y: 0, z: 'altura', r: 0.014, h: 0.16, material: 'matMetal' },
    { kind: 'cylinder', name: w('Bica', 'Spout'), when: 'modelo == 0', x: '-largura/2 + 0.04', y: 0, z: 'altura + 0.15', r: 0.011, h: 0.13, roll: 100, material: 'matMetal' },
    { kind: 'cylinder', name: w('Misturador de piso', 'Floor filler'), when: 'modelo == 1', x: '-largura/2 - 0.12', y: 0, z: 0, r: 0.018, h: 'altura + 0.32', material: 'matMetal' },
    { kind: 'cylinder', name: w('Bica', 'Spout'), when: 'modelo == 1', x: '-largura/2 - 0.12', y: 0, z: 'altura + 0.3', r: 0.013, h: 0.22, roll: 100, material: 'matMetal' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'built', name: w('Embutida 170 × 75', 'Built-in 170 × 75'), values: {} },
    { id: 'free', name: w('De apoio 170 × 80', 'Freestanding 170 × 80'), values: { modelo: 1, profundidade: 0.8, matMetal: 'blackSteel' } },
  ],
};

export const SHOWER_GLASS: ObjectDefinition = {
  id: 'def_shower_glass',
  name: w('Box de vidro', 'Glass shower enclosure'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    choice('formato', 'Formato', 'Layout', [['Frontal de correr', 'Sliding, front'], ['De canto (L)', 'Corner (L)'], ['Fixo (walk-in)', 'Fixed (walk-in)']]),
    len('largura', 'Largura', 'Width', 1.2, 0.7, 2),
    len('profundidade', 'Profundidade do canto', 'Return depth', 0.9, 0.7, 1.4),
    len('altura', 'Altura', 'Height', 1.9, 1.8, 2.2),
    mat('matVidro', 'Vidro', 'Glass', 'glass'),
    mat('matPerfil', 'Perfis', 'Profiles', 'aluminium'),
  ],
  parts: [
    // The front: a fixed pane and a sliding one beside it, overlapping, on two tracks; one pane alone for a walk-in.
    { kind: 'box', name: w('Vidro fixo', 'Fixed pane'), x: '-largura/2', y: '-profundidade/2', z: 0.01, w: 'if(formato == 2, largura * 0.7, largura / 2 + 0.03)', d: 0.008, h: 'altura - 0.02', material: 'matVidro' },
    { kind: 'box', name: w('Vidro de correr', 'Sliding pane'), when: 'formato < 2', x: '-0.03', y: '-profundidade/2 - 0.03', z: 0.01, w: 'largura / 2 + 0.03', d: 0.008, h: 'altura - 0.02', material: 'matVidro' },
    { kind: 'box', name: w('Puxador', 'Handle'), when: 'formato < 2', x: 0.02, y: '-profundidade/2 - 0.06', z: 'altura / 2 - 0.15', w: 0.018, d: 0.02, h: 0.3, material: 'matPerfil', round: 0.007 },
    // The return side (an L), floor to top.
    { kind: 'box', name: w('Vidro lateral', 'Return pane'), when: 'formato == 1', x: 'largura/2 - 0.008', y: '-profundidade/2', z: 0.01, w: 0.008, d: 'profundidade', h: 'altura - 0.02', material: 'matVidro' },
    // The rail along the top, the profile at the wall, the stabiliser of a walk-in to the wall behind.
    { kind: 'box', name: w('Trilho superior', 'Top rail'), when: 'formato < 2', x: '-largura/2', y: '-profundidade/2 - 0.04', z: 'altura - 0.04', w: 'largura', d: 0.05, h: 0.04, material: 'matPerfil', round: 0.004 },
    { kind: 'box', name: w('Perfil de parede', 'Wall profile'), x: '-largura/2 - 0.012', y: '-profundidade/2 - 0.012', z: 0, w: 0.012, d: 0.032, h: 'altura', material: 'matPerfil' },
    { kind: 'cylinder', name: w('Barra estabilizadora', 'Stabiliser bar'), when: 'formato == 2', x: '-largura/2 + largura * 0.7 - 0.02', y: '-profundidade/2', z: 'altura - 0.05', r: 0.01, h: 'profundidade', tilt: 90, material: 'matPerfil' },
    // The floor's shallow tray edge and its linear drain.
    { kind: 'box', name: w('Soleira', 'Kerb'), when: 'formato < 2', x: '-largura/2', y: '-profundidade/2 - 0.04', z: 0, w: 'largura', d: 0.05, h: 0.012, material: 'marble', round: 0.003 },
    { kind: 'box', name: w('Ralo linear', 'Linear drain'), x: '-largura/2 + 0.1', y: 'profundidade/2 - 0.12', z: 0, w: 'largura - 0.2', d: 0.06, h: 0.003, material: 'stainless' },
  ],
  handles: boxHandles('altura'),
  types: [
    { id: 'front', name: w('Frontal de correr 1,20', 'Sliding front 1.20'), values: {} },
    { id: 'corner', name: w('De canto 90 × 90, preto', 'Corner 90 × 90, black'), values: { formato: 1, largura: 0.9, matPerfil: 'blackSteel' } },
    { id: 'walkin', name: w('Walk-in fixo', 'Fixed walk-in'), values: { formato: 2, largura: 1.4, profundidade: 1 } },
  ],
};

export const TOWEL_RAIL: ObjectDefinition = {
  id: 'def_towel_rail',
  name: w('Toalheiro', 'Towel rail'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Barra', 'Bar'], ['Argola', 'Ring'], ['Aquecido (escada)', 'Heated (ladder)']]),
    len('largura', 'Largura', 'Width', 0.6, 0.15, 1),
    len('base', 'Altura do piso', 'Height above floor', 1.2, 0.3, 1.8),
    len('altura', 'Altura (aquecido)', 'Height (heated)', 0.8, 0.5, 1.6, BUILD),
    mat('matMetal', 'Metal', 'Metal', 'chrome'),
  ],
  parts: [
    // A bar off the wall on two posts.
    { kind: 'cylinder', name: w('Barra', 'Bar'), when: 'modelo == 0', x: '-largura/2', y: -0.07, z: 'base', r: 0.01, h: 'largura', roll: 90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Suporte', 'Post'), when: 'modelo == 0', repeat: { count: 2, dx: 'largura - 0.02' }, x: '-largura/2 + 0.01', y: 0, z: 'base', r: 0.009, h: 0.07, tilt: -90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Canopla', 'Rose'), when: 'modelo == 0', repeat: { count: 2, dx: 'largura - 0.02' }, x: '-largura/2 + 0.01', y: 0.01, z: 'base', r: 0.025, h: 0.01, tilt: -90, material: 'matMetal' },
    // A ring hanging from its rose: the ring's outline as a thin disc with its middle out.
    { kind: 'cylinder', name: w('Argola', 'Ring'), when: 'modelo == 1', x: 0, y: -0.05, z: 'base - 0.18', r: 0.09, h: 0.012, tilt: -90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Vão da argola', 'Ring opening'), when: 'modelo == 1', cut: true, x: 0, y: -0.04, z: 'base - 0.18', r: 0.078, h: 0.04, tilt: -90 },
    { kind: 'cylinder', name: w('Canopla', 'Rose'), when: 'modelo == 1', x: 0, y: 0.01, z: 'base', r: 0.025, h: 0.04, tilt: -90, material: 'matMetal' },
    // A heated ladder: two stiles and its rungs.
    { kind: 'cylinder', name: w('Montante', 'Stile'), when: 'modelo == 2', repeat: { count: 2, dx: 'largura' }, x: '-largura/2', y: -0.05, z: 'base - altura/2', r: 0.014, h: 'altura', material: 'matMetal' },
    { kind: 'cylinder', name: w('Travessa', 'Rung'), when: 'modelo == 2', repeat: { count: 'floor(altura / 0.07)', dz: 0.07 }, x: '-largura/2', y: -0.05, z: 'base - altura/2 + 0.04', r: 0.009, h: 'largura', roll: 90, material: 'matMetal' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', -0.07, 'base'], shift: 0.5 }],
  types: [
    { id: 'bar', name: w('Barra 60 cm', 'Bar 60 cm'), values: {} },
    { id: 'ring', name: w('Argola', 'Ring'), values: { modelo: 1, largura: 0.2, base: 1.1 } },
    { id: 'heated', name: w('Aquecido 50 × 80, preto', 'Heated 50 × 80, black'), values: { modelo: 2, largura: 0.5, matMetal: 'blackSteel' } },
  ],
};

export const MIRROR: ObjectDefinition = {
  id: 'def_mirror',
  name: w('Espelho', 'Mirror'),
  category: 'furniture',
  folder: 'Banheiro',
  params: [
    choice('forma', 'Forma', 'Shape', [['Retangular', 'Rectangular'], ['Redondo', 'Round'], ['Arco', 'Arch']]),
    len('largura', 'Largura (ou diâmetro)', 'Width (or diameter)', 0.7, 0.3, 2),
    len('altura', 'Altura', 'Height', 0.9, 0.3, 2.1),
    len('base', 'Altura do piso', 'Height above floor', 1.1, 0, 1.6),
    len('moldura', 'Moldura', 'Frame', 0.02, 0, 0.1, BUILD),
    yes('led', 'Luz por trás (LED)', 'Backlit (LED)', 0),
    mat('matMoldura', 'Moldura', 'Frame', 'brass'),
  ],
  parts: [
    // Rectangular or arched: the frame a panel a little larger than the glass; the arch a disc topping it.
    { kind: 'box', name: w('Moldura', 'Frame'), when: 'forma != 1 && moldura > 0', x: '-largura/2 - moldura', y: -0.025, z: 'base - moldura', w: 'largura + 2 * moldura', d: 0.02, h: 'if(forma == 2, altura - largura/2, altura) + 2 * moldura', material: 'matMoldura', round: 'min(0.005, moldura/2)' },
    { kind: 'cylinder', name: w('Moldura do arco', 'Arch frame'), when: 'forma == 2 && moldura > 0', x: 0, y: 0, z: 'base + altura - largura/2', r: 'largura/2 + moldura', h: 0.02, tilt: -90, material: 'matMoldura' },
    { kind: 'box', name: w('Espelho', 'Mirror'), when: 'forma != 1', x: '-largura/2', y: -0.031, z: 'base', w: 'largura', d: 0.006, h: 'if(forma == 2, altura - largura/2, altura)', material: 'mirror' },
    { kind: 'cylinder', name: w('Espelho do arco', 'Arch mirror'), when: 'forma == 2', x: 0, y: -0.025, z: 'base + altura - largura/2', r: 'largura/2', h: 0.006, tilt: -90, material: 'mirror' },
    // Round: a disc in its ring.
    { kind: 'cylinder', name: w('Moldura', 'Frame'), when: 'forma == 1 && moldura > 0', x: 0, y: 0, z: 'base + largura/2', r: 'largura/2 + moldura', h: 0.02, tilt: -90, material: 'matMoldura' },
    { kind: 'cylinder', name: w('Espelho', 'Mirror'), when: 'forma == 1', x: 0, y: -0.02, z: 'base + largura/2', r: 'largura/2', h: 0.006, tilt: -90, material: 'mirror' },
    // The backlight's glow behind: a frosted panel standing off the wall.
    { kind: 'box', name: w('Luz', 'Glow'), when: 'led && forma != 1', x: '-largura/2 + 0.03', y: -0.012, z: 'base + 0.03', w: 'largura - 0.06', d: 0.01, h: 'altura - 0.06', material: 'frostedGlass' },
    { kind: 'cylinder', name: w('Luz', 'Glow'), when: 'led && forma == 1', x: 0, y: 0, z: 'base + largura/2', r: 'largura/2 - 0.02', h: 0.012, tilt: -90, material: 'frostedGlass' },
  ],
  handles: [
    { param: 'largura', axis: 'x', at: ['largura/2', 0, 'base + altura/2'], shift: 0.5 },
    { param: 'altura', axis: 'z', at: [0, 0, 'base + altura'] },
  ],
  types: [
    { id: 'rect', name: w('Retangular com moldura de latão', 'Rectangular, brass frame'), values: {} },
    { id: 'round', name: w('Redondo 70 cm', 'Round 70 cm'), values: { forma: 1, matMoldura: 'blackSteel', moldura: 0.015 } },
    { id: 'arch', name: w('Arco, de chão', 'Arch, floor-standing'), values: { forma: 2, largura: 0.6, altura: 1.7, base: 0.05, matMoldura: 'oak', moldura: 0.03 } },
    { id: 'led', name: w('LED sem moldura', 'LED, frameless'), values: { led: 1, moldura: 0, largura: 1, altura: 0.8 } },
  ],
};

export const URINAL: ObjectDefinition = {
  id: 'def_urinal',
  name: w('Mictório', 'Urinal'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    len('largura', 'Largura', 'Width', 0.36, 0.3, 0.45),
    len('profundidade', 'Profundidade', 'Depth', 0.34, 0.28, 0.42),
    len('altura', 'Altura da borda', 'Rim height', 0.6, 0.43, 0.65),
    mat('matLouca', 'Louça', 'China', 'ceramic'),
  ],
  parts: [
    { kind: 'box', name: w('Corpo', 'Body'), x: '-largura/2', y: '-profundidade/2', z: 'altura - 0.38', w: 'largura', d: 'profundidade', h: 0.62, material: 'matLouca', round: 0.1 },
    { kind: 'box', name: w('Bojo', 'Bowl'), cut: true, x: '-largura/2 + 0.04', y: '-profundidade/2 - 0.05', z: 'altura - 0.3', w: 'largura - 0.08', d: 'profundidade - 0.06', h: 0.45, round: 0.08 },
    { kind: 'cylinder', name: w('Válvula', 'Flush valve'), x: 0, y: 'profundidade/2 - 0.03', z: 'altura + 0.32', r: 0.035, h: 0.04, tilt: -90, material: 'chrome' },
  ],
  handles: [],
  types: [
    { id: 'std', name: w('Padrão (borda a 60 cm)', 'Standard (rim at 60 cm)'), values: {} },
    { id: 'low', name: w('Acessível / infantil (43 cm)', 'Accessible / child (43 cm)'), values: { altura: 0.43 } },
  ],
};

export const GRAB_BARS: ObjectDefinition = {
  id: 'def_grab_bars',
  name: w('Barras de apoio', 'Grab bars'),
  category: 'fixture',
  folder: 'Banheiro',
  params: [
    choice('modelo', 'Modelo', 'Model', [['Reta', 'Straight'], ['Em L', 'L-shaped'], ['Articulada', 'Hinged (drop-down)']]),
    len('largura', 'Comprimento', 'Length', 0.8, 0.3, 1.2),
    len('base', 'Altura do piso', 'Height above floor', 0.75, 0.6, 0.95),
    mat('matMetal', 'Metal', 'Metal', 'stainless'),
  ],
  parts: [
    // The bar, 4 cm from the wall to its centre (NBR 9050: diameter 3 to 4.5 cm, 4 cm clear).
    { kind: 'cylinder', name: w('Barra', 'Bar'), x: '-largura/2', y: -0.055, z: 'base', r: 0.017, h: 'largura', roll: 90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Fixação', 'Mount'), repeat: { count: 2, dx: 'largura - 0.04' }, x: '-largura/2 + 0.02', y: 0, z: 'base', r: 0.012, h: 0.055, tilt: -90, material: 'matMetal' },
    { kind: 'cylinder', name: w('Canopla', 'Rose'), repeat: { count: 2, dx: 'largura - 0.04' }, x: '-largura/2 + 0.02', y: 0.005, z: 'base', r: 0.035, h: 0.008, tilt: -90, material: 'matMetal' },
    // The L's upright, from the bar's end up 70 cm.
    { kind: 'cylinder', name: w('Barra vertical', 'Upright bar'), when: 'modelo == 1', x: 'largura/2', y: -0.055, z: 'base', r: 0.017, h: 0.7, material: 'matMetal' },
    { kind: 'cylinder', name: w('Fixação', 'Mount'), when: 'modelo == 1', x: 'largura/2', y: 0, z: 'base + 0.68', r: 0.012, h: 0.055, tilt: -90, material: 'matMetal' },
    // Hinged: a loop out from the wall, its hinge plate.
    { kind: 'box', name: w('Placa', 'Plate'), when: 'modelo == 2', x: '-largura/2 - 0.04', y: -0.01, z: 'base - 0.1', w: 0.08, d: 0.01, h: 0.2, material: 'matMetal', round: 0.004 },
    { kind: 'cylinder', name: w('Barra inferior', 'Lower bar'), when: 'modelo == 2', x: '-largura/2', y: -0.055, z: 'base - 0.08', r: 0.017, h: 'largura', roll: 90, material: 'matMetal' },
  ],
  handles: [{ param: 'largura', axis: 'x', at: ['largura/2', -0.055, 'base'], shift: 0.5 }],
  types: [
    { id: 'straight', name: w('Reta 80 cm', 'Straight 80 cm'), values: {} },
    { id: 'l', name: w('Em L 70 × 70', 'L-shaped 70 × 70'), values: { modelo: 1, largura: 0.7 } },
    { id: 'hinged', name: w('Articulada (lado da bacia)', 'Hinged (by the toilet)'), values: { modelo: 2, largura: 0.75 } },
  ],
  rules: [{ when: 'base < 0.7 || base > 0.8', message: w('NBR 9050: barra horizontal a 75 cm do piso (70 a 80)', 'NBR 9050: horizontal bar at 75 cm (70 to 80)') }],
};

export const LIBRARY_BATH: readonly ObjectDefinition[] = [VANITY_SINK, BATHTUB, SHOWER_GLASS, TOWEL_RAIL, MIRROR, URINAL, GRAB_BARS];
