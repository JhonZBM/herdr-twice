// Ejemplo completo: las nueve mascotas del tema herdr-twice (un animal por integrante).
// Sirve de plantilla para un tema nuevo: copia este archivo, cambia paletas y piezas.
//
//   node arte/sprites.js arte/mascotas-twice.js --out mods/twice-nine/sprites --hojas <carpeta-temporal>
//
// Cada mascota: piezas que se pintan en este orden (lo último tapa lo anterior):
//   detras -> cuerpo -> pies -> cabezaDetras -> cabeza -> cabezaDelante -> rubor, ojos, boca -> brazos
// Opciones: dx (centrar), bdx (desplazar en "te necesita"), ojos [[c,c],[c,c]], rubor [c,c,c,c],
// bocaAbierta, brazos {down,up,out}, brazosSinContorno, levantar (brazo de aviso), ladoLevantar.
"use strict";
const { parte, espejo, rango, cabezaBase, cuerpoBase, hocico, BOCA, LEVANTA, LEVANTA_ANCHO } = require("./sprites.js");

// Paleta de 6: contorno, crema y rubor compartidos + luz/base/sombra del color de la mascota.
const CONTORNO = "#3a2433", CREMA = "#fff1e0", RUBOR = "#ff8fb6";
const pal = (l, b, s, c = CREMA, p = RUBOR) => ({ o: CONTORNO, c, p, l, b, s });
const paletas = {
  nayeon: pal("#b9e6ff", "#7ecbf5", "#4f9fd6"),
  jeongyeon: pal("#dcf296", "#b4dc5a", "#7fae3a"),
  momo: pal("#ffbdd4", "#ff8fb6", "#d4518a", CREMA, "#ffd1dc"), // rosa: rubor más claro para que se vea
  sana: pal("#dcc0f7", "#b98ae6", "#8b5fc4"),
  jihyo: pal("#ffd9ad", "#ffb877", "#de8448"),
  mina: pal("#bdf6e1", "#7fe0c3", "#48b097"),
  dahyun: pal("#ffffff", "#f6f1f4", "#cfc6dc", "#ffb877"), // blanca: la "crema" es el pico y las patas
  chaeyoung: pal("#ff8b7b", "#f0504f", "#b02c46"),
  tzuyu: pal("#5b8cf0", "#3f6fd8", "#2a4aa3"),
};
const orden = ["nayeon", "jeongyeon", "momo", "sana", "jihyo", "mina", "dahyun", "chaeyoung", "tzuyu"];
const filas = (a, b, c, s) => rango(a, b).map((r) => [r, c, s]);

const mascotas = {};

// Conejo: orejas largas (una doblada), cola de pompón.
mascotas.nayeon = {
  dx: -1,
  detras: parte([18, 18, "cc"], [19, 18, "ccc"], [20, 18, "cc"]),
  cuerpo: parte(...cuerpoBase("c", "c")),
  cabeza: parte(...cabezaBase(9),
    [4, 6, "lbb"], [5, 6, "lpb"], [6, 6, "lpb"], [7, 6, "lpb"], [8, 6, "lpb"],
    [5, 15, "lbbb"], [6, 14, "bbbbbs"], [7, 14, "bpb"], [7, 18, "bs"], [8, 14, "bpb"], [8, 19, "s"],
    ...hocico("p")),
  bocaAbierta: BOCA,
};

// Perro: orejas caídas por delante de la cabeza, cola en gancho.
mascotas.jeongyeon = {
  dx: 0, bdx: -1, levantar: LEVANTA_ANCHO,
  detras: parte([20, 18, "bb"], [19, 19, "bb"], [18, 20, "b"], [17, 19, "bb"]),
  cuerpo: parte(...cuerpoBase("c", "s"), ...filas(17, 21, 7, "bbbccccbss")),
  cabezaDelante: parte([7, 5, "bs"], [8, 4, "bss"], ...filas(9, 14, 3, "bss"), [14, 3, "sss"], [15, 4, "ss"],
    [7, 17, "ss"], [8, 17, "sss"], ...filas(9, 14, 18, "sss"), [14, 18, "sss"], [15, 18, "ss"]),
  cabeza: parte([7, 8, "lllbbbbb"], [8, 7, "lllbbbbbbb"], [9, 6, "llbbbbbbbbbb"],
    [10, 6, "lbbbbbbbbbbs"], [11, 6, "bbbbbbbbbbbs"], [12, 6, "bbbbbbbbbbbs"],
    [13, 6, "bbbbccccbbss"], [14, 7, "bbbccccsss"], [13, 11, "oo"]),
  ojos: [[8, 9], [14, 15]], rubor: [7, 8, 15, 16],
  bocaAbierta: [[14, 11, "pp"]],
};

