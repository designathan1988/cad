// Architecture gates (ADR 0004), with a ratchet: the current debt counts are snapshotted in
// docs/refatoracao/dividas.json; the gate FAILS when any count grows, and passes while it shrinks.
// When a count reaches zero it is locked (any new occurrence fails). Usage: node scripts/check-architecture.mjs
//   --update  rewrite the snapshot to the current counts (only when they IMPROVED; refuse regressions).
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const SNAPSHOT = path.join(ROOT, 'docs/refatoracao/dividas.json');
const update = process.argv.includes('--update');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(SRC).filter((f) => f.endsWith('.ts'));
const rel = (f) => path.relative(ROOT, f).replaceAll('\\', '/');
const texts = new Map(files.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]));
// Every style sheet: styles.css and the parts it imports (ui/styles/*.css).
const cssTexts = new Map(walk(SRC).filter((f) => f.endsWith('.css')).map((f) => [rel(f), fs.readFileSync(f, 'utf8')]));

// ---- 1. import direction (layers): elements must not know the app; core knows nothing above it.
// Allowed directions (adjacency): app->{core,elements,io,render,tools,ui}, tools->{core,elements,app},
// render->{core,elements,app,ui?no}, io->{core,elements,app?no}, ui->{core,elements}, elements->{core,elements}, core->{}.
// Violations counted per (file -> folder).
const layer = (f) => f.split('/')[1];
// ADR 0004 allowed directions: ui -> session -> {project, canvas} -> elements -> model; ui may render
// INTO the shell the session owns (session -> ui/shell is the session's own DOM) and read the app's
// facade. Everything else stays forbidden.
const FORBIDDEN = {
  elements: ['app', 'ui', 'render', 'tools', 'session'],
  core: ['app', 'ui', 'render', 'tools', 'elements', 'io', 'session'],
  ui: ['render', 'tools'],
  io: ['ui', 'render', 'tools', 'session'],
  render: ['ui'],
  session: ['app'],
  model: ['app', 'ui', 'render', 'tools', 'elements', 'io', 'session', 'project'],
  project: ['app', 'ui', 'render', 'tools', 'session'],
  library: ['app', 'ui', 'render', 'tools', 'session'],
};
// Runtime imports only: 'import type' is erased at compile time (no runtime dependency, no cycle
// - it is how a lower layer names the facade type it receives). The ADR governs runtime direction.
const importRe = /(?:^|\n)\s*import\s+(?!type\b)[^'"]*?from\s+['"](\.[^'"]+)['"]/g;
const directionViolations = [];
for (const [f, t] of texts) {
  const from = layer(f);
  const bad = FORBIDDEN[from] ?? [];
  if (bad.length === 0) continue;
  let m;
  while ((m = importRe.exec(t))) {
    const base = path.normalize(path.join(path.dirname(path.join(ROOT, f)), m[1]));
    const r = [base + '.ts', path.join(base, 'index.ts')].map(rel).find((x) => texts.has(x)) ?? rel(base);
    const to = layer(r);
    const shellOrPanel = from === 'session' && (r === 'src/ui/shell.ts' || r.startsWith('src/ui/panels/'));
    if (texts.has(r) && bad.includes(to) && !shellOrPanel) directionViolations.push(`${f} -> ${to} (${r})`);
  }
}

// ---- 2. mutable module-top state: a `let` at column 0 outside any type declaration.
const letRe = /^let\s+[A-Za-z0-9_$]+\s*(?::[^=]+)?=/gm;
const mutableLets = [];
for (const [f, t] of texts) {
  let m;
  while ((m = letRe.exec(t))) mutableLets.push(`${f}:${t.slice(0, m.index).split('\n').length}`);
}

// ---- 3. file size: logic files <= 400 lines, data files <= 600 (allowlist shrinks).
const DATA = /library|schema\.ts$|i18n|styles\.css/;
const CAP_LOGIC = 400;
const CAP_DATA = 600;
const snapshotRaw = (() => {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  } catch {
    return {};
  }
})();
const allowlist = snapshotRaw.oversize ?? [];
const oversize = [];
for (const [f, t] of texts) {
  const lines = t.split('\n').length;
  const cap = DATA.test(f) ? CAP_DATA : CAP_LOGIC;
  if (lines > cap && !allowlist.includes(f)) oversize.push(`${f} ${lines}>${cap}`);
}
for (const [f, t] of cssTexts) {
  const lines = t.split('\n').length;
  if (lines > CAP_DATA && !allowlist.includes(f)) oversize.push(`${f} ${lines}>${CAP_DATA}`);
}

