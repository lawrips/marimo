'use strict';

const debug = require('debug')('marimo');
const fs = require('fs');

const Newman = require('newman');

Newman.run({
    environment: require('../../resources/dev.json').values,
    collection: require('../../resources/existingUser.json'),
    reporters: '../../../../lib/reporters/postman/basic'
}, function (err) {
    if (err) { throw err; }
    console.log('collection run complete!');
});