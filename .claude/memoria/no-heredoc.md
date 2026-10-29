---
name: no-heredoc
description: Never use shell heredocs (<<EOF) for patches or file content; use Edit/Write or a script file written with Write
metadata:
  node_type: memory
  type: feedback
  originSessionId: 0ffa6168-074b-475a-ac1a-ed29fa28c1f5
  modified: 2026-10-27T01:24:24.243Z
---

Never use heredocs (`<<'EOF'`) in Bash or PowerShell to write files, patch code or run inline scripts. Use Edit/Write for code changes; for multi-file patches, write a Python script with Write and run `python -X utf8 <file>`.

**Why:** heredocs keep breaking in this environment (the shell rejects the text when the code has quotes or backticks, and nothing gets applied), wasting time; the user was furious about it (2026-10-26).

**How to apply:** every time content would go through a shell string, write it to a file with Write first. Related: [[fix-in-code-verify-in-app]].

The same goes for here-strings (`<<<`) and for `node -e "..."` with code or comments inside double quotes: Bash runs every
`backtick` pair as a command. On 2026-10-29 a comment with `clear` in backticks ran `clear` and wrote its escape codes into
two source files, and others lost words. Edits with backticks go through Edit, or a script file written with Write.
