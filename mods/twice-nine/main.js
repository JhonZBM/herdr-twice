// TWICE Nine: cada agente va acompanado por una mascota original, una por
// integrante. Dos papeles en un mismo mod:
//   - bloque del sidebar: tarjetas ("photocards") de los agentes abiertos y
//     una banca con el resto de las mascotas;
//   - cabecera de panel (props().pane): la mascota mini junto al nombre.
// Elegir integrante: comando "twice-nine.elegir" (agente enfocado) o clic en la
// mascota de la cabecera; abre este mismo mod como ventana (props().elegir).
// Solo texto, color y sprites propios; sin logo ni imagenes oficiales.

import { View, div, svg, image } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { agents, panes, theme, run, props, shared, setShared, setAgentOrder, home, layout, nextCommand, openOverlay, closeOverlay } from "herdr";
import { MEMBERS, APRICOT, MAGENTA, FONT, LABEL, SLOTS } from "./members.js";

const N = MEMBERS.length;
const STATES = new Set(["working", "blocked", "done", "idle"]);
const frame = (slug, state, f) => `mods/twice-nine/sprites/${slug}-${state}-${f}.svg`;

// La mascota en su pose. Dos cuadros apilados que se relevan con opacidad:
// corre nativo, sin temporizadores.
function sprite(slug, status, size) {
  const state = STATES.has(status) ? status : "idle";
  const box = div().relative().w(size).h(size).flex_none();
  if (state === "idle") return box.child(image(frame(slug, "idle", "a")).w(size).h(size));
  const period = state === "working" ? 640 : state === "blocked" ? 900 : 1100;
  const layer = (f, from, to) => image(frame(slug, state, f)).absolute().top(0).left(0).w(size).h(size)
    .loop("opacity", { from, to, period, easing: "ease-in-out" });
  const mark = state === "blocked" ? "bang" : state === "done" ? "sparkle" : null;
  const m = Math.round(size / 2.4);
  return box
    .child(layer("a", 1, 0))
    .child(layer("b", 0, 1))
    .when(Boolean(mark), (el) => el.child(image(`mods/twice-nine/sprites/${mark}.svg`).absolute().top(0).right(0).w(m).h(m)
      .loop("opacity", { from: 0.35, to: 1, period: 800 })));
}

const memberOf = (slot) => MEMBERS[slot % N];
const nameOf = (slot) => (slot >= N ? `${memberOf(slot).name} ${Math.floor(slot / N) + 1}` : memberOf(slot).name);
const slotsNow = () => /** @type {Record<string, number>} */ (shared(SLOTS) ?? {});

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

// Abre el selector para un agente. Ventana con clave: si varias copias del mod
// reciben el comando, la segunda reemplaza a la primera en vez de duplicarla.
function abrirSelector(address) {
  if (!address) return;
  openOverlay({ mod: "twice-nine", kind: "window", key: "twice-elegir", width: 300, height: 290, props: { elegir: address } });
}

