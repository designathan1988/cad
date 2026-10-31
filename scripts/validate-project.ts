// Validates a project JSON with the app's own reader (bundled by esbuild to .scratchpad/validate-project.mjs).
// Usage: node .scratchpad/validate-project.mjs <file.json> [--strict] [--roundtrip]
// --strict: fails on ANY fix (a generated fixture must read with zero fixes).
// --roundtrip: also writes it back with the app's writer and re-reads it; the kept-area fields must be
//   byte-equal through open → save → reopen (the file-format gate of the refactor).
import { readProject, writeProject } from '../src/project/file';
import { KEPT_FIELDS } from '../src/project/doc';

const file = process.argv[2]!;
const strict = process.argv.includes('--strict');
const roundtrip = process.argv.includes('--roundtrip');
const fs = await import('node:fs');
const text = fs.readFileSync(file, 'utf8');
const r = readProject(text);
if (!r.ok) {
  console.log(`FAIL ${file}: ${r.error}`);
  process.exit(1);
}
console.log(`ok: ${r.doc.walls.length} walls, ${r.doc.openings.length} openings, ${r.doc.rooms.length} rooms, ${r.doc.floors.length} floors, ${r.doc.objects.length} objects, ${r.doc.references.length} references, kept=${r.doc.kept ? Object.keys(r.doc.kept).length + ' fields' : 'none'}`);
if (r.fixes.length > 0) {
  console.log('fixes: ' + r.fixes.map((f) => `${f.kind}=${f.count}`).join(', '));
  if (strict) process.exit(1);
}
if (roundtrip) {
  const once = writeProject(r.doc);
  const again = readProject(once);
  if (!again.ok) {
    console.log('FAIL roundtrip: rewritten file does not read: ' + again.error);
    process.exit(1);
  }
  const rawIn = JSON.parse(text) as Record<string, unknown>;
  let bad = 0;
  for (const k of KEPT_FIELDS) {
    if (!(k in rawIn)) continue;
    const a = JSON.stringify(rawIn[k]);
    const b = JSON.stringify((JSON.parse(once) as Record<string, unknown>)[k]);
    if (a !== b) {
      console.log(`FAIL roundtrip: kept field ${k} changed`);
      bad++;
    }
  }
  const firstFields = Object.keys(rawIn);
  const outFields = Object.keys(JSON.parse(once) as Record<string, unknown>);
  const lost = firstFields.filter((k) => k !== 'version' && !outFields.includes(k));
  if (lost.length > 0) {
    console.log('FAIL roundtrip: fields lost: ' + lost.join(', '));
    bad++;
  }
  console.log(bad === 0 ? 'roundtrip: kept fields byte-equal after open → save → reopen' : `roundtrip: ${bad} problems`);
  process.exit(bad === 0 ? 0 : 1);
}

