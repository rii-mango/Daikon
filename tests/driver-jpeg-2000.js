
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/jpeg_2000.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);
var imageData = null;

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
            imageData = image.getPixelDataBytes();
            assert.equal(524288, imageData.byteLength);
            done();
        });

        it('image data checksum should equal 2592514340', function () {
            var checksum = daikon.Utils.crc32(new DataView(imageData));
            assert.equal(checksum, 2592514340);
        });
    });
});
