// Formulas of a parametric object (docs/plano-de-escopo.md, phase 3): a small safe language, never eval.
// Numbers (with a decimal point: a comma parts a function's values), lengths with a unit (mm, cm, m: metres inside), the object's parameters by
// name, + − × ÷ and %, comparisons (true is 1, false 0), and/or/not, and the functions if, min, max,
// round, floor, ceil, abs, sqrt, sin, cos, tan (degrees), clamp. Parsed once into a tree and evaluated
// against the values; an unknown name or a division by zero makes the formula fail, never the app.

export type Env = Readonly<Record<string, number>>;

type Node =
  | { readonly k: 'n'; readonly v: number }
  | { readonly k: 'id'; readonly name: string }
  | { readonly k: 'u'; readonly op: '-' | '!'; readonly a: Node }
  | { readonly k: 'b'; readonly op: string; readonly a: Node; readonly b: Node }
  | { readonly k: 'f'; readonly name: string; readonly args: readonly Node[] };

export type Formula = { readonly ok: true; readonly node: Node; readonly names: ReadonlySet<string> } | { readonly ok: false; readonly error: string };

const UNITS: Readonly<Record<string, number>> = { mm: 0.001, cm: 0.01, m: 1 };
const FUNCTIONS: Readonly<Record<string, number>> = { if: 3, min: -1, max: -1, round: -1, floor: 1, ceil: 1, abs: 1, sqrt: 1, sin: 1, cos: 1, tan: 1, clamp: 3 };

const cache = new Map<string, Formula>();

