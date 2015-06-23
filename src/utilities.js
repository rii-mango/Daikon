
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Utils = daikon.Utils || {};


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


daikon.Utils.getStringAt = function (dataview, start, length) {
    var str = "", ctr, ch;

    for (ctr = 0; ctr < length; ctr += 1) {
        ch = dataview.getUint8(start + ctr);

        if (ch !== 0) {
            str += String.fromCharCode(ch);
        }
    }

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
        data[6]*Math.pow(2,8*1)+
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


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Utils;
}
