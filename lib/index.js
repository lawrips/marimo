'use strict';
// node modules
const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo'),
    WebSocket = require('ws'),
    server = require('http').createServer(),
    url = require('url'),
    express = require('express'),
    app = express(),
    crypto = require('crypto'),
    queryString = require('query-string'),
    base64url = require('base64url'),
    async = require('async');

const helper = require('./modules/helper'),
    PortFinder = require('./modules/portFinder');

// array to store a list of tokens 
// todo: back by redis

class Marimo {

    /**
     * Create a new instance of the marimo server 
     * @constructor
     * @param {Object} options - startup options passed to this instance
     * @param {string} [options.directory=./resources] -  Resource directory to locate the test files. Default is ./resources
     * @param {Number} [options.timeout=10000] - How long to wait in ms before failing a test due to timeout (default 10000)
     * @param {Number} [options.debugPort=12141] - The starting port which will be used for the debugger when launching mocha
     * @param {Number} [options.debugPortRange=100] - The number of ports available to cycle through mocha tests (to avoid port collisions)  
     * @param {string} [options.auth] - An optional password. If set, HTTP auth negotiation is required (refer to documentation for howto) 
     * @param {Boolean} [options.env] - An optional boolean. If set to false, then environment variables passed to test will be ignored 
     */
    constructor(options) {
        // set options
        if (!options) options = {};
        this.timeout = options.timeout || 10000;
        this.directory = options.directory || './resources';
        this.auth = options.auth;
        this.env = options.env === false ? false : true;

        // load tests
        this.tests = this._loadTests();

        // websocket server
        this.WebSocketServer = WebSocket.Server;
        this.wss = {};
        this.tokens = [];
        
        // monitoring tests (these run perpetually)
        this.monitors = [];
        this.monitorOptions = {};
        // advanced mode (only change this if the default port of 12141 is being used)
        this.portFinder = new PortFinder({basePort: options.debugPort || 12141, maxPort: (options.debugPort || 12141) + (options.debugPortRange || 100)});
    }

    /**
     * Callback when the marimo server has successfully started
     * @callback startedCallback
     * @param {Object} err - the error if startup failed 
     * @param {Number} port - the port on which the server is listening following successful startup  
     */

    /**
     * Start the marimo server and listen on the supplied port
     * @param {Number} port - The TCP port to listen on
     * @param {startedCallback} callback - The callback following startup
     */

    listen(port, callback) {
        // create web server
        server.on('request', app);
        server.listen(port,  () => { 
            debug('Listening on ' + server.address().port) 
            if (callback) {
                return callback(null, server.address().port);
            }
        });

        // register http based auth route 
        app.get('/auth', (req, res) => {
            // if auth was not set OR auth - always respond succcess
            debug('received incoming http request to /auth');
            if (!this.auth) {
                debug('no password set - automatically authorizing');
                return res.send({});
            }
            else if (req.headers['authorization'] == 'basic ' + this.auth) {
                // successfully auth'd
                let token = base64url(crypto.randomBytes(64).toString('base64'));
                debug(`successfully authorized request. token: ${token}`);
                this.tokens.push(token);
                
                return res.send(token);
            }
            debug(`unsuccessful authorization request`);
            return res.status(401).end();
        });

        // create WebSocket server
        this.wss = new this.WebSocketServer({ server: server, verifyClient: (info, callback) => this._verifyClient(info, callback) });
        this.wss.on('connection', (ws) => {
            let params = ws.upgradeReq.url.replace('/?', '');
            // see if requesting client wants to listen for monitor tests only
            let monitor = queryString.parse(params).monitor || false; 

            debug(`incoming WebSocket request success`);
            if (monitor) {
                ws.send(JSON.stringify({
                    availableTests: this.tests, 
                    monitoringTests: this.monitorOptions.test ? this.monitorOptions.test.primary : null}));
                this.monitors.push(ws);
            }
            else {
                // send the list of available tests
                ws.send(JSON.stringify({availableTests: this.tests}));
            }

            // listen for messages. format is:
            /* 
            {
                reporter: reporter,
                test: test,
                monitor: {
                    cmd: [start|stop],
                    delay: 1000
                }
            }
            */
            ws.on('message', (data, flags) => {                
                debug(`incoming WebSocket message: ${JSON.stringify(data)}`);
                // parse incoming message
                let message = JSON.parse(data);
                try {                    
                    // inherit this process' environment options
                    let env = process.env;

                    // extract any environment variables if they were sent (unless its been explicitly disabled) 
                    if (this.env !== false && this.env !== 'false') {
                        // merge them with environment variables
                        env = Object.assign(env, message.env);
                    }

                    // if this request to start a monitor style test 
                    if (message.monitor) {
                        if (message.monitor.cmd == 'start') {
                            this._startMonitorTest(ws, env, message.test, message.reporter, message.monitor.delay);
                        }
                        else if (message.monitor.cmd == 'stop') {
                            // stop the existing monitor test
                            this.stop = true;
                            this.monitorOptions.test.primary = null;
                        }
                    }
                    else {
                        // regular "run once" tests                         
                        this._runOnce(ws, env, message.test, message.reporter, (err) => {
                            if (err) debug(`error while running ${message.test}: ${err}`);
                            debug(`finished running ${message.test}`);
                        });
                    }
                } catch (err) {
                    // in the case of error loading the specific reporter
                    ws.send(`error. err: ${err}`);
                    debug(`error. err: ${err}`);  
                }
            });
        });

        // error handling
        this.wss.on('error', (err) => {
            debug('something went wrong: ' + err);
        });
    }