/** The formula's tree, or why it does not read (an unknown function, a missing parenthesis). */
export function parseFormula(text: string): Formula {
  const hit = cache.get(text);
  if (hit) return hit;
  let result: Formula;
  try {
    const p = new Parser(text);
    const node = p.or();
    if (!p.done()) throw new Error(`unexpected "${p.rest()}"`);
    result = { ok: true, node, names: namesOf(node) };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (cache.size > 2000) cache.clear();
  cache.set(text, result);
  return result;
}

const namesOf = (n: Node, out = new Set<string>()): Set<string> => {
  if (n.k === 'id') out.add(n.name);
  else if (n.k === 'u') namesOf(n.a, out);
  else if (n.k === 'b') namesOf(n.b, namesOf(n.a, out));
  else if (n.k === 'f') for (const a of n.args) namesOf(a, out);
  return out;
};

export type Value = { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string };

/** A number or a formula's value with `env`, or why it has none (it does not read, a name it does not
 * know, a result that is not a number): the object says it (evaluate.ts: its problems). */
export function evaluateFormula(f: number | string, env: Env): Value {
  if (typeof f === 'number') return Number.isFinite(f) ? { ok: true, value: f } : { ok: false, error: 'not a number' };
  const parsed = parseFormula(f);
  if (!parsed.ok) return parsed;
  for (const name of parsed.names) if (env[name] === undefined) return { ok: false, error: `unknown name ${name}` };
  const v = run(parsed.node, env);
  return Number.isFinite(v) ? { ok: true, value: v } : { ok: false, error: 'the result is not a number (a division by zero?)' };
}

const deg = Math.PI / 180;

function run(n: Node, env: Env): number {
  switch (n.k) {
    case 'n':
      return n.v;
    case 'id': {
      const v = env[n.name];
      if (v === undefined) throw new Error(`unknown name ${n.name}`);
      return v;
    }
    case 'u':
      return n.op === '-' ? -run(n.a, env) : run(n.a, env) === 0 ? 1 : 0;
    case 'b': {
      // and/or evaluate their right side only when needed, as `if` does its branches.
      if (n.op === '&&') return run(n.a, env) !== 0 && run(n.b, env) !== 0 ? 1 : 0;
      if (n.op === '||') return run(n.a, env) !== 0 || run(n.b, env) !== 0 ? 1 : 0;
      const a = run(n.a, env);
      const b = run(n.b, env);
      switch (n.op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return a / b;
        case '%': return a % b;
        case '<': return a < b ? 1 : 0;
        case '<=': return a <= b ? 1 : 0;
        case '>': return a > b ? 1 : 0;
        case '>=': return a >= b ? 1 : 0;
        case '==': return Math.abs(a - b) < 1e-9 ? 1 : 0;
        case '!=': return Math.abs(a - b) >= 1e-9 ? 1 : 0;
      }
      throw new Error(`operator ${n.op}`);
    }
    case 'f': {
      if (n.name === 'if') return run(n.args[0]!, env) !== 0 ? run(n.args[1]!, env) : run(n.args[2]!, env);
      const v = n.args.map((a) => run(a, env));
      switch (n.name) {
        case 'min': return Math.min(...v);
        case 'max': return Math.max(...v);
        // round(x) to a whole number; round(x, step) to a multiple of step (round(w, 5cm)).
        case 'round': return v.length > 1 && v[1]! !== 0 ? Math.round(v[0]! / v[1]!) * v[1]! : Math.round(v[0]!);
        case 'floor': return Math.floor(v[0]! + 1e-9);
        case 'ceil': return Math.ceil(v[0]! - 1e-9);
        case 'abs': return Math.abs(v[0]!);
        case 'sqrt': return Math.sqrt(v[0]!);
        case 'sin': return Math.sin(v[0]! * deg);
        case 'cos': return Math.cos(v[0]! * deg);
        case 'tan': return Math.tan(v[0]! * deg);
        case 'clamp': return Math.min(Math.max(v[0]!, v[1]!), v[2]!);
      }
      throw new Error(`function ${n.name}`);
    }
  }
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  done(): boolean {
    this.skip();
    return this.i >= this.s.length;
  }
  rest(): string {
    return this.s.slice(this.i, this.i + 12);
  }
  private skip(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
  }
  private eat(token: string): boolean {
    this.skip();
    if (this.s.startsWith(token, this.i)) {
      this.i += token.length;
      return true;
    }
    return false;
  }

  or(): Node {
    let a = this.and();
    while (this.eat('||') || this.eatWord('or')) a = { k: 'b', op: '||', a, b: this.and() };
    return a;
  }
  private and(): Node {
    let a = this.compare();
    while (this.eat('&&') || this.eatWord('and')) a = { k: 'b', op: '&&', a, b: this.compare() };
    return a;
  }
  private compare(): Node {
    const a = this.sum();
    for (const op of ['<=', '>=', '==', '!=', '<', '>']) if (this.eat(op)) return { k: 'b', op, a, b: this.sum() };
    return a;
  }
  private sum(): Node {
    let a = this.product();
    for (;;) {
      if (this.eat('+')) a = { k: 'b', op: '+', a, b: this.product() };
      else if (this.peekMinus()) {
        this.i++;
        a = { k: 'b', op: '-', a, b: this.product() };
      } else return a;
    }
  }
  private peekMinus(): boolean {
    this.skip();
    return this.s[this.i] === '-';
  }
  private product(): Node {
    let a = this.unary();
    for (;;) {
      if (this.eat('*') || this.eat('×')) a = { k: 'b', op: '*', a, b: this.unary() };
      else if (this.eat('/') || this.eat('÷')) a = { k: 'b', op: '/', a, b: this.unary() };
      else if (this.eat('%')) a = { k: 'b', op: '%', a, b: this.unary() };
      else return a;
    }
  }
  private unary(): Node {
    if (this.eat('-')) return { k: 'u', op: '-', a: this.unary() };
    if (this.eat('!') || this.eatWord('not')) return { k: 'u', op: '!', a: this.unary() };
    return this.atom();
  }
  private eatWord(w: string): boolean {
    this.skip();
    const m = /^[A-Za-z_]\w*/.exec(this.s.slice(this.i));
    if (m && m[0] === w) {
      this.i += w.length;
      return true;
    }
    return false;
  }
  private atom(): Node {
    this.skip();
    if (this.eat('(')) {
      const n = this.or();
      if (!this.eat(')')) throw new Error('a ")" is missing');
      return n;
    }
    // The decimal point only: a comma (or a semicolon) parts a function's values, as in if(a, 1, 2).
    const num = /^(\d+(?:\.\d*)?|\.\d+)/.exec(this.s.slice(this.i));
    if (num) {
      this.i += num[0].length;
      const v = Number(num[0]);
      this.skip();
      const u = /^(mm|cm|m)(?![A-Za-z_\d])/.exec(this.s.slice(this.i));
      if (u) {
        this.i += u[0].length;
        return { k: 'n', v: v * UNITS[u[1]!]! };
      }
      return { k: 'n', v };
    }
    const id = /^[A-Za-z_À-ÿ][\wÀ-ÿ]*/.exec(this.s.slice(this.i));
    if (!id) throw new Error(this.done() ? 'the formula ends too soon' : `unexpected "${this.rest()}"`);
    this.i += id[0].length;
    const name = id[0];
    if (name === 'true') return { k: 'n', v: 1 };
    if (name === 'false') return { k: 'n', v: 0 };
    if (this.eat('(')) {
      const arity = FUNCTIONS[name];
      if (arity === undefined) throw new Error(`unknown function ${name}`);
      const args: Node[] = [];
      if (!this.eat(')')) {
        do args.push(this.or());
        while (this.eat(',') || this.eat(';'));
        if (!this.eat(')')) throw new Error('a ")" is missing');
      }
      if ((arity > 0 && args.length !== arity) || args.length === 0) throw new Error(`${name} takes ${arity > 0 ? arity : 'one or more'} values`);
      return { k: 'f', name, args };
    }
    return { k: 'id', name };
  }
}
