'use strict';

const debug = require('debug')('marimo'),
    path = require('path'),
    fs = require('fs'),
    http = require('request');

const Newman = require('newman');

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
let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length) : file;
// if test has already been loaded - no need to require 

let environment;
// if env file has already been loaded - no need to require 
if (process.env['marimo_resolved_env_file']) {
    try {
        environment = JSON.parse(process.env['marimo_resolved_env_file']).values;
    } catch (ex) {
        environment = process.env['marimo_env_file'] ? require(process.env['marimo_env_file']).values : null;
    } 
}
else {
    environment = process.env['marimo_env_file'] ? require(process.env['marimo_env_file']).values : null;
}

if (process.env['marimo_resolved_test']) {
    try {
        let json = JSON.parse(process.env['marimo_resolved_test']);
        _runNewman(json);
    } catch (ex) {
        _runNewman(file);
    }
}
else {
    _runNewman(file);
}


function _runNewman(json) {
    let options = {
        collection: json,
        file: testname,
        reporters: (process.env['marimo_reporter'] || 'basic')
    };

    options.environment = environment;

    Newman.run(options, (err) => {
        if (err) { throw err; }
        console.log('collection run complete!');
    });
}