#!/usr/bin/env node
// Instala herdr-twice desde donde esté clonado: mods por junction, temas y layout por copia,
// los atajos de cada mod (mods/<mod>/keys.json) y los colores de agentes.
// --solo galeria,twice-nine: solo esos mods y sus atajos, sin tocar tu layout ni tus temas.
// Opcional: --galeria (regla @imagenN en ~/.claude/CLAUDE.md), --statusline (la de Claude Code),
// --subagentes (hooks de Claude Code: sus subagentes salen como coristas) y --cursor (hooks de
// Cursor CLI para que también tenga mascota).
// Se puede repetir: solo cambia lo que falta y nunca pisa algo distinto sin --forzar.
// Uso, dentro del clon: node instalar.js [--solo m1,m2] [--forzar] [--galeria] [--statusline] [--subagentes] [--cursor]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const opcion = (o) => process.argv.includes(o);
const forzar = opcion('--forzar');
const repo = __dirname;
const claude = path.join(os.homedir(), '.claude');
const home = process.env.HERDR_APP_HOME || path.join(os.homedir(), '.config', 'herdr-app');

const COLORES = { working: '#d77757', blocked: '#e66464', done: '#78c88c' };
const REGLA_GALERIA = '- Si el usuario menciona `@imagenN` (p. ej. `@imagen3`), lee `~/.config/herdr-app/galeria/imagenN.png` con Read (si se soltó otro formato, `imagenN.jpg`, `.gif`…): son las imágenes de la galería de herdr.';
const STATUSLINE = 'node ~/.claude/statusline/statusline.js';
const SUBAGENTES = 'node ~/.claude/subagentes/subagente.js';
// Eventos de Claude Code que atiende subagentes/subagente.js (él decide qué hacer en cada uno).
const HOOKS_SUBAGENTES = ['SubagentStart', 'SubagentStop', 'Stop', 'SessionStart', 'SessionEnd'];
// Evento de Cursor → estado para herdr. Sin «te necesita»: Cursor no avisa cuando pide permiso.
const HOOKS_CURSOR = { sessionStart: 'idle', beforeSubmitPrompt: 'working', stop: 'idle' };

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

// destino → origen (junction en Windows): se edita en el repo y se ve en su sitio.
function enlazar(origen, destino, nombre) {
  let actual = null;
  try { actual = fs.realpathSync(destino); } catch { /* no existe */ }
  if (actual && path.resolve(actual).toLowerCase() === fs.realpathSync(origen).toLowerCase()) ok(nombre);
  else if (actual) aviso(`${nombre}: ya existe ${destino} y no apunta al repo; muévelo y repite`);
  else { fs.symlinkSync(origen, destino, 'junction'); hecho(nombre); }
}

const todos = fs.readdirSync(path.join(repo, 'mods'));
const iSolo = process.argv.indexOf('--solo');
const solo = iSolo > 0 ? (process.argv[iSolo + 1] || '').split(',').filter(Boolean) : null;
const desconocidos = (solo || []).filter((m) => !todos.includes(m));
if (solo && (!solo.length || desconocidos.length)) {
  console.error(`--solo necesita mods de este repo: ${todos.join(', ')}` + (desconocidos.length ? ` (no existe: ${desconocidos.join(', ')})` : ''));
  process.exit(1);
}
const mods = solo || todos;

console.log('Mods (junction):');
fs.mkdirSync(path.join(home, 'mods'), { recursive: true });
for (const mod of mods) enlazar(path.join(repo, 'mods', mod), path.join(home, 'mods', mod), mod);

