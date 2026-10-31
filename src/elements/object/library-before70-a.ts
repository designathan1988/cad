// BEFORE_70 (library-before70.ts), part A: whole definitions, in the order the list has them.

import type { ObjectDefinition } from './schema';
import type { DefinitionId } from './schema';

export const BEFORE_70_A: readonly ObjectDefinition[] = [
  {
    "id": "def_meeting_table" as DefinitionId,
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
        "definition": "def_office_chair" as DefinitionId,
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
        "definition": "def_office_chair" as DefinitionId,
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
  }
];
