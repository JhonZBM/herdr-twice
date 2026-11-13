#!/usr/bin/env node
// Hook de Cursor CLI: manda el estado del agente (working | idle) a cursor-twice.js, que lo
// escribe en el terminal para herdr. Sin cursor-twice (Cursor abierto a mano) no hace nada.
// Lo configura instalar.js --cursor en ~/.cursor/hooks.json: node estado.js working|idle
'use strict';
const net = require('net');

const estado = process.argv[2];
// beforeSubmitPrompt espera permiso para seguir; los demás eventos aceptan un objeto vacío.
const responder = () => process.stdout.write(estado === 'working' ? '{"continue":true}\n' : '{}\n');

const tubo = process.env.HERDR_TWICE_TUBO;
if (!tubo) responder();
else {
  const conexion = net.connect(tubo, () => conexion.end(estado));
  conexion.on('close', responder);
  conexion.on('error', () => {}); // sin lanzador al otro lado: 'close' responde igual
}
