// Points of interest (ref/chat.txt:170): numbered places in the model, each with a title and a text, that
// a visitor opens as a card. In the document (saved, undone); numbered by their order. Pure.

import type { Command } from '../core/store';
import type { Point2 } from '../core/vector';
import type { Doc } from './document';

export interface PointOfInterest {
  readonly id: string;
  readonly levelId: string;
  readonly point: Point2;
  readonly title: string;
  readonly text?: string;
}

/** How high above its level's floor a point's marker stands in 3D (m): about the eyes of someone seated. */
export const POINT_HEIGHT = 1.2;

export const addPoint = (p: PointOfInterest): Command<Doc> => ({
  label: 'cmd.addPoint',
  apply: (doc) => ({ ...doc, points: [...doc.points, p] }),
});

/** A point's title or text changed; an empty text is none, an empty title keeps the old one. */
export const updatePoint = (id: string, patch: { readonly title?: string; readonly text?: string }): Command<Doc> => ({
  label: 'cmd.updatePoint',
  apply: (doc) => {
    let changed = false;
    const points = doc.points.map((p) => {
      if (p.id !== id) return p;
      const title = patch.title !== undefined && patch.title.trim() !== '' ? patch.title.trim() : p.title;
      const text = patch.text !== undefined ? patch.text.trim() : (p.text ?? '');
      if (title === p.title && text === (p.text ?? '')) return p;
      changed = true;
      const { text: _t, ...rest } = p;
      return text === '' ? { ...rest, title } : { ...rest, title, text };
    });
    return changed ? { ...doc, points } : doc;
  },
});

export const deletePoint = (id: string): Command<Doc> => ({
  label: 'cmd.deletePoint',
  apply: (doc) => (doc.points.some((p) => p.id === id) ? { ...doc, points: doc.points.filter((p) => p.id !== id) } : doc),
});

/** Whether a stored value is a point of interest (project-file.ts). */
export function isPointOfInterest(v: unknown): v is PointOfInterest {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const p = o.point as Record<string, unknown> | undefined;
  return (
    typeof o.id === 'string' &&
    typeof o.levelId === 'string' &&
    typeof o.title === 'string' &&
    (o.text === undefined || typeof o.text === 'string') &&
    typeof p === 'object' &&
    p !== null &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y)
  );
}
