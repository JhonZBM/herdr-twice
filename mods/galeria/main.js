// Galería @imagenN: imágenes pegadas o soltadas, guardadas como
// ~/.config/herdr-app/galeria/imagenN.png para nombrarlas en Claude Code.
// Van en la carpeta de la app porque image() solo lee ahí.
// - Pegar (botón o tecla "galeria.pegar"): la imagen del portapapeles
//   (o los archivos de imagen copiados) pasa a imagenN.png.
// - Soltar archivos de imagen sobre el panel: se copian tal cual.
// - Clic en una miniatura: vista previa grande (← → cambia de imagen, Enter
//   inserta, Esc cierra). Es este mismo mod abierto como diálogo (props().ver).
// - Botón "@" de la miniatura (o Enter en la vista previa): escribe "@imagenN "
//   en el terminal enfocado.
// - "×" sobre la miniatura: borra solo esa imagen (sin confirmar).
// - Limpiar: pide confirmación (mod confirm) y vacía la carpeta.
// PowerShell solo corre al pegar, soltar o insertar (una llamada por acción);
// nunca al dibujar, ver o limpiar.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, appHome, readTextFile, run, theme, layout, notify, openOverlay, closeOverlay, nextCommand, props } from "herdr";
import * as fs from "fs/promises";

