// Columns in the registry (contract.ts): elements/column holds the element itself.

import * as THREE from 'three';
import { finite, isObject, isPoint } from '../../core/guards';
import { insideRing } from '../room/derive';
import { updateColumns } from '../column/commands';
import { columnFields } from '../column/fields';
import { type Column, COLUMN_PREFIX, COLUMN_SHAPES, columnOutline } from '../column/schema';
import type { ElementKind } from '../contract';
import { nearSegment, throughElement, trace } from './paint';

export interface ColumnSolid {
  readonly column: Column;
  readonly outline: readonly { x: number; y: number }[];
  readonly bottom: number;
  readonly top: number;
}

export const columnKind: ElementKind<Column, ColumnSolid> = {
  key: 'columns',
  prefix: COLUMN_PREFIX,
  category: 'walls',
  icon: 'column',
  one: 'column.title',
  many: 'column.titleMany',
  dropped: 'fix.droppedColumns',
  exportName: 'export.column',
  exportColour: 'structure',
  valid: (c): c is Column =>
    isObject(c) &&
    typeof c.id === 'string' &&
    typeof c.levelId === 'string' &&
    isPoint(c.at) &&
    finite(c.width) &&
    c.width > 0 &&
    finite(c.depth) &&
    c.depth > 0 &&
    finite(c.angle) &&
    (c.topOffset === undefined || finite(c.topOffset)) &&
    (c.shape === undefined || COLUMN_SHAPES.includes(c.shape as never)) &&
    (c.plate === undefined || (finite(c.plate) && c.plate > 0)) &&
    (c.topLevelId === undefined || typeof c.topLevelId === 'string'),
  // From its level's floor to the level's top (or another level's floor), plus its adjustment. Not
  // memoised by its level alone: up to another level, that one's height moves it too.
  derive: (doc, c) => {
    const level = doc.levels.find((l) => l.id === c.levelId) ?? { elevation: 0, height: 2.8 };
    const bottom = level.elevation;
    const to = c.topLevelId ? doc.levels.find((l) => l.id === c.topLevelId) : undefined;
    const top = (to ? to.elevation : level.elevation + level.height) + (c.topOffset ?? 0);
    return { column: c, outline: columnOutline(c), bottom, top: Math.max(bottom + 0.01, top) };
  },
  element: (s) => s.column,
  outlines: (s) => [s.outline],
  hit: (s, p, near) => insideRing(s.outline, p) || s.outline.some((v, i) => nearSegment(p, v, s.outline[(i + 1) % s.outline.length]!, near)),
  pick: 'beforeWalls',
  span: (s) => ({ bottom: s.bottom, top: s.top }),
  moved: (c, d) => ({ ...c, at: { x: c.at.x + d.x, y: c.at.y + d.y } }),
  // It turns with a turn and a mirror: its x is taken by the transform.
  mapped: (c, t, id) => {
    const at = t.map(c.at);
    const x = t.map({ x: c.at.x + Math.cos(c.angle), y: c.at.y + Math.sin(c.angle) });
    return { ...c, id, at, angle: Math.atan2(x.y - at.y, x.x - at.x), width: c.width * t.factor, depth: c.depth * t.factor };
  },
  onGrid: (c, onLine) => onLine(c.at),
  similar: (a, b) => (a.shape ?? 'rect') === (b.shape ?? 'rect') && Math.abs(a.width - b.width) < 1e-6 && Math.abs(a.depth - b.depth) < 1e-6,
  // Cut, filled as a wall's structure layer is (it is structure), outlined as walls are.
  plan: (p, s, lit) => {
    trace(p, s.outline);
    p.ctx.fillStyle = lit ? p.color('--wall-sel-fill') : p.color('--layer-structure');
    p.ctx.fill();
    p.ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--wall-line');
    p.ctx.lineWidth = p.pen('fine') * (lit ? 2 : 1);
    p.ctx.stroke();
  },
  solid: (s) => {
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(s.outline.map((v) => new THREE.Vector2(v.x, v.y))), { depth: s.top - s.bottom, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    return { geometry, y: s.bottom, material: 'side', edges: true };
  },
  dxfLayers: [{ name: 'S-COLS', colour: 7 }],
  dxf: (s, out) => out.polyline('S-COLS', s.outline, true),
  fields: (items, { dispatch, doc }) => throughElement(columnFields(items.map((s) => s.column), { updateColumns: (ids, patch) => dispatch(updateColumns(ids, patch)) }, doc), (s: ColumnSolid) => s.column),
};
