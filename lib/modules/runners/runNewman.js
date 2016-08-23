'use strict';

const debug = require('debug')('marimo'),
    path = require('path'),
    fs = require('fs'),
    Newman = require('newman');

const fileHelper = require('../utils/fileHelper')

let filename = process.env['marimo_test'];
let testname = filename.lastIndexOf('/') > -1 ? filename.slice(filename.lastIndexOf('/') + 1, filename.length) : filename;
let envFilename;

// load the test file
let file = require(path.resolve(filename));

// if environment variables were passed up as file, load them
if (process.env['marimo_env_file']) {
    let loadedEnv = require(process.env['marimo_env_file']); 
    // merge them with environment variables
    process.env = Object.assign(process.env, loadedEnv);
}

// if an environment file was supplied use that, if not - use environment variables
let environment = process.env['marimo_env_file'] ? require(path.resolve(process.env['marimo_env_file'])).values : process.env;

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
        debug('collection run complete!');
    });

    // cleanup any temporary files
    fileHelper.cleanup();
}
        
