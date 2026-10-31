// BEFORE_70 (library-before70.ts), part C: whole definitions, in the order the list has them.

import type { ObjectDefinition } from './schema';
import type { DefinitionId } from './schema';

export const BEFORE_70_C: readonly ObjectDefinition[] = [
  {
    "id": "def_fire_pit" as DefinitionId,
    "name": {
      "pt": "Fogo de chão",
      "en": "Fire pit"
    },
    "category": "equipment",
    "folder": "Área externa",
    "params": [
      {
        "name": "largura",
        "label": {
          "pt": "Diâmetro",
          "en": "Diameter"
        },
        "kind": "length",
        "default": 1,
        "min": 0.6,
        "max": 1.8,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "altura",
        "label": {
          "pt": "Altura da borda",
          "en": "Rim height"
        },
        "kind": "length",
        "default": 0.35,
        "min": 0.1,
        "max": 0.5,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "fogo",
        "label": {
          "pt": "Aceso",
          "en": "Lit"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "matBorda",
        "label": {
          "pt": "Borda",
          "en": "Rim"
        },
        "kind": "material",
        "default": "stone",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      }
    ],
    "parts": [
      {
        "kind": "revolve",
        "name": {
          "pt": "Borda",
          "en": "Rim"
        },
        "x": 0,
        "y": 0,
        "z": 0,
        "points": [
          [
            "largura/2",
            0
          ],
          [
            "largura/2",
            "altura"
          ],
          [
            "largura/2 - 0.1",
            "altura"
          ],
          [
            "largura/2 - 0.12",
            "altura - 0.12"
          ],
          [
            0,
            "altura - 0.12"
          ]
        ],
        "material": "matBorda"
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Brasas",
          "en": "Embers"
        },
        "x": 0,
        "y": 0,
        "z": "altura - 0.12",
        "r": "largura/2 - 0.13",
        "h": 0.015,
        "material": "graniteBlack"
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Lenha",
          "en": "Log"
        },
        "repeat": {
          "count": 4
        },
        "x": "-0.05 * sin(90 * i)",
        "y": "0.05 * cos(90 * i)",
        "z": "altura - 0.1",
        "r": 0.04,
        "h": "min(0.4, largura/2 - 0.16)",
        "tilt": 80,
        "turn": "90 * i + 30",
        "material": "bark"
      },
      {
        "kind": "revolve",
        "name": {
          "pt": "Chama",
          "en": "Flame"
        },
        "when": "fogo",
        "repeat": {
          "count": 3
        },
        "x": "0.06 * sin(120 * i)",
        "y": "0.06 * cos(120 * i)",
        "z": "altura - 0.08",
        "points": [
          [
            0.07,
            0
          ],
          [
            0.06,
            0.1
          ],
          [
            0.025,
            "0.22 + i * 0.06"
          ],
          [
            0,
            "0.28 + i * 0.07"
          ]
        ],
        "material": "lacquerTerracotta"
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
      }
    ],
    "types": [
      {
        "id": "stone",
        "name": {
          "pt": "Pedra 1 m",
          "en": "Stone 1 m"
        },
        "values": {}
      },
      {
        "id": "steel",
        "name": {
          "pt": "Aço corten baixo",
          "en": "Low steel"
        },
        "values": {
          "matBorda": "copper",
          "altura": 0.2,
          "fogo": 0
        }
      }
    ]
  },
  {
    "id": "def_reception_desk" as DefinitionId,
    "name": {
      "pt": "Balcão de recepção",
      "en": "Reception desk"
    },
    "category": "casework",
    "folder": "Comercial",
    "params": [
      {
        "name": "largura",
        "label": {
          "pt": "Largura",
          "en": "Width"
        },
        "kind": "length",
        "default": 2.2,
        "min": 1.2,
        "max": 4,
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
        "default": 0.75,
        "min": 0.6,
        "max": 0.9,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "altura",
        "label": {
          "pt": "Altura do balcão",
          "en": "Counter height"
        },
        "kind": "length",
        "default": 1.1,
        "min": 1,
        "max": 1.2,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "lateral",
        "label": {
          "pt": "Com retorno lateral (L)",
          "en": "With a return (L)"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "retorno",
        "label": {
          "pt": "Comprimento do retorno",
          "en": "Return length"
        },
        "kind": "length",
        "default": 1.2,
        "min": 0.6,
        "max": 2,
        "step": 0.005,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "acessivel",
        "label": {
          "pt": "Trecho rebaixado acessível",
          "en": "Lowered accessible part"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "matFrente",
        "label": {
          "pt": "Frente",
          "en": "Front"
        },
        "kind": "material",
        "default": "woodSlats",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      },
      {
        "name": "matTampo",
        "label": {
          "pt": "Tampos",
          "en": "Tops"
        },
        "kind": "material",
        "default": "quartz",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      },
      {
        "name": "matCorpo",
        "label": {
          "pt": "Corpo",
          "en": "Body"
        },
        "kind": "material",
        "default": "lacquerWhite",
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
          "pt": "Painel frontal",
          "en": "Front panel"
        },
        "x": "-largura/2",
        "y": "-profundidade/2",
        "z": 0.05,
        "w": "largura - acessivel * 0.9",
        "d": 0.05,
        "h": "altura - 0.07",
        "material": "matFrente"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Tampo alto",
          "en": "Transaction top"
        },
        "x": "-largura/2 - 0.02",
        "y": "-profundidade/2 - 0.06",
        "z": "altura - 0.025",
        "w": "largura - acessivel * 0.9 + 0.02",
        "d": 0.3,
        "h": 0.025,
        "material": "matTampo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Rodapé",
          "en": "Plinth"
        },
        "x": "-largura/2",
        "y": "-profundidade/2 + 0.04",
        "z": 0,
        "w": "largura",
        "d": 0.04,
        "h": 0.05,
        "material": "plasticBlack"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Painel rebaixado",
          "en": "Lowered panel"
        },
        "when": "acessivel",
        "x": "largura/2 - 0.9",
        "y": "-profundidade/2",
        "z": 0.05,
        "w": 0.9,
        "d": 0.05,
        "h": 0.68,
        "material": "matFrente"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Tampo rebaixado",
          "en": "Lowered top"
        },
        "when": "acessivel",
        "x": "largura/2 - 0.9",
        "y": "-profundidade/2 - 0.06",
        "z": 0.73,
        "w": 0.92,
        "d": "profundidade + 0.06",
        "h": 0.025,
        "material": "matTampo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Tampo de trabalho",
          "en": "Work top"
        },
        "x": "-largura/2",
        "y": "-profundidade/2 + 0.05",
        "z": 0.73,
        "w": "largura - acessivel * 0.9",
        "d": "profundidade - 0.05",
        "h": 0.025,
        "material": "matTampo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Gaveteiro",
          "en": "Drawer unit"
        },
        "x": "-largura/2 + 0.05",
        "y": "-profundidade/2 + 0.1",
        "z": 0.05,
        "w": 0.45,
        "d": "profundidade - 0.15",
        "h": 0.68,
        "material": "matCorpo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Retorno",
          "en": "Return"
        },
        "when": "lateral",
        "x": "-largura/2",
        "y": "profundidade/2",
        "z": 0.05,
        "w": 0.05,
        "d": "retorno",
        "h": 0.68,
        "material": "matFrente"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Tampo do retorno",
          "en": "Return top"
        },
        "when": "lateral",
        "x": "-largura/2",
        "y": "profundidade/2",
        "z": 0.73,
        "w": 0.6,
        "d": "retorno",
        "h": 0.025,
        "material": "matTampo"
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
        "id": "l",
        "name": {
          "pt": "Em L, ripado, acessível",
          "en": "L-shaped, slatted, accessible"
        },
        "values": {}
      },
      {
        "id": "straight",
        "name": {
          "pt": "Reto, branco",
          "en": "Straight, white"
        },
        "values": {
          "lateral": 0,
          "matFrente": "lacquerWhite",
          "matTampo": "marble"
        }
      }
    ],
    "rules": [
      {
        "when": "acessivel == 0",
        "message": {
          "pt": "NBR 9050: balcão de atendimento precisa de trecho a até 90 cm (75 a 85)",
          "en": "NBR 9050: a service counter needs a part no higher than 90 cm (75 to 85)"
        }
      }
    ]
  }
];
