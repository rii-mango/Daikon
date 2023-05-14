
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
//var convertBytes = require('@wearemothership/dicom-character-set').convertBytes;
var daikon = daikon || {};
daikon.Utils = daikon.Utils || {};


daikon.Utils.crcTable = null;


/*** Static Pseudo-constants ***/

daikon.Utils.MAX_VALUE = 9007199254740991;
daikon.Utils.MIN_VALUE = -9007199254740991;



/*** Static methods ***/

daikon.Utils.dec2hex = function (i) {
    return (i + 0x10000).toString(16).substr(-4).toUpperCase();
};



// http://stackoverflow.com/questions/966225/how-can-i-create-a-two-dimensional-array-in-javascript
daikon.Utils.createArray = function (length) {
    var arr = new Array(length || 0),
        i = length;

    if (arguments.length > 1) {
        var args = Array.prototype.slice.call(arguments, 1);
        while(i--) arr[length-1 - i] = daikon.Utils.createArray.apply(this, args);
    }

    return arr;
};


daikon.Utils.getStringAt = function (dataview, start, length, charset, vr) {
    var str = "", ctr, ch;

    for (ctr = 0; ctr < length; ctr += 1) {
        ch = dataview.getUint8(start + ctr);

        if (ch !== 0) {
            str += String.fromCharCode(ch);
        }
    }

	/* - @from wearemothership dicom-character-set
    var strBuff = new Uint8Array(dataview.buffer, dataview.byteOffset + start, length);
    var str = convertBytes(charset || "ISO 2022 IR 6", strBuff, {vr: vr} );
    while (str && str.charCodeAt(str.length - 1) === 0) {
        str = str.slice(0,-1);
    }
	*/
    return str;
};



daikon.Utils.trim = function (str) {
    return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
};



daikon.Utils.stripLeadingZeros = function (str) {
    return str.replace(/^[0]+/g, "");
};



daikon.Utils.safeParseInt = function (str) {
    str = daikon.Utils.stripLeadingZeros(str);
    if (str.length > 0) {
        return parseInt(str, 10);
    }

    return 0;
};



daikon.Utils.convertCamcelCaseToTitleCase = function (str) {
    var result = str.replace(/([A-Z][a-z])/g, " $1");
    return daikon.Utils.trim(result.charAt(0).toUpperCase() + result.slice(1));
};



daikon.Utils.safeParseFloat = function (str) {
    str = daikon.Utils.stripLeadingZeros(str);
    if (str.length > 0) {
        return parseFloat(str);
    }

    return 0;
};


// http://stackoverflow.com/questions/8361086/convert-byte-array-to-numbers-in-javascript
daikon.Utils.bytesToDouble = function (data) {
    var sign = (data[0] & 1<<7)>>7;

    var exponent = (((data[0] & 127) << 4) | (data[1]&(15<<4))>>4);

    if(exponent == 0) return 0;
    if(exponent == 0x7ff) return (sign) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

    var mul = Math.pow(2,exponent - 1023 - 52);
    var mantissa = data[7]+
        data[6]*Math.pow(2,8)+
        data[5]*Math.pow(2,8*2)+
        data[4]*Math.pow(2,8*3)+
        data[3]*Math.pow(2,8*4)+
        data[2]*Math.pow(2,8*5)+
        (data[1]&15)*Math.pow(2,8*6)+
        Math.pow(2,52);

    return Math.pow(-1,sign)*mantissa*mul;
};



daikon.Utils.concatArrayBuffers = function (buffer1, buffer2) {
    var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    tmp.set(new Uint8Array(buffer1), 0);
    tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
    return tmp.buffer;
};



daikon.Utils.concatArrayBuffers2 = function (buffers) {
    var length = 0, offset = 0, ctr;

    for (ctr = 0; ctr < buffers.length; ctr += 1) {
        length += buffers[ctr].byteLength;
    }

    var tmp = new Uint8Array(length);

    for (ctr = 0; ctr < buffers.length; ctr += 1) {
        tmp.set(new Uint8Array(buffers[ctr]), offset);
        offset += buffers[ctr].byteLength;

    }

    return tmp.buffer;
};



