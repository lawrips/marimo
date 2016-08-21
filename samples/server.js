'use strict';
const Marimo = require('../lib/index');

// this starts the server with auth enabled
let marimo = new Marimo(
    {
        // auth: 'a-random-password' // enable this line to start marimo with auth enabled
    }
);

marimo.listen(10001); 
// get a remote mocha test
marimo.addFile('https://raw.githubusercontent.com/lawrips/marimo/master/test/samples/mocha/simple.js');
// get a remote postman test
marimo.addFile('https://raw.githubusercontent.com/lawrips/marimo/1.6.0/test/samples/postman/wikipedia.json');
// get another remote postman test 
marimo.addFile('https://raw.githubusercontent.com/lawrips/marimo/master/test/samples/postman/echo.json');