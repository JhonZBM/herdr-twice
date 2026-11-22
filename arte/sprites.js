#!/usr/bin/env node
// Generador de sprites pixel-art para mods de herdr. Node puro, sin dependencias.
//
//   node sprites.js <mascotas.js> --out <carpeta-sprites> [--hojas <carpeta>]
//   node sprites.js extraer <archivo.svg>...        # un SVG de píxeles -> rejilla de texto
//
// <mascotas.js> exporta { tam, paletas, orden, mascotas, poses?, marcas? } (ver mascotas-twice.js).
// Cada mascota se dibuja UNA vez por piezas (cabeza, cuerpo, brazos, cola) y las poses salen de
// mover esas piezas: así todas las poses son la misma mascota. Salida: un SVG por cuadro
// (<slug>-<pose>.svg), uno por marca, y hojas de contacto PNG para mirarlas antes de instalarlas.
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib");

// ---------- piezas -----------------------------------------------------------
// Una pieza es un Map "fila,col" -> letra de la paleta. parte([fila, col, "letras"], ...):
// cada letra pinta un píxel hacia la derecha; " " salta y "." borra lo ya puesto.
const K = (r, c) => r + "," + c;
const RC = (k) => k.split(",").map(Number);
function parte(...specs) {
  const d = new Map();
  for (const [r, c, s] of specs) {
    [...s].forEach((ch, i) => {
      if (ch === " ") return;
      if (ch === ".") d.delete(K(r, c + i));
      else d.set(K(r, c + i), ch);
    });
  }
  return d;
}
// Espejo horizontal (para el brazo derecho). Por defecto la luz "l" pasa a base "b":
// la luz viene de arriba a la izquierda y no debe reflejarse.
function espejo(p, { ancho = 24, desplaza = 0, cambia = { l: "b" } } = {}) {
  const d = new Map();
  for (const [k, ch] of p) { const [r, c] = RC(k); d.set(K(r, ancho - 1 - c + desplaza), cambia[ch] ?? ch); }
  return d;
}
const mover = (p, dr, dc) => { const d = new Map(); for (const [k, ch] of p) { const [r, c] = RC(k); d.set(K(r + dr, c + dc), ch); } return d; };
const rango = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);

// ---------- plantilla chibi 24x24 (lo que hace que varias mascotas parezcan un conjunto) ---
// Cabeza de 14 de ancho que acaba en la fila 14; cuerpo de la fila 15 a la 21; pies en la 21.
// Letras: l luz, b base, s sombra, c crema, p rubor, o contorno.
function cabezaBase(arriba = 7) {
  const sp = [[arriba, 7, "llllbbbbbb"], [arriba + 1, 6, "lllbbbbbbbbb"], [arriba + 2, 5, "llbbbbbbbbbbbb"]];
  for (const r of rango(arriba + 3, 13)) sp.push([r, 5, r === arriba + 3 ? "lbbbbbbbbbbbbs" : "bbbbbbbbbbbbbs"]);
  sp.push([13, 5, "bbbbbbbbbbbbss"], [14, 6, "bbbbbbbbssss"]);
  return sp;
}
function cuerpoBase(barriga = "c", pie = "s") {
  barriga = barriga || "b";
  const sp = [[15, 8, "bbbbbbbb"], [16, 8, "lbbbbbbs"]];
  for (const r of rango(17, 21)) sp.push([r, 7, "bb" + barriga.repeat(4) + "bsss"]);
  sp.push([21, 7, pie.repeat(4)], [21, 13, pie.repeat(4)]);
  return sp;
}
const hocico = (nariz = "o") => [[13, 9, "cccc"], [14, 9, "cccc"], [13, 10, nariz.repeat(2)]];
const BOCA = [[14, 10, "pp"]];
// Brazo izquierdo en sus tres posiciones (el derecho es su espejo).
const BRAZOS = {
  down: parte([17, 6, "lb"], [18, 6, "bb"], [19, 6, "bb"]),
  up: parte([15, 4, "lb"], [16, 5, "bb"], [17, 6, "bb"]),
  out: parte([17, 4, "lbbb"], [18, 5, "bbb"]),
};
// Brazo levantado de "te necesita" (lado derecho; ANCHO para cabezas con orejas caídas).
const LEVANTA_ANCHO = parte([8, 20, "lb"], ...rango(9, 16).map((r) => [r, 20, "bs"]),
  [16, 18, "bbbs"], [17, 16, "bbbbs"], [18, 16, "bs"], [19, 16, "bs"]);
const LEVANTA = mover(LEVANTA_ANCHO, 0, -1);

