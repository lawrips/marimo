'use strict';

const should = require('should'),
    WebSocket = require('ws'),
    path = require('path'),
    fs = require('fs'),
    Marimo = require('../../lib/index'),
    http = require('request'),
    debug = require('debug')('marimo-test');

let filename = 'simple.js';
let testname = filename.slice(0, filename.length - 3);

let marimo;

describe('marimo e2e adding files tests', () => {
    it('start a single marimo server with an incorrect directory specified. startup should fail', (done) => {        

        try {
            let marimo = new Marimo({debugPort: 13100, directory: './afakedir'});
        } catch (ex) {
            should.exist(ex);
            done(); 
        }
    });

    describe('mocha tests', () => {
        it('start a marimo server with directory specified', (done) => {

            marimo = new Marimo({ debugPort: 13100, directory: './test/samples/mocha' });
            marimo.listen(13000);
            done();
        });

        it('start the simple mocha test and reference environment variable file. check succeeeded', (done) => {
            marimo.addFile('./test/samples/envFiles/simpleEnv.json');

            var ws = new WebSocket(`ws://localhost:13000`);

            ws.on('open', () => {
                ws.send(JSON.stringify(
                    {
                        reporter: 'json-stream-detail',
                        test: 'simple',
                        env: 'simpleEnv'
                    })
                );
            });

            var started = false;
            ws.on('message', (data, flags) => {
                try {
                    var result = JSON.parse(data);
                } catch (ex) {
                    debug(ex);
                    should.not.exist(ex);
                }

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
    });

    describe('postman tests', () => {
        it('add wikipedia test and env file', (done) => {
            marimo.addFile('./test/samples/postman/wikipedia.json');
            marimo.addFile('./test/samples/envFiles/wikipediaEnv.json');
            done();
        });


        it('start the wikipedia postman test and send environment variables. check succeeeded', (done) => {
            var ws = new WebSocket(`ws://localhost:13000`);

            ws.on('open', () => {
                ws.send(JSON.stringify(
                    {
                        reporter: 'json-stream-detail',
                        test: 'wikipedia',
                        env: 'wikipediaEnv'
                    })
                );
            });

            var started = false;
            ws.on('message', (data, flags) => {
                try {
                    var result = JSON.parse(data);
                } catch (ex) {
                    debug(ex);
                    should.not.exist(ex);
                }

                if (!result.availableTests) {
                    if (!started) {
                        result[0].should.equal('start');
                        started = true;
                    }
                    else if (result[0] == 'end') {
                        result[1].suites.should.equal(1);
                        result[1].tests.should.equal(4);
                        result[1].passes.should.be.equal(4); // should be 4 passes
                        result[1].failures.should.be.equal(0); // should be 0 failure
                        done();
                    }
                }
            });
        });
    });
});