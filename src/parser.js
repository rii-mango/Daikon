
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Tag = daikon.Tag || ((typeof require !== 'undefined') ? require('./tag.js') : null);
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);
daikon.Dictionary = daikon.Dictionary || ((typeof require !== 'undefined') ? require('./dictionary.js') : null);
daikon.Image = daikon.Image || ((typeof require !== 'undefined') ? require('./image.js') : null);


/*** Constructor ***/
daikon.Parser = daikon.Parser || function () {
    this.littleEndian = true;
    this.explicit = true;
    this.metaFound = false;
    this.metaFinished = false;
    this.metaFinishedOffset = -1;
    this.error = null;
};


/*** Static Fields ***/
daikon.Parser.verbose = false;


/*** Static Pseudo-constants ***/

daikon.Parser.MAGIC_COOKIE_OFFSET = 128;
daikon.Parser.MAGIC_COOKIE = [68, 73, 67, 77];
daikon.Parser.VRS = ["AE", "AS", "AT", "CS", "DA", "DS", "DT", "FL", "FD", "IS", "LO", "LT", "OB", "OD", "OF", "OW", "PN", "SH", "SL", "SS", "ST", "TM", "UI", "UL", "UN", "US", "UT"];
daikon.Parser.DATA_VRS = ["OB", "OW", "OF", "SQ", "UT", "UN"];
daikon.Parser.RAW_DATA_VRS = ["OB", "OD", "OF", "OW", "UN"];
daikon.Parser.TRANSFER_SYNTAX_IMPLICIT_LITTLE = "1.2.840.10008.1.2";
daikon.Parser.TRANSFER_SYNTAX_EXPLICIT_LITTLE = "1.2.840.10008.1.2.1";
daikon.Parser.TRANSFER_SYNTAX_EXPLICIT_BIG = "1.2.840.10008.1.2.2";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG = "1.2.840.10008.1.2.4";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS = "1.2.840.10008.1.2.4.57";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS_SEL1 = "1.2.840.10008.1.2.4.70";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_8BIT = "1.2.840.10008.1.2.4.50";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_12BIT = "1.2.840.10008.1.2.4.51";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000_LOSSLESS = "1.2.840.10008.1.2.4.90";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000 = "1.2.840.10008.1.2.4.91";
daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_RLE = "1.2.840.10008.1.2.5";
daikon.Parser.UNDEFINED_LENGTH = 0xFFFFFFFF;


/*** Static Methods ***/

daikon.Parser.isMagicCookieFound = function (data) {
    var offset = daikon.Parser.MAGIC_COOKIE_OFFSET, magicCookieLength = daikon.Parser.MAGIC_COOKIE.length, ctr;

    for (ctr = 0; ctr < magicCookieLength; ctr += 1) {
        if (data.getUint8(offset + ctr) !== daikon.Parser.MAGIC_COOKIE[ctr]) {
            return false;
        }
    }

    return true;
};


/*** Prototype Methods ***/

daikon.Parser.prototype.parse = function (data) {
    var image = null, offset, tag;

    try {
        image = new daikon.Image();
        offset = this.findFirstTagOffset(data);
        tag = this.getNextTag(data, offset);

        while (tag !== null) {
            if (daikon.Parser.verbose) {
                console.log(tag.toString());
            }

            image.putTag(tag);

            if (tag.isPixelData()) {
                break;
            }

            tag = this.getNextTag(data, tag.offsetEnd);
        }
    } catch (err) {
        this.error = err;
    }

    if (image !== null) {
        image.littleEndian = this.littleEndian;
    }

    return image;
};



daikon.Parser.prototype.parseEncapsulated = function (data) {
    var offset = 0, tag, tags = [];

    try {
        tag = this.getNextTag(data, offset);

        while (tag !== null) {
            if (tag.isSublistItem()) {
                tags.push(tag);
            }

            if (daikon.Parser.verbose) {
                console.log(tag.toString());
            }

            tag = this.getNextTag(data, tag.offsetEnd);
        }
    } catch (err) {
        this.error = err;

    }

    return tags;
};



daikon.Parser.prototype.testForValidTag = function (data) {
    var offset, tag = null;

    try {
        offset = this.findFirstTagOffset(data);
        tag = this.getNextTag(data, offset, true);
    } catch (err) {
        this.error = err;
    }

    return tag;
};



