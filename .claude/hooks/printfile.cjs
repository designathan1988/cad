// SessionStart hook (every start, resume, clear and compaction): prints one memory file of the project whole into the context, so a new
// session, an account change or a compaction loses nothing decided or found. Claude Code adds a SessionStart hook's stdout to the context
// (https://code.claude.com/docs/en/hooks-guide#re-inject-context-after-compaction), but an output past 10,000 characters is saved to a
// file and only a 2 KB preview reaches the session: past the limit, the part that fits, cut at a section, and an order to read the file.
// Usage: node printfile.cjs <path from the project root> <title line>
const fs = require('node:fs');
const path = require('node:path');

/** What a hook may print and still reach the session whole (Claude Code's limit is 10,000 characters). */
const MOST = 9500;
const root = process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..');
const [relative, title] = process.argv.slice(2);
if (!relative || !title) {
  process.stderr.write('printfile.cjs: usage: node printfile.cjs <file> <title>\n');
  process.exit(0);
}
const file = path.join(root, relative);
const head = `${title}\n\n`;
if (!fs.existsSync(file)) {
  process.stdout.write(`${head}${relative} is missing: write it before working (see CLAUDE.md, "Memória que sobrevive à compactação").\n`);
} else {
  const text = fs.readFileSync(file, 'utf8');
  if (head.length + text.length <= MOST) process.stdout.write(head + text);
  else {
    const order = `\n\n${relative.toUpperCase()} IS ${text.length} CHARACTERS, PAST WHAT A HOOK CAN HAND OVER: READ ${relative} IN FULL NOW, before anything else, and cut it under 9,000 characters (what is finished to docs/agent/history.md).\n`;
    const room = MOST - head.length - order.length;
    const cut = text.lastIndexOf('\n## ', room);
    process.stdout.write(head + text.slice(0, cut > 0 ? cut : room) + order);
  }
}
