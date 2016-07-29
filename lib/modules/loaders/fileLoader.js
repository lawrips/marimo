'use strict';

const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo');    

const requireCache = require('../utils/require');

class FileLoader {
    constructor(directory) {
        this.tests = {};
        this.environments = {};
        this.directory = directory;
    }

    loadTests() {
        // uncache mocha - this is a workaround for the fact that mocha stores test state once require-d
        requireCache.uncache('mocha');
        let Mocha = require('mocha');
        let mocha = new Mocha({ timeout: this.timeout });

        //try {
            // Add each .js file to the mocha instance
            fs.readdirSync(this.directory).forEach((file) => {
                debug(`initialize: loading test file=${file}`);
                
                if (file.substr(-3) === '.js') {
                    this._loadMochaFile(mocha, file);
                }
                else if (file.substr(-5) === '.json') {
                    this._loadPostmanFile(file);
                }
            });

            // this is an async function but will execute fast enough that we don't need to wait for the callback
            mocha.loadFiles();
            debug('initialize: all tests loaded')
            // once the tests are loaded, inspect them to get the test description
            // first mocha
            mocha.suite.suites.forEach((suite) => {
                // store the description        
                this.tests[suite.file.substr(suite.file.lastIndexOf('/') + 1)].description = suite.title
            });

            debug('initialize: loaded test descriptions');
        //} catch (ex) {
         //   debug('error on loading tests: ' + ex);
        //}

        return {tests: this.tests, environments: this.environments};
    }

    addFile(file) {
        console.log(file);
        requireCache.uncache('mocha');
        let Mocha = require('mocha');
        let mocha = new Mocha({ timeout: this.timeout });

        if (file.substr(-3) === '.js') {
            this._loadMochaFile(mocha, file, true);
        }
        else if (file.substr(-5) === '.json') {
            this._loadPostmanFile(file, true);
        }        

        // this is an async function but will execute fast enough that we don't need to wait for the callback
        mocha.loadFiles();
        debug('initialize: all tests loaded')
        // once the tests are loaded, inspect them to get the test description
        // first mocha
        mocha.suite.suites.forEach((suite) => {
            // store the description        
            this.tests[suite.file.substr(suite.file.lastIndexOf('/') + 1)].description = suite.title
        });

        debug('initialize: loaded test descriptions')

        return {tests: this.tests, environments: this.environments};
    }

    _loadMochaFile(mocha, file, nodir) {
        let filename = file.slice(0, file.length - 3);
        let testname = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/') + 1, file.length - 3) : filename;
        let test = nodir ? filename : path.join(this.directory, filename);
        mocha.addFile(test);
        // store the filename            
        this.tests[testname] = {
            file: test,
            type: 'mocha'
        }    
    }

    _loadPostmanFile(file, nodir) {
        let filename = file.lastIndexOf('/') > -1 ? file.slice(file.lastIndexOf('/'), file.length - 5) : file.slice(0, file.length - 5);
        let test = nodir ? filename : path.join(this.directory, filename);
        let json = JSON.parse(fs.readFileSync(test + '.json'));
        // check the json format looks like a postman test
        if (json.info && json.item) {
            // file looks good, continue
            // store the filename            
            this.tests[filename] = {
                file: test,
                type: 'postman',
                // grab the description while we are at it
                description: json.info.description
            }            
        }
        else {
            // treat the file like a regular json file
            let filename = file.slice(0, file.length - 5);
            // store the filename            
            this.environments[filename] = {file: test, name: json.name};
        }
    }
}

module.exports = FileLoader;