// Da al agente la integrante i; si otro agente vivo la tenia, intercambian puestos.
function asignar(address, i) {
  const slots = { ...slotsNow() };
  const live = new Set(agents().map((a) => a.address));
  const mine = slots[address];
  const other = Object.keys(slots).find((k) => k !== address && slots[k] === i);
  if (other) {
    if (live.has(other) && Number.isInteger(mine)) slots[other] = mine;
    else delete slots[other];
  }
  slots[address] = i;
  setShared(SLOTS, slots);
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

export default class TwiceNine extends View {
  init(_props, cx) {
    this.size = null;
    this.hovered = false;
    if (props()?.elegir) {
      this.handle = cx.focus_handle();
      this.handle.focus();
      return;
    }
    if (props()?.pane) return;
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "elegir") abrirSelector(agents().find((a) => a.focused)?.address);
      }
    });
    // Los puestos se reparten fuera de render (alli no se puede escribir estado compartido).
    cx.timer.every(1000, (cx) => { if (this.sync()) cx.notify(); });
    cx.spawn(async (cx) => { if (this.sync()) cx.notify(); });
  }

  // Da a cada agente un puesto estable (0..8 una integrante; 9+ segunda ronda)
  // y lo guarda en el estado compartido para que la cabecera de panel lo lea.
  sync() {
    const list = agents();
    if (!list.length) return false;
    const slots = { ...slotsNow() };
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
      // Primero un puesto que nadie tenga; si no, el de un agente que ya no esta.
      let s = 0;
      while (s < N && held.has(s)) s++;
      if (s >= N) {
        s = 0;
        while (taken.has(s)) s++;
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

  card(t, slot, a, w) {
    const m = memberOf(slot);
    const detail = [a.program?.name, a.tab_name].filter(Boolean).join(" · ");
    const tone = a.status === "blocked" ? MAGENTA : a.status === "done" ? APRICOT : a.status === "working" ? t.foreground : t.dim;
    return v_flex().id(`card-${slot}`).w(w).flex_none().rounded(10).overflow_hidden()
      .border(1).border_color(this.edge(t, a)).bg(a.focused ? t.selected : t.surface)
      .hover((s) => s.bg(t.hover))
      .on_click(() => run("pane.focus", { pane: a.pane }))
      .child(div().h(3).w_full().flex_none().bg(m.color))
      .child(v_flex().w_full().items_center().px(6).pt(7).pb(8).gap(2)
        .child(sprite(m.slug, a.status, 48))
        .child(div().max_w(w - 12).truncate().font_family(FONT).text_size(11).text_color(t.foreground).child(nameOf(slot)))
        .child(div().text_size(10.5).text_color(tone).child(LABEL[a.status] ?? a.status))
        .child(div().max_w(w - 12).truncate().text_size(10).text_color(t.dim).child(detail || " ")));
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

  list() {
    const t = theme();
    const all = agents();
    const slots = slotsNow();
    const bySlot = new Map();
    for (const a of all) {
      const s = slots[a.address];
      if (Number.isInteger(s) && !bySlot.has(s)) bySlot.set(s, a);
    }
    const active = [...bySlot.keys()].sort((x, y) => x - y);
    if (props()?.order !== false) setAgentOrder(active.map((s) => bySlot.get(s).address));
    const out = new Set(active.map((s) => s % N));
    const bench = MEMBERS.map((_m, i) => i).filter((i) => !out.has(i));
    const width = this.size?.width ?? 268;
    const root = v_flex().id("root").size_full().text_size(13)
      .on_size_change((size, cx) => { this.size = size; cx.notify(); });

    // Riel angosto: solo las mascotas de los agentes abiertos.
    if (width < 160) {
      return root.items_center().pt(6).gap(6).overflow_y_scrollbar().children(active.map((s) => {
        const a = bySlot.get(s);
        return div().id(`rail-${s}`).p(2).flex_none().rounded(8).border(1).border_color(this.edge(t, a))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(sprite(memberOf(s).slug, a.status, 24));
      }));
    }

    const cols = width < 220 ? 1 : 2;
    const w = Math.floor((width - 16 - (cols - 1) * 6) / cols);
    const big = active.length === 0;
    return root
      .child(this.header(t, all.length, N))
      .child(v_flex().flex_1().min_h(0).px(8).pt(8).pb(8).gap(8).overflow_y_scrollbar()
        .when(!big, (el) => el.child(h_flex().flex_wrap().gap(6).children(active.map((s) => this.card(t, s, bySlot.get(s), w)))))
        .when(big, (el) => el.child(div().px(4).text_size(11.5).text_color(t.dim).child("Abre un agente y una de las nueve lo acompaña.")))
        .when(bench.length > 0, (el) => el.child(h_flex().flex_wrap().gap(big ? 8 : 5).px(2)
          .children(bench.map((i) => div().id(`bench-${i}`).flex_none().opacity(big ? 0.9 : 0.5).tooltip(MEMBERS[i].name)
            .child(sprite(MEMBERS[i].slug, "idle", big ? 36 : 24)))))));
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
          .on_click((_e, cx) => { cx.stop_propagation(); abrirSelector(p.terminal); })
          .child(sprite(memberOf(slot).slug, st, 22)))
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

  // Ventana del selector: las nueve; clic o tecla 1-9 elige, Esc cierra.
  selector() {
    const t = theme();
    const address = props().elegir;
    const slots = slotsNow();
    const all = agents();
    const a = all.find((x) => x.address === address);
    const cur = slots[address];
    const cerrar = () => closeOverlay(props().overlay);
    const elegir = (i) => { asignar(address, i); cerrar(); };
    const taken = (i) => all.some((x) => x.address !== address && slots[x.address] === i);
    const quieto = (_e, cx) => cx.stop_propagation();
    return v_flex().id("elegir").track_focus(this.handle).size_full().p(12).gap(10).rounded(10).bg(t.popover)
      .on_key_down((e, cx) => {
        const n = Number(e.key);
        if (e.key === "escape") cerrar();
        else if (n >= 1 && n <= N) elegir(n - 1);
        else return;
        cx.stop_propagation();
      })
      .child(h_flex().items_center().justify_between()
        .child(div().font_family(FONT).text_size(11).text_color(t.muted).child("ELEGIR INTEGRANTE"))
        .child(div().id("cerrar").text_size(11).text_color(t.dim).cursor_pointer()
          .on_mouse_down("left", quieto).on_click(cerrar).child("Esc")))
      .child(div().truncate().text_size(11).text_color(t.dim)
        .child(a ? [a.program?.name, a.tab_name].filter(Boolean).join(" · ") || "agente" : "agente cerrado"))
      .child(h_flex().flex_wrap().gap(6).children(MEMBERS.map((m, i) => {
        const now = Number.isInteger(cur) && cur % N === i;
        return v_flex().id(`el-${i}`).w(84).items_center().py(6).gap(2).rounded(8).cursor_pointer()
          .border(1).border_color(now ? m.color : t.border).bg(now ? t.selected : t.surface)
          .hover((s) => s.bg(t.hover))
          .on_mouse_down("left", quieto)
          .on_click(() => elegir(i))
          .child(sprite(m.slug, "idle", 32))
          .child(div().font_family(FONT).text_size(10).text_color(m.color).child(`${i + 1} ${m.name}`))
          .child(div().text_size(9.5).text_color(t.dim).child(taken(i) ? "intercambia" : " "));
      })));
  }

  render() {
    if (props()?.elegir) return this.selector();
    return props()?.pane ? this.pane() : this.list();
  }
}
