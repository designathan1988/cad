// What a tag reads from its element, and where its leader ends on it: from the document and the walls',
// doors' and rooms' derivation (the registry's own kinds are not derived yet when tags are). Pure.

import { type Doc, levelOf, wallHeights } from '../../app/document';
import type { BaseGeometry } from '../contract';
import { distance, type Point2 } from '../../core/vector';
import { name as wordsOf, t } from '../../ui/i18n';
import { areaText, lengthNum } from '../../ui/units';
import { arcOf, pointAt } from '../wall/geometry/arc';
import { referenceLength } from '../opening/derive';
import { words } from '../object/fields';
import { kindOfId, listOf } from '../registry';
import type { TagField } from './schema';

/** The values an element has for a tag, as the interface writes them. */
export function tagValues(doc: Doc, g: BaseGeometry, id: string): Partial<Record<TagField, string>> {
  const level = (levelId: string) => wordsOf(levelOf(doc, levelId)?.name ?? '');
  const room = doc.rooms.find((r) => r.id === id);
  if (room) {
    const s = g.rooms.get(id);
    return {
      name: wordsOf(room.name),
      number: room.number,
      ...(s ? { area: areaText(s.area), perimeter: lengthNum(s.perimeter) } : {}),
      height: lengthNum(room.height ?? levelOf(doc, room.levelId)?.height ?? 0),
      level: level(room.levelId),
    };
  }
  const wall = doc.walls.find((w) => w.id === id);
  if (wall) {
    const type = doc.wallTypes.find((x) => x.id === wall.wallTypeId);
    const h = wallHeights(doc, wall);
    return {
      ...(type ? { name: wordsOf(type.name), type: wordsOf(type.name), thickness: lengthNum(type.layers.reduce((s, l) => s + l.thickness, 0)) } : {}),
      length: lengthNum(referenceLength(wall)),
      height: lengthNum(h.top - h.bottom),
      level: level(wall.levelId),
    };
  }
  const o = doc.openings.find((x) => x.id === id);
  if (o) {
    const host = doc.walls.find((w) => w.id === o.wallId);
    return {
      name: t(o.kind === 'door' ? 'panel.door' : 'panel.window'),
      type: t(o.kind === 'door' ? 'panel.door' : 'panel.window'),
      width: lengthNum(o.width),
      height: lengthNum(o.height),
      ...(host ? { level: level(host.levelId) } : {}),
    };
  }
  const object = doc.objects.find((x) => x.id === id);
  if (object) {
    const def = doc.definitions.find((d) => d.id === object.definitionId);
    const type = def?.types.find((x) => x.id === object.typeId) ?? def?.types[0];
    return { ...(def ? { name: words(def.name) } : {}), ...(type ? { type: words(type.name) } : {}), level: level(object.levelId) };
  }
  const k = kindOfId(id);
  const e = k ? listOf(doc, k).find((x) => x.id === id) : undefined;
  return k && e ? { name: t(k.one), level: level(e.levelId) } : {};
}

/** The nearest point to `p` on a segment. */
function onSegment(p: Point2, a: Point2, b: Point2): Point2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  return { x: a.x + dx * k, y: a.y + dy * k };
}

const nearestOn = (p: Point2, line: readonly Point2[], closed: boolean): Point2 | null => {
  if (line.length === 0) return null;
  if (line.length === 1) return line[0]!;
  let best: Point2 | null = null;
  const n = closed ? line.length : line.length - 1;
  for (let i = 0; i < n; i++) {
    const q = onSegment(p, line[i]!, line[(i + 1) % line.length]!);
    if (!best || distance(p, q) < distance(p, best)) best = q;
  }
  return best;
};

const isPt = (x: unknown): x is Point2 => typeof x === 'object' && x !== null && typeof (x as Point2).x === 'number' && typeof (x as Point2).y === 'number';

/** Where a tag's leader ends on its element: the point of it nearest the tag's text; null when the element is gone. */
export function tagAnchor(doc: Doc, g: BaseGeometry, id: string, near: Point2): Point2 | null {
  const room = g.rooms.get(id);
  if (room) return room.label;
  const wall = doc.walls.find((w) => w.id === id);
  if (wall) {
    const arc = arcOf({ start: wall.start, end: wall.end, bulge: wall.bulge ?? 0 });
    const line = arc ? Array.from({ length: 33 }, (_, k) => pointAt(arc, arc.startAngle + (arc.sweep * k) / 32)) : [wall.start, wall.end];
    return nearestOn(near, line, false);
  }
  const placed = g.openings.get(id);
  if (placed) {
    const host = doc.walls.find((w) => w.id === placed.opening.wallId);
    if (!host) return null;
    const s = (placed.start + placed.end) / 2;
    const arc = arcOf({ start: host.start, end: host.end, bulge: host.bulge ?? 0 });
    if (arc) return pointAt(arc, arc.startAngle + Math.sign(arc.sweep) * (s / arc.radius));
    const len = distance(host.start, host.end) || 1;
    return { x: host.start.x + ((host.end.x - host.start.x) * s) / len, y: host.start.y + ((host.end.y - host.start.y) * s) / len };
  }
  // Any other element by the lines its kind draws it with (contract.ts: outlines), as the plan has it.
  const k = kindOfId(id);
  const e = (k ? listOf(doc, k).find((x) => x.id === id) : undefined) as Record<string, unknown> | undefined;
  if (!k || !e) return null;
  const solid = k.derive(doc, e as never, g);
  const lines = solid ? k.outlines(solid as never) : [];
  const onLines = lines.flatMap((line) => {
    // Open: a path's two ends are not joined (a ring's nearest point is on its other sides).
    const q = nearestOn(near, line, false);
    return q ? [q] : [];
  });
  if (onLines.length > 0) return onLines.reduce((m, q) => (distance(near, q) < distance(near, m) ? q : m));
  // Or by the points it is made of: a place, two ends, two corners, an outline, a path.
  if (isPt(e.at)) return e.at;
  for (const [a, b] of [
    ['start', 'end'],
    ['a', 'b'],
  ] as const)
    if (isPt(e[a]) && isPt(e[b])) return nearestOn(near, [e[a] as Point2, e[b] as Point2], false);
  for (const key of ['outline', 'points'] as const) {
    const list = e[key];
    if (Array.isArray(list) && list.every(isPt)) return nearestOn(near, list as Point2[], key === 'outline');
  }
  if (isPt(e.vertex)) return e.vertex;
  return null;
}
