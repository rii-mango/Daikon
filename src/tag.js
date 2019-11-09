
/*jslint browser: true, node: true */
/*global require */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);
daikon.Dictionary = daikon.Dictionary || ((typeof require !== 'undefined') ? require('./dictionary.js') : null);
daikon.Siemens = daikon.Siemens || ((typeof require !== 'undefined') ? require('./siemens.js') : null);


/*** Constructor ***/

/**
 * The Tag constuctor.
 * @property {number} group
 * @property {number} element
 * @property {string} vr
 * @property {number} offsetStart
 * @property {number} offsetValue
 * @property {number} offsetEnd
 * @property {boolean} sublist - true if this tag is a sublist
 * @property {number|number[]|string|string[]|object} value
 * @type {Function}
 */
daikon.Tag = daikon.Tag || function (group, element, vr, value, offsetStart, offsetValue, offsetEnd, littleEndian) {
    this.group = group;
    this.element = element;
    this.vr = vr;
    this.offsetStart = offsetStart;
    this.offsetValue = offsetValue;
    this.offsetEnd = offsetEnd;
    this.sublist = false;
    this.preformatted = false;
    this.id = daikon.Tag.createId(group, element);

    if (value instanceof Array) {
        this.value = value;
        this.sublist = true;
    } else if (value !== null) {
        var dv = new DataView(value);
        this.value = daikon.Tag.convertValue(vr, dv, littleEndian);

        if ((this.value === dv) && this.isPrivateData()) {
            this.value = daikon.Tag.convertPrivateValue(group, element, dv);
            this.preformatted = (this.value !== dv);
        }
    } else {
        this.value = null;
    }
};


/*** Static Pseudo-constants ***/

daikon.Tag.PRIVATE_DATA_READERS = [daikon.Siemens];

daikon.Tag.VR_AE_MAX_LENGTH = 16;
daikon.Tag.VR_AS_MAX_LENGTH = 4;
daikon.Tag.VR_AT_MAX_LENGTH = 4;
daikon.Tag.VR_CS_MAX_LENGTH = 16;
daikon.Tag.VR_DA_MAX_LENGTH = 8;
daikon.Tag.VR_DS_MAX_LENGTH = 16;
daikon.Tag.VR_DT_MAX_LENGTH = 26;
daikon.Tag.VR_FL_MAX_LENGTH = 4;
daikon.Tag.VR_FD_MAX_LENGTH = 8;
daikon.Tag.VR_IS_MAX_LENGTH = 12;
daikon.Tag.VR_LO_MAX_LENGTH = 64;
daikon.Tag.VR_LT_MAX_LENGTH = 10240;
daikon.Tag.VR_OB_MAX_LENGTH = -1;
daikon.Tag.VR_OD_MAX_LENGTH = -1;
daikon.Tag.VR_OF_MAX_LENGTH = -1;
daikon.Tag.VR_OW_MAX_LENGTH = -1;
daikon.Tag.VR_PN_MAX_LENGTH = 64 * 5;
daikon.Tag.VR_SH_MAX_LENGTH = 16;
daikon.Tag.VR_SL_MAX_LENGTH = 4;
daikon.Tag.VR_SS_MAX_LENGTH = 2;
daikon.Tag.VR_ST_MAX_LENGTH = 1024;
daikon.Tag.VR_TM_MAX_LENGTH = 16;
daikon.Tag.VR_UI_MAX_LENGTH = 64;
daikon.Tag.VR_UL_MAX_LENGTH = 4;
daikon.Tag.VR_UN_MAX_LENGTH = -1;
daikon.Tag.VR_US_MAX_LENGTH = 2;
daikon.Tag.VR_UT_MAX_LENGTH = -1;

// metadata
daikon.Tag.TAG_TRANSFER_SYNTAX = [0x0002, 0x0010];
daikon.Tag.TAG_META_LENGTH = [0x0002, 0x0000];

// sublists
daikon.Tag.TAG_SUBLIST_ITEM = [0xFFFE, 0xE000];
daikon.Tag.TAG_SUBLIST_ITEM_DELIM = [0xFFFE, 0xE00D];
daikon.Tag.TAG_SUBLIST_SEQ_DELIM = [0xFFFE, 0xE0DD];

