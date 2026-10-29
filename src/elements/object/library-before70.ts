// The library's definitions as files of version 69 have them (io/project-file.ts): one stored unchanged by
// the user is replaced by the one now; one the user changed is kept. The meeting table's long type said 10
// chairs and made 8; the kettle barbecue showed the brick one's sizes and width handle, which act on nothing
// of it; a fire pit under 15 cm had its floor below the ground; the reception desk's NBR 9050 rule gave the
// counter's width as a height.

import type { ObjectDefinition } from './schema';

export const BEFORE_70: readonly ObjectDefinition[] = [
  {
    "id": "def_meeting_table",
    "name": {
      "pt": "Mesa de reunião",
      "en": "Meeting table"
    },
    "category": "furniture",
    "folder": "Escritório",
    "params": [
      {
        "name": "largura",
        "label": {
          "pt": "Comprimento",
          "en": "Length"
        },
        "kind": "length",
        "default": 2.4,
        "min": 1.6,
        "max": 5,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "profundidade",
        "label": {
          "pt": "Largura",
          "en": "Width"
        },
        "kind": "length",
        "default": 1.1,
        "min": 0.9,
        "max": 1.6,
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
        "default": 0.75,
        "min": 0.72,
        "max": 0.78,
        "step": 0.005,
        "group": {
          "pt": "Dimensões",
          "en": "Dimensions"
        }
      },
      {
        "name": "porLado",
        "label": {
          "pt": "Cadeiras por lado",
          "en": "Chairs a side"
        },
        "kind": "integer",
        "default": 1,
        "formula": "max(1, floor((largura - 0.3) / 0.7))",
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "cadeiras",
        "label": {
          "pt": "Com cadeiras",
          "en": "With chairs"
        },
        "kind": "bool",
        "default": 1,
        "group": {
          "pt": "Construção",
          "en": "Construction"
        }
      },
      {
        "name": "matTampo",
        "label": {
          "pt": "Tampo",
          "en": "Top"
        },
        "kind": "material",
        "default": "walnut",
        "group": {
          "pt": "Materiais",
          "en": "Materials"
        }
      },
      {
        "name": "matBase",
        "label": {
          "pt": "Base",
          "en": "Base"
        },
        "kind": "material",
        "default": "blackSteel",
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
          "pt": "Tampo",
          "en": "Top"
        },
        "x": "-largura/2",
        "y": "-profundidade/2",
        "z": "altura - 0.035",
        "w": "largura",
        "d": "profundidade",
        "h": 0.035,
        "material": "matTampo",
        "round": 0.017
      },
      {
        "kind": "box",
        "name": {
          "pt": "Pedestal",
          "en": "Pedestal"
        },
        "repeat": {
          "count": 2,
          "dx": "largura * 0.5"
        },
        "x": "-largura * 0.25 - 0.1",
        "y": "-profundidade * 0.3",
        "z": 0,
        "w": 0.2,
        "d": "profundidade * 0.6",
        "h": "altura - 0.035",
        "material": "matBase",
        "round": 0.006
      },
      {
        "kind": "box",
        "name": {
          "pt": "Calha de cabos",
          "en": "Cable trough"
        },
        "x": "-largura * 0.25",
        "y": -0.07,
        "z": "altura - 0.035 - 0.08",
        "w": "largura * 0.5",
        "d": 0.14,
        "h": 0.08,
        "material": "matBase"
      },
      {
        "kind": "box",
        "name": {
          "pt": "Tomada de mesa",
          "en": "Table socket"
        },
        "x": -0.12,
        "y": -0.05,
        "z": "altura - 0.002",
        "w": 0.24,
        "d": 0.1,
        "h": 0.004,
        "material": "aluminium",
        "round": 0.002
      },
      {
        "kind": "object",
        "name": {
          "pt": "Cadeira",
          "en": "Chair"
        },
        "definition": "def_office_chair",
        "when": "cadeiras",
        "repeat": {
          "count": "porLado",
          "dx": "(largura - 0.3) / porLado"
        },
        "x": "-largura/2 + 0.15 + (largura - 0.3) / porLado / 2",
        "y": "-profundidade/2 - 0.18",
        "z": 0,
        "angle": 180,
        "values": {
          "bracos": 1
        }
      },
      {
        "kind": "object",
        "name": {
          "pt": "Cadeira",
          "en": "Chair"
        },
        "definition": "def_office_chair",
        "when": "cadeiras",
        "repeat": {
          "count": "porLado",
          "dx": "(largura - 0.3) / porLado"
        },
        "x": "-largura/2 + 0.15 + (largura - 0.3) / porLado / 2",
        "y": "profundidade/2 + 0.18",
        "z": 0,
        "values": {
          "bracos": 1
        }
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
        "id": "eight",
        "name": {
          "pt": "2,40 m, 6 cadeiras",
          "en": "2.40 m, 6 chairs"
        },
        "values": {}
      },
      {
        "id": "long",
        "name": {
          "pt": "3,60 m, 10 cadeiras, carvalho",
          "en": "3.60 m, 10 chairs, oak"
        },
        "values": {
          "largura": 3.6,
          "profundidade": 1.3,
          "matTampo": "oak"
        }
      },
      {
        "id": "bare",
        "name": {
          "pt": "Só a mesa, branca",
          "en": "Table only, white"
        },
        "values": {
          "cadeiras": 0,
          "matTampo": "lacquerWhite",
          "matBase": "lacquerWhite"
        }
      }
    ]
  },
  {
    "id": "def_bbq",
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
  },
  {
    "id": "def_fire_pit",
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
    "id": "def_reception_desk",
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