// ---------- componer un cuadro -------------------------------------------------
// Pinta una pieza en el lienzo; con contorno, rodea su silueta con "o" (lo que la pieza
// siguiente tape, queda tapado: el orden de pintado es el orden de profundidad).
function pinta(cv, p, dx, dy, contorno = true) {
  if (!p) return;
  const sh = mover(p, dy, dx);
  if (contorno) for (const k of sh.keys()) {
    const [r, c] = RC(k);
    for (const q of [K(r - 1, c), K(r + 1, c), K(r, c - 1), K(r, c + 1)]) if (!sh.has(q)) cv.set(q, "o");
  }
  for (const [k, ch] of sh) cv.set(k, ch);
}
// Ojos: columnas [izq, der] de cada ojo de 2x2 en las filas 11-12 (iguales para todo el conjunto).
const OJOS = {
  open: (L, R) => [[11, L[0]], [11, L[1]], [12, L[0]], [12, L[1]], [11, R[0]], [11, R[1]], [12, R[0]], [12, R[1]]],
  blink: (L, R) => [[12, L[0]], [12, L[1]], [12, R[0]], [12, R[1]]],
  worry: (L, R) => [[11, L[1]], [12, L[0]], [12, L[1]], [11, R[0]], [12, R[0]], [12, R[1]]],
  happy: (L, R) => [[11, L[1]], [12, L[0]], [11, R[0]], [12, R[1]]],
};
// Un cuadro. m: la mascota. Opciones de pose:
//   dx, dy  mueve todo (dy -2 = salto)        lean  inclina la cabeza a un lado
//   nod     baja la cabeza sobre el cuerpo    armL/armR  "down" | "up" | "out"
//   eyes    "open" | "blink" | "worry" | "happy"         mouth  boca abierta
//   rdy     levanta el brazo de aviso (0, -1 para el segundo cuadro)
function cuadro(m, { dx = 0, dy = 0, lean = 0, nod = 0, armL = "down", armR = "down", eyes = "open", mouth = false, rdy = null } = {}, tam = 24) {
  const cv = new Map();
  const ox = (m.dx ?? 0) + dx;
  const tope = m.cabeza ? "cabeza" : "cuerpo"; // las de una sola pieza no tienen cabeza aparte
  const nd = m.cabeza ? nod : 0;
  const off = (n) => [ox + (n === tope ? lean : 0), dy + (n === tope ? nd : 0)];
  pinta(cv, m.detras, ox, dy);
  pinta(cv, m.cuerpo, ...off("cuerpo"));
  pinta(cv, m.pies, ox, dy);
  pinta(cv, m.cabezaDetras, ...off("cabeza"));
  pinta(cv, m.cabeza, ...off("cabeza"));
  pinta(cv, m.cabezaDelante, ...off("cabeza"));
  const [fx, fy] = off(tope);
  const [L, R] = m.ojos ?? [[7, 8], [13, 14]];
  for (const c of m.rubor ?? [6, 7, 14, 15]) cv.set(K(13 + fy, c + fx), "p");
  for (const [r, c] of OJOS[eyes](L, R)) cv.set(K(r + fy, c + fx), "o");
  if (mouth) pinta(cv, parte(...m.bocaAbierta), fx, fy, false);
  const brazos = m.brazos ?? BRAZOS;
  const [ax, ay] = off("cuerpo");
  const lado = m.ladoLevantar ?? "R";
  let lev = m.levantar ?? LEVANTA;
  if (lado === "L") lev = espejo(lev, { desplaza: 1 });
  for (const [s, v] of [["L", armL], ["R", armR]]) {
    if (rdy !== null && s === lado) pinta(cv, lev, ax, ay + rdy);
    else pinta(cv, s === "L" ? brazos[v] : espejo(brazos[v]), ax, ay, !(m.brazosSinContorno ?? []).includes(v));
  }
  const g = Array.from({ length: tam }, () => Array(tam).fill("."));
  for (const [k, ch] of cv) {
    const [r, c] = RC(k);
    if (r < 0 || r >= tam || c < 0 || c >= tam) throw new Error(`píxel fuera del lienzo: fila ${r}, col ${c}`);
    g[r][c] = ch;
  }
  return g.map((row) => row.join(""));
}
// Las poses de serie: dos cuadros (a, b) por estado. Una pose es opciones de cuadro(), o una
// función de la mascota que las devuelve.
const POSES = {
  "idle-a": {},
  "idle-b": { eyes: "blink" },
  "working-a": { lean: -1, armL: "up" },
  "working-b": { lean: 1, armR: "up" },
  "blocked-a": (m) => ({ dx: m.bdx ?? 0, eyes: "worry", mouth: true, rdy: 0 }),
  "blocked-b": (m) => ({ dx: m.bdx ?? 0, eyes: "worry", mouth: true, rdy: -1 }),
  "done-a": { dy: -2, armL: "up", armR: "up", eyes: "happy", mouth: true },
  "done-b": { armL: "out", armR: "out", mouth: true },
  "sleep-a": { eyes: "blink", nod: 1 },
  "sleep-b": { eyes: "blink", nod: 2 },
};

