'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class JsonStream {
    constructor(runner, ws, env) {
        this.ws = ws;
        let total = runner.total;
        Base.call(this, runner, env);

        runner.on('start', () => {
            this.ws.send(JSON.stringify(['start', { total: total }]));
            debug(JSON.stringify(['start', { total: total }]));
        });

        runner.on('pass', (test) => {
            this.ws.send(JSON.stringify(['pass', this.clean(test)]));
            debug(JSON.stringify(['pass', this.clean(test)]));
        });

        runner.on('fail', (test, err) => {
            test = this.clean(test);
            test.err = err.message;
            test.stack = err.stack || null;
            this.ws.send(JSON.stringify(['fail', test]));
            debug(JSON.stringify(['fail', test]));
        });

        runner.on('end', () => {
            this.ws.send(JSON.stringify(['end', runner.stats]));
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

