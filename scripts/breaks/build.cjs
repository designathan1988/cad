// Transpiles the project's own src/ to runnable ES modules (no type checking, no code changed), adding the .js extensions Node needs.
// usage (from the project's root): node scripts/breaks/build.cjs . .breaks/run
// The out dir sits inside the project, so 'three', 'polyclip-ts'... resolve from its node_modules.
const ts = require('typescript'); // the project's own (node_modules)
const fs = require('fs');
const path = require('path');
const [root, out] = process.argv.slice(2).map((p) => path.resolve(p));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const srcDir = path.join(root, 'src');
let n = 0;
for (const file of walk(srcDir)) {
  if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
  const code = fs.readFileSync(file, 'utf8');
  let js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, verbatimModuleSyntax: false, isolatedModules: true }, fileName: file }).outputText;
  // Relative specifiers get the file they name: x -> x.js, a folder -> folder/index.js.
  js = js.replace(/((?:from|import)\s*\(?\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (m, a, spec, b) => {
    const abs = path.resolve(path.dirname(file), spec);
    if (fs.existsSync(`${abs}.ts`)) return `${a}${spec}.js${b}`;
    if (fs.existsSync(path.join(abs, 'index.ts'))) return `${a}${spec}/index.js${b}`;
    return m;
  });
  const dest = path.join(out, 'src', path.relative(srcDir, file)).replace(/\.ts$/, '.js');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, js);
  n++;
}
fs.writeFileSync(path.join(out, 'package.json'), '{"type":"module"}');
console.log(`transpiled ${n} files to ${out}`);
