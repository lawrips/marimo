'use strict';

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
    it('test environment variable', (done) => {    
        process.env['hello'].should.be.equal('world');            
        done();
    });
    it('a test designed to fail', (done) => {
        var a = 1;
        var b = 1;
        var c = 3;
        a.should.be.equal(b + c);            
        done();
    });
});

