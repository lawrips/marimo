'use strict';

const debug = require('debug')('marimo'),
    path = require('path'),
    fs = require('fs'),
    http = require('request');

const Newman = require('newman');

const dir = '../../../';

/* future functionality */
/*
if (process.env['marimo_test'] && process.env['marimo_test'].startsWith('http')) {
    http({
        url: process.env['marimo_test'],
        method: 'get',
        json: true
    }, (err, response, body) => {
        _runNewman(body);
    });
} 
else {
    _runNewman(require('../../' + process.env['marimo_test']));
}
*/

let file = process.env['marimo_test'];
let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length - 5) : file.slice(0,file.length-5);

_runNewman(require(dir + file));

function _runNewman(json) {
    let options = {
        collection: json,
        file: testname,
        reporters: dir + '../lib/reporters/postman/' + (process.env['marimo_reporter'] || 'basic')
    };

	if (process.env['env_file']) {
        options.environment = require(dir + process.env['env_file'] + '.json').values; 
    }

    Newman.run(options, (err) => {
        if (err) { throw err; }
        console.log('collection run complete!');
    });
}