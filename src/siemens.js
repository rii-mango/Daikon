
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);


/*** Constructor ***/

/**
 * The Siemens constructor.
 * @params {ArrayBuffer} buffer
 * @type {Function}
 */
daikon.Siemens = daikon.Siemens || function (buffer) {
    this.output = "";
    this.data = new DataView(buffer, 0);
};


/*** Static Pseudo-constants ***/

daikon.Siemens.CSA2_MAGIC_NUMBER = [83, 86, 49, 48];
daikon.Siemens.NAME_LENGTH = 64;
daikon.Siemens.ELEMENT_CSA1 = 0x1010;
daikon.Siemens.ELEMENT_CSA2 = 0x1020;
daikon.Siemens.GROUP_CSA = 0x029;


/*** Prototype Methods ***/

/**
 * Reads the Siemens header.  (See http://nipy.org/nibabel/dicom/siemens_csa.html)
 * @returns {string}
 */
daikon.Siemens.prototype.readHeader = function () {
    /*jslint bitwise: true */

    var ctr, match;

    try {
        if (this.data.byteLength > daikon.Siemens.CSA2_MAGIC_NUMBER.length) {
            match = true;

            for (ctr = 0; ctr < daikon.Siemens.CSA2_MAGIC_NUMBER.length; ctr += 1) {
                match &= (this.data.getUint8(ctr) === daikon.Siemens.CSA2_MAGIC_NUMBER[ctr]);
            }

            if (match) {
                this.readHeaderAtOffset(daikon.Siemens.CSA2_MAGIC_NUMBER.length + 4);
            } else {
                this.readHeaderAtOffset(0);
            }
        }
    } catch (error) {
        console.log(error);
    }

    return this.output;
};



daikon.Siemens.prototype.readHeaderAtOffset = function (offset) {
    var numTags, ctr;

    this.output += '\n';

    numTags = daikon.Utils.swap32(this.data.getUint32(offset));

    if ((numTags < 1) || (numTags > 128)) {
        return this.output;
    }

    offset += 4;

    offset += 4; // unused

    for (ctr = 0; ctr < numTags; ctr += 1) {
        offset = this.readTag(offset);

        if (offset === -1) {
            break;
        }
    }

    return this.output;
};



daikon.Siemens.prototype.readTag = function (offset) {
    var name, ctr, numItems;

    name = this.readString(offset, daikon.Siemens.NAME_LENGTH);

    offset += daikon.Siemens.NAME_LENGTH;

    offset += 4; // vm

    offset += 4;

    offset += 4; // syngodt

    numItems = daikon.Utils.swap32(this.data.getUint32(offset));
    offset += 4;

    offset += 4; // unused

    this.output += ("    " + name + "=");

    for (ctr = 0; ctr < numItems; ctr += 1) {
        offset = this.readItem(offset);

        if (offset === -1) {
            break;
        } else if ((offset % 4) !== 0) {
            offset += (4 - (offset % 4));
        }
    }

    this.output += ('\n');

    return offset;
};



daikon.Siemens.prototype.readString = function (offset, length) {
    var char2, ctr, str = "";

    for (ctr = 0; ctr < length; ctr += 1) {
        char2 = this.data.getUint8(offset + ctr);

        if (char2 === 0) {
            break;
        }

        str += String.fromCharCode(char2);
    }

    return str;
};



daikon.Siemens.prototype.readItem = function (offset) {
    var itemLength;

    itemLength = daikon.Utils.swap32(this.data.getUint32(offset));

    if ((offset + itemLength) > this.data.buffer.length) {
        return -1;
    }

    offset += 16;

    if (itemLength > 0) {
        this.output += (this.readString(offset, itemLength) + " ");
    }

    return offset + itemLength;
};


/**
 * Returns true if the specified group and element indicate this tag can be read.
 * @param {number} group
 * @param {number} element
 * @returns {boolean}
 */
daikon.Siemens.prototype.canRead = function (group, element) {
    return (group === daikon.Siemens.GROUP_CSA) && ((element === daikon.Siemens.ELEMENT_CSA1) || (element === daikon.Siemens.ELEMENT_CSA2));
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Siemens;
}