// ---------- rejilla -> SVG -------------------------------------------------------
// Un <path> por color, con rectángulos lo más grandes posible (ancho y luego alto): unos 1,5 KB
// por sprite. crispEdges y coordenadas enteras para que escale nítido.
function aSvg(grid, paleta) {
  const h = grid.length, w = grid[0].length;
  const visto = grid.map((r) => Array(w).fill(false));
  const porColor = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = grid[y][x];
    if (ch === "." || visto[y][x]) continue;
    let x2 = x;
    while (x2 < w && grid[y][x2] === ch && !visto[y][x2]) x2++;
    let y2 = y + 1;
    const fila = (yy) => { for (let i = x; i < x2; i++) if (grid[yy][i] !== ch || visto[yy][i]) return false; return true; };
    while (y2 < h && fila(y2)) y2++;
    for (let yy = y; yy < y2; yy++) for (let i = x; i < x2; i++) visto[yy][i] = true;
    if (!porColor.has(ch)) porColor.set(ch, []);
    porColor.get(ch).push(`M${x} ${y}h${x2 - x}v${y2 - y}h-${x2 - x}z`);
  }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">\n`;
  for (const [ch, d] of porColor) s += `<path fill="${paleta[ch]}" d="${d.join("")}"/>\n`;
  return s + "</svg>\n";
}
// SVG de píxeles (rect o path de rectángulos) -> { paleta, grid }, para retocar uno que no tiene fuente.
function deSvg(texto) {
  const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(texto);
  if (!vb) throw new Error("sin viewBox");
  const w = +vb[1], h = +vb[2];
  const px = Array.from({ length: h }, () => Array(w).fill(null));
  const pon = (x, y, ww, hh, f) => { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) px[yy][xx] = f.toLowerCase(); };
  for (const m of texto.matchAll(/<path fill="(#[0-9a-fA-F]{6})"[^>]*? d="([^"]+)"/g))
    for (const r of m[2].matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) pon(+r[1], +r[2], +r[3], +r[4], m[1]);
  for (const r of texto.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)" fill="(#[0-9a-fA-F]{6})"\/>/g)) pon(+r[1], +r[2], +r[3], +r[4], r[5]);
  const letras = "abcdefghijklmnopqrstuvwxyz", paleta = {}, deColor = new Map();
  const grid = px.map((row) => row.map((f) => {
    if (!f) return ".";
    if (!deColor.has(f)) { const l = letras[deColor.size]; deColor.set(f, l); paleta[l] = f; }
    return deColor.get(f);
  }).join(""));
  return { paleta, grid };
}

// ---------- PNG (hojas de contacto) ---------------------------------------------
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  const trozo = (tipo, datos) => {
    const cab = Buffer.alloc(8); cab.writeUInt32BE(datos.length, 0); cab.write(tipo, 4, "ascii");
    const fin = Buffer.alloc(4); fin.writeUInt32BE(crc32(Buffer.concat([cab.subarray(4), datos])), 0);
    return Buffer.concat([cab, datos, fin]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo("IHDR", ihdr), trozo("IDAT", zlib.deflateSync(raw)), trozo("IEND", Buffer.alloc(0))]);
}
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
class Lienzo {
  constructor(w, h, fondo) { this.w = w; this.h = h; this.rgb = Buffer.alloc(w * h * 3); this.caja(0, 0, w, h, fondo); }
  caja(x, y, w, h, color) { const c = hex(color); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.rgb.set(c, (yy * this.w + xx) * 3); }
  pega(grid, paleta, x, y, escala) { grid.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== ".") this.caja(x + c * escala, y + r * escala, escala, escala, paleta[ch]); })); }
  guarda(ruta) { fs.writeFileSync(ruta, png(this.w, this.h, this.rgb)); }
}

