'use strict';

const debug = require('debug')('marimo');
var Base = require('./base');

class JsonStream {
    constructor(runner, ws, env) {
        this.ws = ws;
        let count = 0;
        let total = runner.total;
        let width = 80;
        let failed = false;
        Base.call(this, runner, env);

        runner.on('start', () => {            
            this.ws.send(Array(width).join("&#8226;"));
            debug(JSON.stringify(['start', { total: total }]));
        });

        runner.on('pass', (test) => {
            if (failed) return;

            // only continue if we have no prior errors            
            let runway = Array(width);
            runway.fill("&#8226;");            
            runway[++count * Number.parseInt(width / total)] = '&#x2708;';  
            this.ws.send(runway.join(''));
            debug(JSON.stringify(['pass', this.clean(test)]));

        });

        runner.on('fail', (test, err) => {
            if (failed) return;
            failed = true;
            let runway = Array(width);            
            runway.fill("&#8226;");            
            runway[++count * Number.parseInt(width / total)] = 'X';  
            this.ws.send(runway.join(''));
            debug(JSON.stringify(['fail', this.clean(test)]));
        });

        runner.on('end', () => {
            if (!failed) {
                let runway = Array(width-1).join("&#8226;") + '&#x2708;'        
                this.ws.send(runway);
            }
            this.ws.send(`${runner.stats.passes} passing (${runner.stats.duration / 1000}s)`);
            this.ws.send(`${runner.stats.failures} failing`);
            var count=0;
            runner.fails.forEach((failure) => {                
                this.ws.send(`${++count}) ${failure.title}:`);
                this.ws.send(`${failure.err.stack}:`);
            })
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

