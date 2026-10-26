// Text notes and level marks in the registry (contract.ts): elements/note holds the element itself.
// What it derives is the note as shown: a level mark's text is the height it says.

import { finite, isObject, isPoint } from '../../core/guards';
import { num, t } from '../../ui/i18n';
import type { ElementKind, PlanPaint } from '../contract';
import { updateNotes } from '../note/commands';
import { noteFields } from '../note/fields';
import { elevationText, type Note, NOTE_PREFIX, noteBox, shownHeight } from '../note/schema';

/** The box of a note as drawn at `scale` px a metre (its letters never smaller than they read). */
const boxAt = (n: Note, scale?: number) => noteBox(n, scale ? shownHeight(n, scale) : n.height);

export const noteKind: ElementKind<Note, Note> = {
  key: 'notes',
  prefix: NOTE_PREFIX,
  category: null,
  layer: 'over',
  icon: 'text',
  one: 'note.title',
  many: 'note.titleMany',
  // A level mark says so in the panel.
  title: (items) => {
    const marks = items.every((x) => x.elevation);
    const n = items.length;
    return marks
      ? { icon: 'height', text: n === 1 ? t('note.levelMark') : t('note.levelMarks', { n }) }
      : { icon: 'text', text: n === 1 ? t('note.title') : t('note.titleMany', { n }) };
  },
  dropped: 'fix.droppedNotes',
  exportName: 'note.title',
  exportColour: 'structure',
  valid: (n): n is Note =>
    isObject(n) &&
    typeof n.id === 'string' &&
    typeof n.levelId === 'string' &&
    isPoint(n.at) &&
    typeof n.text === 'string' &&
    finite(n.height) &&
    n.height > 0 &&
    // A level mark says a height, so it needs no text; a note does.
    (n.elevation === undefined ? n.text.trim() !== '' : isObject(n.elevation) && finite(n.elevation.offset)),
  // A level mark says its level's height plus its own: as its text, so it is drawn, boxed and picked as one.
  derive: (doc, n) => {
    if (!n.elevation) return n;
    const elevation = doc.levels.find((l) => l.id === n.levelId)?.elevation ?? 0;
    return { ...n, text: elevationText(elevation + n.elevation.offset, (m) => num(m)) };
  },
  element: (n) => n,
  outlines: (n, scale) => {
    const b = boxAt(n, scale);
    return [
      [
        { x: b.x0, y: b.y0 },
        { x: b.x1, y: b.y0 },
        { x: b.x1, y: b.y1 },
        { x: b.x0, y: b.y1 },
      ],
    ];
  },
  hit: (n, p, near, scale) => {
    const b = boxAt(n, scale);
    return p.x >= b.x0 - near && p.x <= b.x1 + near && p.y >= b.y0 - near && p.y <= b.y1 + near;
  },
  // Over everything it is written on.
  pick: 'beforeWalls',
  moved: (n, d) => ({ ...n, at: { x: n.at.x + d.x, y: n.at.y + d.y } }),
  // Notes keep reading upright: only their point goes (a turn, a mirror), their letters as they are.
  mapped: (n, t, id) => ({ ...n, id, at: t.map(n.at) }),
  similar: (a, b) => Math.abs(a.height - b.height) < 1e-6,
  // Their letters as tall as they are at this scale, a line each; a selected one boxed.
  plan: (p, n, lit) => {
    const { ctx } = p;
    const px = shownHeight(n, p.scale) * p.scale;
    const c = p.toScreen(n.at);
    const colour = lit ? p.color('--wall-sel') : p.color('--text');
    ctx.save();
    ctx.fillStyle = colour;
    ctx.strokeStyle = colour;
    ctx.font = `${Math.max(2, px)}px ${p.family}`;
    ctx.textBaseline = 'middle';
    if (n.elevation) levelMark(p, c, px, n.text);
    else {
      const lines = n.text.split('\n');
      ctx.textAlign = 'center';
      const step = px * 1.3;
      lines.forEach((l, i) => ctx.fillText(l, c.x, c.y + (i - (lines.length - 1) / 2) * step));
    }
    if (lit) {
      const b = boxAt(n, p.scale);
      const p0 = p.toScreen({ x: b.x0, y: b.y1 });
      const p1 = p.toScreen({ x: b.x1, y: b.y0 });
      ctx.strokeStyle = p.color('--wall-sel');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(p0.x - 2, p0.y - 2, p1.x - p0.x + 4, p1.y - p0.y + 4);
    }
    ctx.restore();
  },
  // A TEXT a line, centred as the plan draws them (R12's TEXT has one line); a level mark's symbol crossed.
  dxf: (n, out) => {
    if (n.elevation) {
      const r = n.height * 0.5;
      out.line('A-ANNO-TEXT', { x: n.at.x - r * 1.4, y: n.at.y }, { x: n.at.x + r * 1.4, y: n.at.y });
      out.line('A-ANNO-TEXT', { x: n.at.x, y: n.at.y - r * 1.4 }, { x: n.at.x, y: n.at.y + r * 1.4 });
      out.text('A-ANNO-TEXT', { x: n.at.x + r + n.height * 0.3 + n.text.length * n.height * 0.3, y: n.at.y }, n.height, n.text);
      return;
    }
    const lines = n.text.split('\n');
    lines.forEach((l, i) => out.text('A-ANNO-TEXT', { x: n.at.x, y: n.at.y - (i - (lines.length - 1) / 2) * n.height * 1.3 }, n.height, l));
  },
  fields: (items, dispatch) => noteFields(items, { updateNotes: (ids, patch) => dispatch(updateNotes(ids, patch)) }),
};

/** A level mark: the plan's level symbol (a circle with two opposite quarters filled, crossed) at c, and the height it says to its right. */
function levelMark(p: PlanPaint, c: { x: number; y: number }, px: number, text: string): void {
  const { ctx } = p;
  const r = px * 0.5;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.moveTo(c.x - r * 1.4, c.y);
  ctx.lineTo(c.x + r * 1.4, c.y);
  ctx.moveTo(c.x, c.y - r * 1.4);
  ctx.lineTo(c.x, c.y + r * 1.4);
  ctx.stroke();
  for (const start of [-Math.PI / 2, Math.PI / 2]) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, r, start, start + Math.PI / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.textAlign = 'left';
  ctx.fillText(text, c.x + r + px * 0.3, c.y);
}
