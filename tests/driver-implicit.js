
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/implicit_little.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
var dataInterpreted = null;
var image = null;

describe('Daikon', function () {
    describe('test implicit', function () {
        it('should not throw error', function (done) {
            assert.doesNotThrow(function() {
                image = daikon.Series.parseImage(data);
                done();
            });
        });

        it('image data checksum should equal 3896449929', function () {
            var imageData = image.getPixelDataBytes();
            var checksum = daikon.Utils.crc32(new DataView(imageData));
            assert.equal(checksum, 3896449929);
        });

        it('image max should equal 575', function () {
            dataInterpreted = image.getInterpretedData(false, true);
            assert.equal(dataInterpreted.data[dataInterpreted.maxIndex], 575);
        });
    });
});
