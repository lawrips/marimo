'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class BasicReporter {
    constructor(runner) {
        this.passes = 0;
        this.failures = 0;
        this.count = 0;
        let total = runner.total;
        Base.call(this, runner);

        runner.on('start', () => {
            process.send(`Tests beginning. Count = ${total} `);
            debug(`Tests beginning. Count = ${total} `);
        });

        runner.on('pass', (test) =>{
            this.passes++;
            process.send(`✓ Test passed! [${++this.count} / ${test.parent.tests.length}]: "${test.title}" (duration ${test.duration} ms)`);
            debug('Test started: ' + test.title);
        });

        runner.on('fail', (test, err) => {
            this.failures++;
            process.send(`✗ Test failed! [${++this.count} / ${test.parent.tests.length}]: "${test.title}" (error: ${err.message})`);
            debug(`fail: ${test.fullTitle()} -- error: ${err.message}`);
        });

        runner.on('end', () =>{
            debug(`Tests done. passes = ${this.passes}, failures = ${this.failures}`);
        });

        runner.on('suite end', (suite) => {
            let stats = {
                count: 0,
                duration: 0,
                passed: 0,
                failed: 0
            };
            
            if (suite.tests.length > 0) {
                suite.tests.map((test) => {
                    stats.count++;
                    stats.duration = !isNaN(test.duration) ? stats.duration + test.duration : stats.duration;
                    stats.passed = test.state === 'passed' ? ++stats.passed : stats.passed; 
                    stats.failed = test.state === 'failed' ? ++stats.failed : stats.failed; 
                })
                process.send(JSON.stringify(stats));
            }

            debug('All done');
        });
    }
}


module.exports = BasicReporter;

