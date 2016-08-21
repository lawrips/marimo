'use strict';

const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo'),
    recursive = require('recursive-readdir-sync'),
    request = require('request'),
    async = require('async');

const requireCache = require('../utils/require'),
    defaults = require('../utils/defaults');

class FileLoader {
    constructor(directory) {
        this.tests = {};
        this.environments = {};
        this.directory = directory;
    }

    loadTests() {
        try {
            // Add each .js file to the mocha instance
            recursive(this.directory).forEach((file) => {
                this._loadFile(file, false);
            });

            // this is an async function but will execute fast enough that we don't need to wait for the callback
            mocha.loadFiles();
            debug('initialize: all tests loaded')
            this._loadMochaDescriptions(mocha);                
        } catch (ex) {
            // if directory was set, it must exist
            if (this.directory != defaults.directory) 
            {
                // directory was set and not found, throw exception
                let error = `error on loading tests from directory ${this.directory}. Constructor must be initialized with a valid 'directory' property to load local tests. Error: ${ex}`; 
                throw new LoadException(error);
            }
            else {
                // direcotry was not set and not found, just continue
                let error = `error on loading tests from directory ${this.directory}. Marimo will continue but requires ./resources directory to exist, or constructor must be initialized with a valid 'directory' property to load local tests. Error: ${ex}`; 
                debug(`${error}`);
            }
        }

        return {tests: this.tests, environments: this.environments};
    }

    addFile(file, callback) {
        this._loadFile(file, true, callback);

        return {tests: this.tests, environments: this.environments};
    }

    _loadFile(file, nodir, callback) {
        debug(`initialize: loading test file=${file}`);
        if (file.substr(-3) === '.js') {
            this._loadMochaFile(file, nodir, callback);
        }
        else if (file.substr(-5) === '.json') {
            this._loadPostmanFile(file, nodir, callback);
        }
        else {
            debug(`file type not recognized for ${file}. Ignoring`);
        }
    }

    _loadMochaFile(file, nodir, callback) {
        // was required previously when we used a single process to run all mocha tests. todo to double check still needed
        requireCache.uncache('mocha');
        let Mocha = require('mocha');
        let mocha = new Mocha({ timeout: this.timeout });

        async.waterfall([(next) => {
            _fetchIfRemote(file, next);
        }, 
        (remoteFile, next) => {
            // if we downloaded a file over http, make use of it here 
            file = remoteFile || file;
            // continue as normal
            let filename = file.slice(0, file.length - 3);
            let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length - 3) : filename;
            mocha.addFile(filename);

            // store the filename            
            this.tests[testname] = {
                file: filename,
                type: 'mocha'
            }    

            // this is an async function but will execute fast enough that we don't need to wait for the callback
            mocha.loadFiles();
            debug(`initialize: mocha test ${file} loaded`)
            this._loadMochaDescriptions(mocha);
        }], (err, success) => {
            if (err && callback) return callback(err);
        });
    }

    _loadPostmanFile(file, nodir, callback) {
        async.waterfall([(next) => {
            _fetchIfRemote(file, next);
        }, 
        (remoteFile, next) => {
            // if we downloaded a file over http, make use of it here 
            file = remoteFile || file;
            let filename = file.slice(0, file.length - 5);
            let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length - 5) : filename;

            let json = JSON.parse(fs.readFileSync(file));
            // check the json format looks like a postman test
            if (json.info && json.item) {
                // file looks good, continue
                // store the filename            
                this.tests[testname] = {
                    file: filename,
                    type: 'postman',
                    // grab the description while we are at it
                    description: json.info.description
                }            
            }
            else {
                // treat the file like a regular json file (which will be a postman resource / environment variables file)
                let filename = file.slice(0, file.length - 5);
                let resourceName = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length - 5) : filename;
                // store the filename            
                this.environments[resourceName] = {file: filename, name: json.name};
            }
            debug(`initialize: postman test ${file} loaded`)
        }], (err, success) => {
            if (err && callback) return callback(err);
        });
    }

    _loadMochaDescriptions(mocha) {
        // once the tests are loaded, inspect them to get the test description
        // first mocha
        mocha.suite.suites.forEach((suite) => {
            // store the description        
            this.tests[suite.file.substr(suite.file.lastIndexOf('/') + 1)].description = suite.title
        });

        debug('initialize: loaded test descriptions')        
    }    
}

function LoadException(message) {
    this.message = message;
    this.name = 'LoadException';        
}

function _fetchIfRemote(file, callback) {
    if (file.startsWith('http://') || file.startsWith('https://')) {
        request(file, (err, response, body) => {
            if (err || (response && response.statusCode != 200)) return callback(err || new Error(body), null);
            let newFilename = '.marimo/' + file.match(/\/[^\/]+$/);
            fs.writeFileSync(newFilename, body, 'utf8');                    
            return callback(null, newFilename);
        });
    }
    else {
        return callback(null, null);
    }
}

module.exports = FileLoader;