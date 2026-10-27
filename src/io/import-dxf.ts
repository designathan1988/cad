// A DXF's drawing as lines (phase 11: DXF as a reference under the plan): LINE, LWPOLYLINE, POLYLINE with
// its VERTEXes, CIRCLE, ARC and ELLIPSE's full turns as short segments, in metres by the file's $INSUNITS
// (millimetres when it says none and its drawing is larger than a kilometre would be in metres). Texts,
// hatches and blocks' inserts are not lines: counted and said. From its lowest corner. Pure.

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
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    const n = arcSteps(sweep);
    for (let k = 0; k < n; k++) {
      const t0 = a0 + (sweep * k) / n;
      const t1 = a0 + (sweep * (k + 1)) / n;
      seg(cx + r * Math.cos(t0), cy + r * Math.sin(t0), cx + r * Math.cos(t1), cy + r * Math.sin(t1));
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
    switch (type) {
      case 'LINE':
        seg(g(10), g(20), g(11), g(21));
        break;
      case 'LWPOLYLINE': {
        const xs = body.filter((p) => p[0] === 10).map((p) => Number(p[1]));
        const ys = body.filter((p) => p[0] === 20).map((p) => Number(p[1]));
        const closed = (g(70) & 1) === 1;
        for (let k = 0; k + 1 < xs.length; k++) seg(xs[k]!, ys[k]!, xs[k + 1]!, ys[k + 1]!);
        if (closed && xs.length > 2) seg(xs.at(-1)!, ys.at(-1)!, xs[0]!, ys[0]!);
        break;
      }
      case 'POLYLINE': {
        const closed = (g(70) & 1) === 1;
        const pts: [number, number][] = [];
        // Its vertices follow it, each an entity of its own, up to SEQEND.
        while (at < pairs.length && pairs[at]![1] !== 'SEQEND') {
          if (pairs[at]![0] === 0 && pairs[at]![1] === 'VERTEX') {
            at++;
            const v: [number, string][] = [];
            while (at < pairs.length && pairs[at]![0] !== 0) v.push(pairs[at++]!);
            pts.push([Number(v.find((p) => p[0] === 10)?.[1]), Number(v.find((p) => p[0] === 20)?.[1])]);
          } else at++;
        }
        for (let k = 0; k + 1 < pts.length; k++) seg(pts[k]![0], pts[k]![1], pts[k + 1]![0], pts[k + 1]![1]);
        if (closed && pts.length > 2) seg(pts.at(-1)![0], pts.at(-1)![1], pts[0]![0], pts[0]![1]);
        break;
      }
      case 'CIRCLE':
        arc(g(10), g(20), g(40), 0, Math.PI * 2);
        break;
      case 'ARC':
        arc(g(10), g(20), g(40), (g(50) * Math.PI) / 180, (g(51) * Math.PI) / 180);
        break;
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
