#!/usr/bin/env node
// Instala la parte de herdr de este repo: mods por junction, temas y layout por copia,
// atajos en keys.json, colores de agentes y el gitignore global de worktrees.
// Se puede repetir: solo cambia lo que falta y nunca pisa algo distinto sin --forzar.
// Uso: node ~/.claude/herdr/instalar.js [--forzar]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const forzar = process.argv.includes('--forzar');
const repo = __dirname; // ~/.claude/herdr
const home = process.env.HERDR_APP_HOME || path.join(os.homedir(), '.config', 'herdr-app');

const ATAJOS = {
  'ctrl-shift-v': 'galeria.pegar',
  'ctrl-shift-m': 'nombre-agente.nuevo',
  'alt-t': 'twice-nine.elegir',
  'alt-shift-t': 'twice-nine.siguiente',
  'alt-g': 'galeria.ver',
};
const COLORES = { working: '#d77757', blocked: '#e66464', done: '#78c88c' };
const IGNORE_GLOBAL = '**/.claude/worktrees/';

let avisos = 0;
const ok = (m) => console.log('  ✓ ' + m);
const hecho = (m) => console.log('  + ' + m);
const aviso = (m) => { avisos++; console.log('  ! ' + m); };
const leer = (f) => fs.readFileSync(f, 'utf8');
const igual = (a, b) => leer(a).replace(/\r\n/g, '\n') === leer(b).replace(/\r\n/g, '\n');
const leerJson = (f, defecto) => {
  if (!fs.existsSync(f)) return defecto;
  try { return JSON.parse(leer(f)); }
  catch (e) { console.error(`\n${f} no es JSON válido (${e.message}); arréglalo y repite.`); process.exit(1); }
};
const escribirJson = (f, o) => fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n');

if (!fs.existsSync(home)) {
  console.error(`No existe ${home}. Abre herdr-app una vez y vuelve a ejecutar este script.`);
  process.exit(1);
}

console.log('Mods (junction):');
fs.mkdirSync(path.join(home, 'mods'), { recursive: true });
const mods = fs.readdirSync(path.join(repo, 'mods'));
for (const mod of mods) {
  const origen = path.join(repo, 'mods', mod);
  const destino = path.join(home, 'mods', mod);
  let actual = null;
  try { actual = fs.realpathSync(destino); } catch { /* no existe */ }
  if (actual && path.resolve(actual).toLowerCase() === fs.realpathSync(origen).toLowerCase()) ok(mod);
  else if (actual) aviso(`${mod}: ya existe ${destino} y no apunta al repo; bórralo y repite`);
  else { fs.symlinkSync(origen, destino, 'junction'); hecho(mod); }
}

for (const [carpeta, titulo] of [['themes', 'Temas'], ['layouts', 'Layouts']]) {
  console.log(`${titulo} (copia):`);
  fs.mkdirSync(path.join(home, carpeta), { recursive: true });
  for (const f of fs.readdirSync(path.join(repo, carpeta))) {
    const origen = path.join(repo, carpeta, f);
    const destino = path.join(home, carpeta, f);
    if (fs.existsSync(destino) && igual(origen, destino)) ok(f);
    else if (fs.existsSync(destino) && !forzar) aviso(`${f}: el de herdr es distinto (¿cambios sin copiar al repo?); --forzar lo pisa`);
    else { fs.copyFileSync(origen, destino); hecho(f); }
  }
}

console.log('keys.json:');
const rutaKeys = path.join(home, 'keys.json');
const keys = leerJson(rutaKeys, {});
let cambiado = false;
keys.global = keys.global || {};
for (const [tecla, comando] of Object.entries(ATAJOS)) {
  if (keys.global[tecla] === comando) ok(`${tecla} → ${comando}`);
  else if (keys.global[tecla] && !forzar) aviso(`${tecla} ya hace «${keys.global[tecla]}»; --forzar lo cambia a ${comando}`);
  else { keys.global[tecla] = comando; cambiado = true; hecho(`${tecla} → ${comando}`); }
}
if (keys.terminal && keys.terminal['ctrl-shift-v'] === 'terminal.paste') {
  delete keys.terminal['ctrl-shift-v']; cambiado = true;
  hecho('quitado ctrl-shift-v → terminal.paste de «terminal» (si no, pega texto en vez de la captura)');
}
if (cambiado) escribirJson(rutaKeys, keys);

console.log('settings.json (colores de agentes):');
const rutaAjustes = path.join(home, 'settings.json');
const ajustes = leerJson(rutaAjustes, {});
if (JSON.stringify(ajustes.colors) === JSON.stringify(COLORES)) ok('colors');
else if (ajustes.colors && !forzar) aviso('ya hay otros «colors»; --forzar los cambia');
else { ajustes.colors = COLORES; escribirJson(rutaAjustes, ajustes); hecho('colors'); }

console.log('git global:');
const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
const rutaIgnore = path.join(xdg, 'git', 'ignore');
const ignore = fs.existsSync(rutaIgnore) ? leer(rutaIgnore) : '';
if (ignore.split(/\r?\n/).includes(IGNORE_GLOBAL)) ok(IGNORE_GLOBAL);
else {
  fs.mkdirSync(path.dirname(rutaIgnore), { recursive: true });
  fs.appendFileSync(rutaIgnore, (ignore && !ignore.endsWith('\n') ? '\n' : '') + IGNORE_GLOBAL + '\n');
  hecho(`${IGNORE_GLOBAL} en ${rutaIgnore}`);
}

console.log('herdr-app check:');
const herdr = (args) => execFileSync('herdr-app', args, { encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32' });
for (const mod of mods) {
  try { herdr(['check', path.join(home, 'mods', mod)]); ok(mod); }
  catch (e) { aviso(`${mod}: ${(e.stdout || e.stderr || e.message).trim().split('\n').pop()}`); }
}
try { herdr(['do', 'layout.switch', '--name', 'jonz']); ok('layout jonz activo'); }
catch { console.log('  · herdr no está abierto: el layout se elige con Ctrl+Shift+L o «herdr-app do layout.switch --name jonz»'); }

console.log(avisos ? `\nListo, con ${avisos} aviso(s) arriba.` : '\nListo.');
console.log('La fuente pixel de twice-nine se carga al reiniciar herdr.');
