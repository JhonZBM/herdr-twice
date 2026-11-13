// Nombre de espacio desde su agente: un espacio sin nombre que se llama "~"
// (Claude lanzado en home) pasa a llamarse como el título de la sesión de su
// primer agente, el mismo que enseña el panel Agents. Así también recibe su color.
// - Solo toca los nombres que puso él (localStorage): uno puesto a mano no se pisa.
// - Si el espacio se queda sin agente, le devuelve el nombre automático ("").
// - Tecla "nombre-agente.nuevo": elegir carpeta y abrir ahí un espacio con Claude
//   (se llama como el repo desde el principio).
// No dibuja nada, sin temporizadores ni procesos: decide en cada render.

import { View, div } from "gpui-kit";
import { spaces, agents, run, pickFolder, nextCommand } from "herdr";

const CLAVE = "puestos";
const MAX = 40;
const MARCA = "✻";
const limpio = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

// Un título que dice algo, con el mismo criterio que el panel Agents
// (title() en mods/agents/main.js): ni el nombre del programa, ni una ruta, ni user@host.
function titulo(a) {
  const t = limpio(a.title);
  const ruta = /^[~/]|^[A-Za-z]:\\/.test((a.title ?? "").replace(/^[^\p{L}\p{N}~/]+/u, ""));
  if (!t || ruta || t.includes("@") || t === a.program?.name || t.toLowerCase() === a.program?.key) return null;
  // El avatar del panel Spaces pinta el primer carácter del nombre: ✻ hace de logo del agente.
  return `${MARCA} ${t.length > MAX ? `${t.slice(0, MAX - 1).trimEnd()}…` : t}`;
}

function leer() {
  try { return JSON.parse(localStorage.getItem(CLAVE) ?? "{}"); } catch { return {}; }
}

export default class NombreAgente extends View {
  init(_props, cx) {
    this.pedido = {}; // espacio -> nombre ya pedido, para no repetir run() mientras llega
    cx.spawn(async (cx) => {
      for (;;) {
        if (await nextCommand() !== "nuevo") continue;
        const folder = await pickFolder({ prompt: "Carpeta para el espacio de Claude" });
        if (folder) run("space.new", { folder, argv: ["claude"] });
        cx.notify();
      }
    });
  }

  renombrar(id, name) {
    if (this.pedido[id] === name) return;
    this.pedido[id] = name;
    run("space.rename", { id, name });
  }

  render() {
    const puestos = leer();
    const antes = JSON.stringify(puestos);
    const ag = agents();
    const vivos = new Set();
    for (const s of spaces()) {
      vivos.add(s.id);
      const a = ag.find((x) => x.space === s.id); // en orden de pestaña y panel: el primero manda
      const nombre = a ? titulo(a) : null;
      const mio = puestos[s.id];
      const esperando = mio !== undefined && this.pedido[s.id] === mio; // pedido, aún sin aplicar
      if (!s.named) {
        if (!esperando) delete puestos[s.id];
        if (s.name === "~" && nombre) { puestos[s.id] = nombre; this.renombrar(s.id, nombre); }
        else if (!esperando) delete this.pedido[s.id];
      } else if (mio === s.name) {
        delete this.pedido[s.id]; // ya aplicado
        if (!nombre) { delete puestos[s.id]; this.renombrar(s.id, ""); }
        else if (nombre !== s.name) { puestos[s.id] = nombre; this.renombrar(s.id, nombre); }
      } else if (mio !== undefined && !esperando) {
        delete puestos[s.id]; // renombrado a mano: deja de ser nuestro
      }
    }
    for (const id of Object.keys(puestos)) if (!vivos.has(id)) delete puestos[id];
    if (JSON.stringify(puestos) !== antes) {
      try { localStorage.setItem(CLAVE, JSON.stringify(puestos)); } catch {}
    }
    return div();
  }
}
