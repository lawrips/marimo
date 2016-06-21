'use strict';

// an example mocha test

const should = require('should');

describe('my amazing test suite', () => {
    it('a simple test', (done) => {
        var a = 2;
        var b = 2;
        a.should.be.equal(b);            
        done();
    });
    it('a second simple test', (done) => {
        var a = 4;
        var b = 2;
        var c = 2;
        a.should.be.equal(b + c);            
        done();
    });
    it('a third simple test', (done) => {
        var a = 16;
        var b = 4;
        var c = 4;
        a.should.be.equal(b * c);            
        done();
    });
});

