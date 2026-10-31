// A DXF's drawing as lines (phase 11: DXF as a reference under the plan): LINE, LWPOLYLINE and POLYLINE
// with its VERTEXes (their bulges as arcs), CIRCLE, ARC and ELLIPSE as short segments, in metres by the
// file's $INSUNITS (millimetres when it says none and its drawing is larger than a kilometre would be in
// metres). An entity drawn seen from below (its extrusion pointing down) is mirrored as the file means it.
// Texts, hatches and blocks' inserts are not lines: counted and said. From its lowest corner. Pure.

export interface DxfLines {
  /** x1, y1, x2, y2 of each, in metres, from the drawing's lower left corner. */
  readonly lines: number[];
  readonly w: number;
  readonly h: number;
  /** Where its lower left corner is in its own coordinates (m): placed there, it keeps them. */
  readonly origin: { readonly x: number; readonly y: number };
  /** Metres a unit of the file. */
  readonly unit: number;
  /** Entities left out, by type. */
  readonly skipped: Readonly<Record<string, number>>;
}

/** $INSUNITS: inches, feet, miles, millimetres, centimetres, metres, kilometres… */
const UNITS: Readonly<Record<number, number>> = { 1: 0.0254, 2: 0.3048, 3: 1609.344, 4: 0.001, 5: 0.01, 6: 1, 7: 1000, 10: 0.9144 };

/** Segments an arc is drawn with: one each 10°, at least 4. */
const arcSteps = (sweep: number) => Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));

