
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

var buf = fs.readFileSync('./tests/data/jpeg_2000.dcm');

var data = new DataView(toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);

var assert = require("assert");

describe('Daikon', function () {
    describe('test jpeg 2000', function () {
        it('image size should be 524288', function () {
            assert.equal(524288, (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
        });

        it('pixel bytes compressed size should be 7560', function (done) {
            assert.equal(7560, image.getPixelData().value.buffer.byteLength);
            done();
        });

        it('pixel bytes uncompressed size should be 524288', function (done) {
            image.decompress();
            assert.equal(524288, image.getPixelData().value.buffer.byteLength);
            done();
        });
    });
});
