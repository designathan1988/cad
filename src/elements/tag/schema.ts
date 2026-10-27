// Tags (docs/plano-de-escopo.md, phase 10: "etiquetas por elemento com conteúdo livre"): a text by an element
// with a leader to it, written by the user with the element's own values in braces ({nome}, {área},
// {altura}…), filled in from the element as it is now. Held by its element: gone with it.

import type { Point2 } from '../../core/vector';

export const TAG_PREFIX = 'tag';

export interface Tag {
  readonly id: string;
  readonly levelId: string;
  /** The element it tags. */
  readonly target: string;
  /** Where its text stands. */
  readonly at: Point2;
  /** What it says, with the element's values in braces. */
  readonly text: string;
}

/** The values a tag can name, each by its Portuguese and its English word. */
export const TAG_FIELDS = ['name', 'type', 'number', 'area', 'perimeter', 'length', 'height', 'width', 'thickness', 'level'] as const;
export type TagField = (typeof TAG_FIELDS)[number];
export const TAG_WORDS: Readonly<Record<TagField, readonly string[]>> = {
  name: ['nome', 'name'],
  type: ['tipo', 'type'],
  number: ['número', 'numero', 'number'],
  area: ['área', 'area'],
  perimeter: ['perímetro', 'perimetro', 'perimeter'],
  length: ['comprimento', 'length'],
  height: ['altura', 'height'],
  width: ['largura', 'width'],
  thickness: ['espessura', 'thickness'],
  level: ['pavimento', 'level'],
};

/** A tag's text with the element's values put in: a value it does not have reads "—"; a word not known stays as written. */
export function fillTag(text: string, values: Readonly<Partial<Record<TagField, string>>>): string {
  return text.replace(/\{([^{}]+)\}/g, (all, word: string) => {
    const w = word.trim().toLowerCase();
    const field = TAG_FIELDS.find((f) => TAG_WORDS[f].includes(w));
    return field ? (values[field] ?? '—') : all;
  });
}
