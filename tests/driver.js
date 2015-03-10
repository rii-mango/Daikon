
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

var Series = require('../src/series.js');
var Parser = require('../src/parser.js');
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


var buf = fs.readFileSync('./data/explicit_little.dcm');
var data = new DataView(toArrayBuffer(buf));
Parser.verbose = true;
var image = Series.parseImage(data);
