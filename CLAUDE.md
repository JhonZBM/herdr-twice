# herdr-twice
Layout, mods, temas y statusline de herdr con mascotas TWICE. Repo público.
## Regla de ligereza (central)
Ligero en disco **y** en recursos (CPU, memoria, procesos lanzados), también en cambios pequeños:
- Cero dependencias salvo Node y git. Un archivo por pieza. Sin build, sin `package.json`, sin `node_modules`.
- Usar antes lo nativo de Claude Code/herdr (hooks, statusline, `watchFolder`, eventos) que algo propio.
- Nada periódico sin necesidad: prohibido `setInterval`/`setTimeout` recurrente y `cx.timer.every` si un evento
  lo sustituye; si es inevitable, periodo ≥ 1 s y comentario que lo justifique. Cada `exec`/`spawn` es puntual.
- Umbrales (objetivo): versionado ≤ 1 MB; cada SVG ≤ 4 KB; cada PNG ≤ 100 KB (`preview.png` raíz ≤ 150 KB);
  cada `main.js` ≤ 25 KB.
- Sin rutas absolutas (disco, usuario) en lo versionado: siempre relativas a `~` o al repo.
## Convenciones
- Un mod = `mods/<nombre>/` con `mod.json`, `main.js`, `keys.json` (si hay atajos), `RECIPE.md` y `preview.png` si procede.
- `instalar.js` es el único instalador (mods por junction, temas/layout por copia): idempotente, no pisa sin
  `--forzar`, admite `--solo`; lo opcional va tras un flag.
- `README.md` (inglés) y `README.es.md` (español) se actualizan juntos; `RECIPE.md` explica cómo reconstruir.
- Galería: imágenes citadas como `@imagenN` → `~/.config/herdr-app/galeria/imagenN.png`.
- Commits con la skill `commit`, sin `Co-Authored-By`.
## Comprobar el cumplimiento
```
git ls-files -z | xargs -0 du -cb | tail -1                 # total versionado
git ls-files '*.svg' '*.png' | xargs ls -l                   # tamaño por activo
git grep -nE "setInterval|setTimeout|timer\.every"           # periodicidad
git grep -nE "[A-Za-z]:[\\/](Users|PROGRAMACION)|/home/"     # rutas absolutas
```
