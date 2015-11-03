
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/jpeg_lossless_sel1.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);
var imageData = null;

describe('Daikon', function () {
    describe('test jpeg lossless sel1', function () {
        it('image size should be 409600', function () {
            assert.equal(409600, (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
        });

        it('pixel bytes compressed size should be 143498', function (done) {
            assert.equal(143498, image.getPixelData().value.buffer.byteLength);
            done();
        });

        it('pixel bytes uncompressed size should be 409600', function (done) {
            imageData = image.getPixelDataBytes();
            assert.equal(409600, imageData.byteLength);
            done();
        });

        it('image data checksum should equal 4077593098', function () {
            var checksum = daikon.Utils.crc32(new DataView(imageData));
            assert.equal(checksum, 4077593098);
        });
    });
});