// Mapache: antifaz en el tono sombra, cola de anillos (por eso levanta el brazo izquierdo).
mascotas.momo = {
  dx: -2, bdx: 1, ladoLevantar: "L",
  detras: parte([8, 21, "s"], [9, 20, "sss"], [10, 20, "sss"], [11, 20, "bbb"], [12, 20, "bbb"],
    [13, 20, "sss"], [14, 20, "sss"], [15, 20, "bbb"], [16, 20, "bbb"], [17, 20, "sss"],
    [18, 19, "ssss"], [19, 17, "bbbbbb"], [20, 17, "bbbbb"]),
  cuerpo: parte(...cuerpoBase("c", "s")),
  cabeza: parte(...cabezaBase(7),
    [5, 5, "lb"], [6, 5, "lbb"], [5, 17, "bs"], [6, 16, "bbs"],
    [9, 6, "cccc"], [9, 12, "ccccc"],
    [10, 5, "sssss"], [10, 12, "sssssss"], [11, 5, "sssss"], [11, 12, "sssssss"],
    [12, 5, "sssss"], [12, 12, "sssssss"], [13, 5, "ssss"], [13, 13, "ssssss"],
    ...hocico("o")),
  bocaAbierta: BOCA,
};

// Hámster: una sola pieza redonda (sin cabeza aparte: no cabecea al dormir).
mascotas.sana = {
  dx: 0,
  cuerpo: parte([8, 8, "llbbbbbb"], [9, 6, "llbbbbbbbbbs"], [10, 5, "llbbbbbbbbbbbs"],
    [11, 5, "lbbbbbbbbbbbbs"], [12, 5, "bbbbccccbbbbbs"],
    [13, 5, "bcccccccccccss"], ...filas(14, 18, 4, "bccccccccccccsss"),
    [18, 5, "bbcccccccccsss"], [19, 6, "bbcccccccsss"], [20, 8, "bbbsssss"],
    [6, 6, "lb"], [7, 6, "lpb"], [6, 16, "bb"], [7, 15, "bpb"],
    [13, 10, "oo"]),
  pies: parte([21, 7, "ppp"], [21, 14, "ppp"]),
  brazos: { down: parte([16, 8, "bb"]), up: parte([15, 7, "bb"]), out: parte([15, 3, "bbb"]) },
  brazosSinContorno: ["down", "up"],
  bocaAbierta: [[14, 10, "pp"]],
};

// Unicornio: cuerno crema, crin y cola en rubor.
mascotas.jihyo = {
  dx: -1,
  detras: parte([17, 19, "p"], [18, 19, "pp"], [19, 19, "ppp"], [20, 20, "pp"]),
  cuerpo: parte(...cuerpoBase(null, "c")),
  cabeza: parte(...cabezaBase(9),
    [7, 6, "l"], [8, 6, "lb"], [7, 16, "b"], [8, 15, "bb"],
    [4, 11, "c"], [5, 11, "c"], [6, 10, "cc"], [7, 10, "cc"], [8, 10, "cc"],
    [9, 12, "ppp"],
    [9, 16, "ppp"], [10, 17, "pp"], [11, 18, "pp"], [12, 18, "pp"],
    [13, 18, "ppp"], [14, 17, "pppp"], [15, 18, "ppp"], [16, 18, "pp"],
    [13, 8, "coccoc"], [14, 8, "cccccc"]),
  bocaAbierta: [[14, 10, "pp"]],
};

// Pingüino: una sola pieza, aletas en vez de brazos.
const ALETAS = {
  down: parte([14, 5, "b"], [15, 4, "bb"], [16, 4, "bs"], [17, 4, "ss"], [18, 4, "s"]),
  up: parte([15, 5, "b"], [14, 4, "bb"], [13, 3, "bb"]),
  out: parte([15, 3, "bbb"], [16, 4, "ss"]),
};
mascotas.mina = {
  dx: 0,
  cuerpo: parte([5, 9, "llbbbb"], [6, 8, "llbbbbbb"], [7, 7, "llbbbbbbbs"],
    [8, 6, "lbbbbbbbbbbs"], [9, 6, "lbbbbbbbbbbs"],
    [10, 6, "bbccccccccss"],
    [11, 6, "bccccccccccs"], [12, 6, "bccccccccccs"], [13, 6, "bccccccccccs"],
    ...filas(14, 20, 6, "bbccccccccss"),
    [20, 7, "bbccccccss"],
    [12, 11, "pp"], [13, 11, "oo"]),
  pies: parte([21, 7, "ppp"], [21, 14, "ppp"]),
  brazos: ALETAS,
  levantar: parte([7, 19, "lb"], ...filas(8, 15, 19, "bs"), [15, 18, "bbs"], [16, 18, "bs"]),
  ojos: [[8, 9], [14, 15]], rubor: [8, 9, 14, 15],
  bocaAbierta: [[13, 11, "oo"], [14, 11, "pp"]],
};

