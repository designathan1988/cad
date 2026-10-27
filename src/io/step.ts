// A reader of STEP files (ISO 10303-21), as IFC is written: each "#id=ENTITY(args);" of the DATA section
// into its entity's name and its arguments, which are references (#12), strings (their \X2\, \X\ and
// \S\ codes read back), enumerations (.T.), numbers, lists, typed values (IFCLABEL('x')), unset ($) and
// derived (*). Pure; no schema: what an attribute means is the reader's (import-ifc.ts).

export type StepValue = number | string | boolean | null | StepRef | StepEnum | StepTyped | readonly StepValue[];

export interface StepRef {
  readonly ref: number;
}
export interface StepEnum {
  readonly enum: string;
}
export interface StepTyped {
  readonly type: string;
  readonly value: StepValue;
}

export interface StepEntity {
  readonly id: number;
  /** In capitals, as written: IFCWALL. */
  readonly type: string;
  readonly args: readonly StepValue[];
}

export const isRef = (v: StepValue | undefined): v is StepRef => typeof v === 'object' && v !== null && !Array.isArray(v) && 'ref' in v;
export const isEnum = (v: StepValue | undefined): v is StepEnum => typeof v === 'object' && v !== null && !Array.isArray(v) && 'enum' in v;
export const isTyped = (v: StepValue | undefined): v is StepTyped => typeof v === 'object' && v !== null && !Array.isArray(v) && 'type' in v;

/** A STEP string's text: '' quotes, \\ backslashes, \X2\hex\X0\ (UTF-16), \X\hh (Latin-1), \S\c (high half). */
export function decodeStepString(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (c === "'" && raw[i + 1] === "'") {
      out += "'";
      i++;
    } else if (c === '\\') {
      if (raw.startsWith('\\X2\\', i)) {
        const end = raw.indexOf('\\X0\\', i + 4);
        const hex = raw.slice(i + 4, end < 0 ? raw.length : end);
        for (let k = 0; k + 4 <= hex.length; k += 4) out += String.fromCharCode(Number.parseInt(hex.slice(k, k + 4), 16));
        i = end < 0 ? raw.length : end + 3;
      } else if (raw.startsWith('\\X\\', i)) {
        out += String.fromCharCode(Number.parseInt(raw.slice(i + 3, i + 5), 16));
        i += 4;
      } else if (raw.startsWith('\\S\\', i)) {
        out += String.fromCharCode(raw.charCodeAt(i + 3) + 128);
        i += 3;
      } else if (raw[i + 1] === '\\') {
        out += '\\';
        i++;
      } else out += c;
    } else out += c;
  }
  return out;
}

/** The entities of a STEP file's DATA section, by id. */
export function readStep(text: string): Map<number, StepEntity> {
  const out = new Map<number, StepEntity>();
  const data = text.indexOf('DATA;');
  let i = data < 0 ? 0 : data + 5;
  const n = text.length;
  const skipSpace = () => {
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 32 || c === 10 || c === 13 || c === 9) i++;
      else if (text.startsWith('/*', i)) {
        const end = text.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
      } else break;
    }
  };
  const value = (): StepValue => {
    skipSpace();
    const c = text[i];
    if (c === '(') {
      i++;
      const items: StepValue[] = [];
      skipSpace();
      if (text[i] === ')') {
        i++;
        return items;
      }
      for (;;) {
        items.push(value());
        skipSpace();
        if (text[i] === ',') i++;
        else if (text[i] === ')') {
          i++;
          return items;
        } else throw new Error(`STEP: unexpected "${text[i]}" at ${i}`);
      }
    }
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        const q = text.indexOf("'", j);
        if (q < 0) throw new Error('STEP: a string does not end');
        if (text[q + 1] === "'") j = q + 2;
        else {
          const raw = text.slice(i + 1, q);
          i = q + 1;
          return decodeStepString(raw);
        }
      }
    }
    if (c === '#') {
      let j = i + 1;
      while (j < n && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
      const ref = Number(text.slice(i + 1, j));
      i = j;
      return { ref };
    }
    if (c === '$') {
      i++;
      return null;
    }
    if (c === '*') {
      i++;
      return null;
    }
    if (c === '.') {
      const end = text.indexOf('.', i + 1);
      const word = text.slice(i + 1, end);
      i = end + 1;
      if (word === 'T') return true;
      if (word === 'F') return false;
      return { enum: word };
    }
    if (c === '"') {
      // Binary: kept as its hex text.
      const end = text.indexOf('"', i + 1);
      const raw = text.slice(i + 1, end);
      i = end + 1;
      return raw;
    }
    // A number, or a typed value (IFCLABEL('x')).
    let j = i;
    while (j < n && /[A-Za-z0-9_.+-]/.test(text[j]!)) j++;
    const word = text.slice(i, j);
    i = j;
    skipSpace();
    if (text[i] === '(' && /^[A-Za-z]/.test(word)) {
      const inner = value() as StepValue[];
      return { type: word.toUpperCase(), value: inner.length === 1 ? inner[0]! : inner };
    }
    const num = Number(word);
    if (!Number.isFinite(num)) throw new Error(`STEP: "${word}" is not a value`);
    return num;
  };
  while (i < n) {
    skipSpace();
    if (text.startsWith('ENDSEC', i)) break;
    if (text[i] !== '#') {
      // Anything else up to the next statement's end.
      const end = text.indexOf(';', i);
      if (end < 0) break;
      i = end + 1;
      continue;
    }
    let j = i + 1;
    while (j < n && text.charCodeAt(j) >= 48 && text.charCodeAt(j) <= 57) j++;
    const id = Number(text.slice(i + 1, j));
    i = j;
    skipSpace();
    if (text[i] !== '=') throw new Error(`STEP: "=" expected after #${id}`);
    i++;
    skipSpace();
    let k = i;
    while (k < n && /[A-Za-z0-9_]/.test(text[k]!)) k++;
    const type = text.slice(i, k).toUpperCase();
    i = k;
    const args = value();
    skipSpace();
    if (text[i] === ';') i++;
    out.set(id, { id, type, args: Array.isArray(args) ? args : [args] });
  }
  return out;
}
