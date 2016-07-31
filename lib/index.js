'use strict';
// node modules
const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo'),
    WebSocket = require('ws'),
    url = require('url'),
    express = require('express'),
    crypto = require('crypto'),
    queryString = require('query-string'),
    base64url = require('base64url'),
    async = require('async'),
    http = require('http');

const PortFinder = require('./modules/utils/portFinder'),
    FileLoader = require('./modules/loaders/fileLoader'),
    defaults = require('./modules/utils/defaults');

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
        this.timeout = options.timeout || defaults.timeout;
        this.directory = options.directory || defaults.directory;
        this.auth = options.auth;
        this.env = options.env === false ? false : true;

        // load tests
        this.loader = new FileLoader(this.directory);
        let loaded = this.loader.loadTests();
        this.tests = loaded.tests;
        this.environments = loaded.environments;

        // websocket server and webserver
        this.WebSocketServer = WebSocket.Server;
        this.server = http.createServer();
        this.app = express(),

        this.wss = {};
        this.tokens = [];
        
        // monitoring tests (these run perpetually)
        this.monitors = [];
        this.processes = {};

        // advanced mode (only change this if the default port of 12141 is being used)
        this.basePort = options.debugPort || defaults.basePort;
        this.portRange = options.debugPortRange || defaults.portRange;        
        this.maxPort = this.basePort + this.portRange;
        this.portFinder = new PortFinder({basePort: this.basePort, maxPort: this.maxPort, portRange: this.portRange});

        // created a stubbed WS. This will be used for monitor-style tests, to broadcast to all connected websockets
        this.monitorWs = {
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
        this.server.on('request', this.app);
        this.server.listen(port,  () => { 
            debug('Listening on ' + this.server.address().port) 
            if (callback) {
                return callback(null, this.server.address().port);
            }
        });

        // register http based auth route 
        this.app.get('/auth', (req, res) => {
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
        this.wss = new this.WebSocketServer({ server: this.server, verifyClient: (info, callback) => this._verifyClient(info, callback) });
        this.wss.on('connection', (ws) => {
            let params = ws.upgradeReq.url.replace('/?', '');
            // see if requesting client wants to listen for monitor tests only
            let monitor = queryString.parse(params).monitor || false; 

            debug(`incoming WebSocket request success`);
            if (monitor) {
                ws.send(JSON.stringify({
                    availableTests: this.tests, 
                    availableEnvironments: this.environments,
                    monitoringTests: Object.keys(this.processes).join(',')
                }));

                this.monitors.push(ws);
            }
            else {
                // send the list of available tests
                ws.send(JSON.stringify({availableTests: this.tests, availableEnvironments: this.environments}));
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
                    let env = JSON.parse(JSON.stringify(process.env));
                    
                    // extract any environment variables if they were sent (unless its been explicitly disabled) 
                    if (this.env !== false && this.env !== 'false') {
                        // merge them with environment variables
                        env = Object.assign(env, message.env);
                    }

                    // if this request to start a monitor style test 
                    if (message.monitor) {
                        if (message.monitor.cmd == 'start') {                            
                            // run each test contained in the tests string (e.g. tests='simple,complex')
                            async.map(message.test.split(','), (test, mapCallback) => {
                                // if test is already running, just return
                                if (this.processes[test]) return mapCallback();
                                
                                // otheriwse, start the test
                                this._run(this.monitorWs, env, test, message.envFile, message.reporter, message.monitor.delay || 5000, (err) => {
                                    if (err) debug(`error while running ${test}: ${err}`);
                                    debug(`finished running ${test}`);
                                    return mapCallback();
                                });
                            }, (err, results) => {
                                debug(`Finished running tests`);
                            });                 

                        }
                        else if (message.monitor.cmd == 'stop') {
                            // stop the existing monitor test
                            async.map(message.test.split(','), (test) => {
                                // send a stop command to the process
                                this.processes[test].send('command=stop');
                                // remove the process from tracking
                                delete this.processes[test];
                            });
                        }
                    }
                    else {
                        // now start test                         
                        async.map(message.test.split(','), (test, mapCallback) => {
                            this._run(ws, env, test, message.envFile, message.reporter, null, (err) => {
                                if (err) debug(`error while running ${test}: ${err}`);
                                debug(`finished running ${test}`);
                                return mapCallback();
                            });
                        }, (err, results) => {
                            debug(`Finished running tests`);
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


    _run(ws, env, test, envFile, reporter, delay, callback) {
        // iterate through multiple if there is a comma separated list of tests
        // check the test exists
        env = JSON.parse(JSON.stringify(env));
        if (!this.tests[test]) {
            debug(`did not find file for mocha test=${test}`);
            ws.send(JSON.stringify({statusCode: 404}));
            return callback(new Error({statusCode: 404}));
        }
        // load the script
        let script = path.join(path.dirname(fs.realpathSync(__filename)), './modules/runners/processManager.js');
        
        // create environment variables that will be passed to the child process
        env.marimo_test = this.tests[test].file;
        env.marimo_type = this.tests[test].type;
        env.marimo_reporter = reporter || defaults.reporter;
        env.marimo_timeout = this.timeout;
        if (delay) {
            env.marimo_delay = delay;
        }
        env.marimo_basePort = this.basePort;
        env.marimo_maxPort = this.maxPort;
        env.marimo_portRange = this.portRange;
        if (this.environments[envFile]) {
            env.marimo_env_file = this.environments[envFile].file;
        }
        
        let options = {                 
            env: env
        };
    
        this.portFinder.getFreePort((err, port) => {
            if (err) {
            	return callback(err);
            }

            options.execArgv = ['--debug=' + port]; 
            
            // create a child process & fork it
            let childProcess = require('child_process');
            let process = childProcess.fork(script, options);
            
            if (delay) {
                // if it's a monitoring style test, track it
                this.processes[test] = process;
            }

            process.on('error', function (err) {
                debug(`error from childProcess: ${err}`);
                return callback(err);
            });

            // receive messages from child process
            process.on('message', (data) => {                
                if (data == 'command=getport') {
                    // system messages 
                    this.portFinder.getFreePort((err, port) => {
                        process.send('port=' + port);
                    })
                }
                else {
                    // messages received back from child processes are sent to the websocket
                    try {
                        ws.send(data);
                    } catch (ex) {
                        debug(`error sending to websocket: ${ex}`);
                    }
                }
            });

            // exit callback once test is done
            process.on('exit', function (code) {
                var err = code === 0 ? null : new Error('exit code ' + code);
                return callback();
            });

        });
    }            

    addFile(file) {
        let loaded = this.loader.addFile(file);
        Object.keys(loaded).forEach((key) => {
            this.tests[key] = loaded.tests[key]; 
        });
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