// ---- 4. internal duplication: k-gram fingerprints repeated across different files (winnowing-ish).
function tokenize(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, 'S')
    .replace(/"(?:[^"\\\n]|\\.)*"/g, 'S')
    .replace(/`(?:[^`\\]|\\.)*`/g, 'T')
    .split(/[^A-Za-z0-9_$]+/)
    .filter(Boolean);
}
const K = 60;
const gramOwners = new Map(); // hash -> first file
const dupPairs = new Map(); // "a|b" -> count
for (const [f, t] of texts) {
  // Data tables are skipped: a library's items and the i18n texts tokenize to the same 'S: S,' runs.
  if (/library|\.test\.|assets\.d|i18n\/messages\//.test(f)) continue;
  const tokens = tokenize(t);
  for (let i = 0; i + K <= tokens.length; i++) {
    let h = 0;
    for (let j = i; j < i + K; j++) h = (h * 1000003 + (tokens[j].length << 3) + tokens[j].charCodeAt(tokens[j].length - 1)) >>> 0;
    const first = gramOwners.get(h);
    if (first === undefined) gramOwners.set(h, f);
    else if (first !== f) {
      const key = first < f ? `${first}|${f}` : `${f}|${first}`;
      dupPairs.set(key, (dupPairs.get(key) ?? 0) + 1);
    }
  }
}
const DUPLICATE_MIN = 3; // a pair of files sharing >= 3 sixty-token grams is real duplication
const duplications = [...dupPairs.entries()].filter(([, n]) => n >= DUPLICATE_MIN).map(([pair, n]) => `${pair} (${n} grams)`);

// ---- ratchet
const now = {
  direction: directionViolations.length,
  mutableLets: mutableLets.length,
  oversize: oversize.length,
  duplications: duplications.length,
};
const prev = { direction: 99999, mutableLets: 99999, oversize: 99999, duplications: 99999, ...snapshotRaw };
let worse = false;
const report = [];
for (const k of Object.keys(now)) {
  if (now[k] > prev[k]) {
    worse = true;
    report.push(`${k}: ${prev[k]} -> ${now[k]} WORSE`);
  } else report.push(`${k}: ${prev[k]} -> ${now[k]}${prev[k] === 0 ? ' (locked at zero)' : ''}`);
}
const detail = { direction: directionViolations, mutableLets, oversize: [...new Set([...oversize, ...allowlist])], duplications };
console.log(report.join('\n'));
if (update) {
  if (worse) {
    console.log('refusing --update: counts got worse');
    process.exit(1);
  }
  // new allowlist: the union of what still exceeds the cap and the old allowlist, minus what now fits
  const merged = [...new Set([...oversize.map((x) => x.split(' ')[0]), ...allowlist])].filter((f) => {
    const lines2 = (texts.get(f) ?? '').split(String.fromCharCode(10)).length;
    const cap = DATA.test(f) ? CAP_DATA : CAP_LOGIC;
    if (cssTexts.has(f)) return cssTexts.get(f).split(String.fromCharCode(10)).length > CAP_DATA;
    return lines2 > cap;
  });
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ ...now, oversize: merged, detail }, null, 1) + String.fromCharCode(10));
  console.log('snapshot updated');
} else {
  const detailLines = Object.entries(detail).filter(([, v]) => (Array.isArray(v) ? v.length : v) > 0);
  if (detailLines.length > 0) console.log('current debt:\n' + detailLines.map(([k, v]) => `  ${k}: ${Array.isArray(v) ? v.length : v}`).join('\n'));
}
process.exit(worse ? 1 : 0);
