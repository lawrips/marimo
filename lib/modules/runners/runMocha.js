'use strict';

const Mocha = require('mocha');
const debug = require('debug')('marimo');
let Runner = Mocha.Runner;

let mocha = new Mocha({ timeout: process.env['marimo_timeout'] });
let test = process.env['marimo_test'];
let Reporter = require('../../reporters/mocha/' + (process.env['marimo_reporter'] || 'basic'));

// if environment variables were passed up as file, load them
if (process.env['marimo_env_file']) {
    let loadedEnv = require(process.env['marimo_env_file']); 
    // merge them with environment variables
    process.env = Object.assign(process.env, loadedEnv);
}

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