// image dims
daikon.Tag.TAG_ROWS = [0x0028, 0x0010];
daikon.Tag.TAG_COLS = [0x0028, 0x0011];
daikon.Tag.TAG_ACQUISITION_MATRIX = [0x0018, 0x1310];
daikon.Tag.TAG_NUMBER_OF_FRAMES = [0x0028, 0x0008];
daikon.Tag.TAG_NUMBER_TEMPORAL_POSITIONS = [0x0020, 0x0105];

// voxel dims
daikon.Tag.TAG_PIXEL_SPACING = [0x0028, 0x0030];
daikon.Tag.TAG_SLICE_THICKNESS = [0x0018, 0x0050];
daikon.Tag.TAG_SLICE_GAP = [0x0018, 0x0088];
daikon.Tag.TAG_TR = [0x0018, 0x0080];
daikon.Tag.TAG_FRAME_TIME = [0x0018, 0x1063];

// datatype
daikon.Tag.TAG_BITS_ALLOCATED = [0x0028, 0x0100];
daikon.Tag.TAG_BITS_STORED = [0x0028, 0x0101];
daikon.Tag.TAG_PIXEL_REPRESENTATION = [0x0028, 0x0103];
daikon.Tag.TAG_HIGH_BIT = [0x0028, 0x0102];
daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION = [0x0028, 0x0004];
daikon.Tag.TAG_SAMPLES_PER_PIXEL = [0x0028, 0x0002];
daikon.Tag.TAG_PLANAR_CONFIG = [0x0028, 0x0006];
daikon.Tag.TAG_PALETTE_RED = [0x0028, 0x1201];
daikon.Tag.TAG_PALETTE_GREEN = [0x0028, 0x1202];
daikon.Tag.TAG_PALETTE_BLUE = [0x0028, 0x1203];

// data scale
daikon.Tag.TAG_DATA_SCALE_SLOPE = [0x0028, 0x1053];
daikon.Tag.TAG_DATA_SCALE_INTERCEPT = [0x0028, 0x1052];
daikon.Tag.TAG_DATA_SCALE_ELSCINT = [0x0207, 0x101F];
daikon.Tag.TAG_PIXEL_BANDWIDTH = [0x0018, 0x0095];

// range
daikon.Tag.TAG_IMAGE_MIN = [0x0028, 0x0106];
daikon.Tag.TAG_IMAGE_MAX = [0x0028, 0x0107];
daikon.Tag.TAG_WINDOW_CENTER = [0x0028, 0x1050];
daikon.Tag.TAG_WINDOW_WIDTH = [0x0028, 0x1051];

// descriptors
daikon.Tag.TAG_PATIENT_NAME = [0x0010, 0x0010];
daikon.Tag.TAG_PATIENT_ID = [0x0010, 0x0020];
daikon.Tag.TAG_STUDY_DATE = [0x0008, 0x0020];
daikon.Tag.TAG_STUDY_TIME = [0x0008, 0x0030];
daikon.Tag.TAG_STUDY_DES = [0x0008, 0x1030];
daikon.Tag.TAG_IMAGE_TYPE = [0x0008, 0x0008];
daikon.Tag.TAG_IMAGE_COMMENTS = [0x0020, 0x4000];
daikon.Tag.TAG_SEQUENCE_NAME = [0x0018, 0x0024];
daikon.Tag.TAG_MODALITY = [0x0008, 0x0060];

// session ID
daikon.Tag.TAG_FRAME_OF_REF_UID = [0x0020, 0x0052];

// study ID
daikon.Tag.TAG_STUDY_UID = [0x0020, 0x000D];

// volume ID
daikon.Tag.TAG_SERIES_DESCRIPTION = [0x0008, 0x103E];
daikon.Tag.TAG_SERIES_INSTANCE_UID = [0x0020, 0x000E];
daikon.Tag.TAG_SERIES_NUMBER = [0x0020, 0x0011];
daikon.Tag.TAG_ECHO_NUMBER = [0x0018, 0x0086];
daikon.Tag.TAG_TEMPORAL_POSITION = [0x0020, 0x0100];

// slice ID
daikon.Tag.TAG_IMAGE_NUM = [0x0020, 0x0013];
daikon.Tag.TAG_SLICE_LOCATION = [0x0020, 0x1041];

