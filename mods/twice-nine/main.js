// TWICE Nine: cada agente va acompanado por una mascota original, una por
// integrante. Dos papeles en un mismo mod:
//   - bloque del sidebar: tarjetas ("photocards") de los agentes abiertos y
//     una banca con el resto de las mascotas, dormidas (z z z) mientras
//     ningún agente las usa; la de un agente en espera que no estás mirando
//     (sin foco) también duerme;
//   - cabecera de panel (props().pane): la mascota mini junto al nombre.
// Elegir integrante: comando "twice-nine.elegir" (agente enfocado, diálogo
// centrado) o clic en la mascota de la cabecera (menú junto al puntero); abre
// este mismo mod con props().elegir. La elección se recuerda por espacio: el
// próximo agente que se abra ahí vuelve a tener la misma integrante.
// Comando "twice-nine.siguiente": pasa el agente enfocado a la siguiente
// integrante libre, sin abrir nada. Clic derecho en una tarjeta (o en la
// mascota del riel) de la barra lateral: el selector junto al puntero.
// Solo texto, color y sprites propios; sin logo ni imagenes oficiales.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { panes, spaces, theme, run, props, shared, setShared, setAgentOrder, home, layout, nextCommand, openOverlay, closeOverlay } from "herdr";
import { MEMBERS, APRICOT, MAGENTA, FONT, LABEL, SLOTS, PREFS } from "./members.js";
import { equipo, esperaA, subagentes } from "./relaciones.js";

const N = MEMBERS.length;
// Coristas (subagentes) que caben dibujadas en una tarjeta; el resto se cuenta como «+n».
const CORO = 4;
// Los cuatro estados de un agente, más "sleep" para la mascota sin agente y "wait"
// para la que espera a una hija (derivado en pose(), herdr no lo reporta).
const STATES = new Set(["working", "blocked", "done", "idle", "sleep", "wait"]);
// Pose de la mascota de un agente. Si te necesita, eso manda; si una hija suya sigue
// trabajando (o te necesita), espera; si no, su estado. En espera y sin ser el panel que
// miras (el enfocado del space activo; `focused` solo dice el enfocado de su space): duerme.
const pose = (a, todos = equipo()) => {
  if (!a) return "idle";
  if (a.status !== "blocked" && esperaA(a.address, todos)) return "wait";
  const mirando = a.focused && spaces().some((s) => s.active && s.id === a.space);
  return a.status === "idle" && !mirando ? "sleep" : a.status;
};
const frame = (slug, state, f) => `mods/twice-nine/sprites/${slug}-${state}-${f}.svg`;

// La mascota en su pose. Dos cuadros apilados que se relevan con opacidad:
// corre nativo, sin temporizadores.
function sprite(slug, status, size) {
  const state = STATES.has(status) ? status : "idle";
  const box = div().relative().w(size).h(size).flex_none();
  if (state === "idle") return box.child(image(frame(slug, "idle", "a")).w(size).h(size));
  const m = Math.round(size / 2.4);
  // Espera a una hija: quieta, con un reloj de arena que late despacio.
  if (state === "wait") {
    return box.child(image(frame(slug, "idle", "a")).w(size).h(size))
      .child(image("mods/twice-nine/sprites/wait.svg").absolute().top(0).right(0).w(m).h(m)
        .loop("opacity", { from: 0.45, to: 1, period: 1400, easing: "ease-in-out" }));
  }
  const period = state === "working" ? 640 : state === "blocked" ? 900 : 1100;
  const layer = (f, from, to) => image(frame(slug, state, f)).absolute().top(0).left(0).w(size).h(size)
    .loop("opacity", { from, to, period, easing: "ease-in-out" });
  // Dormida: nadie la usa. Cabecea despacio y las z suben (dos cuadros cada cosa).
  if (state === "sleep") {
    const z = (f, from, to) => image(`mods/twice-nine/sprites/zzz-${f}.svg`).absolute().top(0).left(0).w(size).h(size)
      .loop("opacity", { from, to, period: 1300, easing: "ease-in-out" });
    const nod = (f, from, to) => image(frame(slug, "sleep", f)).absolute().top(0).left(0).w(size).h(size)
      .loop("opacity", { from, to, period: 2600, easing: "ease-in-out" });
    return box.child(nod("a", 1, 0)).child(nod("b", 0, 1)).child(z("a", 1, 0)).child(z("b", 0, 1));
  }
  const mark = state === "blocked" ? "bang" : state === "done" ? "sparkle" : null;
  return box
    .child(layer("a", 1, 0))
    .child(layer("b", 0, 1))
    .when(Boolean(mark), (el) => el.child(image(`mods/twice-nine/sprites/${mark}.svg`).absolute().top(0).right(0).w(m).h(m)
      .loop("opacity", { from: 0.35, to: 1, period: 800 })));
}

