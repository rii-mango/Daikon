
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.CompressionUtils = daikon.CompressionUtils || {};


/*** Static Pseudo-constants ***/

daikon.CompressionUtils.JPEG_MAGIC_NUMBER = [0xFF, 0xD8];
daikon.CompressionUtils.JPEG2000_MAGIC_NUMBER = [0xFF, 0x4F, 0xFF, 0x51];


/*** Static methods ***/

daikon.CompressionUtils.isHeaderJPEG = function (data) {
    if (data) {
        if (data.getUint8(0) !== daikon.CompressionUtils.JPEG_MAGIC_NUMBER[0]) {
            return false;
        }

        if (data.getUint8(1) !== daikon.CompressionUtils.JPEG_MAGIC_NUMBER[1]) {
            return false;
        }

        return true;
    }

    return false;
};


daikon.CompressionUtils.isHeaderJPEG2000 = function (data) {
    var ctr;

    if (data) {
        for (ctr = 0; ctr < daikon.CompressionUtils.JPEG2000_MAGIC_NUMBER.length; ctr+=1) {
            if (data.getUint8(ctr) !== daikon.CompressionUtils.JPEG2000_MAGIC_NUMBER[ctr]) {
                return false;
            }
        }

        return true;
    }

    return false;
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.CompressionUtils;
}