'use strict';
const Marimo = require('../lib/index');

// this starts the server with auth enabled
let marimo = new Marimo(
    {
        // auth: 'a-random-password' // enable this line to start marimo with auth enabled
    }
);

marimo.listen(10001); 
marimo.addFile('https://raw.githubusercontent.com/lawrips/marimo/master/test/samples/mocha/simple1.js');
marimo.addFile('https://raw.githubusercontent.com/lawrips/marimo/master/test/samples/postman/echo.json');