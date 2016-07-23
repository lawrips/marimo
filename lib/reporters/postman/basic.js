'use strict';

const _ = require('lodash'),
    debug = require('debug')('marimo'),
    Base = require('./base');

let parentOf = function (item) {
        return item && item.__parent && item.__parent.__parent || undefined;
    };

class Newman {
    constructor(emitter, options) {
        var currentGroup = options.collection;
        Base.call(this, emitter);

        emitter.on('start', function () {
            let msg = `Tests beginning`;
            this.count = 1;
            if (process.send) process.send(msg);
            debug(msg);
        });

        emitter.on('beforeItem', function (err, o) {
        });

        // print out the request name to be executed and start a spinner
        emitter.on('beforeRequest', function (err, o) {
        });

        // output the response code, reason and time
        emitter.on('request', function (err, o) {
        });

        // realtime print out script errors
        emitter.on('script', function (err, o) {
        });

        emitter.on('assertion', function (err, o) {
            // print each test assertions
            if (!err) {
                debug(`✔ Test Passed! [${this.count} / ] "${o.item.name}" (duration ${emitter.test.duration}) ms"`);
            }
            this.count++;
        });

        emitter.on('done', function () {
            let msg = `Tests done: ${JSON.stringify(emitter.stats)}`;
            debug(msg); 
        });
    }
}

module.exports = Newman;