    _runOnce(ws, env, tests, reporter, callback) {

        // iterate through multiple if there is a comma separated list of tests
        async.mapSeries(tests.split(','), (test, mapCallback) => {
            // check the test exists
            if (!this.tests[test]) {
                debug(`did not find file for mocha test=${test}`);
                ws.send(JSON.stringify({statusCode: 404}));
                return mapCallback(new Error({statusCode: 404}));
            }
            // load the script
            let script = path.join(path.dirname(fs.realpathSync(__filename)), './modules/runMocha.js');
            
            // create environment variables that will be passed to the child process
            env.marimo_test = this.directory + '/' + test;
            env.marimo_reporter = reporter;
            env.marimo_timeout = this.timeout;
            
            this.portFinder.getFreePort((err, port) => {
                if (err) {
                    return callback(err);
                }
                debug('Using port: ' + port);
                let options = {                 
                    execArgv: ['--debug=' + port], 
                    env: env
                };
                // create a child process & fork it
                let childProcess = require('child_process');
                let process = childProcess.fork(script, options);

                process.on('error', function (err) {
                    debug(`error from childProcess: ${err}`);
                    return mapCallback(err);
                });

                // messages received back from child processes are sent to the websocket
                process.on('message', (data) => {
                    try {
                        ws.send(data);
                    } catch (ex) {
                        debug(`error sending to websocket: ${ex}`);
                    }
                });

                // exit callback once test is done
                process.on('exit', function (code) {
                    var err = code === 0 ? null : new Error('exit code ' + code);
                    return mapCallback();
                });
            });
        }, (err, results) => {
            debug(`Finished running tests`);
            return callback(err);
        });                 
    }

    _startMonitorTest(ws, env, test, reporter, delay) {
        this.stop = false;
        // create a mock to replace the regular websocket. this overrides ws.send and will send to an array of connected websockets (i.e. broadcast)  
        let monitorWs = {
            monitors: this.monitors,
            send: (message) => {
                // iterate through all our monitoring websockets
                for (let i=this.monitors.length -1; i>=0; i--) {
                    try {
                        // send the result of the test to each one
                        this.monitors[i].send(message);
                    } catch (ex) {
                        // if there is an error sending to one (e.g. ws was disconnected), remove it
                        debug(ex);
                        this.monitors.splice(i,1);
                    }
                };
            }
        }

        // save options for the long running test
        this.monitorOptions = {
            test: {
                // the main test to run
                primary: !this.running ? test : this.monitorOptions.test.primary || test,
                // if a test is already running, save this test to run after 
                secondary: this.running ? test : null 
            },
            env: env,
            reporter: reporter,
            // the array of connected websockets who will be broadcast to
            ws: monitorWs,
            delay: delay || 5000
        };

        // check if there is already a test in progress
        if (!this.running) {
            this.running = true;

            // no test in progress, start the test once immediately
            this._runOnce(this.monitorOptions.ws, this.monitorOptions.env, this.monitorOptions.test.primary, reporter, (err) => {
                // once it's completed, begin the loop
                this._runAlways();
            });
        }
        
    }

    // recursive function which will keep a monitor style test alive
    _runAlways() {
        this.monitorFunc = setTimeout(() => {
            if (this.stop) {
                // if we received a stop message then set running to false to let other tests know they can run
                this.running = false;
            }
            else {
                // no stop command currently executed so keep going
                this.running = true;
                this._runOnce(this.monitorOptions.ws, this.monitorOptions.env, this.monitorOptions.test.primary, this.monitorOptions.reporter, (err) => {
                    // check to see if there is an alternative test waiting to run
                    this.monitorOptions.test.primary = this.monitorOptions.test.secondary || this.monitorOptions.test.primary;
                    this.monitorOptions.test.secondary = null;  

                    // recurse / start over
                    this._runAlways();                    
                });
            }
        }, this.monitorOptions.delay);
    }
            
    _loadTests() {
        let tests = {};
        // uncache mocha - this is a workaround for the fact that mocha stores test state once require-d
        helper.uncache('mocha');
        let Mocha = require('mocha');
        let mocha = new Mocha({ timeout: this.timeout });

        // Add each .js file to the mocha instance
        fs.readdirSync(this.directory).filter((file) => {
            // Only keep the .js files
            return file.substr(-3) === '.js';

        }).forEach((file) => {
            debug(`initialize: loading test file=${file}`);

            let filename = file.slice(0, file.length - 3);
            let test = path.join(this.directory, filename);
            mocha.addFile(test);
            // store the filename            
            tests[filename]  = {
                file: test,
            }
        });

        // this is an async function but will execute fast enough that we don't need to wait for the callback
        mocha.loadFiles();
        debug('initialize: all tests loaded')
        // once the tests are loaded, inspect them to get the test description
        mocha.suite.suites.forEach((suite) => {
            // store the description        
            tests[suite.file.substr(suite.file.lastIndexOf('/') + 1)].description = suite.title
        });
        debug('initialize: loaded test descriptions')

        return tests;
    }

    _verifyClient(info, callback) {
        // check if authorization was set, if so - look for a valid token
        let params = info.req.url.replace('/?', '');
        if (this.auth && this.tokens.indexOf(queryString.parse(params).token) == -1) {
            debug(`Unauthorized client connection for ${info.req.url}. Rejecting 401`)
            return callback(false, 401, "unauthorized");
        }
        return callback(true);
    }

}

module.exports = Marimo;

