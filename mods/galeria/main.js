// Galería @imagenN: imágenes pegadas o soltadas, guardadas como
// ~/.config/herdr-app/galeria/imagenN.png para nombrarlas en Claude Code.
// Van en la carpeta de la app porque image() solo lee ahí.
// - Pegar (botón o tecla "galeria.pegar"): la imagen del portapapeles
//   (o los archivos de imagen copiados) pasa a imagenN.png.
// - Soltar archivos de imagen sobre el panel: se copian tal cual.
// - Clic en una miniatura: escribe "@imagenN " en el terminal enfocado.
// - Limpiar: pide confirmación (mod confirm) y vacía la carpeta.
// PowerShell solo corre al pegar o insertar; nunca al dibujar, soltar o limpiar.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { exec, appHome, run, theme, layout, notify, openOverlay, nextCommand } from "herdr";
import * as fs from "fs/promises";

const CARPETA = "galeria";
const DIR = `${appHome()}\\${CARPETA}`.replace(/\//g, "\\");
const NOMBRE = /^imagen(\d+)\.(png|jpe?g|gif|webp|bmp)$/i;
const EXT = /\.(png|jpe?g|gif|webp|bmp)$/i;
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Guarda la imagen del portapapeles como imagenN.png e imprime "ok".
// Si el portapapeles trae archivos copiados, imprime sus rutas (las copia el mod).
// Sale con 3 si no hay nada que guardar.
function script(n) {
  return `$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
if ([Windows.Forms.Clipboard]::ContainsImage()) {
  [Windows.Forms.Clipboard]::GetImage().Save(${q(`${DIR}\\imagen${n}.png`)},[Drawing.Imaging.ImageFormat]::Png); 'ok'; exit 0
}
if ([Windows.Forms.Clipboard]::ContainsFileDropList()) { [Windows.Forms.Clipboard]::GetFileDropList(); exit 0 }
exit 3`;
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
    this.imagenes = [];
    this.ocupado = false;
    this.leer(cx);
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "pegar") {
          if (buscar(layout(), "galeria")?.hidden) run("layout.show", { id: "galeria" });
          this.pegar(cx);
        } else if (c === "limpiar") this.limpiar(cx);
        cx.notify();
      }
    });
  }

  leer(cx) {
    cx.spawn(async (cx) => {
      let nombres = [];
      try { nombres = await fs.readdir(DIR); } catch { nombres = []; }
      // En Windows un archivo borrado mientras herdr lo tiene abierto (la
      // miniatura) sigue listado un rato: los recién borrados no cuentan.
      this.borradas = new Set([...(this.borradas ?? [])].filter((f) => nombres.includes(f)));
      this.imagenes = nombres.filter((f) => !this.borradas.has(f)).map((f) => NOMBRE.exec(f)).filter(Boolean)
        .map((m) => ({ n: +m[1], ruta: `${DIR}\\${m[0]}`, vista: `${CARPETA}/${m[0]}` }))
        .sort((a, b) => b.n - a.n);
      cx.notify();
    });
  }

  // Número siguiente: el mayor que hay + 1; con la galería vacía vuelve a 1.
  siguiente() {
    const max = Math.max(0, ...this.imagenes.map((i) => i.n));
    return max + 1;
  }

  // Corre `trabajo(n)` (guarda desde imagenN en adelante) sin solaparse.
  tarea(cx, trabajo) {
    if (this.ocupado) return;
    this.ocupado = true;
    cx.notify();
    // Lo que se guarde ahora reutiliza nombres: ya no hay que esconderlos.
    this.borradas = new Set();
    cx.spawn(async (cx) => {
      const n = this.siguiente();
      try {
        await fs.mkdir(DIR, { recursive: true });
        await trabajo(n);
      } catch (e) {
        notify({ title: "Galería: no se pudo guardar", body: String(e?.message ?? e).slice(0, 300), level: "error" });
      }
      this.ocupado = false;
      this.leer(cx);
    });
  }

  pegar(cx) {
    this.tarea(cx, async (n) => {
      const r = await ps(script(n));
      if (r.code === 3) { notify({ title: "Galería", body: "El portapapeles no tiene ninguna imagen.", level: "warning" }); return 0; }
      if (r.code !== 0) throw new Error(r.stderr.trim());
      const lineas = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      return lineas[0] === "ok" ? 1 : this.copiar(lineas, n);
    });
  }

  soltar(rutas, cx) {
    this.tarea(cx, (n) => this.copiar(rutas, n));
  }

  // Copia archivos de imagen como imagenN.<ext> con fs (sin procesos).
  // fs solo lee dentro de home: los que fallen (p. ej. en D:) se copian
  // con una única llamada a PowerShell.
  async copiar(rutas, n) {
    let hechas = 0;
    const fuera = [];
    for (const ruta of rutas) {
      const ext = EXT.exec(ruta)?.[1]?.toLowerCase();
      if (!ext) continue;
      const destino = `${DIR}\\imagen${n + hechas}.${ext}`;
      try { await fs.writeFile(destino, await fs.readFile(ruta)); }
      catch { fuera.push([ruta, destino]); }
      hechas++;
    }
    if (fuera.length) {
      const r = await ps(`$ErrorActionPreference='Stop'\n` +
        fuera.map(([a, b]) => `Copy-Item -LiteralPath ${q(a)} -Destination ${q(b)}`).join("\n"));
      if (r.code !== 0) throw new Error(r.stderr.trim());
    }
    if (!hechas) notify({ title: "Galería", body: "Ninguno de esos archivos es una imagen.", level: "warning" });
    return hechas;
  }

  // Pega "@imagenN " en el terminal enfocado (vía portapapeles: hc keys no
  // escribe "@"). Claude la lee por la regla de CLAUDE.md.
  insertar(img, cx) {
    cx.spawn(async () => {
      const r = await ps(`Set-Clipboard -Value ${q(`@imagen${img.n} `)}`);
      if (r.code === 0) run("terminal.paste");
      else notify({ title: "Galería", body: r.stderr.trim().slice(0, 300), level: "error" });
    });
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
      this.imagenes = [];
      cx.notify();
    });
  }

  render(cx) {
    const t = theme();
    const boton = (id, texto, accion, solido) =>
      h_flex().id(id).h(26).px(10).items_center().rounded(6).cursor_pointer().text_size(12)
        .bg(solido ? t.solid : t.raised).text_color(solido ? t.solid_foreground : t.foreground)
        .hover((s) => s.opacity(0.88)).on_click(accion).child(texto);

    const cabecera = h_flex().h(40).px(10).gap(6).items_center().flex_none()
      .child(svg("mods/galeria/galeria.svg").size(14).text_color(t.muted))
      .child(div().flex_1().text_size(13).font_semibold().text_color(t.foreground).child("Galería"))
      .child(boton("pegar", this.ocupado ? "…" : "Pegar", (_e, cx) => this.pegar(cx), true))
      .when(this.imagenes.length > 0, (el) => el.child(boton("limpiar", "Limpiar", () => this.pedirLimpiar(), false)));

    const vacia = v_flex().flex_1().items_center().justify_center().gap(6).p(16).text_size(12).text_color(t.dim)
      .child("Sin imágenes")
      .child(div().text_color(t.muted).child("Ctrl+Shift+V pega una captura; también puedes soltar archivos aquí"));

    const tarjeta = (img) =>
      v_flex().id(`img-${img.n}`).gap(4).p(6).rounded(8).border_1().border_color(t.border).bg(t.background)
        .cursor_pointer().hover((s) => s.border_color(t.accent))
        .on_click((_e, cx) => this.insertar(img, cx))
        .child(image(img.vista).w_full().h(120).rounded(4))
        .child(h_flex().items_center().text_size(12)
          .child(div().flex_1().text_color(t.foreground).font_semibold().child(`@imagen${img.n}`))
          .child(div().text_color(t.dim).child("insertar")));

    return v_flex().id("galeria").size_full().bg(t.surface).rounded(10).border_1().border_color(t.border)
      .on_drop((e, cx) => this.soltar(e.paths ?? [], cx))
      .child(cabecera)
      .child(this.imagenes.length === 0 ? vacia
        : v_flex().id("lista").flex_1().min_h(0).overflow_y_scrollbar().px(10).pb(10).gap(8)
            .children(this.imagenes.map(tarjeta)));
  }
}
