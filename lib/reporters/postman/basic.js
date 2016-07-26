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
        this.tests = _getTestCount(options);
        Base.call(this, emitter);

        emitter.on('start', () => {
            let msg = `Tests beginning`;
            this.count = 1;
            if (process.send) process.send(msg);
            debug(msg);
        });

        emitter.on('beforeItem', (err, o) => {
        });

        // print out the request name to be executed and start a spinner
        emitter.on('beforeRequest', (err, o) => {
        });

        // output the response code, reason and time
        emitter.on('request', (err, o) => {
        });

        // realtime print out script errors
        emitter.on('script', (err, o) => {
        });

        emitter.on('assertion', (err, o) => {
            // print each test assertions
            if (!err) {
                debug(`✔ Test Passed! [${this.count} / ${this.tests}] "${o.assertion}" (duration ${emitter.test.duration}) ms"`);
            }
            this.count++;
        });

        emitter.on('done', () => {
            let msg = `Tests done: ${JSON.stringify(emitter.stats)}`;
            debug(msg); 
        });
    }
}

// Quite hacky function to determine the # of assertions in a postman collection.
// Will live with this and test closely until find a better awy
function _getTestCount(options) {
    let tests = 0;
    options.collection.items.members.forEach((postmanItem) => {
        if (postmanItem.events) { 
            postmanItem.events.members.forEach((member) => {                    
                if (member.listen == 'test') {
                    if (member.script) {
                        member.script.exec.forEach((script) => {
                            if (script.search(/tests\[('|").+('|")\]/) > -1) {
                                tests++;
                            }
                        });
                    }
                }    
            });
        }
    });
    return tests;    
}

module.exports = Newman;