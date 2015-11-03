
/*jslint browser: true, node: true */
/*global require, module, describe, it */

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var ctr, filePath, buf, image;
var series = new daikon.Series();
var files = fs.readdirSync('./tests/data/volume/');
var imageData = null;

for (ctr in files) {
    if (files[ctr]) {
        filePath = './tests/data/volume/' + files[ctr];
        buf = fs.readFileSync(filePath);
        image = daikon.Series.parseImage(new DataView(daikon.Utils.toArrayBuffer(buf)));

        if (image === null) {
            console.error(daikon.Series.parserError);
        } else if (image.hasPixelData()) {
            if ((series.images.length === 0) || (image.getSeriesId() === series.images[0].getSeriesId())) {
                series.addImage(image);
            }
        }
    }
}

series.buildSeries();

describe('Daikon', function () {
    describe('test series', function () {
        it('cols should equal 256', function () {
            assert.equal(256, series.images[0].getCols());
        });

        it('rows should equal 256', function () {
            assert.equal(256, series.images[0].getRows());
        });

        it('slices should equal 20', function () {
            assert.equal(20, series.images.length);
        });

        it('bits allocated should be 16', function () {
            assert.equal(16, series.images[0].getBitsAllocated());
        });

        it('image size should be 2621440', function (done) {
            series.concatenateImageData(null, function (data) {
                imageData = data;
                assert.equal(2621440, data.byteLength);
                done();
            });
        });

        it('image data checksum should equal 2682517968', function () {
            var checksum = daikon.Utils.crc32(new DataView(imageData));
            assert.equal(checksum, 2682517968);
        });
    });
});
