# herdr-twice
Layout, mods, temas y statusline de herdr con mascotas TWICE. Repo público.
## Regla de ligereza (central)
Ligero en disco **y** en recursos (CPU, memoria, procesos lanzados), también en cambios pequeños:
- Cero dependencias salvo Node y git. Un archivo por pieza. Sin build, sin `package.json`, sin `node_modules`.
- Reutilizar antes que crear: usar lo nativo de Claude Code/herdr (hooks, statusline, `watchFolder`, eventos, `hc`,
  `herdr-app do`) y no escribir nada que ya exista. Mirar primero qué trae; crear solo lo que falte.
- Nada periódico sin necesidad: prohibido `setInterval`/`setTimeout` recurrente y `cx.timer.every` si un evento
  lo sustituye; si es inevitable, periodo ≥ 1 s y comentario que lo justifique. Cada `exec`/`spawn` es puntual.
- Referencias orientativas, no métricas a cumplir: versionado ~1 MB; SVG de unos KB; PNG ≤ ~100 KB; `main.js` de decenas de KB.
  Superarlas pide pensarlo, no obliga a trocear ni recortar si lo nativo o el diseño lo justifican.
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
