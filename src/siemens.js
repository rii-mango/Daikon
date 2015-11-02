
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};


/*** Constructor ***/
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

daikon.Siemens.prototype.readHeader = function () {
    /*jslint bitwise: true */

    var returnVal, ctr, match;

    this.output += "<pre>";

    match = true;
    for (ctr = 0; ctr < daikon.Siemens.CSA2_MAGIC_NUMBER.length; ctr += 1) {
        match &= (this.data.getUint8(ctr) === daikon.Siemens.CSA2_MAGIC_NUMBER[ctr]);
    }

    if (match) {
        returnVal = this.readHeaderAtOffset(daikon.Siemens.CSA2_MAGIC_NUMBER.length + 4);
    } else {
        returnVal = this.readHeaderAtOffset(0);
    }

    this.output += "</pre>";

    return returnVal;
};



daikon.Siemens.prototype.swap32 = function (val) {
    /*jslint bitwise: true */
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >> 8) & 0xFF00) | ((val >> 24) & 0xFF);
};



daikon.Siemens.prototype.readHeaderAtOffset = function (offset) {
    var numTags, ctr;

    this.output += '\n';

    numTags = this.swap32(this.data.getUint32(offset));
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

    numItems = this.swap32(this.data.getUint32(offset));
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
    var char, ctr, str = "";

    for (ctr = 0; ctr < length; ctr += 1) {
        char = this.data.getUint8(offset + ctr);

        if (char === 0) {
            break;
        }

        str += String.fromCharCode(char);
    }

    return str;
};



daikon.Siemens.prototype.readItem = function (offset) {
    var itemLength;

    itemLength = this.swap32(this.data.getUint32(offset));

    if ((offset + itemLength) > this.data.buffer.length) {
        return -1;
    }

    offset += 16;

    if (itemLength > 0) {
        this.output += (this.readString(offset, itemLength) + " ");
    }

    return offset + itemLength;
};



daikon.Siemens.prototype.canRead = function (group, element) {
    return (group === daikon.Siemens.GROUP_CSA) && ((element === daikon.Siemens.ELEMENT_CSA1) || (element === daikon.Siemens.ELEMENT_CSA2));
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Siemens;
}
