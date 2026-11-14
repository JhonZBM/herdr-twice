#!/usr/bin/env node
// Agente falso para probar las mascotas sin gastar un agente de verdad (y para regenerar preview.png).
// Le dice a herdr su estado con el OSC 7501, igual que un CLI real, y obedece a una tecla:
//   w b d i  estado: working, blocked, done, idle
//   h        lanza una hija con `hc run`, así herdr le pone `parent` de verdad
//   s / S    añade / quita una etiqueta twice.sub.<n>=Explore en su terminal (simula los hooks de subagentes)
//   q        sale
// Uso: herdr-app do tab.new --name demo --argv '["node","demo/agente-falso.js"]'   ·   hc keys <t> w
'use strict';
const { execFile } = require('child_process');

const yo = process.env.HC_TERMINAL_ID;
const ESTADOS = { w: 'working', b: 'blocked', d: 'done', i: 'idle' };
let hijas = 0;
let subs = 0;

const decir = (texto) => process.stdout.write(`${texto}\r\n`);
const estado = (e) => { process.stdout.write(`\x1b]7501;state=${e}:app=demo\x1b\\`); decir(`estado: ${e}`); };
const hc = (args, hecho) => execFile('hc', args, { windowsHide: true }, (error, salida, errores) => {
  if (error) decir(`hc ${args[0]} falló: ${(errores || error.message).trim()}`);
  else if (hecho) hecho(salida);
});

const TECLAS = {
  h() {
    const nombre = `demo-${process.pid}-${++hijas}`;
    hc(['run', '--bg', '--no-notify', '--name', nombre, '--', process.execPath, __filename], () => decir(`hija: ${nombre}`));
  },
  s() {
    if (!yo) return decir('sin HC_TERMINAL_ID: no hay terminal que etiquetar');
    const n = ++subs;
    hc(['label', yo, `twice.sub.${n}=Explore`], () => decir(`subagente ${n}: dentro`));
  },
  S() {
    if (!yo || !subs) return;
    const n = subs--;
    hc(['label', yo, `twice.sub.${n}=`], () => decir(`subagente ${n}: fuera`));
  },
  q() { process.exit(0); },
  '\x03': () => process.exit(0), // Ctrl+C: en modo crudo no llega como señal
};

decir(`agente falso${yo ? ` en ${yo}` : ''} · w b d i estado · h hija · s/S subagente · q salir`);
estado('idle');
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.setEncoding('utf8');
// Solo vale una tecla suelta: lo que llegue en bloque (un pegado, una nota de hc) se ignora, o sus letras
// se leerían como órdenes. Por eso también las hijas nacen con --no-notify.
process.stdin.on('data', (texto) => {
  const tecla = texto.replace(/\x1b\[20[01]~|[\r\n]/g, '');
  if (tecla.length !== 1) return;
  if (ESTADOS[tecla]) estado(ESTADOS[tecla]);
  else if (TECLAS[tecla]) TECLAS[tecla]();
});