// orientation
daikon.Tag.TAG_IMAGE_ORIENTATION = [0x0020, 0x0037];
daikon.Tag.TAG_IMAGE_POSITION = [0x0020, 0x0032];
daikon.Tag.TAG_SLICE_LOCATION_VECTOR = [0x0018, 0x2005];

// LUT shape
daikon.Tag.TAG_LUT_SHAPE = [0x2050, 0x0020];

// pixel data
daikon.Tag.TAG_PIXEL_DATA = [0x7FE0, 0x0010];


/*** Static methods ***/

/**
 * Create an ID string based on the specified group and element
 * @param {number} group
 * @param {number} element
 * @returns {string}
 */
daikon.Tag.createId = function (group, element) {
    var groupStr = daikon.Utils.dec2hex(group),
        elemStr = daikon.Utils.dec2hex(element);
    return groupStr + elemStr;
};



daikon.Tag.getUnsignedInteger16 = function (rawData, littleEndian) {
    var data, mul, ctr;

    mul = rawData.byteLength / 2;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getUint16(ctr * 2, littleEndian);
    }

    return data;
};



daikon.Tag.getSignedInteger16 = function (rawData, littleEndian) {
    var data, mul, ctr;

    mul = rawData.byteLength / 2;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getInt16(ctr * 2, littleEndian);
    }

    return data;
};



daikon.Tag.getFloat32 = function (rawData, littleEndian) {
    var data, mul, ctr;

    mul = rawData.byteLength / 4;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getFloat32(ctr * 4, littleEndian);
    }

    return data;
};



daikon.Tag.getSignedInteger32 = function (rawData, littleEndian) {
    var data, mul, ctr;

    mul = rawData.byteLength / 4;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getInt32(ctr * 4, littleEndian);
    }

    return data;
};



daikon.Tag.getUnsignedInteger32 = function (rawData, littleEndian) {
    var data, mul, ctr;

    mul = rawData.byteLength / 4;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getUint32(ctr * 4, littleEndian);
    }

    return data;
};



daikon.Tag.getFloat64 = function (rawData, littleEndian) {
    var data, mul, ctr;

    if (rawData.byteLength < 8) {
        return 0;
    }

    mul = rawData.byteLength / 8;
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = rawData.getFloat64(ctr * 8, littleEndian);
    }

    return data;
};



daikon.Tag.getDoubleElscint = function (rawData) {
    var data = [], reordered = [], ctr;

    for (ctr = 0; ctr < 8; ctr += 1) {
        data[ctr] = rawData.getUint8(ctr);
    }

    reordered[0] = data[3];
    reordered[1] = data[2];
    reordered[2] = data[1];
    reordered[3] = data[0];
    reordered[4] = data[7];
    reordered[5] = data[6];
    reordered[6] = data[5];
    reordered[7] = data[4];

    data = [daikon.Utils.bytesToDouble(reordered)];

    return data;
};



daikon.Tag.getFixedLengthStringValue = function (rawData, maxLength) {
    var data, mul, ctr;

    mul = Math.floor(rawData.byteLength / maxLength);
    data = [];
    for (ctr = 0; ctr < mul; ctr += 1) {
        data[ctr] = daikon.Utils.getStringAt(rawData, ctr * maxLength, maxLength);
    }

    return data;
};



daikon.Tag.getStringValue = function (rawData) {
    var data = daikon.Utils.getStringAt(rawData, 0, rawData.byteLength).split('\\'), ctr;

    for (ctr = 0; ctr < data.length; ctr += 1) {
        data[ctr] = daikon.Utils.trim(data[ctr]);
    }

    return data;
};



daikon.Tag.getDateStringValue = function (rawData) {
    var dotFormat = (daikon.Tag.getSingleStringValue(rawData)[0].indexOf('.') !== -1),
        stringData = daikon.Tag.getFixedLengthStringValue(rawData, dotFormat ? 10 : daikon.Tag.VR_DA_MAX_LENGTH),
        parts = null,
        data = [],
        ctr;

    for (ctr = 0; ctr < stringData.length; ctr += 1) {
        if (dotFormat) {
            parts = stringData[ctr].split('.');
            if (parts.length === 3) {
                data[ctr] = new Date(daikon.Utils.safeParseInt(parts[0]),
                    daikon.Utils.safeParseInt(parts[1]) - 1,
                    daikon.Utils.safeParseInt(parts[2]));
            } else {
                data[ctr] = new Date();
            }
        } else if (stringData[ctr].length === 8) {
            data[ctr] = new Date(daikon.Utils.safeParseInt(stringData[ctr].substring(0, 4)),
                daikon.Utils.safeParseInt(stringData[ctr].substring(4, 6)) - 1,
                daikon.Utils.safeParseInt(stringData[ctr].substring(6, 8)));
        } else {
            data[ctr] = Date.parse(stringData[ctr]);
        }

        if (!daikon.Utils.isValidDate(data[ctr])) {
            data[ctr] = stringData[ctr];
        }
    }

    return data;
};



