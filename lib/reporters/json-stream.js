'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class JsonStream {
    constructor(runner) {
        let total = runner.total;
        Base.call(this, runner);

        runner.on('start', () => {
            process.send(JSON.stringify(['start', { total: total }]));
            debug(JSON.stringify(['start', { total: total }]));
        });

        runner.on('pass', (test) => {
            process.send(JSON.stringify(['pass', this.clean(test)]));
            debug(JSON.stringify(['pass', this.clean(test)]));
        });

        runner.on('fail', (test, err) => {
            test = this.clean(test);
            test.err = err.message;
            test.stack = err.stack || null;
            process.send(JSON.stringify(['fail', test]));
            debug(JSON.stringify(['fail', test]));
        });

        runner.on('end', () => {
            process.send(JSON.stringify(['end', runner.stats]));
            debug(JSON.stringify(['end', runner.stats]));
        });
    }

    clean(test) {
        return {
            title: test.title,
            fullTitle: test.fullTitle(),
            duration: test.duration,
            currentRetry: test.currentRetry()
        };
    }
}

module.exports = JsonStream;

