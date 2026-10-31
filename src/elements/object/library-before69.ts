// The library's definitions as files of versions 66 to 68 have them (io/project-file.ts): one stored
// unchanged by the user is replaced by the one now; one the user changed is kept. The bookcase's four
// book parts each repeated every book and kept a quarter: at its largest sizes over the 500 copies a
// part may make, and its top shelves stood empty.

import type { ObjectDefinition } from './schema';
import type { DefinitionId } from './schema';

export const BEFORE_69: readonly ObjectDefinition[] = [
  {
    "id": "def_bookcase" as DefinitionId,
    "name": {
      "pt": "Estante",
      "en": "Bookcase"
    },
    "category": "casework",
    "params": [
      {
        "name": "largura",
        "label": {
          "pt": "Largura",
          "en": "Width"
        },
        "kind": "length",
        "default": 0.8,
        "min": 0.3,
        "max": 3,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "profundidade",
        "label": {
          "pt": "Profundidade",
          "en": "Depth"
        },
        "kind": "length",
        "default": 0.3,
        "min": 0.15,
        "max": 0.8,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "altura",
        "label": {
          "pt": "Altura",
          "en": "Height"
        },
        "kind": "length",
        "default": 1.8,
        "min": 0.3,
        "max": 3,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "espessura",
        "label": {
          "pt": "Espessura da chapa",
          "en": "Board thickness"
        },
        "kind": "length",
        "default": 0.018,
        "min": 0.012,
        "max": 0.05,
        "step": 0.005,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "vao",
        "label": {
          "pt": "Vão entre prateleiras",
          "en": "Shelf spacing"
        },
        "kind": "length",
        "default": 0.35,
        "min": 0.18,
        "max": 0.6,
        "step": 0.005,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "fundo",
        "label": {
          "pt": "Com fundo",
          "en": "With back"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "prateleiras",
        "label": {
          "pt": "Prateleiras",
          "en": "Shelves"
        },
        "kind": "integer",
        "default": 0,
        "formula": "max(0, floor((altura - 2 * espessura) / vao) - 1)",
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "livros",
        "label": {
          "pt": "Com livros",
          "en": "With books"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "porNivel",
        "label": {
          "pt": "Livros por prateleira",
          "en": "Books a shelf"
        },
        "kind": "integer",
        "default": 0,
        "formula": "floor((largura - 2 * espessura) * 0.72 / 0.032)",
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "matChapa",
        "label": {
          "pt": "Chapas",
          "en": "Boards"
        },
        "kind": "material",
        "default": "mdfWhite",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      }
    ],
    "parts": [
      {
        "kind": "box",
        "name": {
          "pt": "Lateral",
          "en": "Side"
        },
        "repeat": {
          "count": 2,
          "dx": "largura - espessura"
        },
        "x": "-largura/2",
        "y": "-profundidade/2",
        "z": 0,
        "w": "espessura",
        "d": "profundidade",
        "h": "altura",
        "material": "matChapa"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Base e topo",
          "en": "Base and top"
        },
        "repeat": {
          "count": 2,
          "dz": "altura - espessura"
        },
        "x": "-largura/2 + espessura",
        "y": "-profundidade/2",
        "z": 0,
        "w": "largura - 2 * espessura",
        "d": "profundidade",
        "h": "espessura",
        "material": "matChapa"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Fundo",
          "en": "Back"
        },
        "when": "fundo",
        "x": "-largura/2 + espessura",
        "y": "profundidade/2 - 0.006",
        "z": "espessura",
        "w": "largura - 2 * espessura",
        "d": 0.006,
        "h": "altura - 2 * espessura",
        "material": "matChapa"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Prateleira",
          "en": "Shelf"
        },
        "repeat": {
          "count": "prateleiras"
        },
        "x": "-largura/2 + espessura",
        "y": "-profundidade/2",
        "z": "espessura + (i + 1) * (altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + i * espessura",
        "w": "largura - 2 * espessura",
        "d": "profundidade - if(fundo, 0.006, 0)",
        "h": "espessura",
        "material": "matChapa"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Livro",
          "en": "Book"
        },
        "when": "livros && i % 4 == 0",
        "repeat": {
          "count": "porNivel * (prateleiras + 1)"
        },
        "x": "-largura/2 + espessura + 0.01 + (i % porNivel) * 0.032",
        "y": "-profundidade/2 + 0.02 + ((i * 3) % 4) * 0.008",
        "z": "espessura + floor(i / porNivel) * ((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + espessura)",
        "w": 0.028,
        "d": "min(profundidade - 0.05, 0.16 + ((i * 7) % 3) * 0.03)",
        "h": "min((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) - 0.03, 0.2 + ((i * 5) % 4) * 0.025)",
        "material": "lacquerTerracotta",
        "round": 0.002
      },
      {
        "kind": "box",
        "name": {
          "pt": "Livro",
          "en": "Book"
        },
        "when": "livros && i % 4 == 1",
        "repeat": {
          "count": "porNivel * (prateleiras + 1)"
        },
        "x": "-largura/2 + espessura + 0.01 + (i % porNivel) * 0.032",
        "y": "-profundidade/2 + 0.02 + ((i * 3) % 4) * 0.008",
        "z": "espessura + floor(i / porNivel) * ((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + espessura)",
        "w": 0.028,
        "d": "min(profundidade - 0.05, 0.16 + ((i * 7) % 3) * 0.03)",
        "h": "min((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) - 0.03, 0.2 + ((i * 5) % 4) * 0.025)",
        "material": "lacquerSage",
        "round": 0.002
      },
      {
        "kind": "box",
        "name": {
          "pt": "Livro",
          "en": "Book"
        },
        "when": "livros && i % 4 == 2",
        "repeat": {
          "count": "porNivel * (prateleiras + 1)"
        },
        "x": "-largura/2 + espessura + 0.01 + (i % porNivel) * 0.032",
        "y": "-profundidade/2 + 0.02 + ((i * 3) % 4) * 0.008",
        "z": "espessura + floor(i / porNivel) * ((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + espessura)",
        "w": 0.028,
        "d": "min(profundidade - 0.05, 0.16 + ((i * 7) % 3) * 0.03)",
        "h": "min((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) - 0.03, 0.2 + ((i * 5) % 4) * 0.025)",
        "material": "linen",
        "round": 0.002
      },
      {
        "kind": "box",
        "name": {
          "pt": "Livro",
          "en": "Book"
        },
        "when": "livros && i % 4 == 3",
        "repeat": {
          "count": "porNivel * (prateleiras + 1)"
        },
        "x": "-largura/2 + espessura + 0.01 + (i % porNivel) * 0.032",
        "y": "-profundidade/2 + 0.02 + ((i * 3) % 4) * 0.008",
        "z": "espessura + floor(i / porNivel) * ((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) + espessura)",
        "w": 0.028,
        "d": "min(profundidade - 0.05, 0.16 + ((i * 7) % 3) * 0.03)",
        "h": "min((altura - 2 * espessura - prateleiras * espessura) / (prateleiras + 1) - 0.03, 0.2 + ((i * 5) % 4) * 0.025)",
        "material": "velvet",
        "round": 0.002
      }
    ],
    "handles": [
      {
        "param": "largura",
        "axis": "x",
        "at": [
          "largura/2",
          0,
          "altura"
        ],
        "shift": 0.5
      },
      {
        "param": "largura",
        "axis": "x",
        "at": [
          "-largura/2",
          0,
          "altura"
        ],
        "shift": 0.5,
        "sign": -1
      },
      {
        "param": "profundidade",
        "axis": "y",
        "at": [
          0,
          "-profundidade/2",
          "altura"
        ],
        "shift": 0.5,
        "sign": -1
      },
      {
        "param": "altura",
        "axis": "z",
        "at": [
          0,
          0,
          "altura"
        ]
      }
    ],
    "types": [
      {
        "id": "b80",
        "name": {
          "pt": "80 × 30 × 180",
          "en": "80 × 30 × 180"
        },
        "values": {
          "largura": 0.8,
          "profundidade": 0.3,
          "altura": 1.8
        }
      },
      {
        "id": "b120",
        "name": {
          "pt": "120 × 35 × 200",
          "en": "120 × 35 × 200"
        },
        "values": {
          "largura": 1.2,
          "profundidade": 0.35,
          "altura": 2
        }
      },
      {
        "id": "low",
        "name": {
          "pt": "Baixa 80 × 30 × 90",
          "en": "Low 80 × 30 × 90"
        },
        "values": {
          "largura": 0.8,
          "profundidade": 0.3,
          "altura": 0.9
        }
      }
    ],
    "rules": [
      {
        "when": "largura - 2 * espessura > 0.9",
        "message": {
          "pt": "Prateleira com mais de 90 cm sem apoio: pode envergar com livros",
          "en": "A shelf over 90 cm without support may sag under books"
        }
      }
    ]
  }
];