const memberOf = (slot) => MEMBERS[slot % N];
const nameOf = (slot) => (slot >= N ? `${memberOf(slot).name} ${Math.floor(slot / N) + 1}` : memberOf(slot).name);
const slotsNow = () => /** @type {Record<string, number>} */ (shared(SLOTS) ?? {});
const prefsNow = () => /** @type {Record<string, number>} */ (shared(PREFS) ?? {});
const limpio = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();
// Cómo se nombra a un agente en el selector: su espacio, o su pestaña.
const spaceName = (id) => { const n = spaces().find((x) => x.id === id)?.name ?? ""; return limpio(n) || n.trim(); };
const quien = (a) => spaceName(a.space) || a.tab_name || a.program?.name || "agente";

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter((child) => !child.hidden);
    children = [visible.find((child) => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const found = paneFrame(child);
    if (found) return found;
  }
  return null;
}

// Medidas del selector: rejilla de 3x3 tarjetas.
// El marco del diálogo (borde de 1 px por lado) va dentro de width/height: se suma.
const COLS = 3, CARD_W = 100, CARD_H = 104, GAP = 8, PAD = 16, MARCO = 2;
const TITULO_H = 14, AGENTE_H = 16, PIE_H = 14, SEP = 12;
const ANCHO = MARCO + PAD * 2 + COLS * CARD_W + (COLS - 1) * GAP;
const ALTO = MARCO + PAD * 2 + TITULO_H + 4 + AGENTE_H + SEP + 3 * CARD_H + 2 * GAP + SEP + PIE_H;

// Abre el selector para un agente: "dialog" centrado (Alt+T) o "popup" junto
// al puntero (clic en la mascota). Clic fuera o Esc lo cierran.
function abrirSelector(address, kind = "dialog") {
  if (!address) return;
  openOverlay({ mod: "twice-nine", kind, width: ANCHO, height: ALTO, props: { elegir: address } });
}

// Da al agente la integrante i; si otro agente vivo la tenia, intercambian puestos.
function asignar(address, i) {
  const slots = { ...slotsNow() };
  const live = new Set(equipo().map((a) => a.address));
  const mine = slots[address];
  const other = Object.keys(slots).find((k) => k !== address && slots[k] === i);
  if (other) {
    if (live.has(other) && Number.isInteger(mine)) slots[other] = mine;
    else delete slots[other];
  }
  slots[address] = i;
  setShared(SLOTS, slots);
  // Recordarla para el espacio del agente (y olvidar espacios que ya no existen).
  const space = equipo().find((a) => a.address === address)?.space;
  if (!space) return;
  const ids = new Set(spaces().map((x) => x.id));
  const prefs = Object.fromEntries(Object.entries(prefsNow()).filter(([k]) => ids.has(k)));
  prefs[space] = i;
  setShared(PREFS, prefs);
}

// Carpeta relativa a home ("~", "~\proyecto"). En Windows herdr da rutas con "\"
// y sin distinguir mayúsculas: se comparan normalizadas.
// Pasa al agente a la siguiente integrante que ningún otro agente vivo tenga
// (dando la vuelta). Si están todas ocupadas, no cambia nada.
function siguiente(address) {
  if (!address) return;
  const slots = slotsNow();
  const all = equipo();
  const ocupadas = new Set(all.filter((x) => x.address !== address).map((x) => slots[x.address]));
  const cur = Number.isInteger(slots[address]) ? slots[address] % N : -1;
  for (let k = 1; k <= N; k++) {
    const i = (cur + k + N) % N;
    if (!ocupadas.has(i)) { if (i !== cur) asignar(address, i); return; }
  }
}

