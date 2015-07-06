
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

/*
 var buf = fs.readFileSync('./data/explicit_little.dcm');
 var data = new DataView(toArrayBuffer(buf));
 Parser.verbose = true;
 var image = Series.parseImage(data);
 */

var series = new daikon.Series();
var files = fs.readdirSync('./tests/data/volume/');

for (var ctr in files) {
    var name = './tests/data/volume/' + files[ctr];
    var buf = fs.readFileSync(name);
    var image = daikon.Series.parseImage(new DataView(toArrayBuffer(buf)));

    if (image === null) {
        console.error(daikon.Series.parserError);
    } else if (image.hasPixelData()) {
        if ((series.images.length === 0) || (image.getSeriesId() === series.images[0].getSeriesId())) {
            series.addImage(image);
        }
    }
}

series.buildSeries();


var assert = require("assert");

describe('Daikon', function () {
    describe('test series', function () {
        it('cols should equal 256', function () {
            assert.equal(256, series.images[0].getCols());
        });

        it('rows should equal 256', function () {
            assert.equal(256, series.images[0].getRows());
        });

        it('bits allocated should be 16', function () {
            assert.equal(16, series.images[0].getBitsAllocated());
        });

        it('image size should be 2621440', function (done) {
            series.concatenateImageData(null, function (imageData) {
                assert.equal(2621440, imageData.byteLength);
                done();
            });
        });
    });
});