// Águila: cabeza blanca, cuerpo y alas en el tono sombra, cejas oscuras.
const ALAS = {
  down: parte([16, 6, "bs"], [17, 5, "bss"], [18, 5, "sss"], [19, 5, "sss"], [20, 6, "ss"]),
  up: parte([17, 5, "sss"], [16, 4, "bss"], [15, 3, "bs"], [14, 3, "s"]),
  out: parte([17, 3, "bssss"], [18, 4, "ssss"], [19, 5, "ss"]),
};
mascotas.dahyun = {
  dx: 0,
  cuerpo: parte([15, 8, "ssssssss"], [16, 8, "ssssssss"], ...filas(17, 21, 7, "ssssssssss"),
    [21, 7, "cccc"], [21, 13, "cccc"],
    [18, 10, "b"], [18, 12, "b"]),
  cabeza: parte(...cabezaBase(7), [6, 8, "llbbbbbb"], [5, 11, "b"], [4, 12, "b"],
    [10, 6, "ssoo"], [10, 12, "ooss"],
    [12, 9, "cccc"], [13, 9, "cccc"], [14, 9, "oco"]),
  brazos: ALAS,
  levantar: espejo(espejo(LEVANTA), { cambia: { b: "s", l: "b" } }),
  bocaAbierta: [[13, 10, "oo"]],
};

// Cachorro de tigre: tres rayas en la frente, orejas redondas.
mascotas.chaeyoung = {
  dx: -1,
  detras: parte([20, 18, "bb"], [19, 19, "bs"], [18, 19, "bs"], [17, 19, "b"]),
  cuerpo: parte(...cuerpoBase("c", "s")),
  cabeza: parte(...cabezaBase(7),
    [5, 6, "lb"], [6, 5, "lbpb"], [5, 16, "bb"], [6, 15, "bpbs"],
    [7, 9, "s"], [8, 9, "s"], [7, 11, "s"], [8, 11, "s"], [9, 11, "s"], [7, 13, "s"], [8, 13, "s"],
    ...hocico("p")),
  bocaAbierta: BOCA,
};

// Ciervo: astas crema de dos puntas, motas en el lomo.
mascotas.tzuyu = {
  dx: 0,
  detras: parte([19, 18, "cc"], [20, 18, "c"]),
  cuerpo: parte(...cuerpoBase(null, "s"), [17, 13, "c"], [19, 12, "c"], [18, 10, "c"]),
  cabeza: parte(...cabezaBase(7),
    [9, 3, "lb"], [10, 4, "b"], [9, 19, "bs"], [10, 19, "s"],
    [6, 7, "cc"], [5, 6, "cccc"], [4, 5, "cc"], [4, 9, "c"],
    [6, 15, "cc"], [5, 14, "cccc"], [4, 14, "c"], [4, 17, "cc"],
    ...hocico("o")),
  bocaAbierta: BOCA,
};

// Marcas sueltas: se superponen a la mascota desde el mod (no van dentro del sprite).
const BANG = [
  "..oooooooo..",
  ".ommmmmmmmo.",
  "ommmmccmmmmo",
  "ommmmccmmmmo",
  "ommmmccmmmmo",
  "ommmmccmmmmo",
  "ommmmmmmmmmo",
  "ommmmccmmmmo",
  ".ommmmmmmmo.",
  "..ommoooooo.",
  "..omo.......",
  "..oo........",
];
const SPARKLE = [
  ".....oo.....",
  "....oaao....",
  "....oaao....",
  "...ooaaoo...",
  ".ooaaaaaaoo.",
  "oaaaaaaaaaao",
  "oaaaaaaaaaao",
  ".ooaaaaaaoo.",
  "...ooaaoo...",
  "....oaao....",
  "....oaao....",
  ".....oo.....",
];
const ZZZ_A = [
  "....................zzzz",
  "......................z.",
  ".....................z..",
  "....................zzzz",
  "........................",
  ".................zzz....",
  "..................z.....",
  ".................zzz....",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
const ZZZ_B = [
  ".....................zzz",
  "......................z.",
  ".....................zzz",
  "..................zzz...",
  "...................z....",
  "..................zzz...",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
  "........................",
];
const marcas = {
  bang: [{ o: CONTORNO, m: "#ff5fa2", c: CREMA }, BANG],       // 12x12, esquina: "te necesita"
  sparkle: [{ o: CONTORNO, a: "#fcc89b" }, SPARKLE],            // 12x12, esquina: "listo"
  "zzz-a": [{ z: "#b79ae8" }, ZZZ_A],                           // 24x24, mismo lienzo que la mascota
  "zzz-b": [{ z: "#b79ae8" }, ZZZ_B],
};

module.exports = { tam: 24, paletas, orden, mascotas, marcas };
