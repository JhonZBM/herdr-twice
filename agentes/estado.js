#!/usr/bin/env node
// Hook de Cursor CLI y de Codex: manda el estado del agente (working | blocked | idle) a
// lanzador.js, que lo escribe en el terminal para herdr. Sin lanzador (el CLI abierto a mano)
// no hace nada. Lo configura instalar.js --cursor / --codex: node estado.js <estado>
'use strict';
const net = require('net');

const estado = process.argv[2];
// Al enviar un prompt el CLI espera permiso para seguir; los demás eventos aceptan un objeto
// vacío. Siempre JSON: Codex toma el texto suelto por contexto para el modelo.
const responder = () => process.stdout.write(estado === 'working' ? '{"continue":true}\n' : '{}\n');

const tubo = process.env.HERDR_TWICE_TUBO;
if (!tubo) responder();
else {
  const conexion = net.connect(tubo, () => conexion.end(estado));
  conexion.on('close', responder);
  conexion.on('error', () => {}); // sin lanzador al otro lado: 'close' responde igual
}
