// Select similar (ref/chat.txt:107), as Revit's "Select All Instances": from what is selected, every
// element on the level shown that is like one of them. Walls of the same type; doors and windows of the
// same kind and size; rooms of the same use (all rooms, for one without a use); floors of the same
// thickness; notes of the same letter height; guides, all of them. Pure.

import type { Doc } from './document';

const SIZE = 1e-6;

/** The ids to select: what is selected and everything like it on the level, in the document's order. */
export function similarTo(doc: Doc, selected: ReadonlySet<string>, levelId: string): string[] {
  const walls = doc.walls.filter((w) => selected.has(w.id));
  const openings = doc.openings.filter((o) => selected.has(o.id));
  const rooms = doc.rooms.filter((r) => selected.has(r.id));
  const floors = doc.floors.filter((f) => selected.has(f.id));
  const guides = doc.guides.some((g) => selected.has(g.id));
  const notes = doc.notes.filter((n) => selected.has(n.id));
  const columns = doc.columns.filter((c) => selected.has(c.id));
  const beams = doc.beams.filter((b) => selected.has(b.id));
  const onLevel = new Map(doc.walls.map((w) => [w.id, w.levelId]));
  const same = (a: number, b: number) => Math.abs(a - b) <= SIZE;
  const out = new Set(selected);
  for (const w of doc.walls) if (w.levelId === levelId && walls.some((x) => x.wallTypeId === w.wallTypeId)) out.add(w.id);
  for (const o of doc.openings) {
    if (onLevel.get(o.wallId) !== levelId) continue;
    if (openings.some((x) => x.kind === o.kind && same(x.width, o.width) && same(x.height, o.height) && same(x.sill, o.sill))) out.add(o.id);
  }
  for (const r of doc.rooms) if (r.levelId === levelId && rooms.some((x) => x.use === undefined || x.use === r.use)) out.add(r.id);
  for (const f of doc.floors) if (f.levelId === levelId && floors.some((x) => same(x.thickness, f.thickness))) out.add(f.id);
  for (const b of doc.beams) if (b.levelId === levelId && beams.some((x) => same(x.width, b.width) && same(x.depth, b.depth))) out.add(b.id);
  for (const c of doc.columns) if (c.levelId === levelId && columns.some((x) => same(x.width, c.width) && same(x.depth, c.depth))) out.add(c.id);
  for (const n of doc.notes) if (n.levelId === levelId && notes.some((x) => same(x.height, n.height))) out.add(n.id);
  if (guides) for (const g of doc.guides) if (g.levelId === levelId) out.add(g.id);
  return [...out];
}
