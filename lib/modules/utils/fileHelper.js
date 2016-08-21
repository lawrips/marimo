const fs = require('fs'),
    path = require('path'),
    debug = require('debug')('marimo');

const root = `.marimo/${process.pid}`;

module.exports = {

    writeRemoteFile: function (url, body) {
        _checkRootDir();

        // get the filename (part after the last /)        
        let newFilename = root + url.match(/\/[^\/]+$/)[0];
        fs.writeFileSync(newFilename, body, 'utf8');                    

        return newFilename;
    },

    createEnvFile: function(filename) {
        _checkRootDir();

        // get the filename (part after the last /)
        envFilename = root + filename.match(/\/[^\/]+$/)[0] + '_environment.json';
        fs.writeFileSync(envFilename, JSON.stringify(process.env), 'utf8');      
        return envFilename;                  
    },

    deleteEnvFile: function() {
        // cleanup after test run
        if (envFilename) {
            fs.unlink(envFilename);
        }      
    },

    cleanup: function() {
        debug(`cleaning up directory: ${root}`)
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
        debug(`cleanup complete: ${root}`)
    }
}

function _checkRootDir() {
    if (!fs.existsSync(root)){
        fs.mkdirSync(root);
    }        
} 