function folder(cwd) {
  if (!cwd) return "";
  const norm = (s) => s.replace(/\\/g, "/").toLowerCase();
  const c = norm(cwd), h = norm(home() ?? "");
  if (!h) return cwd;
  return c === h ? "~" : c.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class TwiceNine extends View {
  init(_props, cx) {
    this.size = null;
    this.hovered = false;
    if (props()?.elegir) {
      const cur = slotsNow()[props().elegir];
      this.sel = Number.isInteger(cur) ? cur % N : 0;
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    if (props()?.pane) return;
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        const enfocado = equipo().find((a) => a.focused)?.address;
        if (c === "elegir") abrirSelector(enfocado, "dialog");
        else if (c === "siguiente") siguiente(enfocado);
      }
    });
  }

  // ¿Algún agente sin puesto propio? Mismo criterio que sync(), sin escribir nada.
  pendiente() {
    const slots = slotsNow();
    const seen = new Set();
    for (const a of equipo()) {
      const s = slots[a.address];
      if (!Number.isInteger(s) || s < 0 || seen.has(s)) return true;
      seen.add(s);
    }
    return false;
  }

  // Herdr redibuja cuando cambian los agentes: ahí se mira si falta repartir y,
  // si falta, se reparte en una tarea (render no escribe estado compartido).
  // Sin temporizador: nada corre mientras los agentes no cambian.
  programarSync(cx) {
    if (this.syncing || !this.pendiente()) return;
    this.syncing = true;
    cx.spawn(async (cx) => {
      this.syncing = false;
      if (this.sync()) cx.notify();
    });
  }

  // Da a cada agente un puesto estable (0..8 una integrante; 9+ segunda ronda)
  // y lo guarda en el estado compartido para que la cabecera de panel lo lea.
  sync() {
    const list = equipo();
    if (!list.length) return false;
    const slots = { ...slotsNow() };
    const prefs = prefsNow();
    const live = new Set(list.map((a) => a.address));
    const taken = new Map();
    let dirty = false;
    for (const a of list) {
      const s = slots[a.address];
      if (Number.isInteger(s) && s >= 0 && !taken.has(s)) taken.set(s, a.address);
    }
    for (const a of list) {
      if (taken.get(slots[a.address]) === a.address) continue;
      const held = new Set(Object.values(slots));
      // Primero la integrante recordada para su espacio, si ningún agente vivo la
      // tiene; si no, un puesto que nadie tenga; si no, el de un agente que ya no esta.
      // Sin elección guardada, la misma por defecto que dibuja spaces-twice para un espacio sin agente.
      const fav = prefs[a.space] ?? [...a.space].reduce((n, c) => n + c.charCodeAt(0), 0) % N;
      let s = 0;
      if (Number.isInteger(fav) && fav >= 0 && fav < N && !taken.has(fav)) s = fav;
      else {
        while (s < N && held.has(s)) s++;
        if (s >= N) {
          s = 0;
          while (taken.has(s)) s++;
        }
      }
      for (const [k, v] of Object.entries(slots)) if (v === s && !live.has(k)) delete slots[k];
      slots[a.address] = s;
      taken.set(s, a.address);
      dirty = true;
    }
    if (dirty) setShared(SLOTS, slots);
    return dirty;
  }

  edge(t, a) {
    return a.status === "blocked" ? MAGENTA : a.status === "done" ? APRICOT : a.focused ? t.input : t.border;
  }

  // Ir al agente: a su panel, o a un vistazo si es una hija sin panel.
  ir(a) {
    if (a.pane) run("pane.focus", { pane: a.pane });
    else run("terminal.peek", { terminal: a.address });
  }

  // Renglón de la otra integrante (la madre, o la hija por la que espera): su mini mascota
  // y su nombre, en su color. Clic: ir a ella.
  otra(t, id, flecha, a, slot, w) {
    return h_flex().id(id).max_w(w - 12).gap(3).items_center().rounded(4).cursor_pointer()
      .tooltip(`Ir a ${nameOf(slot)}`)
      .on_click((_e, cx) => { cx.stop_propagation(); this.ir(a); })
      .when(flecha, (el) => el.child(div().flex_none().text_size(10).text_color(t.muted).child("↳")))
      .child(sprite(memberOf(slot).slug, "idle", 14))
      .child(div().truncate().font_family(FONT).text_size(9.5).text_color(memberOf(slot).color).child(nameOf(slot)));
  }

  // Las coristas de una líder: integrantes del banco, despiertas, una por subagente.
  coro(t, slot, c) {
    const resto = c.tipos.length - c.quienes.length;
    return h_flex().gap(2).items_center().justify_center()
      .children(c.quienes.map((i, k) => div().id(`coro-${slot}-${i}`).flex_none().tooltip(`${MEMBERS[i].name} · ${c.tipos[k]}`)
        .child(sprite(MEMBERS[i].slug, "working", 18))))
      .when(resto > 0, (el) => el.child(div().id(`coro-${slot}-mas`).flex_none().pl(2).text_size(10).text_color(t.muted)
        .tooltip(c.tipos.slice(c.quienes.length).join(" · ")).child(`+${resto}`)));
  }

  card(t, slot, a, w, todos, coro) {
    const m = memberOf(slot);
    const slots = slotsNow();
    const detail = [a.program?.name, a.tab_name].filter(Boolean).join(" · ");
    const st = pose(a, todos);
    const tone = a.status === "blocked" ? MAGENTA : a.status === "done" ? APRICOT : a.status === "working" ? t.foreground : t.dim;
    // Madre e hija, en dos renglones: el verbo y, debajo, la otra con su mini mascota.
    // «esperando a / Momo» en la madre; «trabajando con / Jihyo» en la hija, que fuera de
    // eso dice su estado y «↳ Jihyo» (quién la lanzó).
    const hija = st === "wait" ? esperaA(a.address, todos) : null;
    const madre = a.madre ? todos.find((x) => x.address === a.madre) : null;
    const otra = [hija, madre].find((x) => x && Number.isInteger(slots[x.address]));
    const trabajaCon = otra === madre && st === "working";
    const estado = div().text_size(10.5).text_color(st === "wait" ? t.foreground : tone)
      .child(trabajaCon ? `${LABEL.working} con` : LABEL[st] ?? st);
    const pie = otra ? this.otra(t, `otra-${slot}`, otra === madre && !trabajaCon, otra, slots[otra.address], w)
      : div().max_w(w - 12).truncate().text_size(10).text_color(t.muted).child(detail || " ");
    // Misma construcción que las tarjetas del selector: el color es el fondo de la
    // tarjeta y asoma solo arriba, siguiendo la curva; base opaca (chrome, el
    // fondo de la barra) bajo la capa del estado, que puede ser translúcida.
    return v_flex().id(`card-${slot}`).w(w).flex_none().rounded(10).bg(m.color)
      .tooltip("Clic: ir al agente · Clic derecho: elegir integrante")
      .on_click(() => this.ir(a))
      .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); abrirSelector(a.address, "popup"); })
      .child(v_flex().w_full().mt(3).rounded(10).bg(t.chrome)
        .child(v_flex().id(`card-in-${slot}`).w_full().rounded(10).border(1).border_color(this.edge(t, a))
          .bg(a.focused ? t.selected : t.surface).hover((s) => s.bg(t.hover))
          .items_center().px(6).pt(7).pb(8).gap(2)
          .child(sprite(m.slug, st, 48))
          .child(div().max_w(w - 12).truncate().font_family(FONT).text_size(11).text_color(t.foreground).child(nameOf(slot)))
          .child(estado)
          .child(pie)
          .when(Boolean(coro), (el) => el.child(this.coro(t, slot, coro)))));
  }

  header(t, count, total) {
    return v_flex().flex_none()
      .child(h_flex().h(28).px(12).items_center().justify_between()
        .child(div().font_family(FONT).text_size(11).text_color(t.muted).child("TWICE"))
        .child(div().text_size(11).text_color(t.dim).child(`${count}/${total}`)))
      .child(h_flex().h(2).mx(12)
        .child(div().flex_1().h(2).bg(APRICOT))
        .child(div().flex_1().h(2).bg(MAGENTA)));
  }

  list(cx) {
    this.programarSync(cx);
    const t = theme();
    const all = equipo();
    const slots = slotsNow();
    const bySlot = new Map();
    for (const a of all) {
      const s = slots[a.address];
      if (Number.isInteger(s) && !bySlot.has(s)) bySlot.set(s, a);
    }
    // Por puesto, y cada hija justo después de su madre.
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
    if (props()?.order !== false) setAgentOrder(active.map((s) => bySlot.get(s).address));
    const out = new Set(active.map((s) => s % N));
    const libres = MEMBERS.map((_m, i) => i).filter((i) => !out.has(i));
    // Cada subagente despierta a una del banco como corista de su líder (hasta CORO por
    // tarjeta, y mientras queden); las que no caben o no alcanzan se cuentan como «+n».
    const subs = subagentes();
    const coros = new Map();
    for (const s of active) {
      const tipos = subs.get(bySlot.get(s).address);
      if (tipos) coros.set(s, { tipos, quienes: libres.splice(0, Math.min(tipos.length, CORO)) });
    }
    const bench = libres;
    const width = this.size?.width ?? 268;
    const root = v_flex().id("root").size_full().text_size(13)
      .on_size_change((size, cx) => { this.size = size; cx.notify(); });

    // Riel angosto: solo las mascotas de los agentes abiertos.
    if (width < 160) {
      return root.items_center().pt(6).gap(6).overflow_y_scrollbar().children(active.map((s) => {
        const a = bySlot.get(s);
        return div().id(`rail-${s}`).p(2).flex_none().rounded(8).border(1).border_color(this.edge(t, a))
          .on_click(() => this.ir(a))
          .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); abrirSelector(a.address, "popup"); })
          .child(sprite(memberOf(s).slug, pose(a, all), 24));
      }));
    }

    const cols = width < 220 ? 1 : 2;
    const w = Math.floor((width - 16 - (cols - 1) * 6) / cols);
    const big = active.length === 0;
    return root
      .child(this.header(t, all.length, N))
      .child(v_flex().flex_1().min_h(0).px(8).pt(8).pb(8).gap(8).overflow_y_scrollbar()
        .when(!big, (el) => el.child(h_flex().flex_wrap().gap(6).children(active.map((s) => this.card(t, s, bySlot.get(s), w, all, coros.get(s))))))
        .when(big, (el) => el.child(div().px(4).text_size(11.5).text_color(t.dim).child("Abre un agente y una de las nueve lo acompaña.")))
        .when(bench.length > 0, (el) => el.child(h_flex().flex_wrap().gap(big ? 8 : 5).px(2)
          .children(bench.map((i) => div().id(`bench-${i}`).flex_none().opacity(big ? 0.9 : 0.7).tooltip(`${MEMBERS[i].name} · dormida`)
            .child(sprite(MEMBERS[i].slug, "sleep", big ? 36 : 24)))))));
  }

  // Cabecera de panel: como la de Herdr, con la mascota del agente.
  pane() {
    const t = theme();
    const p = panes().find((x) => x.pane === props()?.pane);
    if (!p) return div();
    const slot = p.terminal ? slotsNow()[p.terminal] : undefined;
    const mine = Number.isInteger(slot) && Boolean(p.status);
    const program = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const st = p.status;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    const pic = p.program?.icon ? (p.program.tint ? svg(p.program.icon).size(14).flex_none().text_color(t.dim) : image(p.program.icon).w(14).h(14).flex_none()) : null;
    const button = (id, icon, command, args) => div().id(id).p(3).rounded(4).text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { cx.stop_propagation(); run(command, args); })
      .child(svg(`mods/pane/${icon}.svg`).size(14));
    return h_flex().id(`pane-head-${pane}`).size_full().px(10).gap(8).items_center().bg(t.background)
      .when(bottom, (el) => el.border_t(1))
      .when(!bottom, (el) => el.border_b(1))
      .border_color(mine && st === "blocked" ? MAGENTA : mine && st === "done" ? APRICOT : t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .on_click(() => run("pane.focus", { pane }))
      .when(mine, (el) => el
        .child(div().id(`ph-m-${pane}`).flex_none().cursor_pointer().tooltip("Elegir integrante")
          .on_click((_e, cx) => { cx.stop_propagation(); abrirSelector(p.terminal, "popup"); })
          .child(sprite(memberOf(slot).slug, pose(equipo().find((x) => x.address === p.terminal) ?? { status: st, focused: true }), 22)))
        .child(div().flex_none().font_family(FONT).text_size(10.5).text_color(memberOf(slot).color).child(nameOf(slot))))
      .when(!mine && Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(program))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "blocked", (el) => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(MAGENTA + "26").text_size(10.5).font_semibold().text_color(MAGENTA).child(LABEL.blocked)))
      .when(st === "done", (el) => el.child(div().size(7).flex_none().rounded(4).bg(APRICOT)))
      .when(this.hovered, (el) => el
        .child(button(`ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
        .child(button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
        .child(button(`ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
        .child(button(`ph-x-${pane}`, "close", "pane.close", { pane })));
  }

  // Selector: las nueve en una rejilla. Clic, flechas + Enter (o 1-9) eligen;
  // Esc o clic fuera cierran. Cada tarjeta dice si es la actual, quién la tiene
  // o si está libre; la resaltada se anima.
  selector() {
    const t = theme();
    const address = props().elegir;
    const slots = slotsNow();
    const all = equipo();
    const a = all.find((x) => x.address === address);
    const cur = slots[address];
    const actual = Number.isInteger(cur) ? cur % N : -1;
    const duena = (i) => all.find((x) => x.address !== address && slots[x.address] === i);
    const cerrar = () => closeOverlay(props().overlay);
    const elegir = (i) => { if (i !== actual) asignar(address, i); cerrar(); };
    const quieto = (_e, cx) => cx.stop_propagation();

    const tarjeta = (m, i) => {
      const esActual = i === actual, foco = i === this.sel, otro = duena(i);
      // La libre duerme; la que tiene otro agente espera despierta; la resaltada baila.
      const postura = esActual ? pose(a) : foco ? "working" : otro ? "idle" : "sleep";
      const nota = esActual ? "actual" : otro ? `con ${quien(otro)}` : "libre";
      // La franja de color es el fondo de la propia tarjeta (redondeada). Encima,
      // 3 px más abajo y con el mismo radio, una capa opaca (popover) tapa el resto:
      // el color asoma solo arriba y sigue la curva de las esquinas. Sobre ella, la
      // capa del estado (selected/hover/surface pueden ser translúcidos) con el borde.
      return v_flex().id(`el-${i}`).w(CARD_W).h(CARD_H).flex_none().rounded(10).cursor_pointer().bg(m.color)
        .on_mouse_down("left", quieto)
        .on_hover((dentro, cx) => { if (dentro && this.sel !== i) { this.sel = i; cx.notify(); } })
        .on_click(() => elegir(i))
        .child(v_flex().flex_1().w_full().mt(3).rounded(10).bg(t.popover)
          .child(v_flex().size_full().rounded(10).border(1)
            .border_color(foco ? m.color : esActual ? t.input : t.border)
            .bg(esActual ? t.selected : foco ? t.hover : t.surface)
            .items_center().justify_center().gap(4).px(8)
            .child(sprite(m.slug, postura, 40))
            .child(div().max_w(CARD_W - 16).truncate().font_family(FONT).text_size(11).text_color(m.color).child(m.name))
            .child(div().max_w(CARD_W - 16).truncate().text_size(10)
              .text_color(esActual ? t.foreground : t.muted).child(nota))));
    };

    const filas = [];
    for (let f = 0; f < N; f += COLS) {
      filas.push(h_flex().gap(GAP).children(MEMBERS.slice(f, f + COLS).map((m, k) => tarjeta(m, f + k))));
    }
    const agente = a ? [a.program?.name || "Agente", quien(a)].join(" · ") : "agente cerrado";

    return v_flex().id("elegir").track_focus(this.handle).size_full().p(PAD).gap(SEP).bg(t.popover)
      .on_key_down((e, cx) => {
        const n = Number(e.key);
        if (e.key === "escape") cerrar();
        else if (e.key === "enter") elegir(this.sel);
        else if (e.key === "left") this.sel = (this.sel + N - 1) % N;
        else if (e.key === "right") this.sel = (this.sel + 1) % N;
        else if (e.key === "up") this.sel = (this.sel + N - COLS) % N;
        else if (e.key === "down") this.sel = (this.sel + COLS) % N;
        else if (n >= 1 && n <= N) elegir(n - 1);
        else return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(v_flex().gap(4)
        .child(div().h(TITULO_H).flex().items_center().font_family(FONT).text_size(11).text_color(t.muted).child("ELEGIR INTEGRANTE"))
        .child(div().h(AGENTE_H).flex().items_center().truncate().text_size(12).text_color(t.foreground).child(agente)))
      .child(v_flex().gap(GAP).children(filas))
      .child(h_flex().h(PIE_H).items_center().justify_between().text_size(10).text_color(t.muted)
        .child(div().child(a?.space ? "Se recuerda en este espacio" : " "))
        .child(div().child("Enter elige · Esc cierra")));
  }

  render(cx) {
    if (props()?.elegir) return this.selector();
    return props()?.pane ? this.pane() : this.list(cx);
  }
}
