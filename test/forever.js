'use strict';

const should = require('should'),
    proxyquire = require('proxyquire'),
    WebSocket = require('ws'),
    path = require('path'),
    fs = require('fs'),
    Marimo = require('../lib/index'),
    http = require('request'),
    debug = require('debug')('marimo-test');

const filename = 'simple.js';
let testname = filename.slice(0,filename.length-3);

// change this to the # of times you want to run a test for (can be a v large nuber for stability tests)
const numTimes = 10;

describe('marimo e2e test that runs perpatually (to test stability)', () => {
    before('start a marimo servers ', (done) => {        

        let marimo = new Marimo({debugPort: 15100, directory: path.dirname(fs.realpathSync(__filename))});
        marimo.listen(15000);
        done(); 
    });


    it('start a monitor style test and let it run ' + numTimes + ' iterations', (done) => {
        var ws = new WebSocket(`ws://localhost:15000/?monitor=true`);        

        ws.on('open', () => {
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'simple',
                    env: {'hello':'world'},
                    monitor: {
                        cmd: 'start',
                        delay: 200
                    }
                })
            );            
            ws.send(JSON.stringify(
                {
                    reporter: 'json-stream-detail',
                    test: 'simpleCopy',
                    env: {'hello':'world'},
                    monitor: {
                        cmd: 'start',
                        delay: 50
                    }
                })
            );            
        });

        var started = false;
        var counter = {'simple':0, 'simpleCopy':0};

        ws.on('message', (data, flags) => {
            var result = JSON.parse(data);
            if (!result.availableTests) {
                if (counter['simple'] < numTimes || counter['simpleCopy'] < numTimes) {
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
                        debug(`completed run # ${JSON.stringify(counter)}`);
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
                    // after sending stop, wait 1s before completing test
                    setTimeout(() => {
                        done();
                    }, 1000);
                    
                }
            }        
        });
    });


});