daikon.Utils.fillBuffer = function (array, buffer, offset, numBytes) {
    var ctr;

    if (numBytes === 1) {
        for (ctr = 0; ctr < array.length; ctr+=1) {
            buffer.setUint8(offset + ctr, array[ctr]);
        }
    } else if (numBytes === 2) {
        for (ctr = 0; ctr < array.length; ctr+=1) {
            buffer.setUint16(offset + (ctr * 2), array[ctr], true);
        }
    }
};



daikon.Utils.fillBufferRGB = function (array, buffer, offset) {
    var r, g, b, ctr, numElements = (parseInt(array.length / 3));

    for (ctr = 0; ctr < numElements; ctr+=1) {
        r = array[ctr * 3];
        g = array[ctr * 3 + 1];
        b = array[ctr * 3 + 2];

        buffer.setUint8(offset + ctr, parseInt((r + b + g) / 3), true);
    }
};



daikon.Utils.bind = function (scope, fn, args, appendArgs) {
    if (arguments.length === 2) {
        return function () {
            return fn.apply(scope, arguments);
        };
    }

    var method = fn,
        slice = Array.prototype.slice;

    return function () {
        var callArgs = args || arguments;

        if (appendArgs === true) {
            callArgs = slice.call(arguments, 0);
            callArgs = callArgs.concat(args);
        } else if (typeof appendArgs === 'number') {
            callArgs = slice.call(arguments, 0); // copy arguments first
            Ext.Array.insert(callArgs, appendArgs, args);
        }

        return method.apply(scope || window, callArgs);
    };
};



daikon.Utils.toArrayBuffer = function (buffer) {
    var ab, view, i;

    ab = new ArrayBuffer(buffer.length);
    view = new Uint8Array(ab);
    for (i = 0; i < buffer.length; i += 1) {
        view[i] = buffer[i];
    }
    return ab;
};



// http://stackoverflow.com/questions/203739/why-does-instanceof-return-false-for-some-literals
daikon.Utils.isString = function (s) {
    return typeof(s) === 'string' || s instanceof String;
};



// http://stackoverflow.com/questions/1353684/detecting-an-invalid-date-date-instance-in-javascript
daikon.Utils.isValidDate = function(d) {
    if (Object.prototype.toString.call(d) === "[object Date]") {
        if (isNaN(d.getTime())) {
            return false;
        } else {
            return true;
        }
    } else {
        return false;
    }
};



daikon.Utils.swap32 = function (val) {
    /*jslint bitwise: true */
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >> 8) & 0xFF00) | ((val >> 24) & 0xFF);
};



daikon.Utils.swap16 = function (val) {
    /*jslint bitwise: true */
    return ((((val & 0xFF) << 8) | ((val >> 8) & 0xFF)) << 16) >> 16;  // since JS uses 32-bit when bit shifting
};


// http://stackoverflow.com/questions/18638900/javascript-crc32
daikon.Utils.makeCRCTable = function(){
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
};

daikon.Utils.crc32 = function(dataView) {
    var crcTable = daikon.Utils.crcTable || (daikon.Utils.crcTable = daikon.Utils.makeCRCTable());
    var crc = 0 ^ (-1);

    for (var i = 0; i < dataView.byteLength; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ dataView.getUint8(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
};



daikon.Utils.createBitMask = function (numBytes, bitsStored, unsigned) {
    var mask = 0xFFFFFFFF;
    mask >>>= (((4 - numBytes) * 8) + ((numBytes * 8) - bitsStored));

    if (unsigned) {
        if (numBytes == 1) {
            mask &= 0x000000FF;
        } else if (numBytes == 2) {
            mask &= 0x0000FFFF;
        } else if (numBytes == 4) {
            mask &= 0xFFFFFFFF;
        } else if (numBytes == 8) {
            mask = 0xFFFFFFFF;
        }
    } else {
        mask = 0xFFFFFFFF;
    }

    return mask;
};



/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Utils;
}
