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
    base64url = require('base64url');

const helper = require('./modules/helper');

// array to store a list of tokens 
// todo: back by redis

class Marimo {

    /**
     * Create a new instance of the marimo server 
     * @constructor
     * @param {Object} options - startup options passed to this instance
     * @param {string} [options.directory=./resources] -  Resource directory to locate the test files. Default is ./resources
     * @param {Number} [options.timeout=10000] - How long to wait in ms before failing a test due to timeout (default 10000)
     * @param {string} [options.auth] - An optional password. If set, HTTP auth negotiation is required (refer to documentation for howto) 
     * @param {Boolean} [options.env] - An optional boolean. If set to false, then environment variables passed to test will be ignored 
     */
    constructor(options) {
        // set options
        if (!options) options = {};
        this.timeout = options.timeout || 10000;
        this.directory = options.directory || './resources';
        this.auth = options.auth;
        this.env = options.env;

        // load tests
        this.tests = this._loadTests();

        // websocket server
        this.WebSocketServer = WebSocket.Server;
        this.wss = {};
        this.tokens = [];
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
            debug(`incoming WebSocket request success`);
            // send the list of available tests
            ws.send(JSON.stringify({availableTests: this.tests}));

            // listen for messages
            ws.on('message', (data, flags) => {                
                debug(`incoming WebSocket message: ${JSON.stringify(data)}`);
                // parse incoming message
                let message = JSON.parse(data);
                try {
                    // require the specified reporter
                    let Reporter = require('./reporters/' + message.reporter || 'basic');

                    let env;
                    // extract any environment variables if they were sent (unless its been explicitly disabled) 
                    if (this.env !== false && this.env !== 'false') {
                        env = message.env;
                    }

                    // run the test
                    this._run(ws, Reporter, message.test, env);                    

                } catch (err) {
                    // in the case of error loading the specific reporter
                    ws.send(`error loading reporter ${message.reporter}. err: ${err.message}`);
                    debug(`error requiring reporter ${message.reporter} with ${err.message}`);                    
                }
            });
        });

        // error handling
        this.wss.on('error', (err) => {
            debug('something went wrong: ' + err);
        });

    }

    _run(ws, Reporter, test, env) {
        // uncache mocha - this is a workaround for the fact that mocha stores test state once require-d
        helper.uncache('mocha');
        let Mocha = require('mocha');
        let Runner = Mocha.Runner;

        let mocha = new Mocha({ timeout: this.timeout });
        let environmentKeys = [];
        if (this.tests[test]) {
            // set any environment variables that were incoming
            if (env) {
                debug('setting incoming environment variables');
                Object.keys(env).forEach((key) => {
                    if (env[key] instanceof Object) {
                        debug(`set object ${test + '_' + key} = ${JSON.stringify(env[key])}`);
                        process.env[test + '_' + key] = JSON.stringify(env[key]);
                    }
                    else {
                        debug(`set object ${test + '_' + key} = ${env[key]}`);
                        process.env[test + '_' + key] = env[key];                        
                    }
                    environmentKeys.push(test + '_' + key);
                });
            }

            // add the files
            mocha.addFile(this.tests[test].file);
            // this is an async function but will execute fast enough that we don't need to wait for the callback
            mocha.loadFiles();
            debug(`successfully loaded mocha test file=${this.tests[test].file}`);

            debug(`beginning test run test=${test}`);
            // create a test runner & reporter and run the test
            var runner = new Runner(mocha.suite);
            new Reporter(runner, ws, environmentKeys);
            runner.run();
        }
        else {
            debug(`did not find file for mocha test=${test}`);
            ws.send(JSON.stringify({statusCode: 404}));
        }
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

