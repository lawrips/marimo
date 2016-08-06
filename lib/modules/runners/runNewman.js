'use strict';

const debug = require('debug')('marimo'),
    path = require('path'),
    fs = require('fs');

const Newman = require('newman');

let file = process.env['marimo_test'];
let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length) : file;

// newman will accept url's as tests... if not a url, load it
if (!file.startsWith('http')) {
    file = require(path.resolve(file));
} 

let environment = process.env['marimo_env_file'] ? require(path.resolve(process.env['marimo_env_file'])).values : null;

_runNewman();

function _runNewman() {
    let options = {
        collection: file,
        file: testname,        
        reporters: (process.env['marimo_reporter'] || 'basic')
    };

    options.environment = environment;

    Newman.run(options, (err) => {
        if (err) { throw err; }
        console.log('collection run complete!');
    });
}