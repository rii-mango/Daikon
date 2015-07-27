
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/deflated.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);

describe('Daikon', function () {
    describe('test deflated', function () {
        it('image size should be 524288', function () {
            assert.equal(262144, (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
        });

        it('pixel bytes uncompressed size should be 262144', function (done) {
            assert.equal(262144, image.getPixelData().value.buffer.byteLength);
            done();
        });
    });
});
