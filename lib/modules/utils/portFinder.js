'use strict';

const portfinder = require('portfinder'),
    async = require('async'),
    debug = require('debug')('marimo');

class PortFinder {
    constructor(options) {
        // the starting port
        this.basePort = options.basePort;
        // the max port we can reach (before wrapping around)
        this.maxPort = options.maxPort;
        this.port = this.basePort;

        // use a queue to ensure parallel requests for a port can't be made (can create bad race conditions)
        this.portQueue = async.queue((task, callback) => {
            // dequeue a request for port
            // increment the port from last time and check that it's not higher than the max port
            if (this.port++ > this.maxPort) {
                // if we have exceeded, wrap around 
                this.port = this.basePort;
            }
            // set the base port now to search for an available port (as it could still be in use)
            portfinder.basePort = this.port;

            // find a free port from the system, starting at this starting point
            portfinder.getPort((err, port) => {
                // remember the port we set and set it back
                this.port = port;
                task.callback(err, port);
                return callback();
            });        
        });

        this.portQueue.drain = function() {
            debug('all port requests fulfilled');
        };

    }

    getFreePort(callback) {
        // queue the request for a port
        this.portQueue.push({callback: callback});
    }    
}

module.exports = PortFinder;