export function readDxfLines(text: string): DxfLines {
  const rows = text.split(/\r?\n/);
  const pairs: [number, string][] = [];
  for (let i = 0; i + 1 < rows.length; i += 2) pairs.push([Number.parseInt(rows[i]!.trim(), 10), rows[i + 1]!.trim()]);
  let units = 0;
  for (let i = 0; i < pairs.length; i++) if (pairs[i]![0] === 9 && pairs[i]![1] === '$INSUNITS') units = Number(pairs[i + 1]?.[1] ?? 0);
  const raw: number[] = [];
  const skipped: Record<string, number> = {};
  const seg = (x1: number, y1: number, x2: number, y2: number) => {
    if ([x1, y1, x2, y2].every(Number.isFinite) && (x1 !== x2 || y1 !== y2)) raw.push(x1, y1, x2, y2);
  };
  // `mirror`: the entity's own axes (its OCS) seen from below, its extrusion's z negative: x the other way.
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number, mirror = false) => {
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    const n = arcSteps(sweep);
    const m = mirror ? -1 : 1;
    for (let k = 0; k < n; k++) {
      const t0 = a0 + (sweep * k) / n;
      const t1 = a0 + (sweep * (k + 1)) / n;
      seg(m * (cx + r * Math.cos(t0)), cy + r * Math.sin(t0), m * (cx + r * Math.cos(t1)), cy + r * Math.sin(t1));
    }
  };
  // A polyline's side from one vertex to the next: straight, or an arc when its bulge is not 0 (the
  // tangent of a quarter of its sweep, counter-clockwise when positive). Lost before: every arc in a
  // polyline came in as its chord.
  const side = (x1: number, y1: number, x2: number, y2: number, bulge: number, mirror: boolean) => {
    const m = mirror ? -1 : 1;
    const c = Math.hypot(x2 - x1, y2 - y1);
    if (!Number.isFinite(bulge) || Math.abs(bulge) < 1e-9 || c < 1e-12) return seg(m * x1, y1, m * x2, y2);
    const sweep = 4 * Math.atan(bulge);
    // The centre: off the chord's middle, along its left normal, by half the chord over tan(sweep / 2).
    const s = c / 2 / Math.tan(sweep / 2);
    const cx = (x1 + x2) / 2 - ((y2 - y1) / c) * s;
    const cy = (y1 + y2) / 2 + ((x2 - x1) / c) * s;
    const r = Math.hypot(x1 - cx, y1 - cy);
    const a0 = Math.atan2(y1 - cy, x1 - cx);
    const n = arcSteps(sweep);
    for (let k = 0; k < n; k++) {
      const t0 = a0 + (sweep * k) / n;
      const t1 = a0 + (sweep * (k + 1)) / n;
      seg(m * (cx + r * Math.cos(t0)), cy + r * Math.sin(t0), m * (cx + r * Math.cos(t1)), cy + r * Math.sin(t1));
    }
  };
  // The ENTITIES section only: blocks' definitions are not drawn where they are defined.
  let at = pairs.findIndex(([c, v], i) => c === 2 && v === 'ENTITIES' && pairs[i - 1]?.[1] === 'SECTION');
  if (at < 0) return { lines: [], w: 0, h: 0, origin: { x: 0, y: 0 }, unit: 1, skipped: {} };
  at++;
  while (at < pairs.length) {
    const [code, value] = pairs[at]!;
    if (code === 0 && value === 'ENDSEC') break;
    if (code !== 0) {
      at++;
      continue;
    }
    // An entity: its group codes up to the next 0.
    const type = value;
    const body: [number, string][] = [];
    at++;
    while (at < pairs.length && pairs[at]![0] !== 0) body.push(pairs[at++]!);
    const g = (c: number) => Number(body.find((p) => p[0] === c)?.[1] ?? Number.NaN);
    // Seen from below: its extrusion (210, 220, 230) pointing down, 0, 0, −1 by default up.
    const mirror = g(230) < 0;
    // A polyline's vertices with their bulges, from one to the next, closed back to the first.
    const polyline = (pts: readonly { x: number; y: number; bulge: number }[], closed: boolean) => {
      for (let k = 0; k + 1 < pts.length; k++) side(pts[k]!.x, pts[k]!.y, pts[k + 1]!.x, pts[k + 1]!.y, pts[k]!.bulge, mirror);
      if (closed && pts.length > 2) side(pts.at(-1)!.x, pts.at(-1)!.y, pts[0]!.x, pts[0]!.y, pts.at(-1)!.bulge, mirror);
    };
    switch (type) {
      case 'LINE':
        seg(g(10), g(20), g(11), g(21));
        break;
      case 'LWPOLYLINE': {
        // Each vertex its 10 and 20, and its bulge (42) when it has one, in order.
        const pts: { x: number; y: number; bulge: number }[] = [];
        for (const [c, v] of body) {
          if (c === 10) pts.push({ x: Number(v), y: Number.NaN, bulge: 0 });
          else if (c === 20 && pts.length > 0) pts.at(-1)!.y = Number(v);
          else if (c === 42 && pts.length > 0) pts.at(-1)!.bulge = Number(v);
        }
        polyline(pts, (g(70) & 1) === 1);
        break;
      }
      case 'POLYLINE': {
        const closed = (g(70) & 1) === 1;
        const pts: { x: number; y: number; bulge: number }[] = [];
        // Its vertices follow it, each an entity of its own, up to SEQEND.
        while (at < pairs.length && pairs[at]![1] !== 'SEQEND') {
          if (pairs[at]![0] === 0 && pairs[at]![1] === 'VERTEX') {
            at++;
            const v: [number, string][] = [];
            while (at < pairs.length && pairs[at]![0] !== 0) v.push(pairs[at++]!);
            const of = (c: number) => Number(v.find((p) => p[0] === c)?.[1] ?? Number.NaN);
            pts.push({ x: of(10), y: of(20), bulge: of(42) || 0 });
          } else at++;
        }
        polyline(pts, closed);
        break;
      }
      case 'CIRCLE':
        arc(g(10), g(20), g(40), 0, Math.PI * 2, mirror);
        break;
      case 'ARC':
        arc(g(10), g(20), g(40), (g(50) * Math.PI) / 180, (g(51) * Math.PI) / 180, mirror);
        break;
      case 'ELLIPSE': {
        // Its centre and its major axis's end from it (in the drawing's axes), its minor axis `ratio` of
        // it, square to it on the side the extrusion turns to, from parameter 41 to 42 (radians).
        const [cx, cy, mx, my, ratio] = [g(10), g(20), g(11), g(21), g(40)];
        const [nx, ny] = mirror ? [my * ratio, -mx * ratio] : [-my * ratio, mx * ratio];
        const p0 = Number.isFinite(g(41)) ? g(41) : 0;
        let p1 = Number.isFinite(g(42)) ? g(42) : Math.PI * 2;
        while (p1 <= p0) p1 += Math.PI * 2;
        const n = arcSteps(p1 - p0);
        const point = (t: number) => [cx + mx * Math.cos(t) + nx * Math.sin(t), cy + my * Math.cos(t) + ny * Math.sin(t)] as const;
        for (let k = 0; k < n; k++) {
          const [ax, ay] = point(p0 + ((p1 - p0) * k) / n);
          const [bx, by] = point(p0 + ((p1 - p0) * (k + 1)) / n);
          seg(ax, ay, bx, by);
        }
        break;
      }
      case 'SEQEND':
      case 'VERTEX':
        break;
      default:
        skipped[type] = (skipped[type] ?? 0) + 1;
    }
  }
  if (raw.length === 0) return { lines: [], w: 0, h: 0, origin: { x: 0, y: 0 }, unit: 1, skipped };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < raw.length; i += 2) {
    x0 = Math.min(x0, raw[i]!);
    x1 = Math.max(x1, raw[i]!);
    y0 = Math.min(y0, raw[i + 1]!);
    y1 = Math.max(y1, raw[i + 1]!);
  }
  // No unit said: millimetres when the drawing would be over a kilometre in metres, else metres.
  const unit = UNITS[units] ?? (Math.max(x1 - x0, y1 - y0) > 1000 ? 0.001 : 1);
  const lines = raw.map((v, i) => (v - (i % 2 === 0 ? x0 : y0)) * unit);
  return { lines, w: Math.max(1e-6, (x1 - x0) * unit), h: Math.max(1e-6, (y1 - y0) * unit), origin: { x: x0 * unit, y: y0 * unit }, unit, skipped };
}
