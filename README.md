# herdr-twice

[Español](README.es.md)

A layout for [herdr](https://herdr.dev) where every coding agent gets a pixel TWICE mascot that shows its
status, plus an image gallery for Claude Code and a matching Claude Code status line.

![TWICE](preview.png)

- **twice-nine**: one mascot per agent (working, needs you, done, waiting, asleep). Free members sleep on
  the bench. `Alt+T` picks a member; the choice is remembered per space.
  - A session that launched another one shows "waiting for" her while she works, and the child says who she works with.
  - Claude Code subagents show up as backing singers on their session's card (`--subagentes`).
  - **The stage**, a panel under the gallery (`Alt+R`): every status has its spot, and whoever needs you gets the spotlight.
- **spaces-twice**: the spaces list, with each agent's mascot as avatar.
- **galeria**: `Ctrl+Shift+V` saves a screenshot as `@imagenN`; write `@imagen3` in Claude Code to use it. A small × on each thumbnail deletes that image.
- **nombre-agente**: unnamed spaces take their agent's title; `Ctrl+Shift+M` opens Claude in a folder.
- **statusline**: model, effort, branch, context and usage limits in one line.
- **Cursor CLI and Codex**: a tiny launcher and hooks so their agents get a mascot too.
- Themes `apricot-neon` (dark) and `apricot-cream` (light).

## Install

Requirements: herdr-app (open it once), Node and git.

**Easiest:** paste this into an agent in herdr (it is the same line the [herdr gallery](https://herdr.dev/gallery/) gives):

```
Read ~/.config/herdr-app/AGENTS.md, then add this layout: https://github.com/JhonZBM/herdr-twice/tree/main
```

It follows herdr's own rules: it copies without overwriting and asks before replacing a key you already use.

**With the script** (mods linked to the clone, so `git pull` updates them):

```sh
git clone https://github.com/JhonZBM/herdr-twice
cd herdr-twice
node instalar.js --galeria --statusline --subagentes --cursor --codex
```

Clone it wherever you like: nothing depends on its location. The script can be run again: it only adds
what's missing and warns (without overwriting) when something differs; `--forzar` overwrites.

- `--galeria` adds the `@imagenN` rule to `~/.claude/CLAUDE.md`.
- `--statusline` links `~/.claude/statusline` to the clone and sets `statusLine` in `~/.claude/settings.json`.
- `--subagentes` links `~/.claude/subagentes` to the clone and adds its hooks (`SubagentStart`, `SubagentStop`, `Stop`,
  `SessionStart`, `SessionEnd`, all `async`) to `~/.claude/settings.json`, after the ones you already have.
- `--cursor` adds the hooks to `~/.cursor/hooks.json` and a **Cursor (TWICE)** entry to herdr's `+` menu.
- `--codex` adds the hooks to `~/.codex/hooks.json` and a **Codex (TWICE)** entry to the `+` menu. Codex doesn't run new
  hooks until you review them: open it, type `/hooks` and accept them.

Restart herdr to load the pixel font. To update: `git pull`, then `node instalar.js` again (themes and
layout are copies).

## Just one mod

Each mod works on its own and has its own `RECIPE.md`, `keys.json` and preview in its folder:
[twice-nine](mods/twice-nine), [galeria](mods/galeria), [spaces-twice](mods/spaces-twice),
[nombre-agente](mods/nombre-agente).

- Ask your agent in herdr: *"add this herdr mod: https://github.com/JhonZBM/herdr-twice/tree/main/mods/galeria"*.
- Or with the script: `node instalar.js --solo galeria` (several: `--solo galeria,twice-nine`). It installs
  those mods and their keys without touching your layout or themes; then ask your agent to place them
  following their RECIPE.md.

## Keys

| Key | Action |
|---|---|
| `Ctrl+Shift+V` | Paste a screenshot or image into the gallery |
| `Alt+G` | Preview the last image (`←` `→` browse, `Enter` insert `@imagenN`, `Esc` close) |
| `Alt+T` | Pick a member for the focused agent |
| `Alt+Shift+T` | Next free member |
| `Alt+R` | Show or hide the stage |
| `Ctrl+Shift+M` | Open a space with Claude in a folder |
| `Ctrl+Shift+L` | Switch layout (way out if `twice` fails) |

## Status line

```
Opus 5.5  ✦ medio    ▸ repo    main  ·  3 cambios    ⇡ 1    ▰▰▰▰▱▱▱▱▱▱  42%    ◷ 5h 30%  7d 65% ↻ 2d4h
```

Icons, colors, thresholds and spacing live in `statusline/iconos.json` (no code changes needed).

## Notes

- Paste in the gallery is Windows only (PowerShell); dropping files on it works everywhere.
- Mascots follow agents that report their status to herdr (Claude Code does). Cursor CLI and Codex don't on their own: open
  them from **Cursor (TWICE)** / **Codex (TWICE)** in the `+` menu (or `node agentes/lanzador.js cursor|codex`). Their hooks
  run outside the terminal, so they tell that launcher, which reports the status to herdr.
  - Cursor has no hook for permission prompts, so "needs you" isn't shown.
  - Codex shows "needs you" on permission prompts; it always starts with `--no-daemon`, as herdr requires.
  - Gemini CLI is not covered: Google replaced it with Antigravity CLI.
- "Waiting for" needs herdr to know who launched whom: it works for sessions started with `hc run` from another one.
- Subagents interrupted with Esc may not fire their hook; their singers leave when the session next stops or starts.
- To try the mascots without a real agent: `herdr-app do tab.new --name demo --argv '["node","demo/agente-falso.js"]'`,
  then `hc keys <t> w` (`w` `b` `d` `i` status, `h` child, `s`/`S` subagent, `q` quit).
- A guided demo to record or screenshot, with no real agents: `node demo/presentacion.js` from a terminal outside herdr
  (`--pausa 3` seconds per step, `--dejar` keeps the spaces open, `--captura preview.png` just sets up one scene with every status and saves the window). It opens three spaces with fake agents, walks through
  every status and closes them. Close your own sessions first if you don't want them in the recording.
- To see a change made to a mod: `herdr-app do layout.switch --name main`, then `--name twice`.
- Rebuild it from scratch: [RECIPE.md](RECIPE.md).

## Principle: lightweight

Zero dependencies (only Node and git), one file per piece, no build. herdr and Claude Code first. Light in
size and in resources too: no polling, few processes.

- No `setInterval`/`setTimeout` and no `cx.timer.every` if an event (`watchFolder`, herdr's live data) can replace it; if a
  timer is unavoidable: period ≥ 1 s, with a comment saying why. Every `exec`/`spawn` is one-off.
- Rough guides, not metrics to hit: repo ~1 MB; SVGs a few KB; PNGs ≤ ~100 KB. Reuse what Claude Code and herdr already provide before writing anything new.
- No absolute paths (drive, user) in what is versioned.

## License

Code: MIT. Silkscreen font: SIL OFL (`mods/twice-nine/fonts/OFL.txt`). The sprites are original pixel art,
an unofficial fan tribute; no logos or official images.
