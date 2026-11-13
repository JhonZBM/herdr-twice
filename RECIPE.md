# TWICE

A herdr window where every coding agent gets a pixel mascot, one per TWICE member, that shows what the
agent is doing: working, needs you, done, waiting or asleep. The sidebar lists your spaces with each
agent's mascot as its avatar, and the rest of the members sleep on a bench underneath. A gallery on the
right keeps pasted screenshots as `@imagen1`, `@imagen2`… so you can refer to them from Claude Code.
Apricot and neon magenta, with a pixel font.

![TWICE](preview.png)

## What you see

Left to right:

- **Sidebar, 268 px.** `workspace-chrome` brand (46 px) on top. Below it, two lists that split the height:
  - **Spaces** (`spaces-twice`): one row per space. The avatar is that space's agent mascot (a still
    frame of its pose); with no mascot, the program's icon (Claude, Codex…); with no agent, the first
    letter on a colored tile. The name drops a leading `✻ ` and shows in full in the tooltip. The block
    is as tall as its rows (up to 8, then it scrolls) so the mascots get the rest.
  - **TWICE Nine** (`twice-nine`): a "photocard" per open agent (mascot, member name and color, status
    word, space name) and a bench with the members nobody uses, asleep with a "z z z".
  - `workspace-chrome` footer (69 px).
- **Work column.** `tabs` on top (42 px), the terminal in the middle, `workspace-status` at the bottom
  (28 px). Each pane header shows the agent's mini mascot next to its name.
- **Gallery, 260 px** (`galeria`) on the right, next to the hidden Files/Changes stack: thumbnails
  labelled `@imagenN` with Paste and Clear buttons.

Colors: apricot `#fcc89b`, magenta `#ff5fa2`, one color per member. Font: Silkscreen (OFL, shipped in
`mods/twice-nine/fonts/`). Themes `apricot-neon` (dark) and `apricot-cream` (light).

## How it behaves

- **Statuses**, two-frame animated SVG sprites per member and pose:
  - `working`: the mascot is busy; `blocked`: a "!" over it, "needs you"; `done`: sparkles, "done";
  - `idle`: awake and still while you're looking at that pane; idle and not focused: it falls asleep;
  - members with no agent sleep on the bench, nodding with "z z z".
- **Picking a member:** `Alt+T` opens a centered dialog for the focused agent; clicking the header mascot
  opens the same picker by the pointer; right-click on a sidebar card picks for that agent. Click or
  arrows + Enter; Esc or a click outside closes. Each card says if the member is free or which space has
  her; taking a busy one swaps them. The choice is remembered per space, so the next agent opened there
  gets the same member. `Alt+Shift+T` moves to the next free member without opening anything.
- **Gallery:** `Ctrl+Shift+V` saves the clipboard image as `imagenN.png` (also an image file you copied);
  you can also drop files on the panel. Click a thumbnail for a large preview (`←` `→` to browse,
  `Enter` inserts `@imagenN`, `Esc` closes); `Alt+G` opens the last one. "@ insert" types `@imagenN ` into
  the focused terminal. Clear empties the gallery and numbering starts again at 1.
- **Agent names:** an unnamed space called `~` takes its agent's session title, prefixed with `✻`.
  `Ctrl+Shift+M` picks a folder and opens a space with Claude there.

## Built from

- Layout `layouts/twice.json`, cloned from the shipped `main` (0.1.15): the `agents` block is kept but
  hidden (its order is replaced by `twice-nine`'s `setAgentOrder`); `twice-nine` is also the `header`
  of the pane template; `nombre-agente` is a 0 px block (no UI, only logic).
- `mods/twice-nine/`: `main.js` (sidebar, header and picker overlay in one mod, chosen by `props()`),
  `members.js` (names, colors, labels), `sprites/` (90 member SVGs + `bang`, `sparkle`, `zzz`),
  `fonts/`. State in `shared("twice.slots")` and `shared("twice.prefs")`. Uses `agents`, `panes`,
  `spaces`, `setAgentOrder`, `openOverlay`, `nextCommand`; runs no programs.
- `mods/spaces-twice/`: clone of the shipped `spaces` (0.1.15) with the avatar, name and height changes
  above; runs `git` (as `spaces` does) and `layout.resize` on its own block.
- `mods/galeria/`: images in `~/.config/herdr-app/galeria/`; runs PowerShell to read the clipboard and to
  paste `@imagenN` (the clipboard is the only way to type `@`); copying dropped files also goes through
  PowerShell (the mod `fs` writes 0 bytes for binary data).
- `mods/nombre-agente/`: `space.rename` from the agent's title; `pickFolder` + `space.new`.
- Keys: each mod's `keys.json` (`mods/<mod>/keys.json`), merged into the global section. Also remove `"ctrl-shift-v": "terminal.paste"` from the
  `terminal` section, or that key keeps pasting text instead of the screenshot.

## Watch out

- The layout names its themes: copy `themes/*.json` too, or herdr rejects the whole layout
  (`herdr-app status` → `errors`).
- The pixel font loads when herdr restarts.
- Paste in the gallery is Windows only (PowerShell); dropping files works everywhere.
- Claude Code doesn't know `@imagenN` on its own: add this line to `~/.claude/CLAUDE.md`: "If the user
  mentions `@imagenN`, read `~/.config/herdr-app/galeria/imagenN.png` with Read". `instalar.js --galeria`
  does it.
- Mascots only follow agents that report a status to herdr (OSC 7501: `ESC ] 7501 ; state=working:app=cursor ESC `).
  Claude Code does it itself. Cursor CLI doesn't, and its hooks run in a hidden console of their own, so writing the
  sequence from a hook never reaches the terminal: `cursor/cursor-twice.js` launches Cursor, listens on a local pipe
  and writes the sequence itself; `cursor/estado.js` (hooks `sessionStart`/`stop` → idle, `beforeSubmitPrompt` →
  working) sends the state there. No hook fires on permission prompts, so Cursor never shows "needs you".
- herdr doesn't notice edits made through a junction: to see a change in a mod, switch to `main` and back.
- `herdr-app check` doesn't run async code: a failure inside `cx.spawn` passes the check.
- Sprites are original pixel art; no logos or official images.

## Done when

- `herdr-app check` passes for the four mods and `herdr-app status` shows `"layout": "twice"` and no errors.
- Opening Claude in a space gives it a mascot card; while it works the mascot animates, a permission
  prompt shows "needs you", and switching to another pane makes an idle one fall asleep.
- `Alt+T` swaps the member, and the next Claude opened in that space gets the same one.
- The spaces list shows the mascot as avatar and is only as tall as its rows.
- `Ctrl+Shift+V` with a screenshot copied adds `@imagen1`; "@ insert" types it in the prompt.
