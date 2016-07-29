'use strict';

const should = require('should'),
    proxyquire = require('proxyquire'),
    WebSocket = require('ws'),
    path = require('path'),
    fs = require('fs'),
    Marimo = require('../lib/index'),
    http = require('request'),
    debug = require('debug')('marimo-test');

let filename = 'simple.js';
let testname = filename.slice(0,filename.length-3);


describe('marimo e2e tests', () => {
    before('start two marimo servers. One with auth and a good directory, the other with auth and adding files manually)', (done) => {        

        let marimo = new Marimo({debugPort: 13100, directory: './test'});
        marimo.listen(13000);

        let marimo_auth = new Marimo({debugPort: 14100, auth: 'password', directory: './abaddir'});
        marimo_auth.addFile('test/simple.js');
        marimo_auth.addFile('test/echo.json');
        marimo_auth.listen(14000);
        done(); 
    });

    it('connect to web socket (no auth) and check simple and echo are in the available tests', (done) => {        
        var ws = new WebSocket(`ws://localhost:13000`);        

        ws.on('open', () => {            
        });

        ws.on('message', (data, flags) => {
            if (JSON.parse(data).availableTests) {
                Object.keys(JSON.parse(data).availableTests).indexOf('simple').should.be.greaterThan(-1);
                Object.keys(JSON.parse(data).availableTests).indexOf('echo').should.be.greaterThan(-1);
                JSON.parse(data).availableTests['simple'].file.should.equal('test/simple');
                JSON.parse(data).availableTests['echo'].file.should.equal('test/echo');
            }
            else {
            }
            done();
        });        
    });

    it('start the simple test and check it ran ok', (done) => {
        var ws = new WebSocket(`ws://localhost:13000`);        

        ws.on('open', () => {
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'simple',
                    env: {'hello':'world'}
                })
            );            
        });

        var started = false;
        ws.on('message', (data, flags) => {
            var result = JSON.parse(data);
            if (!result.availableTests) {
                if (!started) {
                    result[0].should.equal('start');
                    started = true;
                }
                else if (result[0] == 'end') {
                    result[1].suites.should.equal(1);
                    result[1].tests.should.equal(5);
                    result[1].passes.should.be.equal(4); // should be 4 passes
                    result[1].failures.should.be.equal(1); // should be 1 failure
                    done();
                }
            }        
        });        
    });


    it('start the echo test and check it ran ok', (done) => {
        var ws = new WebSocket(`ws://localhost:13000`);        

        ws.on('open', () => {
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'echo'
                })
            );            
        });

        var started = false;
        ws.on('message', (data, flags) => {
            var result = JSON.parse(data);
            if (!result.availableTests) {
                if (!started) {
                    result[0].should.equal('start');
                    started = true;
                }
                else if (result[0] == 'end') {
                    result[1].suites.should.equal(1);
                    result[1].tests.should.equal(63);
                    result[1].passes.should.be.greaterThan(61); // at least 61 passes
                    result[1].failures.should.be.lessThan(5); // v few failures
                    done();
                }
            }        
        });        
    });

    it('don\'t send any environment variables and check a test designed to read them failed', (done) => {
        var ws = new WebSocket(`ws://localhost:13000`);        

        ws.on('open', () => {
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'simple'
                })
            );            
        });

        var started = false;
        ws.on('message', (data, flags) => {
            var result = JSON.parse(data);
            if (!result.availableTests) {
                if (!started) {
                    result[0].should.equal('start');
                    started = true;
                }
                else if (result[0] == 'end') {
                    result[1].suites.should.equal(1);
                    result[1].tests.should.equal(5);
                    result[1].passes.should.be.equal(3); // should be 3 passes
                    result[1].failures.should.be.equal(2); // should be 2 failures
                    done();
                }
            }        
        });
        
    });


    it('connect to web socket (auth) and check simple and echo are in the available tests', (done) => {        
        http('http://localhost:14000/auth', {
            method: 'get',
            headers: {
                authorization: 'basic password'
        }}, (err, response, body) => {
            should.not.exist(err);
            var ws = new WebSocket(`ws://localhost:14000/?token=${body}`);        

            ws.on('open', () => {            
            });

            ws.on('message', (data, flags) => {
                if (JSON.parse(data).availableTests) {
                    Object.keys(JSON.parse(data).availableTests).indexOf('simple').should.be.greaterThan(-1);
                    Object.keys(JSON.parse(data).availableTests).indexOf('echo').should.be.greaterThan(-1);
                    JSON.parse(data).availableTests['simple'].file.should.equal('test/simple');
                    JSON.parse(data).availableTests['echo'].file.should.equal('test/echo');
                }
                else {
                }
                done();
            });
        });        
    });

    it('start two monitor style tests and check they ran ok 3 times', (done) => {
        var ws = new WebSocket(`ws://localhost:13000/?monitor=true`);        

        ws.on('open', () => {
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'simple,simpleCopy',
                    env: {'hello':'world'},
                    monitor: {
                        cmd: 'start',
                        delay: 1000
                    }
                })
            );            
        });

        var started = false;
        var counter = {'simple':0, 'simpleCopy':0};

        ws.on('message', (data, flags) => {
            var result = JSON.parse(data);
            if (!result.availableTests) {
                if (counter['simple'] < 3 || counter['simpleCopy'] < 3) {
                    if (!started) {
                        result[0].should.equal('start');
                        started = true;
                    }
                    else if (result[0] == 'end') {
                        counter[result[1].filename]++;
                        result[1].suites.should.equal(1);
                        result[1].tests.should.equal(5);
                        result[1].passes.should.be.equal(4); // should be 4 passes
                        result[1].failures.should.be.equal(1); // should be 1 failure
                    }
                }
                else {
                    // stop the test
                    ws.send(JSON.stringify(
                        {
                            test: 'simple,simpleCopy',
                            monitor: {
                                cmd: 'stop'
                            }
                        })
                    );
                    // after sending stop, wait 5s before completing test
                    setTimeout(() => {
                        done();
                    }, 5000);                    
                }
            }        
        });
    });
});



