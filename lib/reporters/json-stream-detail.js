'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class JsonStream {
    constructor(runner) {
        let total = runner.total;
        let filename = runner.suite.suites[0].file;;

        filename = filename.slice(filename.lastIndexOf('/') + 1);
        Base.call(this, runner);

        runner.on('start', () => {            
            process.send(JSON.stringify(['start', { title: runner.suite.suites[0].title, filename: filename, total: total }]));
            debug(JSON.stringify(['start', { total: total }]));
        });

        runner.on('pass', (test) => {
            test = this.clean(test);
            test.filename = filename;
            process.send(JSON.stringify(['pass', test]));
            debug(JSON.stringify(['pass', test]));
        });

        runner.on('fail', (test, err) => {
            test = this.clean(test);
            test.filename = filename;
            test.err = err.message;
            test.stack = err.stack || null;
            process.send(JSON.stringify(['fail', test]));
            debug(JSON.stringify(['fail', test]));
        });

        runner.on('end', () => {
            let stats = runner.stats;
            stats.title = title;
            stats.filename = filename;
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

