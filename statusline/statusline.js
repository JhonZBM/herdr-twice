// Statusline de herdr-twice: lee el JSON de Claude Code (stdin) y pinta una línea.
// Iconos y colores: iconos.json. Sin dependencias: solo Node y git.
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "iconos.json"), "utf8"));
const E = "\x1b[", R = E + "0m";
const tenue = (s) => `${E}2m${s}${R}`;
const rgb = (hex, s) => {
  const n = parseInt(hex.slice(1), 16);
  return `${E}38;2;${n >> 16};${(n >> 8) & 255};${n & 255}m${s}${R}`;
};
// Etiqueta: texto oscuro sobre fondo de color, para el nivel que debe destacar.
const etiqueta = (hex, s) => {
  const n = parseInt(hex.slice(1), 16);
  return `${E}48;2;${n >> 16};${(n >> 8) & 255};${n & 255}m${E}38;2;30;30;30m ${s} ${R}`;
};
const pintar = (c, s) => (c === "normal" ? s : c === "tenue" ? tenue(s) : rgb(c, s));

// git es lo más caro: su resultado se reutiliza 5 s desde un archivo temporal.
function gitStatus(dir) {
  const cache = path.join(require("os").tmpdir(), "statusline-" + Buffer.from(dir).toString("hex").slice(-40));
  try {
    if (Date.now() - fs.statSync(cache).mtimeMs < 5000) return fs.readFileSync(cache, "utf8");
  } catch {}
  let out = "";
  try {
    out = execFileSync("git", ["-C", dir, "--no-optional-locks", "status", "--porcelain=v2", "--branch"],
      { encoding: "utf8", timeout: 800, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  } catch {}
  try { fs.writeFileSync(cache, out); } catch {}
  return out;
}

function rama(dir) {
  const out = gitStatus(dir);
  const r = cfg.rama;
  const nombre = (out.match(/^# branch\.head (.+)$/m) || [])[1];
  if (!nombre) return "";
  const [, sube = 0, baja = 0] = out.match(/^# branch\.ab \+(\d+) -(\d+)$/m) || [];
  const cambios = (out.match(/^[12u?] /gm) || []).length;
  let txt = `${nombre}  ` + (cambios
    ? tenue(`${r.cambios}  ${cambios} ${cambios === 1 ? r.texto_cambio : r.texto_cambios}`)
    : rgb(r.color_limpia, r.limpia));
  const remoto = [+sube && `${r.subir} ${sube}`, +baja && `${r.bajar} ${baja}`].filter(Boolean);
  return remoto.length ? `${txt}${" ".repeat(cfg.espacio)}${tenue(remoto.join("  "))}` : txt;
}

function contexto(cw = {}) {
  if (cw.used_percentage == null) return "";
  const p = Math.round(cw.used_percentage), b = cfg.barra;
  const color = p < b.limites[0] ? b.colores.bajo : p < b.limites[1] ? b.colores.medio : b.colores.alto;
  const n = Math.round((p / 100) * b.largo);
  return rgb(color, b.lleno.repeat(n)) + tenue(b.vacio.repeat(b.largo - n)) + `  ${p}%`;
}

// Límites de uso: cada ventana (5 h, semanal) con sus umbrales en iconos.json.
// Tenue hasta el primer umbral, amarillo hasta el segundo y rojo después.
// Cuánto falta para el reinicio: en rojo, o siempre con "reinicio_siempre".
function limites(rl = {}) {
  const l = cfg.limite, b = cfg.barra;
  const txt = Object.entries(l.ventanas).map(([k, w]) => {
    const v = rl[k];
    if (v?.used_percentage == null) return "";
    const p = Math.round(v.used_percentage), [u1, u2] = w.umbrales;
    let s = `${w.nombre} ${p}%`;
    // Si el reinicio ya pasó (o lo regalaron y aún no llega la fecha nueva), no se muestra.
    const min = v.resets_at ? Math.round((v.resets_at * 1000 - Date.now()) / 60000) : 0;
    if ((p >= u2 || w.reinicio_siempre) && min > 0) {
      const t = min >= 1440 ? `${Math.floor(min / 1440)}d${Math.floor((min % 1440) / 60)}h`
        : min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min}m`;
      s += ` ${l.reinicio} ${t}`;
    }
    return p < u1 ? tenue(s) : rgb(p < u2 ? b.colores.medio : b.colores.alto, s);
  }).filter(Boolean);
  return txt.length ? `${tenue(l.icono)} ${txt.join("  ")}` : "";
}

let e = {};
try { e = JSON.parse(fs.readFileSync(0, "utf8")); } catch {}
const dir = e.workspace?.current_dir || e.cwd || "";
const est = cfg.esfuerzo[e.effort?.level];
const partes = [
  [(e.model?.display_name || "").replace(/^Claude\s+/, ""), est && pintar(est.color, est.icono) + (est.nombre ? " " + (est.etiqueta ? etiqueta(est.color, est.nombre) : tenue(est.nombre)) : "")].filter(Boolean).join("  "),
  dir && `${cfg.carpeta} ${path.basename(dir)}`,
  dir && rama(dir),
  contexto(e.context_window),
  limites(e.rate_limits),
];
process.stdout.write(partes.filter(Boolean).join(" ".repeat(cfg.espacio)));
