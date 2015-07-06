
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

var daikon = {};
daikon.Series = require('../src/series.js');
daikon.Parser = require('../src/parser.js');
var fs = require('fs');


function toArrayBuffer(buffer) {
    var ab, view, i;

    ab = new ArrayBuffer(buffer.length);
    view = new Uint8Array(ab);
    for (i = 0; i < buffer.length; i += 1) {
        view[i] = buffer[i];
    }
    return ab;
}

var buf = fs.readFileSync('./tests/data/explicit_big.dcm');
var data = new DataView(toArrayBuffer(buf));

var assert = require("assert");
describe('Daikon', function () {
    describe('test explicit big', function () {
        it('should not throw error', function () {
            assert.doesNotThrow(function() {
                var image = daikon.Series.parseImage(data);
            });
        });
    });
});


