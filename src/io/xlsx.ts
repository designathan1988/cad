// A spreadsheet's first sheet read as rows of text (a price base: SINAPI's files are XLSX, docs/plano-
// de-escopo.md, "Custos"). An XLSX is a ZIP of XML: its central directory found from the end, each file
// inflated by the browser's own DecompressionStream, the shared strings and the first sheet's cells read
// from their XML. No library; enough for a table of text and numbers (no formulas evaluated: their last
// value is read, as the file keeps it).

/** One ZIP entry: its name, how it is stored, where its data is. */
interface Entry {
  readonly name: string;
  readonly method: number;
  readonly size: number;
  readonly offset: number;
}

function entries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end of central directory record, its signature searched backwards (a comment may follow it).
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error('not a ZIP file');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const out: Entry[] = [];
  const decoder = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('bad ZIP directory');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    // The data starts after the local header, whose own name and extra lengths may differ.
    const offset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    out.push({ name, method, size, offset });
    at += 46 + nameLength + extra + comment;
  }
  return out;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

/** A ZIP's files by name, as text. */
export async function unzipText(bytes: Uint8Array, wanted: (name: string) => boolean): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const e of entries(bytes)) {
    if (!wanted(e.name)) continue;
    const raw = bytes.subarray(e.offset, e.offset + e.size);
    const data = e.method === 0 ? raw : e.method === 8 ? await inflate(raw) : null;
    if (!data) throw new Error(`ZIP method ${e.method} not read`);
    out.set(e.name, new TextDecoder().decode(data));
  }
  return out;
}

const decodeXml = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');

/** The text of every <t> in an XML fragment, joined (a rich text run is several). */
const textOf = (xml: string): string => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]!)).join('');

/** "AB" → 27 (A is 0). */
function column(ref: string): number {
  let n = 0;
  for (const ch of ref) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The first sheet of an XLSX as rows of cell texts (numbers as they are written, a point for decimals). */
export async function readXlsx(bytes: Uint8Array): Promise<string[][]> {
  const files = await unzipText(bytes, (n) => n === 'xl/sharedStrings.xml' || n === 'xl/workbook.xml' || n === 'xl/_rels/workbook.xml.rels' || /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
  const shared = [...(files.get('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]!));
  // The first sheet in the workbook's order, through its relationship; else the lowest numbered.
  let sheet: string | undefined;
  const firstId = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(files.get('xl/workbook.xml') ?? '')?.[1];
  if (firstId) {
    const target = new RegExp(`<Relationship\\b[^>]*Id="${firstId}"[^>]*Target="([^"]+)"`).exec(files.get('xl/_rels/workbook.xml.rels') ?? '')?.[1];
    if (target) sheet = files.get(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  }
  sheet ??= [...files.entries()].filter(([n]) => n.startsWith('xl/worksheets/')).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))[0]?.[1];
  if (!sheet) throw new Error('no sheet');
  const rows: string[][] = [];
  for (const r of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    // A row in its place: the file leaves empty rows out, and its number says where it is.
    const n = Number(/\br="(\d+)"/.exec(r[1]!)?.[1] ?? rows.length + 1);
    while (rows.length < n - 1) rows.push([]);
    const row: string[] = [];
    for (const c of r[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const body = c[2] ?? '';
      const ref = /\br="([A-Z]+)\d+"/.exec(attrs)?.[1];
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const text = type === 's' ? (shared[Number(v)] ?? '') : type === 'inlineStr' ? textOf(body) : v !== undefined ? decodeXml(v) : '';
      const at = ref ? column(ref) : row.length;
      while (row.length < at) row.push('');
      row[at] = text;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * A CSV or TSV read as rows: its separator guessed from its first lines (";" as a spreadsheet set to
 * Portuguese writes it, a tab, or ","), quoted fields with their doubled quotes.
 */
export function readCsv(text: string): string[][] {
  const body = text.replace(/^﻿/, '');
  const head = body.split(/\r?\n/, 5).join('\n');
  const count = (ch: string) => head.split(ch).length - 1;
  const sep = count('\t') > count(';') && count('\t') > count(',') ? '\t' : count(';') >= count(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') (field += '"'), i++;
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) row.push(field), (field = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) (row.push(field), rows.push(row));
  return rows;
}
