// Typed measures: "4,5", "450cm", "4500 mm", "1,5+0,3", "4.5<90", "12'6\"", "3ft", "8in". Metres
// inside. A small parser, never eval: numbers with comma or point, an optional unit per term, + − × ÷
// and parentheses. A number typed without a unit is in the project's length unit (setBareUnit; metres
// until it is set). Feet followed by a number are feet and inches: 12'6" and 12' 6 are 12 ft 6 in.

export type Parsed<T> = { ok: true; value: T } | { ok: false };

const UNITS: Readonly<Record<string, number>> = { mm: 0.001, cm: 0.01, m: 1, ft: 0.3048, "'": 0.3048, in: 0.0254, '"': 0.0254 };

/** Metres per unit of a number typed without one: 1 for metres, 0.01 for centimetres, 0.001 for millimetres. */
let bare = 1;
export const setBareUnit = (metresPerUnit: number): void => {
  bare = metresPerUnit;
};

/** A length in metres, or { ok: false } when the text is not a valid expression. */
export function parseLength(text: string): Parsed<number> {
  const p = new Parser(text);
  const value = p.expression();
  return value !== null && p.done() && Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/** A plain number without units (degrees, a factor): "90", "1,5", "45+45". */
export function parseNumber(text: string): Parsed<number> {
  const p = new Parser(text, false);
  const value = p.expression();
  return value !== null && p.done() && Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/** "x;y": a point in metres, each coordinate a length (units and expressions as parseLength). */
export function parsePoint(text: string): Parsed<{ x: number; y: number }> {
  const parts = text.split(';');
  if (parts.length !== 2) return { ok: false };
  const x = parseLength(parts[0]!);
  const y = parseLength(parts[1]!);
  return x.ok && y.ok ? { ok: true, value: { x: x.value, y: y.value } } : { ok: false };
}

/** "length<angle": the length in metres and the angle in degrees (counter-clockwise from +x). */
export function parseLengthAngle(text: string): Parsed<{ length: number; angle: number | null }> {
  const [l, a, ...rest] = text.split('<');
  if (l === undefined || rest.length > 0) return { ok: false };
  const length = parseLength(l);
  if (!length.ok) return { ok: false };
  if (a === undefined) return { ok: true, value: { length: length.value, angle: null } };
  const angle = new Parser(a, false);
  const deg = angle.expression();
  return deg !== null && angle.done() && Number.isFinite(deg)
    ? { ok: true, value: { length: length.value, angle: deg } }
    : { ok: false };
}

class Parser {
  private i = 0;
  constructor(
    private readonly s: string,
    private readonly units = true,
  ) {}

  done(): boolean {
    this.skip();
    return this.i === this.s.length;
  }

  expression(): number | null {
    let left = this.term();
    while (left !== null) {
      const op = this.peek();
      if (op !== '+' && op !== '-') return left;
      this.i++;
      const right = this.term();
      if (right === null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return null;
  }

  private term(): number | null {
    let left = this.factor();
    while (left !== null) {
      const op = this.peek();
      if (op !== '*' && op !== '/' && op !== 'x' && op !== '×') return left;
      // "x" is multiplication only between numbers, never a unit.
      this.i++;
      const right = this.factor(false);
      if (right === null) return null;
      left = op === '/' ? left / right : left * right;
    }
    return null;
  }

  private factor(withUnit = this.units): number | null {
    const c = this.peek();
    if (c === '-') {
      this.i++;
      const v = this.factor(withUnit);
      return v === null ? null : -v;
    }
    if (c === '(') {
      this.i++;
      const v = this.expression();
      if (v === null || this.peek() !== ')') return null;
      this.i++;
      return v;
    }
    const m = /^\d+(?:[.,]\d*)?|^[.,]\d+/.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    const n = Number(m[0].replace(',', '.'));
    if (!withUnit) return n;
    this.skip();
    const u = /^(?:(mm|cm|m|ft|in)(?![a-z])|(['"]))/i.exec(this.s.slice(this.i));
    if (!u) return n * bare;
    this.i += u[0].length;
    const unit = (u[1] ?? u[2]!).toLowerCase();
    const value = n * UNITS[unit]!;
    if (unit !== 'ft' && unit !== "'") return value;
    // Feet, then inches: 12'6" or 12' 6 (the inches' mark may be left off).
    this.skip();
    const inches = /^(\d+(?:[.,]\d*)?|[.,]\d+)\s*(?:"|in(?![a-z]))?/i.exec(this.s.slice(this.i));
    if (!inches) return value;
    this.i += inches[0].length;
    return value + Number(inches[1]!.replace(',', '.')) * UNITS.in!;
  }

  private peek(): string | undefined {
    this.skip();
    return this.s[this.i];
  }

  private skip(): void {
    while (this.s[this.i] === ' ') this.i++;
  }
}
