'use strict';

const path = require('path');
const fs = require('fs');
const debug = require('debug')('marimo');
const async = require('async');

let script;

if (process.env['marimo_type'] == 'mocha') {
    script = path.join(path.dirname(fs.realpathSync(__filename)), './runMocha.js');
}
else if (process.env['marimo_type'] == 'postman') {
    script = path.join(path.dirname(fs.realpathSync(__filename)), './runNewman.js');
}
else {
    process.exit(0);
}

let delay = process.env.marimo_delay;
let alive = new Date()
let child;

// if we are monitoring
if (delay) {
    setInterval(() => {
        // see if we've run in the last n seconds'
        debug(`Last message on child process received ${(new Date().getTime() - alive.getTime()) / 1000}s ago. Compared to threshold of ${(Number.parseInt(delay) + Number.parseInt(process.env.marimo_timeout)) / 1000}s`);
        if (new Date().getTime() - alive.getTime() > (Number.parseInt(delay) + Number.parseInt(process.env.marimo_timeout))) {
            debug('Test took too long to respond, killing the process');
            alive = new Date();
            child.kill('SIGINT');
        }
    }, 60000);
}

let options = {                 
    env: JSON.parse(JSON.stringify(process.env))
};

// debug mode will be automatically detected based on whether the original node process was started with this option 
let debugMode = process.execArgv.map((arg) => arg.startsWith('--debug')).indexOf(true) > -1 ? true: false;

initialize();

function initialize() {
    if (debugMode) {
        // if debugging is enabled, we must first request a prot
        process.send('command=getport');
    }
    else {
        // no debug - we can just run 
        run();
    }    
}

function run(port) {
    if (debugMode) {
        options.execArgv = ['--debug=' + port];
        debug('Using port: ' + port);
    } 
    else {
        debug('Debugging disabled');        
    }

    // create a child process & fork it
    let childProcess = require('child_process');
    child  = childProcess.fork(script, options);

    // future functionality to support tape
//    options.silent = true;
/*    child.stdout.on('data', (data) => {
        try {
            let output = new Buffer(data).toString('utf-8');
            debug(output);
            process.send(output);
        } catch (ex) {
            debug(`error sending to websocket: ${ex}`);
        }
    });*/

    child.on('error', (err) => {
        debug(`error from childProcess: ${err}`);
        return callback(err);
    });

    // messages received back from child processes are sent to the websocket
    child.on('message', (data) => {
        alive = new Date();        
        try {
            process.send(data);
        } catch (ex) {
            debug(`error sending to websocket: ${ex}`);
        }
    });


    // exit callback once test is done
    child.on('exit', (code) => {
        var err = code === 0 ? null : new Error('exit code ' + code);
        
        // if this test was initialized with a delay, run it monitoring style
        if (delay) {
            setTimeout(() => {
                initialize();
            }, delay);
        }
        else {
            // otherwise finish this process
            process.exit(err);
        }
    });
}


// listen for stop messages from parent 
process.on('message', (m) => {
    if (m.split('=')[0] == 'port') {
        // free TCP port received from parent
        // run test with this port
        run(m.split('=')[1]);
    }
    else if (m == 'command=stop') {
        // stop 
        debug('received stop signal. exiting');
        process.exit(1);
    }
});

