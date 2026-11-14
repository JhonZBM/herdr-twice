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
