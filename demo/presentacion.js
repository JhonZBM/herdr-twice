#!/usr/bin/env node
// Demo guiada para grabar o capturar: abre tres espacios con agentes falsos (agente-falso.js) y
// recorre los estados con pausas: trabajando, te necesita, madre e hija, coristas y listo.
// No usa ningún agente de verdad: solo `herdr-app do` y `hc`, uno por paso.
// Uso (con herdr abierto y el layout twice): node demo/presentacion.js [--pausa 3] [--dejar] [--captura f.png]
//   --pausa N  segundos entre pasos (por defecto 3)
//   --captura F  no recorre el guion: monta una escena con todos los estados a la vez, guarda la
//              ventana en F (para preview.png) y cierra
//   --dejar    no cierra los espacios al terminar (para hacer capturas con calma)
// Lánzalo desde una terminal de fuera de herdr y graba la ventana (en Windows, Win+Shift+R).
'use strict';
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.join(__dirname, '..').replace(/\\/g, '/');
const falso = `${repo}/demo/agente-falso.js`;
const iPausa = process.argv.indexOf('--pausa');
const pausa = (iPausa > 0 ? Number(process.argv[iPausa + 1]) : 3) || 3;
const dejar = process.argv.includes('--dejar');
const iCaptura = process.argv.indexOf('--captura');
const captura = iCaptura > 0 ? path.resolve(process.argv[iCaptura + 1] || 'preview.png') : null;

const correr = (bin, args) => execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
const herdr = (comando, datos = {}) => JSON.parse(correr('herdr-app', ['do', comando, JSON.stringify(datos)]) || '{}');
const terminales = () => JSON.parse(correr('hc', ['ls', '--json'])).terminals || [];
const tecla = (t, ...teclas) => { for (const k of teclas) correr('hc', ['keys', t, k]); };
// Pausas puntuales del guion (una por paso): es una demo, no algo que quede corriendo.
const esperar = (s = pausa) => new Promise((hecho) => setTimeout(hecho, s * 1000));
const decir = (texto) => console.log(`▸ ${texto}`);

async function hasta(condicion, segundos = 10) {
  for (let i = 0; i < segundos * 4; i++) {
    const r = condicion();
    if (r) return r;
    await esperar(0.25);
  }
  throw new Error('herdr no respondió a tiempo');
}

async function main() {
  try { herdr('layout.switch', { name: 'twice' }); }
  catch { console.error('herdr no está abierto (o no tiene el layout twice: node instalar.js).'); process.exit(1); }
  const otros = terminales().filter((t) => t.state === 'live');
  if (otros.length) console.log(`Aviso: hay ${otros.length} terminal(es) abiertas en herdr; saldrán en la grabación.`);

  const espacios = [];
  const creadas = new Set();
  const abrir = async (name) => {
    const r = herdr('space.new', { name, folder: repo, argv: ['node', falso] });
    espacios.push(r.space);
    creadas.add(r.terminal);
    // El agente falso se presenta como «en espera» al arrancar: entonces ya tiene mascota.
    await hasta(() => terminales().find((t) => t.address === r.terminal && t.status));
    return r;
  };
  const ver = (e) => herdr('space.select', { id: e.space });

  try {
    decir('Tres espacios, cada uno con su agente y su mascota');
    const api = await abrir('api');
    const web = await abrir('web');
    const docs = await abrir('docs');
    await esperar();

    if (captura) {
      decir('Foto: una espera a su hija, otra te necesita y otra trabaja con coristas');
      tecla(api.terminal, 'h');
      const hija = await hasta(() => terminales().find((t) => t.parent === api.terminal && t.status));
      tecla(hija.address, 'w');
      tecla(web.terminal, 'b');
      tecla(docs.terminal, 'w', 's', 's');
      ver(web); // la que te necesita, a la vista: si no, herdr tapa la escena con su aviso
      await esperar(10); // que acaben las transiciones y se vaya el aviso «needs you» de herdr, que tapa la escena
      correr('herdr-app', ['shot', captura]);
      decir(`Captura guardada en ${captura}`);
      return;
    }

    decir('Trabajando: pasean por el tablado');
    ver(api); tecla(api.terminal, 'w'); tecla(web.terminal, 'w');
    await esperar();

    decir('Te necesita: al micrófono, con el foco y el sobretítulo');
    ver(web); tecla(web.terminal, 'b');
    await esperar(pausa * 1.5);
    tecla(web.terminal, 'w');
    await esperar();

    decir('Madre e hija: la madre espera mientras su hija trabaja');
    ver(api); tecla(api.terminal, 'h');
    const hija = await hasta(() => terminales().find((t) => t.parent === api.terminal && t.status));
    tecla(hija.address, 'w'); tecla(api.terminal, 'i');
    await esperar(pausa * 1.5);
    tecla(hija.address, 'q');
    tecla(api.terminal, 'w');
    await esperar();

    decir('Coristas: cada subagente despierta a una integrante libre');
    ver(docs); tecla(docs.terminal, 'w');
    for (let i = 0; i < 3; i++) { tecla(docs.terminal, 's'); await esperar(0.8); }
    await esperar();
    for (let i = 0; i < 3; i++) { tecla(docs.terminal, 'S'); await esperar(0.5); }

    decir('Listo: terminan y vuelven al camerino');
    ver(api);
    tecla(web.terminal, 'd'); tecla(docs.terminal, 'd');
    await esperar();
    tecla(api.terminal, 'i'); tecla(web.terminal, 'i'); tecla(docs.terminal, 'i');
    await esperar();
  } finally {
    if (dejar) decir('Espacios abiertos (--dejar): ciérralos tú cuando termines');
    else {
      for (const id of espacios) { try { herdr('space.close', { id, confirmed: true }); } catch { /* ya cerrado */ } }
      // Lo que quede de la demo (sus terminales ya terminadas, una hija sin panel) se retira de hc.
      const todas = JSON.parse(correr('hc', ['ls', '--all', '--json'])).terminals || [];
      for (const t of todas) {
        if (!creadas.has(t.address) && !creadas.has(t.parent)) continue;
        try { if (t.state === 'live') correr('hc', ['kill', t.address]); correr('hc', ['rm', t.address]); } catch { /* ya no está */ }
      }
      decir('Fin: espacios cerrados');
    }
  }
}

main().catch((e) => { console.error(e.stderr || e.message); process.exit(1); });
