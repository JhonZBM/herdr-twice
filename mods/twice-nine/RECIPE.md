# TWICE Nine

Every coding agent gets a pixel mascot, one per TWICE member, that shows what it's doing. The sidebar
shows a card per agent and a bench where the members nobody uses sleep; each pane header shows the
agent's mini mascot. Part of the [twice](../../RECIPE.md) layout, but it works in any layout.

![TWICE Nine](preview.png)

## What you see

- **Sidebar block** (fills its space; ~268 px wide in twice): a "TWICE n/9" title with an apricot→magenta
  line, then two columns of cards (mascot 48 px, member name in Silkscreen, status word, "program · tab"),
  each with a top stripe in the member's color. Below, the bench: the free members, small and asleep.
- **Pane header**: the mini mascot (14 px) and the member name next to the program and folder.
- **Picker**: a dialog with the nine members, each card saying if she's free or which space has her.
- **Stage** (optional block, 260×330): a drawn theatre with surtitles, wings, dressing room, boards,
  microphone and a front row, where each mascot stands where her status says.

Colors: apricot `#fcc89b`, magenta `#ff5fa2`, one color per member (`members.js`). Font: Silkscreen (OFL,
in `fonts/`).

## How it behaves

- `working`: busy animation; `blocked`: a "!" ("needs you"); `done`: sparkles; `idle`: awake while you
  look at that pane, asleep ("z z z") when you don't. Free members sleep on the bench.
- `Alt+T` picks a member for the focused agent (centered dialog); click on the header mascot opens it by
  the pointer; right-click on a card picks for that agent. Click or arrows + Enter; Esc closes. Taking a
  busy member swaps them. The choice is remembered per space. `Alt+Shift+T`: next free member.
- A session launched from another with `hc run` sits right after its mother. While it works or needs
  you the mother shows `wait` (hourglass, "esperando a" + the child's mini mascot); the child says
  "trabajando con" her mother. Priority: blocked > wait > own status.
- Each `twice.sub.<id>=<type>` label on a session's terminal wakes a free member as a backing singer on
  its card (up to 4, then "+n"). The repo's `subagentes/subagente.js` hook sets them for Claude Code.
- Stage: `working` strolls on the boards, `blocked` bounces at the microphone under the spotlight, `done`
  at the corners, `wait` in the wings, idle and asleep in the dressing room, free members in the front
  row, singers behind their leader. Surtitles show the most urgent line. Click goes to the agent.
  `Alt+R` hides or shows the block.
- Only agents that report a status to herdr get a mascot (Claude Code, Codex…; Cursor CLI through the
  repo's `cursor/` launcher).

## Built from

- One mod, four roles by `props()`: sidebar block (no props), pane header (`props().pane`), picker
  overlay (`props().elegir`, opened with `openOverlay`), stage (`props().escenario`, in `escenario.js`).
- `relaciones.js` reads `terminals()`: `parent` gives mother and child (children without a pane aren't
  in `agents()`), and the `twice.sub.*` labels give the subagents.
- Uses `agents`, `terminals`, `panes`, `spaces`, `setAgentOrder`, `openOverlay`, `nextCommand`,
  `shared("twice.slots")` and `shared("twice.prefs")`. Runs no programs, no timers: the sprites animate
  with native loops and the stage moves with native transitions.
- Art: `sprites/<member>-<state>-<a|b>.svg` (two frames per pose) plus `bang`, `sparkle`, `zzz`, `wait`,
  `escena` (the theatre) and `foco` (the spotlight).

## Add it to a layout

- A block in the sidebar: `{ "id": "twice-nine", "type": "block", "content": { "mod": "twice-nine" } }`.
- Optional, the header of the tab block's panes: `"pane": { "header": { "content": { "mod": "twice-nine" }, "height": 30 } }`.
- Optional, the stage: `{ "id": "escenario", "type": "block", "content": { "mod": "twice-nine", "props": { "escenario": true } }, "size": { "px": 330 }, "resizable": false }`
  in a column at least 260 px wide. The id must be `escenario`: that is what `alt-r` toggles.
- Keys: merge `keys.json` (`alt-t`, `alt-shift-t`, `alt-r`).

## Watch out

- The pixel font loads when herdr restarts.
- `mod.json` has `"place": "none"`: it only shows where a layout puts it.
- Sprites are original pixel art; no logos or official images.

## Done when

- `herdr-app check` passes; opening Claude gives it a card that animates while it works.
- `Alt+T` swaps the member and the next Claude in that space gets the same one.
- A session started with `hc run` from another makes its mother say "esperando a" while it works.
- With the stage block in the layout, `Alt+R` hides and shows it and each status has its zone.
