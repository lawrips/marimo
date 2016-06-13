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
     * @param {number} [options.timeout=10000] - How long to wait in ms before failing a test due to timeout (default 10000)
     * @param {string} [options.auth] - An optional password. If set, HTTP auth negotiation is required (refer to documentation for howto) 
     */
    constructor(options) {
        // set options
        if (!options) options = {};
        this.timeout = options.timeout || 10000;
        this.directory = options.directory || './resources';
        this.auth = options.auth;

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
     * @param {number} port - the port on which the server is listening following successful startup  
     */

    /**
     * Start the marimo server and listen on the supplied port
     * @param {number} port - The TCP port to listen on
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
            return res.status(401);
        });

        // create web socket server
        this.wss = new this.WebSocketServer({ server: server, verifyClient: (info, callback) => this._verifyClient(info, callback) });
        this.wss.on('connection', (ws) => {
            debug(`incoming web socket request success`);
            // send the list of available tests
            ws.send(JSON.stringify({availableTests: Object.keys(this.tests)}));

            // listen for messages
            ws.on('message', (data, flags) => {                
                debug(`incoming web socket message: ${JSON.stringify(data)}`);
                let Reporter = require('./reporters/' + JSON.parse(data).reporter);
                this._run(ws, Reporter, JSON.parse(data).test);
            });
        });

        // error handling
        this.wss.on('error', (err) => {
            debug('something went wrong: ' + err);
        });

    }

    _run(ws, Reporter, test) {
        // uncache mocha - this is a workaround for the fact that mocha stores test state once require-d
        helper.uncache('mocha');
        let Mocha = require('mocha');

        let mocha = new Mocha({ timeout: this.timeout });
        mocha.addFile(this.tests[test]);
        debug(`successfully loaded mocha test file=${this.tests[test]}`);
        let count = 0;

        debug(`beginning test run test=${test}`);
        // once we have a web socket client connected
        new Reporter(mocha.run(), ws);
    }

    _resetTests(suite) {
        suite.tests.forEach((t) => {
            delete t.state;
            t.timedOut = false;
        });
        suite.suites.forEach((suite) => this._resetTests(suite) );
    }
    
    _loadTests() {
        let tests = {};
        // Add each .js file to the mocha instance
        fs.readdirSync(this.directory).filter((file) => {
            // Only keep the .js files
            return file.substr(-3) === '.js';

        }).forEach((file) => {
            debug(`loading test file=${file}`);
            tests[file.slice(0, file.length - 3)] = path.join(this.directory, file);
        });
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

