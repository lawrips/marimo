'use strict';

const debug = require('debug');

// based on the following file: https://github.com/mochajs/mocha/blob/master/lib/reporters/base.js

function Base(runner, env) {
    var stats = this.stats = { suites: 0, tests: 0, passes: 0, pending: 0, failures: 0 };
    var failures = this.failures = [];

    if (!runner) {
        return;
    }
    this.runner = runner;

    runner.stats = stats;

    runner.on('start', function () {
        stats.start = new Date();
    });

    runner.on('suite', function (suite) {
        stats.suites = stats.suites || 0;
        suite.root || stats.suites++;
    });

    runner.on('test end', function () {
        stats.tests = stats.tests || 0;
        stats.tests++;
    });

    runner.on('pass', function (test) {
        stats.passes = stats.passes || 0;

        if (test.duration > test.slow()) {
            test.speed = 'slow';
        } else if (test.duration > test.slow() / 2) {
            test.speed = 'medium';
        } else {
            test.speed = 'fast';
        }

        stats.passes++;
    });

    runner.on('fail', function (test, err) {
        stats.failures = stats.failures || 0;
        stats.failures++;
        test.err = err;
        failures.push(test);
    });

    runner.on('end', function () {
        stats.end = new Date();
        stats.duration = new Date() - stats.start;

        // unset any environment variables that were incoming
        if (env) {
            debug('unsetting incoming environment variables');
            env.forEach((key) => {
                delete process.env[key];
                debug(`unset ${key}`);
            });
        }

    });

    runner.on('pending', function () {
        stats.pending++;
    });
}


module.exports = Base;