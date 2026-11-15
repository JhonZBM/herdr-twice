// Quién lanzó a quién. herdr apunta en cada terminal su `parent` (la terminal desde la que se hizo
// `hc run`), y de ahí salen las dos relaciones del mod: la madre «espera a» su hija y la hija
// trabaja «con» su madre. Todo se lee de los datos vivos de herdr en cada render, sin timers.
import { agents, terminals } from "herdr";

// Una hija sin panel no está en agents(): su estado viene de terminals(), como palabra suelta.
const ESTADO = { working: "working", blocked: "blocked", error: "blocked", done: "done", idle: "idle" };

// Los agentes con mascota: los de agents() más sus hijas sin panel (lanzadas con `hc run`, viven
// en la pestaña de la madre). Cada uno lleva `madre`: la dirección de quien lo lanzó, si está aquí.
export function equipo() {
  const ts = terminals();
  const porDir = new Map(ts.map((t) => [t.address, t]));
  const lista = agents().map((a) => ({ ...a, madre: porDir.get(a.address)?.parent ?? null }));
  const dentro = new Map(lista.map((a) => [a.address, a]));
  for (let cambio = true; cambio;) {
    cambio = false;
    for (const t of ts) {
      const m = t.parent && dentro.get(t.parent);
      if (!m || dentro.has(t.address) || t.state !== "live" || !ESTADO[t.status]) continue;
      const hija = {
        address: t.address, pane: null, space: m.space, space_name: m.space_name, tab: m.tab, tab_index: m.tab_index,
        tab_name: t.name || m.tab_name, status: ESTADO[t.status], app: t.report?.app ?? null, program: t.program,
        title: t.title ?? "", seq: 0, pinned: false, focused: false, madre: t.parent,
      };
      lista.push(hija);
      dentro.set(hija.address, hija);
      cambio = true;
    }
  }
  for (const a of lista) if (a.madre && !dentro.has(a.madre)) a.madre = null;
  return lista;
}

// Los subagentes que cada sesión tiene abiertos ahora: dirección → sus tipos ("Explore"…).
// Los apunta el hook subagentes/subagente.js como etiquetas twice.sub.<id>=<tipo>.
export function subagentes() {
  const mapa = new Map();
  for (const t of terminals()) {
    const tipos = Object.entries(t.labels ?? {}).filter(([k]) => k.startsWith("twice.sub.")).map(([, v]) => v);
    if (tipos.length && t.state === "live") mapa.set(t.address, tipos);
  }
  return mapa;
}

export const hijasDe = (address, lista) => lista.filter((a) => a.madre === address);

// La hija por la que espera: la primera que sigue trabajando o que necesita al usuario.
export const esperaA = (address, lista) =>
  hijasDe(address, lista).find((h) => h.status === "working" || h.status === "blocked") ?? null;

// Coristas que caben dibujadas junto a su líder; el resto se cuenta como «+n».
export const CORO = 4;

// Los agentes con puesto, en el orden de las tarjetas: por puesto, y cada hija justo después
// de su madre. `bySlot`: puesto → agente; `active`: los puestos en ese orden.
export function enOrden(lista, slots) {
  const bySlot = new Map();
  for (const a of lista) {
    const s = slots[a.address];
    if (Number.isInteger(s) && !bySlot.has(s)) bySlot.set(s, a);
  }
  const porPuesto = [...bySlot.keys()].sort((x, y) => x - y);
  const vivos = new Set(porPuesto.map((s) => bySlot.get(s).address));
  const active = [];
  const colocar = (madre) => {
    for (const s of porPuesto) {
      const a = bySlot.get(s);
      if ((vivos.has(a.madre) ? a.madre : null) !== madre) continue;
      active.push(s);
      colocar(a.address);
    }
  };
  colocar(null);
  return { bySlot, active };
}

// Cada subagente despierta a una integrante libre como corista de su líder (hasta CORO por
// líder, y mientras queden); las que no caben o no alcanzan se cuentan como «+n». Un solo
// reparto para la barra y el escenario: la misma corista en los dos. `n`: integrantes.
// Devuelve `coros` (puesto → { tipos, quienes }) y `libres` (las que siguen sin nadie).
export function repartirCoros(active, bySlot, n) {
  const fuera = new Set(active.map((s) => s % n));
  const libres = Array.from({ length: n }, (_x, i) => i).filter((i) => !fuera.has(i));
  const subs = subagentes();
  const coros = new Map();
  for (const s of active) {
    const tipos = subs.get(bySlot.get(s).address);
    if (tipos) coros.set(s, { tipos, quienes: libres.splice(0, Math.min(tipos.length, CORO)) });
  }
  return { coros, libres };
}
