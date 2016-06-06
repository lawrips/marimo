'use strict';
// node modules
const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo'),
    WebSocket = require('ws');
    
const helper = require('./modules/helper');
   
// todo: enable auth
let auth = 'abcdefg';

class Marimo {
    /*
    * Options:
    { 
        directory // required: resource directory to locate the test files
        timeout // optional: how long to wait in ms before failing a test due to timeout (default 10000)
    }
    */
    constructor(options) {
        // resources
        if (!options) options = {};
        debug(options);
        this.timeout = options.timeout || 10000;
        this.directory = options.directory || './resources';
        this.tests = this._loadTests();

        // websocket server
        this.WebSocketServer = WebSocket.Server;
        this.wss = {};
        this.port = options.port || 7878;
    }

    initialize(callback) {
        this.wss = new this.WebSocketServer({ port: this.port, verifyClient: (info, callback) => _verifyClient(info, callback) });
        this.wss.on('connection', (ws) => {
            ws.on('message', (data, flags) => {
                
                let Reporter = require('./reporters/' + JSON.parse(data).reporter);
                this.run(ws, Reporter, JSON.parse(data).test);
            });
        });

        // error handling
        this.wss.on('error', (err) => {
            debug('something went wrong: ' + err);
        });

    }

    run(ws, Reporter, test) {
        // uncache mocha - this is a workaround for the fact that mocha stores test state once require-d
        helper.uncache('mocha');
        let Mocha = require('mocha');

        let mocha = new Mocha({ timeout: this.timeout });
        mocha.addFile(this.tests[test]);
        let count = 0;

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
            tests[file.slice(0, file.length - 3)] = path.join(this.directory, file);
        });
        return tests;
    }
}

module.exports = Marimo;


debug('listening on web socket');
let count = 0;


function _verifyClient(info, callback) {
    // optional authorization
    // currently support only basic http 
    debug(info.req.headers.authorization)
    /*    if (auth && ('Basic ' + auth) != info.req.headers.authorization) {
            debug(`Unauthorized client connection for ${info.req.url}. Rejecting 401`)
            return callback(false, 401, "unauthorized");
        }*/
    return callback(true);
}

