
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

var daikon = {};
daikon.Series = require('../src/series.js');
daikon.Parser = require('../src/parser.js');
daikon.CompressionUtils = require('../src/compression-utils.js');


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

var buf = fs.readFileSync('./tests/data/jpeg_baseline_8bit.dcm');

var data = new DataView(toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);

var assert = require("assert");

describe('Daikon', function () {
    describe('test jpeg baseline 8bit', function () {
        it('image size should be 25165824', function () {
            assert.equal(25165824, (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
        });

        it('pixel bytes compressed size should be 1691672', function (done) {
            assert.equal(1691672, image.getPixelData().value.buffer.byteLength);
            done();
        });


        it('pixel bytes uncompressed size should be 25165824', function (done) {
            image.decompress();
            assert.equal(25165824, image.getPixelData().value.buffer.byteLength);
            done();
        });
    });
});
