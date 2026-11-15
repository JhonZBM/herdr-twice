#!/usr/bin/env node
// Lanza un CLI de agentes que no informa su estado a herdr y se lo pasa él, para que twice-nine
// le ponga mascota. Los hooks de esos CLI corren sin el terminal a la vista, así que avisan por
// una tubería local (estado.js) y este proceso, que sí está en el terminal, escribe el OSC 7501.
// Uso: node lanzador.js <cursor|codex> [argumentos del CLI]
'use strict';
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// Un agente por fila: su programa, el nombre con que se presenta a herdr y los argumentos fijos.
const AGENTES = {
  cursor: { bin: 'cursor-agent', app: 'cursor', fijos: [] },
  // Sin el daemon compartido: con él, las sesiones siguientes usarían la terminal de la primera.
  codex: { bin: 'codex', app: 'codex', fijos: ['--no-daemon'] },
};

const agente = AGENTES[process.argv[2]];
if (!agente) {
  console.error(`Uso: node lanzador.js <${Object.keys(AGENTES).join('|')}> [argumentos]`);
  process.exit(1);
}

const windows = process.platform === 'win32';
const tubo = windows ? `\\\\.\\pipe\\herdr-twice-${process.pid}` : path.join(os.tmpdir(), `herdr-twice-${process.pid}.sock`);
const enHerdr = Boolean(process.env.HC_TERMINAL_ID);
const avisar = (estado) => { if (enHerdr) process.stdout.write(`\x1b]7501;state=${estado}:app=${agente.app}\x1b\\`); };

const servidor = net.createServer((conexion) => {
  let estado = '';
  conexion.on('data', (b) => { estado += b; });
  conexion.on('end', () => { if (/^(working|blocked|idle)$/.test(estado.trim())) avisar(estado.trim()); });
});

process.on('SIGINT', () => {}); // Ctrl+C es para el agente, no para el lanzador.

servidor.listen(tubo, () => {
  avisar('idle'); // la mascota sale ya, sin esperar al primer hook del agente (tarda unos segundos)
  const args = [...agente.fijos.filter((a) => !process.argv.includes(a)), ...process.argv.slice(3).filter(Boolean)];
  const hijo = spawn(agente.bin, args, {
    stdio: 'inherit',
    shell: windows, // en Windows estos CLI son un .cmd
    env: { ...process.env, HERDR_TWICE_TUBO: tubo },
  });
  hijo.on('exit', (codigo) => { servidor.close(); process.exit(codigo ?? 0); });
  hijo.on('error', (e) => { console.error(`No se pudo abrir ${agente.bin}: ${e.message}`); servidor.close(); process.exit(1); });
});