daikon.Tag.getDateTimeStringValue = function (rawData) {
    var stringData = daikon.Tag.getStringValue(rawData),
        data = [],
        ctr,
        year = null,
        month = null,
        date = null,
        hours = null,
        minutes = null,
        seconds = null;

    for (ctr = 0; ctr < stringData.length; ctr += 1) {
        if (stringData[ctr].length >= 4) {
            year = parseInt(stringData[ctr].substring(0, 4), 10);  // required

            if (stringData[ctr].length >= 6) {
                month = daikon.Utils.safeParseInt(stringData[ctr].substring(4, 6)) - 1;
            }

            if (stringData[ctr].length >= 8) {
                date = daikon.Utils.safeParseInt(stringData[ctr].substring(6, 8));
            }

            if (stringData[ctr].length >= 10) {
                hours = daikon.Utils.safeParseInt(stringData[ctr].substring(8, 10));
            }

            if (stringData[ctr].length >= 12) {
                minutes = daikon.Utils.safeParseInt(stringData[ctr].substring(10, 12));
            }

            if (stringData[ctr].length >= 14) {
                seconds = daikon.Utils.safeParseInt(stringData[ctr].substring(12, 14));
            }

            data[ctr] = new Date(year, month, date, hours, minutes, seconds);
        } else {
            data[ctr] = Date.parse(stringData[ctr]);
        }

        if (!daikon.Utils.isValidDate(data[ctr])) {
            data[ctr] = stringData[ctr];
        }
    }

    return data;
};



daikon.Tag.getTimeStringValue = function (rawData, ms) {
    var stringData = daikon.Tag.getStringValue(rawData),
    data = [];

    if (ms) {
        var parts = null,
            ctr,
            hours = 0,
            minutes = 0,
            seconds = 0;

        for (ctr = 0; ctr < stringData.length; ctr += 1) {
            if (stringData[ctr].indexOf(':') !== -1) {
                parts = stringData[ctr].split(':');
                hours = daikon.Utils.safeParseInt(parts[0]);

                if (parts.length > 1) {
                    minutes = daikon.Utils.safeParseInt(parts[1]);
                }

                if (parts.length > 2) {
                    seconds = daikon.Utils.safeParseFloat(parts[2]);
                }
            } else {
                if (stringData[ctr].length >= 2) {
                    hours = daikon.Utils.safeParseInt(stringData[ctr].substring(0, 2));
                }

                if (stringData[ctr].length >= 4) {
                    minutes = daikon.Utils.safeParseInt(stringData[ctr].substring(2, 4));
                }

                if (stringData[ctr].length >= 6) {
                    seconds = daikon.Utils.safeParseFloat(stringData[ctr].substring(4));
                }
            }

            data[ctr] = Math.round((hours * 60 * 60 * 1000) + (minutes * 60 * 1000) + (seconds * 1000));
        }

        return data;
    }


    return stringData;
};



daikon.Tag.getDoubleStringValue = function (rawData) {
    var stringData = daikon.Tag.getStringValue(rawData),
        data = [],
        ctr;

    for (ctr = 0; ctr < stringData.length; ctr += 1) {
        data[ctr] = parseFloat(stringData[ctr]);
    }

    return data;
};



daikon.Tag.getIntegerStringValue = function (rawData) {
    var stringData = daikon.Tag.getStringValue(rawData),
        data = [],
        ctr;

    for (ctr = 0; ctr < stringData.length; ctr += 1) {
        data[ctr] = parseInt(stringData[ctr], 10);
    }

    return data;
};



daikon.Tag.getSingleStringValue = function (rawData) {
    return [daikon.Utils.trim(daikon.Utils.getStringAt(rawData, 0, rawData.byteLength))];
};



