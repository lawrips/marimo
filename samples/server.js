'use strict';
const Marimo = require('../lib/index');

// this starts the server with auth enabled
let marimo = new Marimo({auth: 'a-random-password'});

marimo.listen(10001); 