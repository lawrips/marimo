'use strict';

const should = require('should'),
    proxyquire = require('proxyquire'),
    debug = require('debug')('marimo-test');

let filename = 'test.js';

var stubs = { 
    fs: {
        readdirSync: function(directory) {
            return {
                filter: function(callback) {
                        return [filename]
                }
            }
        }
    },
    mocha: function() {
        return {
            suite: {
                suites: []
            },
            addFile: function(file) {
                this.suite.suites.push({file: file});
            },
            loadFiles : function() {
                // no need to do anything
            }
        }
    },
    express: function() {
        return {
            get: function(route, callback) {
                 debug('got stub app request');
            }
        }
    },
    http: {
        createServer: function() {
            return {
                on: function(event) {
                    if (event === 'request') {
                        //return callback();
                        debug('got stub server request');
                    }
                },
                listen: function(port, callback) {
                    this.port = port;
                    debug('stub server listening');
                    return callback();
                },
                address: function() {
                    return {
                        port: this.port
                    }
                },
                once: function() {
                }
            }
        }
    },
    ws: {
        on: function(event) {
            if (event === 'message') {
                debug('got stub ws message');
            }
        },
        Server: function (options) {
            return { 
                on: function(event, callback) {
                    if (event === 'connection') {
                        debug('got stub wss connection');
                    }
                    else if (event === 'error') {
                        debug('got stub wss error');
                    }
                }
            }
        }
    }
};

var marimo = null;

describe('marimo unit tests', () => {
    it('create constructor', (done) => {        
        var Marimo = proxyquire('../lib/index', stubs);
        marimo = new Marimo();

        done();
    });

    it('constructor with timeout and directory should set options', (done) => {        
        var Marimo = proxyquire('../lib/index', stubs);
        var directory = 'anotherdir';
        marimo = new Marimo({timeout: 20000, directory: './' + directory});
        marimo.timeout.should.equal(20000);
        done();
    });

    it('constructor and validate tests load', (done) => {        
        // create a stubbed mocha
        var mocha = stubs.mocha();
        mocha.addFile(filename);
            
        var Marimo = proxyquire('../lib/index', stubs);
        marimo = new Marimo();
        
        // validate files were loaded when instantiating marimo
        JSON.stringify(mocha.suite.suites)
        .should.be.equal(
            JSON.stringify([{file: filename}])
        );

        done();
    });

    it('call listen and ensure port is returned', (done) => {        
        // create a stubbed web server
        marimo.listen(10000, (err, port) => {
            should.not.exist(err);
            port.should.be.equal(10000);
        });
        
        done();
    });
});



