#!/usr/bin/env node
// Hook de Claude Code: apunta en la terminal de herdr los subagentes que tiene abiertos la
// sesión, como etiquetas twice.sub.<id>=<tipo>, para que twice-nine les ponga coristas.
//   SubagentStart → pone la etiqueta · SubagentStop → la quita
//   SessionStart, SessionEnd y Stop sin tareas en segundo plano → barre las que queden
//   (Esc o un proceso muerto no garantizan SubagentStop: sin barrido quedarían fantasmas).
// Fuera de herdr (sin HC_TERMINAL_ID) no hace nada. Siempre sale con 0: nunca frena a Claude.
// Lo configura instalar.js --subagentes en ~/.claude/settings.json, con "async": true.
'use strict';
const { execFile } = require('child_process');

const terminal = process.env.HC_TERMINAL_ID;
const PREFIJO = 'twice.sub.';
const hc = (args, hecho) => execFile('hc', args, { windowsHide: true }, (error, salida) => { if (!error && hecho) hecho(salida); });

function barrer() {
  hc(['get', terminal, '--json'], (salida) => {
    let etiquetas = {};
    try { etiquetas = JSON.parse(salida).labels || {}; } catch { return; }
    const fuera = Object.keys(etiquetas).filter((k) => k.startsWith(PREFIJO)).map((k) => `${k}=`);
    if (fuera.length) hc(['label', terminal, ...fuera]);
  });
}

function atender(e) {
  const id = String(e.agent_id || '').replace(/[^\w-]/g, '');
  const tipo = String(e.agent_type || 'subagente').replace(/[^\w .:-]/g, '').slice(0, 40) || 'subagente';
  switch (e.hook_event_name) {
    case 'SubagentStart': if (id) hc(['label', terminal, `${PREFIJO}${id}=${tipo}`]); break;
    case 'SubagentStop': if (id) hc(['label', terminal, `${PREFIJO}${id}=`]); break;
    case 'Stop': if (!(e.background_tasks || []).length) barrer(); break;
    // Al compactar o limpiar la conversación los subagentes en segundo plano siguen vivos: no se barre.
    case 'SessionStart': if (!['compact', 'clear'].includes(e.source)) barrer(); break;
    case 'SessionEnd': barrer(); break;
  }
}

if (terminal) {
  let entrada = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (t) => { entrada += t; });
  process.stdin.on('end', () => { try { atender(JSON.parse(entrada)); } catch { /* entrada rara: nada que hacer */ } });
}
