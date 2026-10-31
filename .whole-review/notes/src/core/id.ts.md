# src/core/id.ts
Lines: 4
Summary: New element ids: the kind's prefix, an underscore and the first 8 hex digits of crypto.randomUUID().

## Structure (every non-blank line range, 1 to the end, and what it holds)
- 1 header comment: random stable ids; randomUUID "in every supported browser"
- 3 newId(prefix): `${prefix}_${8 hex digits}` (the first group of a v4 UUID: 32 random bits)

## Contracts, state and data flow
- crypto.randomUUID exists only in secure contexts (HTTPS or localhost): the app opened over plain http from another device (a phone on the LAN at http://192.168.x.x:5173) has no randomUUID, and every newId throws a TypeError, so nothing can be created (F-0043). The project has no vite.config (default dev server on localhost only; `--host` is needed for LAN, which is exactly the plain-http case).
- 32 random bits per id: by the birthday bound, about 1 % chance of a repeat among ~9,000 ids of one prefix (copying, pasting and series make many); a repeat makes two elements one id (F-0043).

## Depends on / used by
- uses: Web Crypto (crypto.randomUUID)
- used by: every element-making path (app, kind tools, commands, io), tests

## Problems found (finding IDs)
- F-0043 newId needs a secure context and keeps only 32 random bits

## To check in other files
- io/project-file.ts: whether duplicate ids are repaired when read

## Sources
- https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID : secure contexts only; a 36-character v4 UUID, 122 random bits, the first group fully random (line 3)
