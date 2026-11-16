import { appHome, readTextFile } from "herdr";
// Las nueve integrantes: animal con que las asocian los fans y color representativo.
// Los sprites son originales (sprites/<slug>-<estado>-<a|b>.svg).
export const MEMBERS = [
  { slug: "nayeon", name: "Nayeon", color: "#7ecbf5" },
  { slug: "jeongyeon", name: "Jeongyeon", color: "#b4dc5a" },
  { slug: "momo", name: "Momo", color: "#ff8fb6" },
  { slug: "sana", name: "Sana", color: "#b98ae6" },
  { slug: "jihyo", name: "Jihyo", color: "#ffb877" },
  { slug: "mina", name: "Mina", color: "#7fe0c3" },
  { slug: "dahyun", name: "Dahyun", color: "#f6f1f4" },
  { slug: "chaeyoung", name: "Chaeyoung", color: "#f0504f" },
  { slug: "tzuyu", name: "Tzuyu", color: "#5b8cf0" },
];
// Colores del grupo: albaricoque y magenta neon.
export const APRICOT = "#fcc89b";
export const MAGENTA = "#ff5fa2";
export const FONT = "Silkscreen";
export const LABEL = { working: "trabajando", blocked: "te necesita", done: "listo", idle: "en espera", sleep: "dormida", wait: "esperando a" };
export const SLOTS = "twice.slots";
export const PREFS = "twice.prefs";
// Arte (sprites/*.svg). herdr solo dibuja imágenes que estén de verdad dentro de ~/.config/herdr-app,
// y a través del junction que deja instalar.js no las ve: el instalador copia el arte a
// herdr-twice/twice-nine/. Si esa copia está, se usa; si no (mod copiado a mano), el de la carpeta del mod.
export let ARTE = "mods/twice-nine";
export const buscarArte = () => readTextFile(`${appHome()}/herdr-twice/twice-nine/sprites/escena.svg`)
  .then((t) => t != null && ((ARTE = "herdr-twice/twice-nine"), true), () => false);