daikon.Parser.prototype.getNextTag = function (data, offset, testForTag) {
    var group = 0, element, value = null, offsetStart = offset, offsetValue, length = 0, little = true, vr = null, tag;

    if (offset >= data.byteLength) {
        return null;
    }

    if (this.metaFinished) {
        little = this.littleEndian;
        group = data.getUint16(offset, little);
    } else {
        group = data.getUint16(offset, true);

        if (((this.metaFinishedOffset !== -1) && (offset >= this.metaFinishedOffset)) || (group !== 0x0002)) {
            this.metaFinished = true;
            little = this.littleEndian;
            group = data.getUint16(offset, little);
        } else {
            little = true;
        }
    }

    if (!this.metaFound && (group === 0x0002)) {
        this.metaFound = true;
    }

    offset += 2;

    element = data.getUint16(offset, true);
    offset += 2;

    if (this.explicit || !this.metaFinished) {
        vr = daikon.Utils.getStringAt(data, offset, 2);

        if (!this.metaFound && this.metaFinished && (daikon.Parser.VRS.indexOf(vr) === -1)) {
            vr = daikon.Dictionary.getVR(group, element);
            length = data.getUint32(offset, little);
            offset += 4;
            this.explicit = false;
        } else {
            offset += 2;

            if (daikon.Parser.DATA_VRS.indexOf(vr) !== -1) {
                offset += 2;  // skip two empty bytes

                length = data.getUint32(offset, little);
                offset += 4;
            } else {
                length = data.getUint16(offset, little);
                offset += 2;
            }
        }
    } else {
        vr = daikon.Dictionary.getVR(group, element);
        length = data.getUint32(offset, little);

        if (length === daikon.Parser.UNDEFINED_LENGTH) {
            vr = 'SQ';
        }

        offset += 4;
    }

    offsetValue = offset;

    if (vr === 'SQ') {
        value = this.parseSublist(data, offset, length);

        if (length === daikon.Parser.UNDEFINED_LENGTH) {
            length = value[value.length - 1].offsetEnd - offset;
        }
    } else if ((length > 0) && !testForTag) {
        if (length === daikon.Parser.UNDEFINED_LENGTH) {
            if ((group === daikon.Tag.TAG_PIXEL_DATA[0]) && (element === daikon.Tag.TAG_PIXEL_DATA[1])) {
                length = (data.byteLength - offset);
            }
        }

        value = data.buffer.slice(offset, offset + length);
    }

    offset += length;
    tag = new daikon.Tag(group, element, vr, value, offsetStart, offsetValue, offset, this.littleEndian);

    if (tag.isTransformSyntax()) {
        if (tag.value[0] === daikon.Parser.TRANSFER_SYNTAX_IMPLICIT_LITTLE) {
            this.explicit = false;
            this.littleEndian = true;
        } else if (tag.value[0] === daikon.Parser.TRANSFER_SYNTAX_EXPLICIT_BIG) {
            this.explicit = true;
            this.littleEndian = false;
        } else {
            this.explicit = true;
            this.littleEndian = true;
        }
    } else if (tag.isMetaLength()) {
        this.metaFinishedOffset = tag.value[0] + offset;
    }

    return tag;
};



daikon.Parser.prototype.parseSublist = function (data, offset, length) {
    var sublistItem,
        offsetEnd = offset + length,
        tags = [];

    if (length === daikon.Parser.UNDEFINED_LENGTH) {
        sublistItem = this.parseSublistItem(data, offset);

        while (!sublistItem.isSequenceDelim()) {
            tags.push(sublistItem);
            offset = sublistItem.offsetEnd;
            sublistItem = this.parseSublistItem(data, offset);
        }

        tags.push(sublistItem);
    } else {
        while (offset < offsetEnd) {
            sublistItem = this.parseSublistItem(data, offset);
            tags.push(sublistItem);
            offset = sublistItem.offsetEnd;
        }
    }

    return tags;
};



daikon.Parser.prototype.parseSublistItem = function (data, offset) {
    var group, element, length, offsetEnd, tag, offsetStart = offset, offsetValue, sublistItemTag, tags = [];

    group = data.getUint16(offset, this.littleEndian);
    offset += 2;

    element = data.getUint16(offset, this.littleEndian);
    offset += 2;

    length = data.getUint32(offset, this.littleEndian);
    offset += 4;

    offsetValue = offset;

    if (length === daikon.Parser.UNDEFINED_LENGTH) {
        tag = this.getNextTag(data, offset);

        while (!tag.isSublistItemDelim()) {
            tags.push(tag);
            offset = tag.offsetEnd;
            tag = this.getNextTag(data, offset);
        }

        tags.push(tag);
        offset = tag.offsetEnd;
    } else {
        offsetEnd = offset + length;

        while (offset < offsetEnd) {
            tag = this.getNextTag(data, offset);
            tags.push(tag);
            offset = tag.offsetEnd;
        }
    }

    sublistItemTag = new daikon.Tag(group, element, null, tags, offsetStart, offsetValue, offset, this.littleEndian);

    return sublistItemTag;
};



daikon.Parser.prototype.findFirstTagOffset = function (data) {
    var offset = 0,
        magicCookieLength = daikon.Parser.MAGIC_COOKIE.length,
        searchOffsetMax = daikon.Parser.MAGIC_COOKIE_OFFSET * 2,
        found = false,
        ctr = 0,
        ctrIn = 0,
        ch = 0;

    if (daikon.Parser.isMagicCookieFound(data)) {
        offset = daikon.Parser.MAGIC_COOKIE_OFFSET + magicCookieLength;
    } else {
        for (ctr = 0; ctr < searchOffsetMax; ctr += 1) {
            ch = data.getUint8(offset);
            if (ch === daikon.Parser.MAGIC_COOKIE[0]) {
                found = true;
                for (ctrIn = 1; ctrIn < magicCookieLength; ctrIn += 1) {
                    if (data.getUint8(ctr + ctrIn) !== daikon.Parser.MAGIC_COOKIE[ctrIn]) {
                        found = false;
                    }
                }

                if (found) {
                    offset = ctr;
                    break;
                }
            }
        }
    }

    return offset;
};



daikon.Parser.prototype.hasError = function () {
    return (this.error !== null);
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Parser;
}
