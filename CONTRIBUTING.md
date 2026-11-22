# Contributing

Thanks for looking. Issues and PRs are welcome, in English or Spanish.

## What fits

- A new pose, member, theme or mod (the method is in [RECIPE.md](RECIPE.md)).
- Support for another agent CLI, following `agentes/` (Cursor and Codex are the examples).
- Fixes for macOS or Linux: this was built and tested on Windows only, so reports there are the most useful.

## The one rule: stay lightweight

Zero dependencies (only Node and git), one file per piece, no build, nothing periodic if an event can replace it.
The full rule is in the README ("Principle: lightweight"). A PR that adds a dependency or a polling timer will be
asked to find a native alternative first.

## Before opening a PR

- One mod = `mods/<name>/` with `mod.json`, `main.js`, `keys.json` (if it has keys) and `RECIPE.md`.
- `instalar.js` stays the only installer: idempotent, no overwriting without `--forzar`.
- Update `README.md` and `README.es.md` together.
- No absolute paths (drive, user) in what is versioned: always relative to `~` or the repo.
- Try it without a real agent: `node demo/presentacion.js` (see the README notes).