for (const [carpeta, titulo] of solo ? [] : [['themes', 'Temas'], ['layouts', 'Layouts']]) {
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
const atajos = Object.assign({}, ...mods.map((m) => leerJson(path.join(repo, 'mods', m, 'keys.json'), {}).global));
for (const [tecla, comando] of Object.entries(atajos)) {
  if (keys.global[tecla] === comando) ok(`${tecla} → ${comando}`);
  else if (keys.global[tecla] && !forzar) aviso(`${tecla} ya hace «${keys.global[tecla]}»; --forzar lo cambia a ${comando}`);
  else { keys.global[tecla] = comando; cambiado = true; hecho(`${tecla} → ${comando}`); }
}
if (mods.includes('galeria') && keys.terminal && keys.terminal['ctrl-shift-v'] === 'terminal.paste') {
  delete keys.terminal['ctrl-shift-v']; cambiado = true;
  hecho('quitado ctrl-shift-v → terminal.paste de «terminal» (si no, pega texto en vez de la captura)');
}
if (cambiado) escribirJson(rutaKeys, keys);

if (!solo) {
  console.log('settings.json (colores de agentes):');
  const rutaAjustes = path.join(home, 'settings.json');
  const ajustes = leerJson(rutaAjustes, {});
  if (JSON.stringify(ajustes.colors) === JSON.stringify(COLORES)) ok('colors');
  else if (ajustes.colors && !forzar) aviso('ya hay otros «colors»; --forzar los cambia');
  else { ajustes.colors = COLORES; escribirJson(rutaAjustes, ajustes); hecho('colors'); }
}

if (opcion('--galeria')) {
  console.log('Claude Code (regla de la galería):');
  const rutaClaude = path.join(claude, 'CLAUDE.md');
  const texto = fs.existsSync(rutaClaude) ? leer(rutaClaude) : '';
  if (texto.includes('herdr-app/galeria/imagenN')) ok('@imagenN en CLAUDE.md');
  else {
    fs.mkdirSync(claude, { recursive: true });
    fs.appendFileSync(rutaClaude, (texto && !texto.endsWith('\n') ? '\n' : '') + REGLA_GALERIA + '\n');
    hecho('@imagenN en CLAUDE.md');
  }
}

if (opcion('--statusline')) {
  console.log('Claude Code (statusline):');
  fs.mkdirSync(claude, { recursive: true });
  enlazar(path.join(repo, 'statusline'), path.join(claude, 'statusline'), 'statusline');
  const rutaSettings = path.join(claude, 'settings.json');
  const settings = leerJson(rutaSettings, {});
  const actual = settings.statusLine?.command;
  if (actual === STATUSLINE) ok('statusLine');
  else if (actual && !forzar) aviso(`ya hay otra statusLine («${actual}»); --forzar la cambia`);
  else { settings.statusLine = { type: 'command', command: STATUSLINE }; escribirJson(rutaSettings, settings); hecho('statusLine'); }
}

if (opcion('--subagentes')) {
  console.log('Claude Code (subagentes como coristas):');
  fs.mkdirSync(claude, { recursive: true });
  enlazar(path.join(repo, 'subagentes'), path.join(claude, 'subagentes'), 'subagentes');
  const rutaSettings = path.join(claude, 'settings.json');
  const settings = leerJson(rutaSettings, {});
  settings.hooks = settings.hooks || {};
  let cambios = false;
  for (const evento of HOOKS_SUBAGENTES) {
    // Se añade un grupo propio al final: los hooks que ya tenga ese evento no se tocan.
    const grupos = (settings.hooks[evento] = settings.hooks[evento] || []);
    const nuestro = grupos.flatMap((g) => g.hooks || []).find((h) => h.command?.includes('subagente.js'));
    if (nuestro?.command === SUBAGENTES && nuestro.async === true) ok(evento);
    else if (nuestro && !forzar) aviso(`${evento}: ya hay un hook de subagente.js distinto («${nuestro.command}»); --forzar lo cambia`);
    else if (nuestro) { nuestro.command = SUBAGENTES; nuestro.async = true; cambios = true; hecho(`${evento} (cambiado)`); }
    else { grupos.push({ hooks: [{ type: 'command', command: SUBAGENTES, async: true }] }); cambios = true; hecho(evento); }
  }
  if (cambios) escribirJson(rutaSettings, settings);
}

if (opcion('--cursor')) {
  console.log('Cursor CLI (hooks):');
  // hooks.json no se versiona: la ruta del clon se escribe al instalar.
  const script = path.join(repo, 'cursor', 'estado.js').replace(/\\/g, '/');
  const rutaHooks = path.join(os.homedir(), '.cursor', 'hooks.json');
  const config = leerJson(rutaHooks, { version: 1, hooks: {} });
  config.hooks = config.hooks || {};
  let cambios = false;
  for (const [evento, estado] of Object.entries(HOOKS_CURSOR)) {
    const command = `node "${script}" ${estado}`;
    const lista = (config.hooks[evento] = config.hooks[evento] || []);
    const nuestro = lista.find((h) => h.command?.includes('estado.js'));
    if (nuestro?.command === command) ok(evento);
    else if (nuestro) { nuestro.command = command; cambios = true; hecho(`${evento} (ruta nueva)`); }
    else { lista.push({ command }); cambios = true; hecho(evento); }
  }
  if (cambios) { fs.mkdirSync(path.dirname(rutaHooks), { recursive: true }); escribirJson(rutaHooks, config); }

  // Entrada del menú + de herdr: abre Cursor por el lanzador, que es quien avisa a herdr.
  const rutaProgramas = path.join(home, 'programs.json');
  const programas = leerJson(rutaProgramas, {});
  programas.programs = programas.programs || {};
  const run = ['node', path.join(repo, 'cursor', 'cursor-twice.js').replace(/\\/g, '/')];
  const entrada = { name: 'Cursor (TWICE)', icon: 'icons/cursor.svg', run };
  if (JSON.stringify(programas.programs['cursor-twice']) === JSON.stringify(entrada)) ok('menú + de herdr');
  else { programas.programs['cursor-twice'] = entrada; escribirJson(rutaProgramas, programas); hecho('menú + de herdr: «Cursor (TWICE)»'); }
}

console.log('herdr-app check:');
const herdr = (args) => execFileSync('herdr-app', args, { encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32' });
for (const mod of mods) {
  try { herdr(['check', path.join(home, 'mods', mod)]); ok(mod); }
  catch (e) { aviso(`${mod}: ${(e.stdout || e.stderr || e.message).trim().split('\n').pop()}`); }
}
if (!solo) {
  try { herdr(['do', 'layout.switch', '--name', 'twice']); ok('layout twice activo'); }
  catch { console.log('  · herdr no está abierto: el layout se elige con Ctrl+Shift+L o «herdr-app do layout.switch --name twice»'); }
}

console.log(avisos ? `\nListo, con ${avisos} aviso(s) arriba.` : '\nListo.');
if (solo) console.log(`Para verlos en tu layout, pídele a tu agente en herdr: «pon el mod ${mods.join(', ')} en mi layout siguiendo su RECIPE.md».`);
if (mods.includes('twice-nine')) console.log('La fuente pixel de twice-nine se carga al reiniciar herdr.');
