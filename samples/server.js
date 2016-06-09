'use strict';
const Marimo = require('../lib/index');

let marimo = new Marimo({auth: 'a-random-password'});

marimo.listen(10001); 