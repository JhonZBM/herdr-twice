#!/usr/bin/env node
// Ruta antigua del lanzador de Cursor: sigue valiendo para quien ya la tiene en el menú + de
// herdr. El lanzador es agentes/lanzador.js; `node instalar.js --cursor` pasa a la ruta nueva.
'use strict';
process.argv.splice(2, 0, 'cursor');
require('../agentes/lanzador.js');