daikon.Tag.getPersonNameStringValue = function (rawData) {
    var stringData = daikon.Tag.getStringValue(rawData),
        data = [],
        ctr;

    for (ctr = 0; ctr < stringData.length; ctr += 1) {
        data[ctr] = stringData[ctr].replace('^', ' ');
    }

    return data;
};



daikon.Tag.convertPrivateValue = function (group, element, rawData) {
    var ctr, privReader;

    for (ctr = 0; ctr < daikon.Tag.PRIVATE_DATA_READERS.length; ctr += 1) {
        privReader = new daikon.Tag.PRIVATE_DATA_READERS[ctr](rawData.buffer);
        if (privReader.canRead(group, element)) {
            return privReader.readHeader();
        }
    }

    return rawData;
};



daikon.Tag.convertValue = function (vr, rawData, littleEndian) {
    var data = null;

    if (vr === 'AE') {
        data = daikon.Tag.getSingleStringValue(rawData, daikon.Tag.VR_AE_MAX_LENGTH);
    } else if (vr === 'AS') {
        data = daikon.Tag.getFixedLengthStringValue(rawData, daikon.Tag.VR_AS_MAX_LENGTH);
    } else if (vr === 'AT') {
        data = daikon.Tag.getUnsignedInteger16(rawData, littleEndian);
    } else if (vr === 'CS') {
        data = daikon.Tag.getStringValue(rawData);
    } else if (vr === 'DA') {
        data = daikon.Tag.getDateStringValue(rawData);
    } else if (vr === 'DS') {
        data = daikon.Tag.getDoubleStringValue(rawData);
    } else if (vr === 'DT') {
        data = daikon.Tag.getDateTimeStringValue(rawData);
    } else if (vr === 'FL') {
        data = daikon.Tag.getFloat32(rawData, littleEndian);
    } else if (vr === 'FD') {
        data = daikon.Tag.getFloat64(rawData, littleEndian);
    } else if (vr === 'FE') {  // special Elscint double (see dictionary)
        data = daikon.Tag.getDoubleElscint(rawData, littleEndian);
    } else if (vr === 'IS') {
        data = daikon.Tag.getIntegerStringValue(rawData);
    } else if (vr === 'LO') {
        data = daikon.Tag.getStringValue(rawData);
    } else if (vr === 'LT') {
        data = daikon.Tag.getSingleStringValue(rawData);
    } else if (vr === 'OB') {
        data = rawData;
    } else if (vr === 'OD') {
        data = rawData;
    } else if (vr === 'OF') {
        data = rawData;
    } else if (vr === 'OW') {
        data = rawData;
    } else if (vr === 'PN') {
        data = daikon.Tag.getPersonNameStringValue(rawData);
    } else if (vr === 'SH') {
        data = daikon.Tag.getStringValue(rawData);
    } else if (vr === 'SL') {
        data = daikon.Tag.getSignedInteger32(rawData, littleEndian);
    } else if (vr === 'SQ') {
        data = null;
    } else if (vr === 'SS') {
        data = daikon.Tag.getSignedInteger16(rawData, littleEndian);
    } else if (vr === 'ST') {
        data = daikon.Tag.getSingleStringValue(rawData);
    } else if (vr === 'TM') {
        data = daikon.Tag.getTimeStringValue(rawData);
    } else if (vr === 'UI') {
        data = daikon.Tag.getStringValue(rawData);
    } else if (vr === 'UL') {
        data = daikon.Tag.getUnsignedInteger32(rawData, littleEndian);
    } else if (vr === 'UN') {
        data = rawData;
    } else if (vr === 'US') {
        data = daikon.Tag.getUnsignedInteger16(rawData, littleEndian);
    } else if (vr === 'UT') {
        data = daikon.Tag.getSingleStringValue(rawData);
    }

    return data;
};


/*** Prototype Methods ***/

/**
 * Returns a string representation of this tag.
 * @param {number} [level] - the indentation level
 * @param {boolean} [html]
 * @returns {string}
 */
