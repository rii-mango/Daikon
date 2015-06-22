
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

var buf = fs.readFileSync('./data/jpeg_2000.dcm');

var data = new DataView(toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);
console.log("size of image (bytes) = " + (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
console.log("pixel bytes (compressed) = " + image.getPixelData().value.buffer.byteLength);
image.decompress();
console.log("pixel bytes (decompressed) = " + image.getPixelData().value.buffer.byteLength);
