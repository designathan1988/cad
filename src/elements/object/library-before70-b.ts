// BEFORE_70 (library-before70.ts), part B: whole definitions, in the order the list has them.

import type { ObjectDefinition } from './schema';
import type { DefinitionId } from './schema';

export const BEFORE_70_B: readonly ObjectDefinition[] = [
  {
    "id": "def_bbq" as DefinitionId,
    "name": {
      "pt": "Churrasqueira",
      "en": "Barbecue"
    },
    "category": "equipment",
    "folder": "Área externa",
    "params": [
      {
        "name": "modelo",
        "label": {
          "pt": "Modelo",
          "en": "Model"
        },
        "kind": "choice",
        "default": 0,
        "options": [
          {
            "pt": "Alvenaria",
            "en": "Built of brick"
          },
          {
            "pt": "Bola (portátil)",
            "en": "Kettle"
          }
        ],
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "largura",
        "label": {
          "pt": "Largura",
          "en": "Width"
        },
        "kind": "length",
        "default": 1.2,
        "min": 0.8,
        "max": 2,
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
        "default": 0.7,
        "min": 0.55,
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
          "pt": "Altura até o teto",
          "en": "Height to ceiling"
        },
        "kind": "length",
        "default": 2.6,
        "min": 2.2,
        "max": 3.2,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "matTijolo",
        "label": {
          "pt": "Alvenaria",
          "en": "Brickwork"
        },
        "kind": "material",
        "default": "brick",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      },
      {
        "name": "matBancada",
        "label": {
          "pt": "Bancada",
          "en": "Counter"
        },
        "kind": "material",
        "default": "graniteBlack",
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
          "pt": "Base",
          "en": "Base"
        },
        "when": "modelo == 0",
        "x": "-largura/2",
        "y": "-profundidade/2",
        "z": 0,
        "w": "largura",
        "d": "profundidade",
        "h": 0.85,
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Nicho de lenha",
          "en": "Wood niche"
        },
        "when": "modelo == 0",
        "cut": true,
        "x": "-largura/2 + 0.12",
        "y": "-profundidade/2 - 0.01",
        "z": 0.1,
        "w": "largura - 0.24",
        "d": "profundidade - 0.1",
        "h": 0.6
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Lenha",
          "en": "Log"
        },
        "when": "modelo == 0",
        "repeat": {
          "count": "floor((largura - 0.3) / 0.11)",
          "dx": 0.11
        },
        "x": "-largura/2 + 0.2",
        "y": "-profundidade/2 + 0.08",
        "z": 0.15,
        "r": 0.05,
        "h": "profundidade - 0.25",
        "tilt": 90,
        "material": "bark"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Bancada",
          "en": "Counter"
        },
        "when": "modelo == 0",
        "x": "-largura/2 - 0.03",
        "y": "-profundidade/2 - 0.03",
        "z": 0.85,
        "w": "largura + 0.06",
        "d": "profundidade + 0.03",
        "h": 0.04,
        "material": "matBancada"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Fundo da fornalha",
          "en": "Firebox back"
        },
        "when": "modelo == 0",
        "x": "-largura/2 + 0.05",
        "y": "profundidade/2 - 0.12",
        "z": 0.89,
        "w": "largura - 0.1",
        "d": 0.12,
        "h": 0.45,
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Lateral da fornalha",
          "en": "Firebox side"
        },
        "when": "modelo == 0",
        "repeat": {
          "count": 2,
          "dx": "largura - 0.22"
        },
        "x": "-largura/2 + 0.05",
        "y": "-profundidade/2 + 0.05",
        "z": 0.89,
        "w": 0.12,
        "d": "profundidade - 0.05",
        "h": 0.45,
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Grelha",
          "en": "Grill"
        },
        "when": "modelo == 0",
        "repeat": {
          "count": "floor((largura - 0.36) / 0.03)",
          "dx": 0.03
        },
        "x": "-largura/2 + 0.19",
        "y": "-profundidade/2 + 0.08",
        "z": 1.08,
        "w": 0.006,
        "d": "profundidade - 0.22",
        "h": 0.008,
        "material": "stainless"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Espeto",
          "en": "Skewer"
        },
        "when": "modelo == 0",
        "repeat": {
          "count": 3,
          "dy": 0.12
        },
        "x": "-largura/2 + 0.17",
        "y": "-profundidade/2 + 0.14",
        "z": 1.2,
        "w": "largura - 0.34",
        "d": 0.01,
        "h": 0.01,
        "material": "stainless"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Viga da boca",
          "en": "Lintel"
        },
        "when": "modelo == 0",
        "x": "-largura/2 + 0.05",
        "y": "-profundidade/2 + 0.05",
        "z": 1.34,
        "w": "largura - 0.1",
        "d": "profundidade - 0.05",
        "h": 0.1,
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Coifa",
          "en": "Hood"
        },
        "when": "modelo == 0",
        "x": "-largura/2 + 0.05",
        "y": "-profundidade/2 + 0.05",
        "z": 1.44,
        "w": "largura - 0.1",
        "d": 0.12,
        "h": "sqrt((profundidade - 0.55) * (profundidade - 0.55) + 0.36)",
        "tilt": "atan2(profundidade - 0.55, 0.6)",
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Corpo da coifa",
          "en": "Hood body"
        },
        "when": "modelo == 0",
        "x": "-largura/2 + 0.05",
        "y": "profundidade/2 - 0.38",
        "z": 1.44,
        "w": "largura - 0.1",
        "d": 0.38,
        "h": 0.6,
        "material": "matTijolo"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Chaminé",
          "en": "Flue"
        },
        "when": "modelo == 0",
        "x": -0.22,
        "y": "profundidade/2 - 0.4",
        "z": 2.04,
        "w": 0.44,
        "d": 0.4,
        "h": "altura - 2.04",
        "material": "matTijolo"
      },
      {
        "kind": "revolve",
        "name": {
          "pt": "Bacia",
          "en": "Bowl"
        },
        "when": "modelo == 1",
        "x": 0,
        "y": 0,
        "z": 0.55,
        "points": [
          [
            0.05,
            0
          ],
          [
            0.2,
            0.05
          ],
          [
            0.28,
            0.16
          ],
          [
            0.29,
            0.28
          ]
        ],
        "material": "lacquerBlack"
      },
      {
        "kind": "revolve",
        "name": {
          "pt": "Tampa",
          "en": "Lid"
        },
        "when": "modelo == 1",
        "x": 0,
        "y": 0,
        "z": 0.835,
        "points": [
          [
            0.295,
            0
          ],
          [
            0.27,
            0.1
          ],
          [
            0.17,
            0.2
          ],
          [
            0.04,
            0.24
          ],
          [
            0,
            0.245
          ]
        ],
        "material": "lacquerBlack"
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Pegador",
          "en": "Handle"
        },
        "when": "modelo == 1",
        "x": -0.06,
        "y": 0,
        "z": 1.1,
        "r": 0.012,
        "h": 0.12,
        "roll": 90,
        "material": "freijo"
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Pé",
          "en": "Leg"
        },
        "when": "modelo == 1",
        "repeat": {
          "count": 3
        },
        "x": "-0.2 * sin(120 * i)",
        "y": "0.2 * cos(120 * i)",
        "z": 0,
        "r": 0.012,
        "h": 0.6,
        "material": "aluminium"
      },
      {
        "kind": "cylinder",
        "name": {
          "pt": "Bandeja",
          "en": "Tray"
        },
        "when": "modelo == 1",
        "x": 0,
        "y": 0,
        "z": 0.22,
        "r": 0.2,
        "h": 0.008,
        "material": "aluminium"
      }
    ],
    "handles": [
      {
        "param": "largura",
        "axis": "x",
        "at": [
          "largura/2",
          0,
          0.88
        ],
        "shift": 0.5
      }
    ],
    "types": [
      {
        "id": "brick",
        "name": {
          "pt": "Alvenaria 1,20 m",
          "en": "Brick 1.20 m"
        },
        "values": {}
      },
      {
        "id": "kettle",
        "name": {
          "pt": "Bola 57 cm",
          "en": "Kettle 57 cm"
        },
        "values": {
          "modelo": 1
        }
      },
      {
        "id": "concrete",
        "name": {
          "pt": "Concreto aparente",
          "en": "Fair-faced concrete"
        },
        "values": {
          "matTijolo": "concretePolished",
          "matBancada": "stone",
          "largura": 1.6
        }
      }
    ]
  }
];
