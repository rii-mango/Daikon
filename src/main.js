
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ****/

/**
 * daikon
 * @type {*|{}}
 */
var daikon = daikon || {};

daikon.CompressionUtils = daikon.CompressionUtils || ((typeof require !== 'undefined') ? require('./compression-utils.js') : null);
daikon.Dictionary = daikon.Dictionary || ((typeof require !== 'undefined') ? require('./dictionary.js') : null);
daikon.Image = daikon.Image || ((typeof require !== 'undefined') ? require('./image.js') : null);
daikon.OrderedMapIterator = daikon.OrderedMapIterator || ((typeof require !== 'undefined') ? require('./iterator.js') : null);
daikon.OrderedMap = daikon.OrderedMap || ((typeof require !== 'undefined') ? require('./orderedmap.js') : null);
daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);
daikon.RLE = daikon.RLE || ((typeof require !== 'undefined') ? require('./rle.js') : null);
daikon.Series = daikon.Series || ((typeof require !== 'undefined') ? require('./series.js') : null);
daikon.Tag = daikon.Tag || ((typeof require !== 'undefined') ? require('./tag.js') : null);
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);
daikon.Siemens = daikon.Siemens || ((typeof require !== 'undefined') ? require('./siemens.js') : null);

var jpeg = jpeg || {};
jpeg.lossless = jpeg.lossless || {};
jpeg.lossless.Decoder = ((typeof require !== 'undefined') ? require('jpeg-lossless-decoder-js') : null);

var JpegDecoder = JpegDecoder || ((typeof require !== 'undefined') ? require('../lib/jpeg-baseline.js').JpegImage : null);

var JpxImage = JpxImage || ((typeof require !== 'undefined') ? require('../lib/jpx.js') : null);

var CharLS = CharLS || ((typeof require !== 'undefined') ? require('../lib/charLS-DynamicMemory-browser.js') : null);
var JpegLSDecoder = JpegLSDecoder || ((typeof require !== 'undefined') ? require('../lib/jpeg-ls.js') : null);

var pako = pako || ((typeof require !== 'undefined') ? require('pako') : null);

/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon;
}
