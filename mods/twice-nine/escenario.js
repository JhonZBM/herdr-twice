// El escenario: un panel (bajo la Galería; Alt+R lo muestra u oculta) donde las mascotas se colocan
// según lo que hace su agente. De arriba abajo:
//   sobretítulos → una línea con lo más urgente («SANA te necesita · tarea»)
//   bambalinas (izq.) → espera a su hija · camerino (der., con sofá) → en espera o dormida
//   tablado → trabajando (pasean) · micrófono → te necesita (con foco) · esquinas → listo
//   primera fila → las libres, cada una en su butaca
// Las coristas (subagentes) van detrás de su líder. No hay burbujas: el detalle de cada una está
// en su tooltip. Todo sale de los datos vivos de herdr en cada render: el paseo y el rebote son
// .loop nativos y el cambio de zona un .transition; no hay timers. `k` son las piezas de main.js.
import { div, image } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run } from "herdr";
import { MEMBERS, APRICOT, MAGENTA, FONT, LABEL } from "./members.js";
import { equipo, esperaA, subagentes } from "./relaciones.js";

// La escena tiene tamaño fijo, el del dibujo; si el panel es más ancho, se centra.
const ANCHO = 260, ALTO = 330;
const T = 40, GRANDE = 48, MINI = 22, PASEO = 12, CORO = 3;
const TINTA = "#1a121f", SOMBRA = "#120c16";
// Sitios de cada zona: la esquina de la mascota, en px del dibujo.
const ZONA = {
  working: [[22, 136], [98, 136], [174, 136], [52, 178], [128, 178], [196, 178]],
  blocked: [[136, 222], [70, 222], [190, 222]],
  done: [[14, 230], [206, 230], [56, 232], [166, 232]],
  wait: [[14, 56], [70, 56]],
  idle: [[142, 56], [200, 56]],
};
ZONA.sleep = ZONA.idle;
const butaca = (i) => 13 + i * 26;

const ir = (a) => (a.pane ? run("agent.focus", { terminal: a.address }) : run("terminal.peek", { terminal: a.address }));

