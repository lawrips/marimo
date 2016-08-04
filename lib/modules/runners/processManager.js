'use strict';

const path = require('path');
const fs = require('fs');
const debug = require('debug')('marimo');
const async = require('async');
const PortFinder = require('../utils/portFinder');

let portFinder = new PortFinder({basePort: process.env['marimo_basePort'], maxPort: process.env['marimo_maxPort'], portRange: process.env['marimi_portRange']});

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

// load files into env variables
try {
    process.env['marimo_resolved_test'] = JSON.stringify(require(path.resolve(process.env['marimo_test'])));
} catch (ex) {}    

try {
    process.env['marimo_resolved_env_file'] = JSON.stringify(require(process.env['marimo_env_file']));
} catch (ex) {
}    

let delay = process.env.marimo_delay;

let options = {                 
    env: JSON.parse(JSON.stringify(process.env))
};

// start by requesting a free port from the parent
process.send('command=getport');

function run(port) {
    options.execArgv = ['--debug=' + port]; 
//    options.silent = true;
    debug('Using port: ' + port);
    // create a child process & fork it
    let childProcess = require('child_process');
    let child  = childProcess.fork(script, options);

    // do this for tape
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
    // do this for everyone else
    child.on('message', (data) => {
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
                process.send('command=getport');
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

