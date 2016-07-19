'use strict';

const path = require('path');
const fs = require('fs');
const debug = require('debug')('marimo');
const async = require('async');
const PortFinder = require('./portFinder');

let portFinder = new PortFinder({basePort: process.env['marimo_basePort'], maxPort: process.env['marimo_maxPort'], portRange: process.env['marimi_portRange']});

let script = path.join(path.dirname(fs.realpathSync(__filename)), './runMocha.js');
    
let delay = process.env.marimo_delay;

let options = {                 
    env: JSON.parse(JSON.stringify(process.env))
};

// start by requesting a free port from the parent
process.send('command=getport');

function run(port) {
    options.execArgv = ['--debug=' + port]; 
    debug('Using port: ' + port);
    // create a child process & fork it
    let childProcess = require('child_process');
    let child  = childProcess.fork(script, options);

    child.on('error', (err) => {
        debug(`error from childProcess: ${err}`);
        return callback(err);
    });

    // messages received back from child processes are sent to the websocket
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
