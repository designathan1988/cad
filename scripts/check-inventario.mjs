// Gate: every src file must have a disposition row in docs/refatoracao/inventario.md. Prints the diff;
// exit 1 when not empty. Usage: node scripts/check-inventario.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(SRC)
  .filter((f) => /\.(ts|css)$/.test(f))
  .map((f) => path.relative(ROOT, f).replaceAll('\\', '/'))
  .sort();
const doc = fs.readFileSync(path.join(ROOT, 'docs/refatoracao/inventario.md'), 'utf8');
const missing = files.filter((f) => !doc.includes(f));
const extra = [...doc.matchAll(/(src\/[a-z0-9/._-]*\.(?:ts|css))/g)]
  .map((m) => m[1])
  .filter((f) => !files.includes(f) && !doc.includes(`(apagado) ${f}`));
console.log(`files in src: ${files.length}; rows matched: ${files.length - missing.length}`);
if (missing.length > 0) console.log('MISSING DISPOSITION:\n  ' + missing.join('\n  '));
if (extra.length > 0) console.log('ROWS FOR FILES THAT DO NOT EXIST:\n  ' + [...new Set(extra)].join('\n  '));
process.exit(missing.length === 0 && extra.length === 0 ? 0 : 1);
