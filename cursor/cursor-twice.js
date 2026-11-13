#!/usr/bin/env node
// Lanza Cursor CLI y le pasa a herdr los estados que mandan sus hooks (estado.js), para que
// twice-nine le ponga mascota. Los hooks de Cursor corren sin el terminal a la vista, así que
// avisan por una tubería local y este proceso, que sí está en el terminal, escribe el OSC 7501.
// Uso: node cursor-twice.js [argumentos de cursor-agent]
'use strict';
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const windows = process.platform === 'win32';
const tubo = windows ? `\\\\.\\pipe\\herdr-twice-${process.pid}` : path.join(os.tmpdir(), `herdr-twice-${process.pid}.sock`);
const enHerdr = Boolean(process.env.HC_TERMINAL_ID);
const avisar = (estado) => { if (enHerdr) process.stdout.write(`\x1b]7501;state=${estado}:app=cursor\x1b\\`); };

const servidor = net.createServer((conexion) => {
  let estado = '';
  conexion.on('data', (b) => { estado += b; });
  conexion.on('end', () => { if (/^(working|blocked|idle)$/.test(estado.trim())) avisar(estado.trim()); });
});

process.on('SIGINT', () => {}); // Ctrl+C es para Cursor, no para el lanzador.

servidor.listen(tubo, () => {
  avisar('idle'); // la mascota sale ya, sin esperar al sessionStart de Cursor (tarda unos segundos)
  const cursor = spawn('cursor-agent', process.argv.slice(2).filter(Boolean), {
    stdio: 'inherit',
    shell: windows, // en Windows cursor-agent es un .cmd
    env: { ...process.env, HERDR_TWICE_TUBO: tubo },
  });
  cursor.on('exit', (codigo) => { servidor.close(); process.exit(codigo ?? 0); });
  cursor.on('error', (e) => { console.error(`No se pudo abrir cursor-agent: ${e.message}`); servidor.close(); process.exit(1); });
});
