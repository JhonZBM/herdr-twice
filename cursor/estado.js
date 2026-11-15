#!/usr/bin/env node
// Ruta antigua del hook de Cursor: sigue valiendo para quien ya la tiene en ~/.cursor/hooks.json.
// El hook es agentes/estado.js; `node instalar.js --cursor` pasa a la ruta nueva.
'use strict';
require('../agentes/estado.js');