export function escenario(k) {
  const t = theme();
  const todos = equipo();
  const slots = k.slotsNow();
  const subs = subagentes();
  const nombre = (a) => k.nameOf(slots[a.address]);
  const color = (a) => k.memberOf(slots[a.address]).color;
  const conPuesto = todos.filter((a) => Number.isInteger(slots[a.address]));
  const libres = MEMBERS.map((_m, i) => i).filter((i) => !conPuesto.some((a) => slots[a.address] % MEMBERS.length === i));

  const usados = {};
  const actores = conPuesto.map((a) => {
    const st = k.pose(a, todos);
    const sitios = ZONA[st] ?? ZONA.idle;
    const n = (usados[st] = (usados[st] ?? 0) + 1) - 1;
    // Si la zona se llena, las siguientes repiten sitio un poco desplazadas.
    const [x, y] = sitios[n % sitios.length];
    const vuelta = Math.floor(n / sitios.length) * 8;
    return { a, slot: slots[a.address], st, x: x + vuelta, y: y - vuelta };
  });

  // Sobretítulos: lo más urgente, en una línea. Te necesitan > terminó > espera; si no, nada.
  const sobretitulos = () => {
    const de = (st) => actores.filter((p) => p.st === st).map((p) => p.a);
    const pixel = (a) => div().flex_none().font_family(FONT).text_size(10).child(nombre(a));
    const tarea = (a) => { const s = k.limpio(a.title); return s ? ` · ${s}` : ""; };
    const linea = (a, fondo, tinta, piezas) => h_flex().id("sobretitulos").absolute().top(12).left(0).w(ANCHO).h(20).px(8).gap(4)
      .items_center().bg(fondo).text_size(11).text_color(tinta)
      .when(Boolean(a), (el) => el.cursor_pointer().tooltip(`Ir a ${nombre(a)}`).on_click(() => ir(a)))
      .children(piezas);
    const resto = (texto) => div().truncate().child(texto);
    const [b, ...mas] = de("blocked");
    if (b) {
      return mas.length
        ? linea(b, MAGENTA, TINTA, [pixel(b), resto(mas.length === 1 ? "y" : `+${mas.length - 1} y`), pixel(mas[mas.length - 1]), resto("te necesitan")])
        : linea(b, MAGENTA, TINTA, [pixel(b), resto(`te necesita${tarea(b)}`)]);
    }
    const [d] = de("done");
    if (d) return linea(d, SOMBRA, APRICOT, [pixel(d).text_color(color(d)), resto(`¡listo!${tarea(d)}`)]);
    const [w] = de("wait");
    const hija = w && esperaA(w.address, todos);
    if (w) return linea(w, SOMBRA, t.muted, [pixel(w).text_color(color(w)), resto("espera a"), ...(hija ? [pixel(hija).text_color(color(hija))] : [resto("otra sesión")])]);
    return conPuesto.length ? null : linea(null, SOMBRA, t.dim, [resto("nadie en escena")]);
  };

  const actor = (p) => {
    const { a, slot, st } = p;
    const m = k.memberOf(slot);
    const lado = st === "blocked" ? GRANDE : T; // la que te necesita, más grande: es la que hay que ver
    const coro = (subs.get(a.address) ?? []).slice(0, Math.min(CORO, libres.length)).map(() => libres.shift());
    const cuerpo = div().absolute().w(lado).h(lado + 12)
      .child(div().absolute().top(lado - 2).left(Math.round(lado / 2) - 12).w(24).h(3).bg(SOMBRA).opacity(0.6))
      .child(k.sprite(m.slug, st, lado))
      .child(h_flex().w(lado).justify_center().font_family(FONT).text_size(8).text_color(m.color).child(k.nameOf(slot)));
    // La caja se mueve de zona con una transición; dentro, la que trabaja pasea y la que te necesita bota.
    const vivo = st === "working" ? cuerpo.top(0).loop("left", { from: 0, to: PASEO, period: 2600 + (slot % 5) * 420, easing: "ease-in-out" })
      : st === "blocked" ? cuerpo.left(PASEO / 2).loop("top", { from: 0, to: -3, period: 700, easing: "ease-in-out" })
      : cuerpo.top(0).left(PASEO / 2);
    const tarea = k.limpio(a.title);
    return div().id(`actor-${a.address}`).absolute().left(p.x - PASEO / 2).top(p.y).w(lado + PASEO).h(lado + 12).cursor_pointer()
      .transition("left", { duration: 700, easing: "ease-in-out" }).transition("top", { duration: 700, easing: "ease-in-out" })
      .tooltip([k.nameOf(slot), LABEL[st] ?? st, a.program?.name ?? a.app, tarea].filter(Boolean).join(" · "))
      .on_click(() => ir(a))
      .children(coro.map((i, n) => div().absolute().top(-6).left(n * 12 - 2).opacity(0.9).child(k.sprite(MEMBERS[i].slug, "working", MINI))))
      .child(vivo);
  };

  const enEscena = [...actores].sort((p, q) => p.y - q.y).map(actor); // antes de la primera fila: las coristas dejan su butaca
  const foco = actores.find((p) => p.st === "blocked");
  const letrero = sobretitulos();
  return h_flex().id("escenario").size_full().justify_center().bg(TINTA).overflow_hidden()
    .child(div().relative().flex_none().w(ANCHO).h(ALTO).overflow_hidden()
      .child(image("mods/twice-nine/sprites/escena.svg").absolute().top(0).left(0).w(ANCHO).h(ALTO))
      // El único foco de color: sobre quien te necesita. Sin nadie al micrófono, no hay foco.
      .when(Boolean(foco), (el) => el.child(image("mods/twice-nine/sprites/foco.svg").absolute().top(118).left(foco.x + GRANDE / 2 - 60).w(120).h(168)
        .loop("opacity", { from: 0.55, to: 1, period: 1400, easing: "ease-in-out" })))
      .children(libres.map((i) => div().id(`butaca-${i}`).absolute().left(butaca(i)).top(300).opacity(0.6)
        .tooltip(`${MEMBERS[i].name} · libre`).child(k.sprite(MEMBERS[i].slug, "sleep", MINI))))
      .children(enEscena)
      .when(Boolean(letrero), (el) => el.child(letrero)));
}