// ---------- construir --------------------------------------------------------------
function construir(def, out, hojas) {
  const tam = def.tam ?? 24, poses = def.poses ?? POSES, nombres = Object.keys(poses);
  const maxColores = def.maxColores ?? 6, fondos = def.fondos ?? { oscura: "#241a22", clara: "#fff6ef" };
  const grids = {}, escritos = [];
  const revisa = (g, pal, n, nombre) => {
    if (g.length !== n || g.some((row) => row.length !== n)) throw new Error(`${nombre}: no es ${n}x${n}`);
    for (const row of g) for (const ch of row) if (ch !== "." && !(ch in pal)) throw new Error(`${nombre}: letra "${ch}" fuera de la paleta`);
  };
  fs.mkdirSync(out, { recursive: true });
  for (const slug of def.orden) {
    const m = def.mascotas[slug], pal = def.paletas[slug];
    if (!m || !pal) throw new Error(`${slug}: falta la mascota o su paleta`);
    if (Object.keys(pal).length > maxColores) throw new Error(`${slug}: más de ${maxColores} colores`);
    grids[slug] = {};
    for (const p of nombres) {
      const g = cuadro(m, typeof poses[p] === "function" ? poses[p](m) : poses[p], tam);
      revisa(g, pal, tam, `${slug}-${p}`);
      if (g[tam - 1] !== ".".repeat(tam)) throw new Error(`${slug}-${p}: la última fila debe quedar libre`);
      grids[slug][p] = g;
      const f = path.join(out, `${slug}-${p}.svg`);
      fs.writeFileSync(f, aSvg(g, pal)); escritos.push(f);
    }
  }
  for (const [nombre, [pal, g]] of Object.entries(def.marcas ?? {})) {
    revisa(g, pal, g.length, nombre);
    const f = path.join(out, `${nombre}.svg`);
    fs.writeFileSync(f, aSvg(g, pal)); escritos.push(f);
  }
  if (hojas) {
    fs.mkdirSync(hojas, { recursive: true });
    // Todas las poses a 8x, sobre el fondo oscuro y el claro del tema.
    const E = 8, hueco = 4, celda = tam * E;
    for (const [n, fondo] of Object.entries(fondos)) {
      const l = new Lienzo(hueco + nombres.length * (celda + hueco), hueco + def.orden.length * (celda + hueco), fondo);
      def.orden.forEach((slug, r) => nombres.forEach((p, c) => l.pega(grids[slug][p], def.paletas[slug], hueco + c * (celda + hueco), hueco + r * (celda + hueco), E)));
      l.guarda(path.join(hojas, `hoja-${n}.png`));
    }
    // A tamaño real (1x y 2x) sobre los dos fondos: lo que de verdad se verá en herdr.
    const base = nombres[0], h6 = 6, medio = h6 + def.orden.length * (tam * 2 + h6), fs2 = Object.values(fondos);
    const l = new Lienzo(medio * fs2.length, h6 + tam + h6 + tam * 2 + h6, fs2[0]);
    fs2.forEach((fondo, i) => {
      l.caja(i * medio, 0, medio, l.h, fondo);
      def.orden.forEach((slug, k) => {
        const x = i * medio + h6 + k * (tam * 2 + h6);
        l.pega(grids[slug][base], def.paletas[slug], x + tam / 2, h6, 1);
        l.pega(grids[slug][base], def.paletas[slug], x, h6 + tam + h6, 2);
      });
    });
    l.guarda(path.join(hojas, "hoja-real.png"));
  }
  return { escritos, grids };
}

module.exports = { parte, espejo, mover, rango, cabezaBase, cuerpoBase, hocico, BOCA, BRAZOS, LEVANTA, LEVANTA_ANCHO, cuadro, POSES, aSvg, deSvg, construir };

if (require.main === module) {
  const a = process.argv.slice(2);
  const op = (n) => { const i = a.indexOf(n); return i < 0 ? null : a[i + 1]; };
  if (a[0] === "extraer" && a.length > 1) {
    for (const f of a.slice(1)) {
      const { paleta, grid } = deSvg(fs.readFileSync(f, "utf8"));
      console.log(`// ${path.basename(f)}\n[${JSON.stringify(paleta)}, [\n${grid.map((r) => `  "${r}",`).join("\n")}\n]],`);
    }
  } else if (a[0] && op("--out")) {
    const { escritos } = construir(require(path.resolve(a[0])), op("--out"), op("--hojas"));
    console.log(`${escritos.length} SVG en ${op("--out")}` + (op("--hojas") ? `; hojas de contacto en ${op("--hojas")}` : ""));
  } else {
    console.error("uso: node sprites.js <mascotas.js> --out <carpeta> [--hojas <carpeta>]\n     node sprites.js extraer <archivo.svg>...");
    process.exit(1);
  }
}
