/*jslint browser: true, node: true */
/*global require, module, describe, it */
// from https://dicom.nema.org/dicom/2013/output/chtml/part10/chapter_7.html

"use strict";

var assert = require("assert");
var fs = require('fs');

var daikon = require('../src/main.js');

var buf = fs.readFileSync('./tests/data/jpeg_baseline_8bit.dcm');
var data = new DataView(daikon.Utils.toArrayBuffer(buf));
daikon.Parser.verbose = true;
var image = daikon.Series.parseImage(data);
var imageData = null;

describe('Daikon', function () {
    describe('test jpeg verify tags', function () {        
        it('private tags are correctly read', function() {
            var tags = image.tags;            
            assert.equal(tags['50000005'].value[0], 2);
            assert.equal(tags['50000010'].value[0], 3840);
            assert.equal(tags['50000020'].value[0], 'ECG');
            assert.equal(tags['50000030'].value[0], 'DPPS');
            assert.equal(tags['50000103'].value[0], 0);
        });
    });
});
daikon.Parser.verbose = false;