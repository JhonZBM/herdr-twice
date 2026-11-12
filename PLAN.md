# Plan: layout «jonz» para herdr con galería de imágenes @imagenN

## Contexto
El usuario usa Claude Code dentro de **herdr-app** (herdr-app 0.1.15, layout `main`). Quiere acercarlo a Claude Desktop: pegar imágenes y referirse a ellas como
`@imagen1`, `@imagen2`…, versionarlo en su repo `JhonZBM/Herdr-jonz` (raíz = `~/.claude`) y
tener un `preview.png` del layout.

Comparación rápida (lo que motiva el mod):
| Función | Claude Desktop | Hoy en herdr + Claude Code |
|---|---|---|
| Pegar imagen | Ctrl+V con miniatura | `Alt+V` en Claude Code → `[Image #1]`; el Ctrl+V de herdr en Windows solo pega texto |
| Ver miniaturas antes de enviar | Sí | No |
| Nombrar/reutilizar imágenes | No (solo en el mensaje) | No → **lo añadimos: @imagenN persistente** |
| Arrastrar archivos | Sí | herdr pega la ruta |

## Diseño
1. **Mod `galeria`** (`~/.claude/herdr/mods/galeria/`: `main.js`, `mod.json`, icono svg)
   - Carpeta de imágenes: `~/.config/herdr-app/galeria/imagenN.png` (`appHome()/galeria`: `image()` solo lee
     dentro de la carpeta de la app; fuera del repo; numeración continua, no se reutiliza ni tras Limpiar).
   - Botón **Pegar** y tecla `ctrl-shift-v` → `galeria.pegar` (sustituye a `terminal.paste`; Ctrl+V y
     Shift+Insert siguen pegando texto). Si el bloque `galeria` está oculto, lo muestra (`layout.show`).
     Pegar: `exec("powershell", ["-STA", …])`
     guarda la imagen del portapapeles como PNG (System.Windows.Forms.Clipboard.GetImage).
   - **Soltar archivos** sobre el panel (`.on_drop`, `event.paths`) → se copian con `fs` como imagenN.<ext> (sin procesos).
   - Miniaturas (`image(path)`) con etiqueta `@imagenN`; **clic** → copia `@<ruta absoluta> ` al
     portapapeles (`Set-Clipboard`) y ejecuta `run("terminal.paste")` en el terminal enfocado.
   - Botón **Limpiar** (vacía la carpeta con `fs.unlink`, con confirmación vía mod `confirm`).
   - PowerShell solo al pegar o insertar; nunca al dibujar, soltar ni limpiar.
   - Revisar mods existentes como referencia: `~/.config/herdr-app/mods/files`, `changes`, `toast`;
     API en `~/.config/herdr-app/herdr.d.ts` y `gpui-kit.d.ts`.
2. **Escribir `@imagen1` a mano también funciona**: una línea en el `~/.claude/CLAUDE.md` global:
   «si el usuario menciona @imagenN, lee `~/.config/herdr-app/galeria/imagenN.png` con Read».
3. **Layout `jonz`**: copia de `layouts/main.json` con `cloned_from` y un bloque `galeria`
   en la columna derecha (junto a files/changes), ~260 px. La original no se toca.
4. **Repo** (`~/.claude`):
   - `herdr/mods/galeria/` → junction desde `~/.config/herdr-app/mods/galeria` (`mklink /J`, sin admin).
   - `herdr/layouts/jonz.json` → hardlink a `~/.config/herdr-app/layouts/jonz.json`
     (comprobar tras editar que sigue enlazado; si herdr lo reemplaza, pasar a copia con `herdr/sync.ps1`).
   - `herdr/keys.json` no: solo documentar la tecla nueva en README (keys.json es del usuario, se edita in situ).
   - `.gitignore`: `!herdr/` y `!herdr/**` (ya añadidos al rescatar este plan).
   - `herdr/preview.png` con `herdr-app shot`, y `herdr/RECIPE.md` (formato de AGENTS.md §«Layouts and mods other people made»).
   - Commits separados: mod, layout, CLAUDE.md, preview/recipe; línea en CHANGELOG por cada uno.

## Verificación
- `herdr-app check ~/.config/herdr-app/mods/galeria` sin errores; `herdr-app status` sin `.error`.
- `herdr-app do layout.switch --name jonz`, luego `herdr-app shot` y revisar la captura.
- Copiar una captura (Win+Shift+S) → Pegar → aparece `@imagen1` con miniatura.
- Clic en miniatura con Claude Code enfocado → se inserta la ruta; enviar y confirmar que Claude ve la imagen.
- Escribir «describe @imagen1» → Claude la lee por la regla de CLAUDE.md.
- `git status` muestra solo archivos esperados; ninguna imagen de la galería en el repo.
- Push a `origin main` con la cuenta JhonZBM.
- Escape si algo sale mal: `ctrl-shift-l` vuelve a otro layout; `ctrl-alt-shift-escape` restablece.

## Estado (2026-11-12) — hecho
Construido por una sesión delegada (skill `delegar`) y revisado. Probado a mano: pegar, numeración
que vuelve a 1 tras Limpiar, clic que pega `@imagenN `, lectura de `@imagenN` por la regla.

Ojo (aprendido al probarlo):
- **Recargar el mod:** herdr no ve los cambios guardados a través del junction. Tras editar
  `main.js`: `herdr-app do layout.switch --name main` y luego `--name jonz`.
- **`herdr-app check` no prueba lo asíncrono:** un fallo dentro de `cx.spawn` pasa el check.
  El `fs` de los mods no tiene `stat` (solo readFile, writeFile, readdir, exists, unlink, rmdir, mkdir).
- **Windows y archivos borrados:** si herdr tiene abierta la miniatura, el archivo sigue listado un rato
  tras borrarlo; el mod recuerda los recién borrados y deja de esconderlos al guardar algo nuevo.
- **El menú `@` de Claude Code no sugiere la galería** (solo busca en el proyecto; `/add-dir` no ayuda).
  Se escribe `@imagenN` a mano o se hace clic en la miniatura.
- **`hc keys` no escribe `@`:** el clic pega `@imagenN ` por el portapapeles (pisa lo copiado).

### 2026-11-11
Nada implementado todavía. La sesión se detuvo porque la máquina dejó de responder
(sospecha: un proceso de Edge con mucha CPU).

Ya investigado, para no repetirlo:
- herdr-app vive en `~/.config/herdr-app`; su `AGENTS.md` documenta layouts, keys y mods.
- API de mods: `herdr.d.ts` (`exec`, `run`, `home`, `nextCommand`, `writeTextFile`) y
  `gpui-kit.d.ts` (`image(path)` línea ~20291, `svg(path)`, `localStorage`).
- Ejemplo de mod: `mods/changes/main.js` (View con `init`/`render`, `cx.spawn`, `exec`).
- En `layouts/main.json` el panel derecho es un stack con `files` y `changes`
  (`"active": "files"`, 368 px, oculto por defecto): ahí va el bloque `galeria`.
- `terminal.paste` en Windows pega el texto del portapapeles en el terminal enfocado.
- Comprobar mods con `herdr-app check <carpeta>`; captura con `herdr-app shot`.

Siguiente paso: escribir `herdr/mods/galeria/` (main.js, mod.json) y hacer el junction.
