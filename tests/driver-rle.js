
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/rle.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);
var imageData = null;

describe('Daikon', function () {
    describe('test rle', function () {
        it('image size should be 524288', function () {
            assert.equal(524288, (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
        });

        it('pixel bytes compressed size should be 248496', function (done) {
            assert.equal(248496, image.getPixelData().value.buffer.byteLength);
            done();
        });

        it('pixel bytes uncompressed size should be 524288', function (done) {
            imageData = image.getPixelDataBytes();
            assert.equal(524288, imageData.byteLength);
            done();
        });

        it('image data checksum should equal 1052635650', function () {
            var checksum = daikon.Utils.crc32(new DataView(imageData));
            assert.equal(checksum, 1052635650);
        });
    });
});
