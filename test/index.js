'use strict';

const should = require('should'),
    proxyquire = require('proxyquire'),
    debug = require('debug')('marimo-test');

let filename = 'simple.js';
let testname = filename.slice(0,filename.length-3);

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
    './reporters/basic': function(runner, ws, envKeys) {
        return {
            // no need to do anything yet
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
        Server: function (options) {
            return { 
                onConnection: [],
                onError: [],
                
                on: function (event, callback) {
                    if (event === 'connection') {
                        debug('registering server.on(connection) callback');
                        this.onConnection.push(callback);
                    }
                    else if (event === 'error') {
                        debug('registering server.on(error) callback');
                        this.onError.push(callback);
                    }
                }
            }
        }
    },
    websocket : {
        lastSentMessage: '',
        onMessage: [],
        upgradeReq: {
            url: ''
        },
        on: function(event, callback) {
            if (event === 'message') {
                debug('client registering websocket.on(message) callback');
                this.onMessage.push(callback);
            }
        },
        send: function(message) {
            debug('client sending message over WebSocket: ' + message);
            this.lastSentMessage = message;
        }
    }
};

let success = false;
let env; 
stubs.mocha.Runner = function(suite) {
    return {
        run: function() {
            debug('running the test!!!')
            success = true;
        }
    }                
};


let marimo = null;

describe('marimo unit tests', () => {
    it('create constructor', (done) => {        
        var Marimo = proxyquire('../lib/index', stubs);
        marimo = new Marimo();

        done();
    });

    it('constructor with timeout, directory, debug options and env should set options', (done) => {        
        var Marimo = proxyquire('../lib/index', stubs);
        var directory = 'anotherdir';
        marimo = new Marimo({timeout: 20000, directory: './' + directory, debugPort: 2016, debugPortRange: 50, env: false});
        marimo.timeout.should.equal(20000);
        marimo.env.should.equal(false);
        marimo.portFinder.basePort.should.be.equal(2016);
        marimo.portFinder.maxPort.should.be.equal(2016 + 50);
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

    it('call listen to setup the server and ensure port is returned', (done) => {        
        // create a stubbed web server
        marimo.listen(10000, (err, port) => {
            should.not.exist(err);
            port.should.be.equal(10000);
            // a callback to be notified of any incoming websocket connections will now be registered in the array marimo.wss.onConnection
        });
        
        done();
    });

    it('simulate a connecting client and make sure we recieve a list of available tests', (done) => {        
        // trigger the callback, which woudl have been called if an incoming websocket were detected
        marimo.wss.onConnection[0](stubs.websocket);
        // when a client first connects, it receives a message with the list of available tests. we'll verify it matches
        let expectedJson = {"availableTests":{}};
        expectedJson.availableTests[testname] = {"file":"resources/" + testname};
        stubs.websocket.lastSentMessage.should.be.equal(JSON.stringify(expectedJson));

        done();
        
    });

    it('simulate a request to run a test, should result in success', (done) => {        
        stubs.websocket.onMessage[0](JSON.stringify({"reporter":"basic", "test":testname}));
        // we're forking a process so give things a sec to update
        setTimeout(() => {
            success.should.be.equal(true);
        }, 100);
        // reset success
        success = false;
        done();
        
    });

    it('simulate a request to run a test, sending some environment variables', (done) => {        
        stubs.websocket.onMessage[0](JSON.stringify({"reporter":"basic", "test":testname, "env": {"myenvkey":"myenvval"}}));
        'myenvval'.should.be.equal(process.env['myenvkey']);
        done();        
    });

    it('simulate a request to run a test, sending some more complex environment variables', (done) => {        
        let envObj = {"mystuff": 
            [{"myenvval1":"myenvkey1"},
            {"myenvval2":"myenvkey2"}]
        };
        stubs.websocket.onMessage[0](JSON.stringify({"reporter":"basic", "test":testname, "env": {mystuff :JSON.stringify(envObj.mystuff)}}));
        JSON.stringify(envObj.mystuff).should.be.equal(process.env['mystuff']);
        done();        
    });

    it('simulate a request to run in monitor mode (i.e. perpetually running)', (done) => {        
        // set request params so that the monitor code path is triggered
        stubs.websocket.upgradeReq.url = '/?monitor=true';
        stubs.websocket.onMessage[0](JSON.stringify({"reporter":"basic", "test":testname}));
        // we're forking a process so give things a sec to update
        setTimeout(() => {
            success.should.be.equal(true);
        }, 100);
        // todo: trigger an array of connected websockets with a single test
        done();        
    });

    it('running a test that does not exist should result in a 404', (done) => {        
        // when a client first connects, it receives a message with the list of available tests. we'll verify it matches
        stubs.websocket.onMessage[0](JSON.stringify({"reporter":"basic", "test":'notesthere'}));
        stubs.websocket.lastSentMessage.should.be.equal(JSON.stringify({statusCode:404}));
        done();        
    });
});



