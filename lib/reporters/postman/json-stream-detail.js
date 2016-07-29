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
        let total = _getTestCount(options);
        Base.call(this, emitter);
        let filename = options.file;
        this.suiteTitle = options.collection.name;
        this.emitter = emitter;

        emitter.on('start', () => {
            if (process.send) process.send(JSON.stringify(['start', { title: this.suiteTitle, filename: filename, total: total }]));
            debug(JSON.stringify(['start', { total: total }]));
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
            if (err) {
                let test = this.clean(o);
                test.filename = filename;
                test.err = err.message;
                test.stack = err.stack || null;
                if (process.send) process.send(JSON.stringify(['fail', test]));
                debug(JSON.stringify(['fail', test]));
            }
            else {
                let test = this.clean(o);
                test.filename = filename;
                if (process.send) process.send(JSON.stringify(['pass', test]));
                debug(JSON.stringify(['pass', test]));
            }
        });

        emitter.on('done', () => {
            let stats = emitter.stats;
            stats.title = this.suiteTitle;
            stats.filename = filename;
            if (process.send) process.send(JSON.stringify(['end', stats]));
            debug(JSON.stringify(['end', stats]));
        });
    }

    clean(test) {
        return {
            title: test.assertion,
            fullTitle: this.suiteTitle + ' ' + test.assertion,
            currentRetry: 0,
            // not being calculated correctly. fix
            duration: this.emitter.test.duration
        };
    }
}

// Quite hacky function to determine the # of assertions in a postman collection.
// Will live with this and test closely until find a better awy
function _getTestCount(options) {
    let tests = 0;
    options.collection.items.members.forEach((postmanItem) => {
        tests += _getTestCountRecurse(postmanItem);
    });
    return tests;    
}

function _getTestCountRecurse(postmanItem) {
    let tests = 0;
    if (postmanItem.items) {
        postmanItem.items.members.forEach((item) => {
            tests += _getTestCountRecurse(item);
        });
    }
    else {
        tests += _getTestCountSingle(postmanItem)
    }
    return tests;
}

function _getTestCountSingle(postmanItem) {
    let tests = 0;
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
    return tests;
}

module.exports = Newman;