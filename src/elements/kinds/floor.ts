// Floors and ceilings in the registry (contract.ts): elements/room holds the element and its slab. A
// room's floor follows its room: placed from it, copied with it, and left with the outline it had when
// the room is deleted.

import { finite, isObject, isPoint } from '../../core/guards';
import type { Point2 } from '../../core/vector';
import { slabGeometry } from '../../render/prisms';
import { name, t } from '../../ui/i18n';
import type { ElementKind } from '../contract';
import { clearFloorHoles, setFloorLayers, setFloorTiling, updateFloor } from '../room/commands';
import { deriveFloor, type FloorSolid, insideRing, riseAt } from '../room/derive';
import { floorFields } from '../room/fields';
import type { Floor } from '../room/schema';
import { trace } from './paint';
import { tilingDrawing } from '../../render/tiling';
import { materialIn } from '../material/schema';

export const FLOOR_PREFIX = 'floor';

export const floorKind: ElementKind<Floor, FloorSolid> = {
  key: 'floors',
  prefix: FLOOR_PREFIX,
  category: 'floors',
  // Under the walls: the cut runs over it.
  layer: 'under',
  surface: true,
  icon: 'slab',
  one: 'floor.title',
  many: 'floor.titleMany',
  title: (items) => {
    const n = items.length;
    const ceilings = items.every((f) => f.floor.kind === 'ceiling');
    return { icon: 'slab', text: ceilings ? (n === 1 ? t('ceiling.title') : t('ceiling.titleMany', { n })) : n === 1 ? t('floor.title') : t('floor.titleMany', { n }) };
  },
  dropped: 'fix.droppedFloors',
  exportName: 'export.floor',
  exportColour: 'floor',
  valid: (f): f is Floor =>
    isObject(f) &&
    typeof f.id === 'string' &&
    typeof f.levelId === 'string' &&
    finite(f.thickness) &&
    f.thickness > 0 &&
    finite(f.offset) &&
    isObject(f.source) &&
    ((f.source.kind === 'room' && typeof f.source.roomId === 'string') ||
      (f.source.kind === 'outline' && Array.isArray(f.source.points) && f.source.points.length >= 3 && f.source.points.every(isPoint))) &&
    (f.holes === undefined || (Array.isArray(f.holes) && f.holes.every((h) => Array.isArray(h) && h.length >= 3 && h.every(isPoint)))) &&
    (f.slope === undefined || (isObject(f.slope) && finite(f.slope.grade) && finite(f.slope.dir))) &&
    (f.kind === undefined || f.kind === 'ceiling'),
  derive: (doc, f, g) => {
    const s = deriveFloor(f, g.rooms, (id) => doc.levels.find((l) => l.id === id)?.elevation ?? 0);
    return f.layers ? { ...s, layerMaterials: f.layers.map((l) => materialIn(doc.materials, l.materialId)) } : s;
  },
  element: (s) => s.floor,
  follows: (f) => (f.source.kind === 'room' ? f.source.roomId : null),
  // A floor following a deleted room keeps the outline it had, so it does not move.
  released: (f, g) => (f.source.kind === 'room' ? { ...f, source: { kind: 'outline', points: [...(g.rooms.get(f.source.roomId)?.outline ?? [])] } } : f),
  outlines: (s) => (s.outline.length >= 3 ? [s.outline] : []),
  hit: (s, p) => s.outline.length >= 3 && insideRing(s.outline, p),
  // After the rooms on it, before a roof over everything.
  pick: 'last',
  // A room's floor follows its room: only an outline floor moves.
  moved: (f, d) => {
    if (f.source.kind !== 'outline') return f;
    const m = (p: Point2) => ({ x: p.x + d.x, y: p.y + d.y });
    return { ...f, source: { kind: 'outline', points: f.source.points.map(m) }, ...(f.holes ? { holes: f.holes.map((h) => h.map(m)) } : {}) };
  },
  mapped: (f, tr, id) => {
    const map = (pts: readonly Point2[]) => pts.map(tr.map);
    return { ...f, id, ...(f.source.kind === 'outline' ? { source: { kind: 'outline', points: map(f.source.points) } } : {}), ...(f.holes ? { holes: f.holes.map(map) } : {}) };
  },
  // A selected outline floor goes; a room's floor with its room (its holes taken along); copied, a room's
  // floor is the copy of its room's.
  transformed: (f, c) => {
    const map = (pts: readonly Point2[]) => pts.map(c.t.map);
    const holes = f.holes ? { holes: f.holes.map(map) } : {};
    if (f.source.kind === 'outline') return c.selected ? { ...f, id: c.id, source: { kind: 'outline', points: map(f.source.points) }, ...holes } : null;
    const going = c.going(f.source.roomId);
    if (!c.copy) return going && f.holes ? { ...f, ...holes } : null;
    return going ? { ...f, id: c.id, source: { kind: 'room', roomId: c.to(f.source.roomId) }, ...holes } : null;
  },
  similar: (a, b) => Math.abs(a.thickness - b.thickness) < 1e-6,
  // A floor's holes left out of it, crossed as voids are drawn. A ceiling is above the cut: only its
  // outline, dotted.
  plan: (p, f, lit) => {
    if (f.outline.length < 3) return;
    const { ctx } = p;
    const ceiling = f.floor.kind === 'ceiling';
    trace(p, f.outline);
    for (const h of f.holes) {
      h.forEach((v, i) => {
        const s = p.toScreen(v);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.closePath();
    }
    if (!ceiling || lit) {
      ctx.fillStyle = lit ? p.color('--accent-soft') : p.color('--floor-fill');
      ctx.fill('evenodd');
    }
    // Its pieces (paginação), inside it only: clipped to its outline less its holes.
    if (f.floor.tiling && !ceiling) {
      const drawn = tilingDrawing(f.floor.tiling, f.outline);
      ctx.save();
      ctx.clip('evenodd');
      ctx.fillStyle = p.color('--text-3');
      ctx.globalAlpha = 0.12;
      for (const piece of drawn.shaded) {
        trace(p, piece);
        ctx.fill();
      }
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = p.color('--text-3');
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const l of drawn.lines)
        l.forEach((v, i) => {
          const q = p.toScreen(v);
          if (i === 0) ctx.moveTo(q.x, q.y);
          else ctx.lineTo(q.x, q.y);
        });
      ctx.stroke();
      ctx.restore();
      // The clip took the path: trace it again for the outline below.
      trace(p, f.outline);
      for (const h of f.holes) {
        h.forEach((v, i) => {
          const s = p.toScreen(v);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
      }
    }
    ctx.save();
    ctx.setLineDash(ceiling ? [2, 3] : [5, 4]);
    ctx.strokeStyle = lit ? p.color('--wall-sel') : p.color('--text-3');
    ctx.lineWidth = 1;
    ctx.stroke();
    // Each hole crossed corner to corner.
    ctx.setLineDash([]);
    ctx.beginPath();
    for (const h of f.holes) {
      if (h.length < 3) continue;
      const pts = h.map((v) => p.toScreen(v));
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      ctx.lineTo(pts[Math.floor(pts.length / 2)]!.x, pts[Math.floor(pts.length / 2)]!.y);
      if (pts.length >= 4) {
        ctx.moveTo(pts[1]!.x, pts[1]!.y);
        ctx.lineTo(pts[Math.floor(pts.length / 2) + 1]!.x, pts[Math.floor(pts.length / 2) + 1]!.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  },
  // Extruded down from its top; a sloped one rising across.
  solid: (f) => {
    if (f.outline.length < 3) return null;
    const rise = f.rise ? (q: Point2) => riseAt(f, q) : undefined;
    // A build-up: each layer its own slab in its material, from the top down.
    if (f.floor.layers && f.layerMaterials) {
      let top = f.top;
      return f.floor.layers.map((l, i) => {
        const geometry = slabGeometry(f.outline, f.holes, l.thickness, rise);
        geometry.rotateX(-Math.PI / 2);
        top -= l.thickness;
        return { geometry, y: top, material: f.layerMaterials![i]!, edges: true };
      });
    }
    const geometry = slabGeometry(f.outline, f.holes, f.top - f.bottom, rise);
    // The shape lies in x–y; turned −90° about x it lies in three.js x–(−z), extruded upward.
    geometry.rotateX(-Math.PI / 2);
    return { geometry, y: f.bottom, material: 'floor', edges: true };
  },
  span: (f) => ({ bottom: f.bottom, top: f.top }),
  caps: (f) => (f.outline.length >= 3 ? [{ polygon: f.outline, bottom: f.bottom, top: f.top }] : []),
  fields: (items, c) =>
    floorFields(
      items,
      (id) => {
        const r = c.doc.rooms.find((x) => x.id === id);
        return r ? name(r.name) : '—';
      },
      {
        updateFloor: (ids, patch) => {
          const next = ids.reduce((d, id) => updateFloor(id, patch).apply(d), c.doc);
          if (next !== c.doc) c.dispatch({ label: 'cmd.updateFloor', apply: () => next });
        },
        ...(c.startFloorHole ? { startFloorHole: c.startFloorHole } : {}),
        clearFloorHoles: (ids) => c.dispatch(clearFloorHoles(ids)),
        materials: () => c.doc.materials,
        setFloorLayers: (ids, layers) => c.dispatch(setFloorLayers(ids, layers)),
        setFloorTiling: (ids, tiling) => c.dispatch(setFloorTiling(ids, tiling)),
      },
    ),
};