daikon.Tag.prototype.toString = function (level, html) {
    var valueStr = '',
        ctr,
        groupStr = daikon.Utils.dec2hex(this.group),
        elemStr = daikon.Utils.dec2hex(this.element),
        tagStr = '(' + groupStr + ',' + elemStr + ')',
        des = '',
        padding;

    if (level === undefined) {
        level = 0;
    }

    padding = "";
    for (ctr = 0; ctr < level; ctr += 1) {
        if (html) {
            padding += "&nbsp;&nbsp;";
        } else {
            padding += "  ";
        }
    }

    if (this.sublist) {
        for (ctr = 0; ctr < this.value.length; ctr += 1) {
            valueStr += ('\n' + (this.value[ctr].toString(level + 1, html)));
        }
    } else if (this.vr === 'SQ') {
        valueStr = '';
    } else if (this.isPixelData()) {
        valueStr = '';
    } else if (!this.value) {
        valueStr = '';
    } else {
        if (html && this.preformatted) {
            valueStr = "[<pre>"+this.value +"</pre>]";
        } else {
            valueStr = '[' + this.value + ']';
        }
    }

    if (this.isSublistItem()) {
        tagStr = "Sequence Item";
    } else if (this.isSublistItemDelim()) {
        tagStr = "Sequence Item Delimiter";
    } else if (this.isSequenceDelim()) {
        tagStr = "Sequence Delimiter";
    } else if (this.isPixelData()) {
        tagStr = "Pixel Data";
    } else {
        des = daikon.Utils.convertCamcelCaseToTitleCase(daikon.Dictionary.getDescription(this.group, this.element));
    }

    if (html) {
        return padding + "<span style='color:#B5CBD3'>" + tagStr + "</span>&nbsp;&nbsp;&nbsp;" + des + '&nbsp;&nbsp;&nbsp;' + valueStr;
    } else {
        return padding + ' ' + tagStr + ' ' + des + ' ' + valueStr;
    }
};


/**
 * Returns an HTML string representation of this tag.
 * @param {number} level - the indentation level
 * @returns {string}
 */
daikon.Tag.prototype.toHTMLString = function (level) {
    return this.toString(level, true);
};


/**
 * Returns true if this is the transform syntax tag.
 * @returns {boolean}
 */
daikon.Tag.prototype.isTransformSyntax = function () {
    return (this.group === daikon.Tag.TAG_TRANSFER_SYNTAX[0]) && (this.element === daikon.Tag.TAG_TRANSFER_SYNTAX[1]);
};


/**
 * Returns true if this is the pixel data tag.
 * @returns {boolean}
 */
daikon.Tag.prototype.isPixelData = function () {
    return (this.group === daikon.Tag.TAG_PIXEL_DATA[0]) && (this.element === daikon.Tag.TAG_PIXEL_DATA[1]);
};


/**
 * Returns true if this tag contains private data.
 * @returns {boolean}
 */
daikon.Tag.prototype.isPrivateData = function () {
    /*jslint bitwise: true */
    return ((this.group & 1) === 1);
};


/**
 * Returns true if this tag contains private data that can be read.
 * @returns {boolean}
 */
daikon.Tag.prototype.hasInterpretedPrivateData = function () {
    return this.isPrivateData() && daikon.Utils.isString(this.value);
};


/**
 * Returns true if this tag is a sublist item.
 * @returns {boolean}
 */
daikon.Tag.prototype.isSublistItem = function () {
    return (this.group === daikon.Tag.TAG_SUBLIST_ITEM[0]) && (this.element === daikon.Tag.TAG_SUBLIST_ITEM[1]);
};


/**
 * Returns true if this tag is a sublist item delimiter.
 * @returns {boolean}
 */
daikon.Tag.prototype.isSublistItemDelim = function () {
    return (this.group === daikon.Tag.TAG_SUBLIST_ITEM_DELIM[0]) && (this.element === daikon.Tag.TAG_SUBLIST_ITEM_DELIM[1]);
};


/**
 * Returns true if this tag is a sequence delimiter.
 * @returns {boolean}
 */
daikon.Tag.prototype.isSequenceDelim = function () {
    return (this.group === daikon.Tag.TAG_SUBLIST_SEQ_DELIM[0]) && (this.element === daikon.Tag.TAG_SUBLIST_SEQ_DELIM[1]);
};


/**
 * Returns true if this is a meta length tag.
 * @returns {boolean}
 */
daikon.Tag.prototype.isMetaLength = function () {
    return (this.group === daikon.Tag.TAG_META_LENGTH[0]) && (this.element === daikon.Tag.TAG_META_LENGTH[1]);
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Tag;
}
