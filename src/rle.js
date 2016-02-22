
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};


/*** Constructor ***/

/**
 * The RLE constructor.
 * @type {Function}
 */
daikon.RLE = daikon.RLE || function () {
    this.rawData = null;
    this.bytesRead = 0;
    this.bytesPut = 0;
    this.segElemPut = 0;
    this.numSegments = 0;
    this.segmentOffsets = [];
    this.littleEndian = true;
    this.segmentIndex = 0;
    this.numElements = 0;
    this.size = 0;
    this.output = null;
};


/*** Static Pseudo-constants ***/

daikon.RLE.HEADER_SIZE = 64;


/*** Prototype Methods ***/

/**
 * Decodes the RLE data.
 * @param {ArrayBuffer} data
 * @param {boolean} littleEndian
 * @param {number} numElements
 * @returns {DataView}
 */
daikon.RLE.prototype.decode = function (data, littleEndian, numElements) {
    var ctr;

    this.rawData = new DataView(data);
    this.littleEndian = littleEndian;
    this.numElements = numElements;

    this.readHeader();
    this.output = new DataView(new ArrayBuffer(this.size));

    for (ctr = 0; ctr < this.numSegments; ctr+=1) {
        this.readNextSegment();
    }

    return this.processData();
};


daikon.RLE.prototype.processData = function () {
    /*jslint bitwise: true */

    var ctr, temp1, temp2, temp3, value, outputProcessed, offset;

    if (this.numSegments === 1) {
        return this.output;
    } else if (this.numSegments === 2) {
        outputProcessed = new DataView(new ArrayBuffer(this.size));

        for (ctr = 0; ctr < this.numElements; ctr+=1) {
            temp1 = (this.output.getInt8(ctr));
            temp2 = (this.output.getInt8(ctr + this.numElements));
            value = (((temp1 & 0xFF) << 8) | (temp2 & 0xFF));
            outputProcessed.setInt16(ctr * 2, value, this.littleEndian);
        }

        return outputProcessed;
    } else if (this.numSegments === 3) {  // rgb
        outputProcessed = new DataView(new ArrayBuffer(this.size));
        offset = (2 * this.numElements);

        for (ctr = 0; ctr < this.numElements; ctr+=1) {
            outputProcessed.setInt8(ctr * 3, this.output.getInt8(ctr));
            outputProcessed.setInt8(ctr * 3 + 1, this.output.getInt8(ctr + this.numElements));
            outputProcessed.setInt8(ctr * 3 + 2, this.output.getInt8(ctr + offset));
        }

        return outputProcessed;
    } else {
        throw new Error("RLE data with " + this.numSegments + " segments is not supported!");
    }
};



daikon.RLE.prototype.readHeader = function () {
    var ctr;

    this.numSegments = this.getInt32();
    this.size = this.numElements * this.numSegments;

    for (ctr = 0; ctr < this.numSegments; ctr+=1) {
        this.segmentOffsets[ctr] = this.getInt32();
    }

    this.bytesRead = daikon.RLE.HEADER_SIZE;
};



daikon.RLE.prototype.hasValidInput = function () {
    return ((this.bytesRead < this.rawData.buffer.byteLength) &&
        (this.bytesPut < this.size) && (this.segElemPut < this.numElements));
};



daikon.RLE.prototype.readNextSegment = function () {
    var code;

    this.bytesRead = this.segmentOffsets[this.segmentIndex];
    this.segElemPut = 0;

    while (this.hasValidInput()) {
        code = this.get();

        if ((code >= 0) && (code < 128)) {
            this.readLiteral(code);
        } else if ((code <= -1) && (code > -128)) {
            this.readEncoded(code);
        } else if (code === -128) {
            console.warn("RLE: unsupported code!");
        }
    }

    this.segmentIndex+=1;
};



daikon.RLE.prototype.readLiteral = function (code) {
    var ctr, length = (code + 1);

    if (this.hasValidInput()) {
        for (ctr = 0; ctr < length; ctr+=1) {
            this.put(this.get());
        }
    } else {
        console.warn("RLE: insufficient data!");
    }
};



daikon.RLE.prototype.readEncoded = function (code) {
    var ctr,
        runLength = (1 - code),
        encoded = this.get();

    for (ctr = 0; ctr < runLength; ctr+=1) {
        this.put(encoded);
    }
};



daikon.RLE.prototype.getInt32 = function () {
    var value = this.rawData.getInt32(this.bytesRead, this.littleEndian);
    this.bytesRead += 4;
    return value;
};



daikon.RLE.prototype.getInt16 = function () {
    var value = this.rawData.getInt16(this.bytesRead, this.littleEndian);
    this.bytesRead += 2;
    return value;
};



daikon.RLE.prototype.get = function () {
    var value = this.rawData.getInt8(this.bytesRead);
    this.bytesRead += 1;
    return value;
};



daikon.RLE.prototype.put = function (val) {
    this.output.setInt8(this.bytesPut, val);
    this.bytesPut += 1;
    this.segElemPut += 1;
};



/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.RLE;
}
