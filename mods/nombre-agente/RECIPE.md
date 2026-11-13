# Nombre de agente

An invisible mod: a space nobody named, which herdr calls `~`, takes its agent's session title, with `✻`
in front. And `Ctrl+Shift+M` picks a folder and opens a space with Claude there. Part of the
[twice](../../RECIPE.md) layout, but it works in any layout. No preview: it draws nothing.

## How it behaves

- When a space is called `~` (unnamed, at home) and its first agent has a real title (not the program's
  name, a path or `user@host`), the space is renamed `✻ <title>`. It gets herdr's color for named spaces.
- It only touches names it set (remembered in `localStorage`); a name you gave by hand is never changed.
  When the space has no agent left, its name goes back to automatic.
- `Ctrl+Shift+M`: the system folder picker, then a new space there running `claude`.

## Built from

- `spaces`, `agents`, `run("space.rename")`, `run("space.new")`, `pickFolder`, `nextCommand` for
  `nombre-agente.nuevo`. Draws nothing, no timers, no programs.

## Add it to a layout

- A 0 px block anywhere (it must be in the layout to run): `{ "id": "nombre-agente", "type": "block", "size": { "px": 0 }, "content": { "mod": "nombre-agente" } }`.
- Keys: merge `keys.json` (`ctrl-shift-m`).

## Watch out

- `✻` is its mark to recognize the names it set; spaces-twice hides it in the list.

## Done when

- `herdr-app check` passes; Claude opened in an unnamed space at home renames it to `✻ <title>`.
- `Ctrl+Shift+M` opens a folder picker and a space with Claude in the folder chosen.
