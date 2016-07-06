'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class JsonStream {
    constructor(runner) {
        let total = runner.total;
        Base.call(this, runner);

        runner.on('start', () => {
            let filename = runner.suite.suites[0].file;
            process.send(JSON.stringify(['start', { title: runner.suite.suites[0].title, filename: filename.slice(filename.lastIndexOf('/') + 1), total: total }]));
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
            let stats = runner.stats;
            let filename = runner.suite.suites[0].file;
            stats.title = runner.suite.suites[0].title;
            stats.filename= filename.slice(filename.lastIndexOf('/') + 1),
            process.send(JSON.stringify(['end', stats]));
            debug(JSON.stringify(['end', stats]));
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

