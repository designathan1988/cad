// Tags in the registry (contract.ts): elements/tag holds the element. In plan, its text on a backing with
// a leader to the nearest point of its element and a dot there; gone with its element. On the DXF as the
// leader and the text on the annotations' layer.

import { isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { getLang } from '../../ui/i18n';
import type { ElementKind, PlanPaint } from '../contract';
import { segmentDistance } from '../dimension/anchor';
import { setTagText } from '../tag/commands';
import { fillTag, TAG_FIELDS, TAG_PREFIX, TAG_WORDS, type Tag } from '../tag/schema';
import { tagAnchor, tagValues } from '../tag/values';

export interface TagSolid {
  readonly tag: Tag;
  /** What it says now, and where its leader ends (null: its element is not there to point at). */
  readonly text: string;
  readonly anchor: Point2 | null;
}

/** The text a new tag of an element starts with, in the interface's words. */
export function defaultTagText(id: string): string {
  const pt = getLang() === 'pt';
  if (id.startsWith('room_')) return pt ? '{número} {nome} · {área}' : '{number} {name} · {area}';
  if (id.startsWith('wall_')) return pt ? '{tipo} · {comprimento}' : '{type} · {length}';
  if (id.startsWith('opening_')) return pt ? '{largura} × {altura}' : '{width} × {height}';
  return pt ? '{nome}' : '{name}';
}

/** The text's half width and half height in the model (about 6.5 px a letter, 15 px high). */
const halfBox = (text: string, scale: number) => ({ w: (text.length * 6.5) / 2 / scale + 4 / scale, h: 9 / scale });

export const tagKind: ElementKind<Tag, TagSolid> = {
  key: 'tags',
  prefix: TAG_PREFIX,
  category: null,
  layer: 'top',
  icon: 'tag',
  one: 'tag.title',
  many: 'tag.titleMany',
  dropped: 'fix.droppedTags',
  exportName: 'tag.title',
  exportColour: 'structure',
  valid: (x): x is Tag => isObject(x) && typeof x.id === 'string' && typeof x.levelId === 'string' && typeof x.target === 'string' && isPoint(x.at) && typeof x.text === 'string' && x.text.trim() !== '',
  derive: (doc, tag, g) => ({ tag, text: fillTag(tag.text, tagValues(doc, g, tag.target)), anchor: tagAnchor(doc, g, tag.target, tag.at) }),
  element: (s) => s.tag,
  holders: (tag) => [tag.target],
  // A copy of the element gets a copy of its tag; mirrored or turned, the text goes where it is taken.
  transformed: (tag, c) => {
    if (!c.going(tag.target) || c.selected) return null;
    return c.copy ? { ...tag, id: c.id, target: c.to(tag.target), at: c.t.map(tag.at) } : { ...tag, at: c.t.map(tag.at) };
  },
  outlines: (s) => (s.anchor ? [[s.anchor, s.tag.at]] : [[s.tag.at]]),
  hit: (s, p, near, scale) => {
    const b = halfBox(s.text, scale);
    if (Math.abs(p.x - s.tag.at.x) <= b.w + near && Math.abs(p.y - s.tag.at.y) <= b.h + near) return true;
    return s.anchor !== null && segmentDistance(p, s.anchor, s.tag.at) <= near;
  },
  pick: 'first',
  moved: (tag, d) => ({ ...tag, at: { x: tag.at.x + d.x, y: tag.at.y + d.y } }),
  mapped: (tag, tr, id) => ({ ...tag, id, at: tr.map(tag.at) }),
  similar: (a, b) => a.text === b.text,
  plan: (p, s, lit) => drawTag(p, s, lit ? p.color('--wall-sel') : p.color('--text')),
  dxf: (s, out) => {
    if (s.anchor) out.line('A-ANNO-TEXT', s.anchor, s.tag.at);
    out.text('A-ANNO-TEXT', { x: s.tag.at.x, y: s.tag.at.y - 0.06 }, 0.12, s.text);
  },
  fields: (items, { dispatch }) => {
    const ids = items.map((s) => s.tag.id);
    return [
      { id: 'tagText', label: 'tag.text', kind: 'text', get: (s: TagSolid) => s.tag.text, set: (v: string) => dispatch(setTagText(ids, v)) },
      { id: 'tagShows', label: 'tag.shows', kind: 'readout', text: (xs: readonly TagSolid[]) => (xs.length === 1 ? xs[0]!.text : '—') },
      // The words a tag knows, in the interface's language (not through t: its braces are t's own placeholders).
      { id: 'tagWords', label: 'tag.words', kind: 'readout', text: () => TAG_FIELDS.map((f) => `{${TAG_WORDS[f][getLang() === 'pt' ? 0 : TAG_WORDS[f].length - 1]}}`).join(' ') },
    ];
  },
};

/** A tag in plan: the leader with a dot on the element, then the text over a backing with a thin frame. */
function drawTag(p: PlanPaint, s: TagSolid, colour: string): void {
  const { ctx } = p;
  const at = p.toScreen(s.tag.at);
  ctx.save();
  ctx.font = p.font('600', '--fs-xs');
  const w = ctx.measureText(s.text).width + 10;
  const h = 18;
  if (s.anchor) {
    const a = p.toScreen(s.anchor);
    // The leader from the box's edge nearest the element.
    const ex = Math.max(at.x - w / 2, Math.min(at.x + w / 2, a.x));
    const ey = Math.max(at.y - h / 2, Math.min(at.y + h / 2, a.y));
    ctx.strokeStyle = colour;
    ctx.lineWidth = p.pen('annotation');
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(a.x, a.y);
    ctx.stroke();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = p.color('--canvas');
  ctx.globalAlpha = 0.9;
  ctx.fillRect(at.x - w / 2, at.y - h / 2, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colour;
  ctx.lineWidth = p.pen('fine');
  ctx.strokeRect(at.x - w / 2, at.y - h / 2, w, h);
  ctx.fillStyle = colour;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.text, at.x, at.y + 0.5);
  ctx.restore();
}
