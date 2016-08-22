'use strict';

const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo'),
    crypto = require('crypto');

// if marimo is installed in $project/node_modules/marimo, this will ensure a temp directory $project/node_modules/marimo/.marimo is created
const root = path.resolve(__dirname + `/../../../.marimo/${process.pid}`);

module.exports = {

    writeRemoteFile: function (url, body) {
        _checkRootDir();

        // get the filename (part after the last /)        
        let newFilename = root + url.match(/\/[^\/]+$/)[0];
        fs.writeFileSync(newFilename, body, 'utf8');                    

        return newFilename;
    },

    cleanup: function() {
        try { 
            var files = fs.readdirSync(root); 
        }
        catch(e) { 
            return; 
        }
        if (files.length > 0) {
            for (var i = 0; i < files.length; i++) {
                var filePath = path.join(root, files[i]);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
                else {
                    rmDir(filePath);
                }
            }
        }
        fs.rmdirSync(root);
    }
}

function _checkRootDir() {
    if (!fs.existsSync(root)){
        fs.mkdirSync(root);
    }        
} 