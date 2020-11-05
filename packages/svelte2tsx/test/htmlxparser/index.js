let converter = require('../build/htmlxtojsx')
let fs = require('fs')
let assert = require('assert')

describe('htmlxparser', () => {
    let content = fs.readFileSync(`${__dirname}/large.svelte`, {encoding: 'utf8'});
    
    it('parses in a reasonable time', () => {
        const start = new Date();
        converter.htmlx2jsx(content);
        const elapsed = new Date() - start;
        assert(elapsed <= 1000, `Parsing took ${elapsed} ms, which was longer than 1000ms`);
    })
    
});