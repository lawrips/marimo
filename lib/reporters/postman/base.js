'use strict';

const debug = require('debug')('marimo');

// based on the following file: https://github.com/mochajs/mocha/blob/master/lib/reporters/base.js

function Base(runner) {
    var stats = this.stats = { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 };
    var fails = this.fails = [];
    var test = this.test = {};

    if (!runner) {
        return;
    }
    this.runner = runner;
    runner.stats = stats;
    runner.fails = fails;
    runner.test = test;

    runner.on('start', () => {
        stats.start = new Date();
        stats.suites = 1;
    });

    runner.on('suite', (suite) => {
    });

    runner.on('beforeRequest', function (err, o) {
        test.start = new Date();
    });

    runner.on('request', (err, o) => {
        test.end = new Date();
        test.duration = new Date() - test.start; 
    });

    runner.on('assertion', (err, o) => {
        stats.tests = stats.tests || 0;
        stats.tests++;

        stats.failures = stats.failures || 0;
        stats.passes = stats.passes || 0;

        if (!err) {
            stats.passes++;
        }
        else {
            stats.failures++;
            test.err = err;
            fails.push(test);
        }
    });

    runner.on('done', () => {
        stats.end = new Date();
        stats.duration = new Date() - stats.start;
    });

    runner.on('pending', () => {
        stats.pending++;
    });
}


module.exports = Base;