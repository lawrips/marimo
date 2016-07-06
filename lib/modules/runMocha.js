'use strict';

const Mocha = require('mocha');
const debug = require('debug')('marimo');
let Runner = Mocha.Runner;

let mocha = new Mocha({ timeout: process.env['marimo_timeout'] });
let test = process.env['marimo_test'];
let Reporter = require('../reporters/' + (process.env['marimo_reporter'] || 'basic'));
    
// add the files
mocha.addFile(test);
// this is an async function but will execute fast enough that we don't need to wait for the callback
mocha.loadFiles();
debug(`successfully loaded mocha test file=${test}`);

debug(`beginning test run test=${test}`);
// create a test runner & reporter and run the test
var runner = new Runner(mocha.suite);
new Reporter(runner);
runner.run();