const CARPETA = "galeria";
// Icono del mod: la copia que deja instalar.js en herdr-twice/galeria/ (herdr no dibuja imágenes a
// través del junction del mod); sin ella, la carpeta del mod.
let ICONO = "mods/galeria/galeria.svg";
const DIR = `${appHome()}\\${CARPETA}`.replace(/\//g, "\\");
const NOMBRE = /^imagen(\d+)\.(png|jpe?g|gif|webp|bmp)$/i;
// Copias para mostrar, con nombre único (<n>-<sello>.<ext>): herdr guarda las
// imágenes en caché por ruta, y al reutilizar un número (tras Limpiar) la
// miniatura enseñaría la imagen vieja. Claude sigue leyendo imagenN.<ext>.
const VISTA = `${DIR}\\vista`; // sin punto: image() no carga carpetas ocultas
const COPIA = /^(\d+)-([0-9a-z]+)\.(png|jpe?g|gif|webp|bmp)$/i;
const EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Guarda la imagen del portapapeles como imagenN.png (y su copia para mostrar)
// e imprime "ok": primero el formato "PNG" (conserva transparencia; la
// recortadora a veces deja solo ese), si no, el mapa de bits.
// Si el portapapeles trae archivos copiados, imprime sus rutas (las copia el mod).
// Sale con 3 si no hay nada que guardar.
function script(n, sello) {
  return `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$destino = ${q(`${DIR}\\imagen${n}.png`)}
$copia = ${q(`${VISTA}\\${n}-${sello}.png`)}
$png = [Windows.Forms.Clipboard]::GetData('PNG')
if ($png -is [IO.MemoryStream]) { [IO.File]::WriteAllBytes($destino, $png.ToArray()) }
elseif ([Windows.Forms.Clipboard]::ContainsImage()) { [Windows.Forms.Clipboard]::GetImage().Save($destino,[Drawing.Imaging.ImageFormat]::Png) }
elseif ([Windows.Forms.Clipboard]::ContainsFileDropList()) { [Windows.Forms.Clipboard]::GetFileDropList(); exit 0 }
else { exit 3 }
Copy-Item -LiteralPath $destino -Destination $copia; 'ok'; exit 0`;
}

const ps = (code) => exec("powershell", ["-NoProfile", "-NonInteractive", "-STA", "-Command", code], { timeout: 20000 });

function buscar(nodo, id) {
  if (!nodo || typeof nodo !== "object") return null;
  if (nodo.id === id) return nodo;
  for (const h of nodo.children ?? []) { const r = buscar(h, id); if (r) return r; }
  return null;
}

export default class Galeria extends View {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      if (await readTextFile(`${appHome()}/herdr-twice/galeria/galeria.svg`).catch(() => null) == null) return;
      ICONO = "herdr-twice/galeria/galeria.svg";
      cx.notify();
    });
    this.imagenes = [];
    this.ocupado = false;
    this.leer(cx);
    if (props()?.ver) {
      this.verN = props().ver;
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "pegar") {
          if (buscar(layout(), "galeria")?.hidden) run("layout.show", { id: "galeria" });
          this.pegar(cx);
        } else if (c === "limpiar") this.limpiar(cx);
        else if (c === "ver" && this.imagenes.length) this.abrirVista(this.imagenes[0]);
        cx.notify();
      }
    });
  }

  leer(cx) {
    cx.spawn(async (cx) => {
      let nombres = [], copias = [];
      try { nombres = await fs.readdir(DIR); } catch { nombres = []; }
      try { copias = await fs.readdir(VISTA); } catch { copias = []; }
      const vista = {};
      for (const c of copias) {
        const m = COPIA.exec(c);
        if (m && (!vista[m[1]] || parseInt(m[2], 36) > vista[m[1]].sello)) vista[m[1]] = { f: c, sello: parseInt(m[2], 36) };
      }
      // En Windows un archivo borrado mientras herdr lo tiene abierto (la
      // miniatura) sigue listado un rato: los recién borrados no cuentan.
      this.borradas = new Set([...(this.borradas ?? [])].filter((f) => nombres.includes(f)));
      this.imagenes = nombres.filter((f) => !this.borradas.has(f)).map((f) => NOMBRE.exec(f)).filter(Boolean)
        .map((m) => ({ n: +m[1], ruta: `${DIR}\\${m[0]}`, vista: vista[m[1]] ? `${CARPETA}/vista/${vista[m[1]].f}` : `${CARPETA}/${m[0]}` }))
        .sort((a, b) => b.n - a.n);
      cx.notify();
    });
  }

  // Número siguiente: el mayor que hay + 1; con la galería vacía vuelve a 1.
  siguiente() {
    const max = Math.max(0, ...this.imagenes.map((i) => i.n));
    return max + 1;
  }

  // Corre `trabajo(n, sello)` (guarda desde imagenN en adelante, con sus copias
  // para mostrar <n>-<sello>) sin solaparse.
  tarea(cx, trabajo) {
    if (this.ocupado) return;
    this.ocupado = true;
    cx.notify();
    // Lo que se guarde ahora reutiliza nombres: ya no hay que esconderlos.
    this.borradas = new Set();
    cx.spawn(async (cx) => {
      const n = this.siguiente();
      try {
        await fs.mkdir(VISTA, { recursive: true });
        await trabajo(n, Date.now().toString(36));
      } catch (e) {
        notify({ title: "Galería: no se pudo guardar", body: String(e?.message ?? e).slice(0, 300), level: "error" });
      }
      this.ocupado = false;
      this.leer(cx);
    });
  }

  pegar(cx) {
    this.tarea(cx, async (n, sello) => {
      const r = await ps(script(n, sello));
      if (r.code === 3) { notify({ title: "Galería", body: "El portapapeles no tiene ninguna imagen.", level: "warning" }); return 0; }
      if (r.code !== 0) throw new Error(r.stderr.trim());
      const lineas = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return lineas[0] === "ok" ? 1 : this.copiar(lineas, n, sello);
    });
  }

  soltar(rutas, cx) {
    this.tarea(cx, (n, sello) => this.copiar(rutas, n, sello));
  }

  // Copia archivos de imagen como imagenN.<ext>, más su copia para mostrar, en
  // una sola llamada a PowerShell: el fs de los mods escribe vacíos los datos
  // binarios (writeFile con Uint8Array deja 0 bytes en herdr 0.1.15).
  async copiar(rutas, n, sello) {
    const ordenes = [];
    let hechas = 0;
    for (const ruta of rutas) {
      const ext = EXT.exec(ruta)?.[1]?.toLowerCase();
      if (!ext) continue;
      const k = n + hechas;
      const destino = `${DIR}\\imagen${k}.${ext}`;
      ordenes.push(`Copy-Item -LiteralPath ${q(ruta)} -Destination ${q(destino)}`,
        `Copy-Item -LiteralPath ${q(destino)} -Destination ${q(`${VISTA}\\${k}-${sello}.${ext}`)}`);
      hechas++;
    }
    if (!hechas) { notify({ title: "Galería", body: "Ninguno de esos archivos es una imagen.", level: "warning" }); return 0; }
    const r = await ps(["$ErrorActionPreference='Stop'", ...ordenes].join("\n"));
    if (r.code !== 0) throw new Error(r.stderr.trim());
    return hechas;
  }

  // Pega "@imagenN " en el terminal enfocado (vía portapapeles: hc keys no
  // escribe "@"). Claude la lee por la regla de CLAUDE.md.
  insertar(n, cx) {
    cx.spawn(async () => {
      const r = await ps(`Set-Clipboard -Value ${q(`@imagen${n} `)}`);
      if (r.code === 0) run("terminal.paste");
      else notify({ title: "Galería", body: r.stderr.trim().slice(0, 300), level: "error" });
    });
  }

  // Vista previa: diálogo grande con este mismo mod.
  abrirVista(img) {
    openOverlay({ mod: "galeria", kind: "dialog", width: 0.8, height: 0.85, props: { ver: img.n } });
  }

  // La vista previa: la imagen en grande, flechas para cambiar, Enter inserta.
  vista() {
    const t = theme();
    const lista = [...this.imagenes].sort((a, b) => a.n - b.n);
    if (!lista.length) return v_flex().id("vista").track_focus(this.handle).size_full().bg(t.popover);
    let i = lista.findIndex((x) => x.n === this.verN);
    if (i < 0) i = lista.length - 1;
    const img = lista[i];
    const ir = (d) => { this.verN = lista[(i + d + lista.length) % lista.length].n; };
    const cerrar = () => closeOverlay(props().overlay);
    const insertar = (cx) => { cerrar(); this.insertar(img.n, cx); };
    const flecha = (id, texto, d) => h_flex().id(id).w(36).h(56).flex_none().items_center().justify_center()
      .rounded(8).cursor_pointer().text_size(22).text_color(lista.length > 1 ? t.foreground : t.dim)
      .hover((s) => s.bg(t.hover))
      .on_click((_e, cx) => { ir(d); cx.notify(); })
      .child(texto);
    const boton = (id, texto, accion, solido) =>
      h_flex().id(id).h(28).px(12).items_center().rounded(6).cursor_pointer().text_size(12)
        .bg(solido ? t.solid : t.raised).text_color(solido ? t.solid_foreground : t.foreground)
        .hover((s) => s.opacity(0.88)).on_click(accion).child(texto);

    // Recuadro de la imagen, en px, a partir del tamaño del diálogo: padding (14),
    // flechas (36) y huecos (8) a lo ancho; cabecera (28), pie (16) y huecos (10)
    // a lo alto; 8 de margen dentro del recuadro. image() con w/h explícitos se
    // ajusta dentro conservando la proporción.
    const tam = this.tam ?? { width: 800, height: 600 };
    const anchoImg = Math.max(40, tam.width - 28 - 72 - 16 - 16);
    const altoImg = Math.max(40, tam.height - 28 - 28 - 16 - 20 - 16);

    return v_flex().id("vista").track_focus(this.handle).size_full().p(14).gap(10).bg(t.popover)
      .on_size_change((size, cx) => { this.tam = size; cx.notify(); })
      .on_key_down((e, cx) => {
        if (e.key === "left") ir(-1);
        else if (e.key === "right") ir(1);
        else if (e.key === "enter") return insertar(cx);
        else if (e.key === "escape") return cerrar();
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(h_flex().items_center().gap(10).flex_none()
        .child(div().text_size(14).font_semibold().text_color(t.foreground).child(`@imagen${img.n}`))
        .child(div().flex_1().text_size(12).text_color(t.muted).child(`${i + 1} de ${lista.length}`))
        .child(boton("v-insertar", `Insertar @imagen${img.n}`, (_e, cx) => insertar(cx), true))
        .child(boton("v-cerrar", "Cerrar", () => cerrar(), false)))
      .child(h_flex().flex_1().min_h(0).items_center().gap(8)
        .child(flecha("v-ant", "‹", -1))
        .child(h_flex().flex_1().h_full().min_w(0).overflow_hidden().items_center().justify_center()
          .rounded(8).bg(t.background)
          .child(image(img.vista).w(anchoImg).h(altoImg)))
        .child(flecha("v-sig", "›", 1)))
      .child(div().flex_none().text_size(11).text_color(t.muted)
        .child("← → cambiar de imagen · Enter insertar · Esc cerrar"));
  }

  pedirLimpiar() {
    openOverlay({
      mod: "confirm", kind: "dialog", width: 360, height: 170,
      props: {
        title: "¿Vaciar la galería?",
        detail: `Se borran las ${this.imagenes.length} imágenes de ${DIR}. Las @imagenN ya enviadas dejarán de poder leerse.`,
        command: { name: "galeria.limpiar" },
      },
    });
  }

  limpiar(cx) {
    cx.spawn(async (cx) => {
      this.borradas = new Set(this.imagenes.map((i) => i.ruta.split("\\").pop()));
      for (const img of this.imagenes) { try { await fs.unlink(img.ruta); } catch {} }
      let copias = [];
      try { copias = await fs.readdir(VISTA); } catch {}
      for (const c of copias) { try { await fs.unlink(`${VISTA}\\${c}`); } catch {} }
      this.imagenes = [];
      cx.notify();
    });
  }

  // Borra una sola imagen (la original y sus copias para mostrar <n>-*).
  // Sin confirmación: es un solo archivo y el botón es pequeño y distinto de Limpiar.
  eliminar(img, cx) {
    const nombre = img.ruta.split("\\").pop();
    this.borradas = new Set([...(this.borradas ?? []), nombre]);
    this.imagenes = this.imagenes.filter((i) => i.n !== img.n);
    cx.notify();
    cx.spawn(async (cx) => {
      try { await fs.unlink(img.ruta); } catch {}
      let copias = [];
      try { copias = await fs.readdir(VISTA); } catch {}
      for (const c of copias) {
        if (COPIA.exec(c)?.[1] === String(img.n)) { try { await fs.unlink(`${VISTA}\\${c}`); } catch {} }
      }
      cx.notify();
    });
  }

  render(cx) {
    if (props()?.ver) return this.vista();
    const t = theme();
    const boton = (id, texto, accion, solido) =>
      h_flex().id(id).h(26).px(10).items_center().rounded(6).cursor_pointer().text_size(12)
        .bg(solido ? t.solid : t.raised).text_color(solido ? t.solid_foreground : t.foreground)
        .hover((s) => s.opacity(0.88)).on_click(accion).child(texto);

    const cabecera = h_flex().h(40).px(10).gap(6).items_center().flex_none()
      .child(svg(ICONO).size(14).text_color(t.muted))
      .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child("Galería"))
      .child(boton("pegar", this.ocupado ? "…" : "Pegar", (_e, cx) => this.pegar(cx), true))
      .when(this.imagenes.length > 0, (el) => el.child(boton("limpiar", "Limpiar", () => this.pedirLimpiar(), false)));

    const vacia = v_flex().flex_1().items_center().justify_center().gap(6).p(16).text_size(12).text_color(t.dim)
      .child("Sin imágenes")
      .child(div().text_color(t.muted).child("Ctrl+Shift+V pega una captura; también puedes soltar archivos aquí"));

    const tarjeta = (img) =>
      v_flex().id(`img-${img.n}`).relative().gap(4).p(6).rounded(8).border_1().border_color(t.border).bg(t.background)
        .cursor_pointer().hover((s) => s.border_color(t.accent))
        .tooltip("Clic: ver en grande · @: insertar en el prompt")
        .on_click(() => this.abrirVista(img))
        .child(image(img.vista).w_full().h(120).rounded(4))
        .child(h_flex().items_center().text_size(12)
          .child(div().flex_1().text_color(t.foreground).font_semibold().child(`@imagen${img.n}`))
          .child(h_flex().id(`ins-${img.n}`).h(22).px(8).items_center().rounded(5).cursor_pointer()
            .bg(t.raised).text_color(t.foreground).hover((s) => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); this.insertar(img.n, cx); })
            .child("@ insertar")))
        .child(h_flex().id(`del-${img.n}`).absolute().top(10).right(10).size(18).items_center().justify_center()
          .rounded(9).cursor_pointer().text_size(12).bg(t.raised).text_color(t.muted)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip(`Eliminar @imagen${img.n}`)
          .on_click((_e, cx) => { cx.stop_propagation(); this.eliminar(img, cx); })
          .child("×"));

    return v_flex().id("galeria").size_full().bg(t.surface).rounded(10).border_1().border_color(t.border)
      .on_drop((e, cx) => this.soltar(e.paths ?? [], cx))
      .child(cabecera)
      .child(this.imagenes.length === 0 ? vacia
        : v_flex().id("lista").flex_1().min_h(0).overflow_y_scrollbar().px(10).pb(10).gap(8)
            .children(this.imagenes.map(tarjeta)));
  }
}
