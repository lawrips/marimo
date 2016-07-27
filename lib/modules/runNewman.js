'use strict';

const debug = require('debug')('marimo');
const fs = require('fs');

const Newman = require('newman');

Newman.run({
    environment: require('../../resources/dev.json').values,
    collection: require('../../resources/' + process.env['marimo_test']),
    reporters: '../../../../lib/reporters/postman/' + (process.env['marimo_reporter'] || 'basic')
}, function (err) {
    if (err) { throw err; }
    console.log('collection run complete!');
});