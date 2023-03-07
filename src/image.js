
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Tag = daikon.Tag || ((typeof require !== 'undefined') ? require('./tag.js') : null);
daikon.CompressionUtils = daikon.CompressionUtils || ((typeof require !== 'undefined') ? require('./compression-utils.js') : null);
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);
daikon.RLE = daikon.RLE || ((typeof require !== 'undefined') ? require('./rle.js') : null);

var jpeg = ((typeof require !== 'undefined') ? require('jpeg-lossless-decoder-js') : null);
var JpegDecoder = JpegDecoder || ((typeof require !== 'undefined') ? require('../lib/jpeg-baseline.js').JpegImage : null);
var JpxImage = JpxImage || ((typeof require !== 'undefined') ? require('../lib/jpx.js') : null);
var JpegLSDecoder = JpegLSDecoder || ((typeof require !== 'undefined') ? require('../lib/jpeg-ls.js') : null);


/*** Constructor ***/

/**
 * The Image constructor.
 * @property {object} tags - a map of tag id to tag (see daikon.Tag.createId)
 * @property {object} tagsFlat - a flattened map of tags
 * @type {Function}
 */
daikon.Image = daikon.Image || function () {
    this.tags = {};
    this.tagsFlat = {};
    this.littleEndian = false;
    this.index = -1;
    this.decompressed = false;
    this.privateDataAll = null;
    this.convertedPalette = false;
};


/*** Static Pseudo-constants ***/

daikon.Image.SLICE_DIRECTION_UNKNOWN = -1;
daikon.Image.SLICE_DIRECTION_AXIAL = 2;
daikon.Image.SLICE_DIRECTION_CORONAL = 1;
daikon.Image.SLICE_DIRECTION_SAGITTAL = 0;
daikon.Image.SLICE_DIRECTION_OBLIQUE = 3;
daikon.Image.OBLIQUITY_THRESHOLD_COSINE_VALUE = 0.8;

daikon.Image.BYTE_TYPE_UNKNOWN = 0;
daikon.Image.BYTE_TYPE_BINARY = 1;
daikon.Image.BYTE_TYPE_INTEGER = 2;
daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED = 3;
daikon.Image.BYTE_TYPE_FLOAT = 4;
daikon.Image.BYTE_TYPE_COMPLEX = 5;
daikon.Image.BYTE_TYPE_RGB = 6;


/*** Static Methods ***/

daikon.Image.skipPaletteConversion = false;


daikon.Image.getSingleValueSafely = function (tag, index) {
    if (tag && tag.value) {
        return tag.value[index];
    }

    return null;
};



daikon.Image.getValueSafely = function (tag) {
    if (tag) {
        return tag.value;
    }

    return null;
};



// originally from: http://public.kitware.com/pipermail/insight-users/2005-March/012246.html
daikon.Image.getMajorAxisFromPatientRelativeDirectionCosine = function(x, y, z) {
    var axis, orientationX, orientationY, orientationZ, absX, absY, absZ;

    orientationX = (x < 0) ? "R" : "L";
    orientationY = (y < 0) ? "A" : "P";
    orientationZ = (z < 0) ? "F" : "H";

    absX = Math.abs(x);
    absY = Math.abs(y);
    absZ = Math.abs(z);

    // The tests here really don't need to check the other dimensions,
    // just the threshold, since the sum of the squares should be == 1.0
    // but just in case ...

    if ((absX > daikon.Image.OBLIQUITY_THRESHOLD_COSINE_VALUE) && (absX > absY) && (absX > absZ)) {
        axis = orientationX;
    } else if ((absY > daikon.Image.OBLIQUITY_THRESHOLD_COSINE_VALUE) && (absY > absX) && (absY > absZ)) {
        axis = orientationY;
    } else if ((absZ > daikon.Image.OBLIQUITY_THRESHOLD_COSINE_VALUE) && (absZ > absX) && (absZ > absY)) {
        axis = orientationZ;
    } else {
        axis = null;
    }

    return axis;
};


/*** Prototype Methods ***/

/**
 * Returns the number of columns.
 * @returns {number}
 */
daikon.Image.prototype.getCols = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_COLS[0], daikon.Tag.TAG_COLS[1]), 0);
};



/**
 * Returns the number of rows.
 * @returns {number}
 */
daikon.Image.prototype.getRows = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ROWS[0], daikon.Tag.TAG_ROWS[1]), 0);
};



/**
 * Returns the series description.
 * @returns {string}
 */
daikon.Image.prototype.getSeriesDescription = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_DESCRIPTION[0], daikon.Tag.TAG_SERIES_DESCRIPTION[1]), 0);
};



/**
 * Returns the series instance UID.
 * @returns {string}
 */
daikon.Image.prototype.getSeriesInstanceUID = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_INSTANCE_UID[0], daikon.Tag.TAG_SERIES_INSTANCE_UID[1]), 0);
};



/**
 * Returns the series number.
 * @returns {number}
 */
daikon.Image.prototype.getSeriesNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_NUMBER[0], daikon.Tag.TAG_SERIES_NUMBER[1]), 0);
};



/**
 * Returns the echo number.
 * @returns {number}
 */
daikon.Image.prototype.getEchoNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ECHO_NUMBER[0], daikon.Tag.TAG_ECHO_NUMBER[1]), 0);
};



/**
 * Returns the image position.
 * @return {number[]}
 */
daikon.Image.prototype.getImagePosition = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_POSITION[0], daikon.Tag.TAG_IMAGE_POSITION[1]));
};

/**
 * Returns the image axis directions
 * @return {number[]}
 */
daikon.Image.prototype.getImageDirections = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_ORIENTATION[0], daikon.Tag.TAG_IMAGE_ORIENTATION[1]))
};


/**
 * Returns the image position value by index.
 * @param {number} sliceDir - the index
 * @returns {number}
 */
daikon.Image.prototype.getImagePositionSliceDir = function (sliceDir) {
    var imagePos = daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_POSITION[0], daikon.Tag.TAG_IMAGE_POSITION[1]));
    if (imagePos) {
        if (sliceDir >= 0) {
            return imagePos[sliceDir];
        }
    }

    return 0;
};


/**
 * Returns the modality
 * @returns {string}
 */
daikon.Image.prototype.getModality = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_MODALITY[0], daikon.Tag.TAG_MODALITY[1]), 0);
};


/**
 * Returns the slice location.
 * @returns {number}
 */
daikon.Image.prototype.getSliceLocation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_LOCATION[0], daikon.Tag.TAG_SLICE_LOCATION[1]), 0);
};



/**
 * Returns the slice location vector.
 * @returns {number[]}
 */
daikon.Image.prototype.getSliceLocationVector = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_SLICE_LOCATION_VECTOR[0], daikon.Tag.TAG_SLICE_LOCATION_VECTOR[1]));
};



/**
 * Returns the image number.
 * @returns {number}
 */
daikon.Image.prototype.getImageNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_NUM[0], daikon.Tag.TAG_IMAGE_NUM[1]), 0);
};


/**
 * Returns the temporal position.
 * @returns {number}
 */
daikon.Image.prototype.getTemporalPosition = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TEMPORAL_POSITION[0], daikon.Tag.TAG_TEMPORAL_POSITION[1]), 0);
};


/**
 * Returns the temporal number.
 * @returns {number}
 */
daikon.Image.prototype.getTemporalNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_NUMBER_TEMPORAL_POSITIONS[0], daikon.Tag.TAG_NUMBER_TEMPORAL_POSITIONS[1]), 0);
};


/**
 * Returns the slice gap.
 * @returns {number}
 */
daikon.Image.prototype.getSliceGap = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_GAP[0], daikon.Tag.TAG_SLICE_GAP[1]), 0);
};


/**
 * Returns the slice thickness.
 * @returns {number}
 */
daikon.Image.prototype.getSliceThickness = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_THICKNESS[0], daikon.Tag.TAG_SLICE_THICKNESS[1]), 0);
};


/**
 * Returns the image maximum.
 * @returns {number}
 */
daikon.Image.prototype.getImageMax = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_MAX[0], daikon.Tag.TAG_IMAGE_MAX[1]), 0);
};


/**
 * Returns the image minimum.
 * @returns {number}
 */
daikon.Image.prototype.getImageMin = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_MIN[0], daikon.Tag.TAG_IMAGE_MIN[1]), 0);
};


/**
 * Returns the rescale slope.
 * @returns {number}
 */
daikon.Image.prototype.getDataScaleSlope = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_DATA_SCALE_SLOPE[0], daikon.Tag.TAG_DATA_SCALE_SLOPE[1]), 0);
};


/**
 * Returns the rescale intercept.
 * @returns {number}
 */
daikon.Image.prototype.getDataScaleIntercept = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_DATA_SCALE_INTERCEPT[0], daikon.Tag.TAG_DATA_SCALE_INTERCEPT[1]), 0);
};



daikon.Image.prototype.getDataScaleElscint = function () {
    var scale = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_DATA_SCALE_ELSCINT[0], daikon.Tag.TAG_DATA_SCALE_ELSCINT[1]), 0);

    if (!scale) {
        scale = 1;
    }

    var bandwidth = this.getPixelBandwidth();
    scale = Math.sqrt(bandwidth) / (10 * scale);

    if (scale <= 0) {
        scale = 1;
    }

    return scale;
};


/**
 * Returns the window width.
 * @returns {number}
 */
daikon.Image.prototype.getWindowWidth = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_WINDOW_WIDTH[0], daikon.Tag.TAG_WINDOW_WIDTH[1]), 0);
};


/**
 * Returns the window center.
 * @returns {number}
 */
daikon.Image.prototype.getWindowCenter = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_WINDOW_CENTER[0], daikon.Tag.TAG_WINDOW_CENTER[1]), 0);
};



daikon.Image.prototype.getPixelBandwidth = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PIXEL_BANDWIDTH[0], daikon.Tag.TAG_PIXEL_BANDWIDTH[1]), 0);
};



daikon.Image.prototype.getSeriesId = function () {
    var des = this.getSeriesDescription();
    var uid = this.getSeriesInstanceUID();
    var num = this.getSeriesNumber();
    var echo = this.getEchoNumber();
    var orientation = this.getOrientation();
    var cols = this.getCols();
    var rows = this.getRows();

    var id = "";

    if (des !== null) {
        id += (" " + des);
    }

    if (uid !== null) {
        id += (" " + uid);
    }

    if (num !== null) {
        id += (" " + num);
    }

    if (echo !== null) {
        id += (" " + echo);
    }

    if (orientation !== null) {
        id += (" " + orientation);
    }

    id += (" (" + cols + " x " + rows + ")");

    return id;
};


/**
 * Returns the pixel spacing.
 * @returns {number[]}
 */
daikon.Image.prototype.getPixelSpacing = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_PIXEL_SPACING[0], daikon.Tag.TAG_PIXEL_SPACING[1]));
};


/**
 * Returns the image type.
 * @returns {string[]}
 */
daikon.Image.prototype.getImageType = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_TYPE[0], daikon.Tag.TAG_IMAGE_TYPE[1]));
};


/**
 * Returns the number of bits stored.
 * @returns {number}
 */
daikon.Image.prototype.getBitsStored = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_BITS_STORED[0], daikon.Tag.TAG_BITS_STORED[1]), 0);
};


/**
 * Returns the number of bits allocated.
 * @returns {number}
 */
daikon.Image.prototype.getBitsAllocated = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_BITS_ALLOCATED[0], daikon.Tag.TAG_BITS_ALLOCATED[1]), 0);
};


/**
 * Returns the frame time.
 * @returns {number}
 */
daikon.Image.prototype.getFrameTime = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_FRAME_TIME[0], daikon.Tag.TAG_FRAME_TIME[1]), 0);
};


/**
 * Returns the acquisition matrix (e.g., "mosaic" data).
 * @returns {number[]}
 */
daikon.Image.prototype.getAcquisitionMatrix = function () {
    var mat, matPrivate, start, end, str;

    mat = [0, 0];
    mat[0] = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ACQUISITION_MATRIX[0], daikon.Tag.TAG_ACQUISITION_MATRIX[1]), 0);

    if (this.privateDataAll === null) {
        this.privateDataAll = this.getAllInterpretedPrivateData();
    }

    if ((this.privateDataAll !== null) && (this.privateDataAll.length > 0)) {
        start = this.privateDataAll.indexOf("AcquisitionMatrixText");
        if (start !== -1) {

            end = this.privateDataAll.indexOf('\n', start);

            if (end !== -1) {
                str = this.privateDataAll.substring(start, end);
                matPrivate = str.match(/\d+/g);

                if ((matPrivate !== null) && (matPrivate.length === 2)) {
                    mat[0] = matPrivate[0];
                    mat[1] = matPrivate[1];
                } else if ((matPrivate !== null) && (matPrivate.length === 1)) {
                    mat[0] = matPrivate[0];
                }
            }
        }
    }

    if (mat[1] === 0) {
        mat[1] = mat[0];
    }

    return mat;
};


/**
 * Returns the TR.
 * @returns {number}
 */
daikon.Image.prototype.getTR = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TR, daikon.Tag.TAG_TR[1]), 0);
};



daikon.Image.prototype.putTag = function (tag) {
    if (this.tags[tag.id] && this.tags[tag.id].value[0] !== tag.value[0]) {
        return;
    }
    this.tags[tag.id] = tag;
    this.putFlattenedTag(this.tagsFlat, tag);
};



daikon.Image.prototype.putFlattenedTag = function (tags, tag) {
    var ctr;

    if (tag.sublist) {
        for (ctr = 0; ctr < tag.value.length; ctr += 1) {
            this.putFlattenedTag(tags, tag.value[ctr]);
        }
    } else {
        if (!tags[tag.id]) {
            tags[tag.id] = tag;
        }
    }
};


/**
 * Returns a tag matching the specified group and element.
 * @param {number} group
 * @param {number} element
 * @returns {daikon.Tag}
 */
daikon.Image.prototype.getTag = function (group, element) {
    var tagId = daikon.Tag.createId(group, element);

    if (this.tags[tagId]) {
        return this.tags[tagId];
    }

    return this.tagsFlat[tagId];
};


/**
 * Returns the pixel data tag.
 * @returns {daikon.Tag}
 */
daikon.Image.prototype.getPixelData = function () {
    return this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])];
};



daikon.Image.prototype.getPixelDataBytes = function () {
    if (this.isCompressed()) {
        this.decompress();
    }

    if (this.isPalette() && !daikon.Image.skipPaletteConversion) {
        this.convertPalette();
    }

    return this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value.buffer;
};


/**
 * Returns the raw pixel data.
 * @returns {ArrayBuffer}
 */
daikon.Image.prototype.getRawData = function () {
    return this.getPixelDataBytes();
};


/**
 * Returns interpreted pixel data (considers datatype, byte order, data scales).
 * @param {boolean} asArray - if true, the returned data is a JavaScript Array
 * @param {boolean} asObject - if true, an object is returned with properties: data, min, max, minIndex, maxIndex, numCols, numRows
 * @param {number} frameIndex - if provided, only the desired frame in a multi-frame dataset is returned
 * @returns {Float32Array|Array|object}
 */
daikon.Image.prototype.getInterpretedData = function (asArray, asObject, frameIndex) {
    var datatype, numBytes, numElements, dataView, data, ctr, mask, slope, intercept, min, max, value, minIndex,
        maxIndex, littleEndian, rawValue, rawData, allFrames, elementsPerFrame, totalElements, offset, dataCtr;
    allFrames = arguments.length < 3;
    mask = daikon.Utils.createBitMask(this.getBitsAllocated() / 8, this.getBitsStored(),
        this.getDataType() === daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED);
    datatype = this.getPixelRepresentation() ? daikon.Image.BYTE_TYPE_INTEGER : daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED;
    numBytes = this.getBitsAllocated() / 8;
    rawData = this.getRawData();
    dataView = new DataView(rawData);
    totalElements = rawData.byteLength / numBytes;
    elementsPerFrame = totalElements / this.getNumberOfFrames();
    numElements = allFrames ? totalElements : elementsPerFrame;
    offset = allFrames ? 0 : frameIndex * elementsPerFrame;
    slope = this.getDataScaleSlope() || 1;
    intercept = this.getDataScaleIntercept() || 0;
    min = daikon.Utils.MAX_VALUE;
    max = daikon.Utils.MIN_VALUE;
    minIndex = -1;
    maxIndex = -1;
    littleEndian = this.littleEndian;

    if (asArray) {
        data = new Array(numElements);
    } else {
        data = new Float32Array(numElements);
    }
    var getWord;
    if (datatype === daikon.Image.BYTE_TYPE_INTEGER) {
        if (numBytes === 1) {
            getWord = dataView.getInt8.bind(dataView)
        } else if (numBytes === 2) {
            getWord = dataView.getInt16.bind(dataView)
        }
    } else if (datatype === daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED) {
        if (numBytes === 1) {
            getWord = dataView.getUint8.bind(dataView)
        } else if (numBytes === 2) {
            getWord = dataView.getUint16.bind(dataView)
        }
    }
    
    // invert pixel values if INVERTED or MONOCHROME1
    var invert = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_LUT_SHAPE[0], daikon.Tag.TAG_LUT_SHAPE[1]), 0) === "INVERSE";
    invert = invert || this.getPhotometricInterpretation() === "MONOCHROME1";
    if (invert) {
        var maxVal = Math.pow(2, this.getBitsStored()) - 1;
        var minVal = 0;
        if (datatype === daikon.Image.BYTE_TYPE_INTEGER) {
            maxVal /= 2;
            minVal = -maxVal;
        }
        var originalGetWord = getWord;
        getWord = function(offset, endian) { 
            var val = maxVal - originalGetWord(offset, endian);
            return Math.min(maxVal, Math.max(minVal, val)); 
        }
    }

    for (ctr = offset, dataCtr = 0; dataCtr < numElements; ctr++, dataCtr++) {
        rawValue = getWord(ctr * numBytes, littleEndian);

        value = ((rawValue & mask) * slope) + intercept;
        data[dataCtr] = value;

        if (value < min) {
            min = value;
            minIndex = dataCtr;
        }

        if (value > max) {
            max = value;
            maxIndex = dataCtr;
        }
    }

    if (asObject) {
        return {data: data, min: min, minIndex: minIndex, max: max, maxIndex: maxIndex, numCols: this.getCols(),
            numRows: this.getRows()};
    }
    
    return data;
};



daikon.Image.prototype.convertPalette = function () {
    var data, reds, greens, blues, rgb, numBytes, numElements, ctr, index, rVal, gVal, bVal;

    data = this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value;

    reds = this.getPalleteValues(daikon.Tag.TAG_PALETTE_RED);
    greens = this.getPalleteValues(daikon.Tag.TAG_PALETTE_GREEN);
    blues = this.getPalleteValues(daikon.Tag.TAG_PALETTE_BLUE);

    if ((reds !== null) && (reds.length > 0) && (greens !== null) && (greens.length > 0) && (blues !== null) &&
            (blues.length > 0) && !this.convertedPalette) {
        rgb = new DataView(new ArrayBuffer(this.getRows() * this.getCols() * this.getNumberOfFrames() * 3));
        numBytes = parseInt(Math.ceil(this.getBitsAllocated() / 8));
        numElements = data.byteLength / numBytes;

        if (numBytes === 1) {
            for (ctr = 0; ctr < numElements; ctr += 1) {
                index = data.getUint8(ctr);
                rVal = reds[index];
                gVal = greens[index];
                bVal = blues[index];
                rgb.setUint8((ctr * 3), rVal);
                rgb.setUint8((ctr * 3) + 1, gVal);
                rgb.setUint8((ctr * 3) + 2, bVal);
            }
        } else if (numBytes === 2) {
            for (ctr = 0; ctr < numElements; ctr += 1) {
                index = data.getUint16(ctr * 2);
                rVal = reds[index];
                gVal = greens[index];
                bVal = blues[index];
                rgb.setUint8((ctr * 3), rVal);
                rgb.setUint8((ctr * 3) + 1, gVal);
                rgb.setUint8((ctr * 3) + 2, bVal);
            }
        }

        data = rgb;
        this.convertedPalette = true;
    }

    this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = data;
};



daikon.Image.prototype.decompressJPEG = function (jpg) {
    if (this.isCompressedJPEGLossless()) {
        var decoder = new jpeg.lossless.Decoder();
        return decoder.decode(jpg);
    } else if (this.isCompressedJPEGBaseline()) {
        var decoder = new JpegDecoder();
        decoder.parse(new Uint8Array(jpg));
        var width = decoder.width;
        var height = decoder.height;

        var decoded;
        if (this.getBitsAllocated() === 8) {
            decoded = decoder.getData(width, height);
        } else if (this.getBitsAllocated() === 16) {
            decoded = decoder.getData16(width, height);
        }

        return decoded;
    } else if (this.isCompressedJPEG2000()) {
        var decoder = new JpxImage();
        decoder.parse(new Uint8Array(jpg));
        return decoder.tiles[0].items;
    } else if (this.isCompressedJPEGLS()) {
        var decoder = new JpegLSDecoder();
        return decoder.decodeJPEGLS(new Uint8Array(jpg), this.getDataType() === daikon.Image.BYTE_TYPE_INTEGER);
    }
};



daikon.Image.prototype.decompress = function () {
    var jpegs, rle, decoder, decompressed, numFrames, frameSize, temp, ctr, width, height, numComponents, decoded;

    decompressed = null;

    if (!this.decompressed) {
        this.decompressed = true;

        frameSize = this.getRows() * this.getCols() * parseInt(Math.ceil(this.getBitsAllocated() / 8));
        numFrames = this.getNumberOfFrames();

        if (this.isCompressedJPEGLossless()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new jpeg.lossless.Decoder();
                temp = decoder.decode(jpegs[ctr]);
                numComponents = decoder.numComp;

                if (decompressed === null) {
                    decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents));
                }

                (new Uint8Array(decompressed.buffer)).set(new Uint8Array(temp.buffer), (ctr * frameSize * numComponents));
                temp = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedJPEGBaseline()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new JpegDecoder();
                decoder.parse(new Uint8Array(jpegs[ctr]));
                width = decoder.width;
                height = decoder.height;
                numComponents = decoder.components.length;

                if (decompressed === null) {
                    decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents));
                }

                if (this.getBitsAllocated() === 8) {
                    decoded = decoder.getData(width, height);
                } else if (this.getBitsAllocated() === 16) {
                    decoded = decoder.getData16(width, height);
                }

                daikon.Utils.fillBuffer(decoded, decompressed, (ctr * frameSize * numComponents),
                    parseInt(Math.ceil(this.getBitsAllocated() / 8)));

                decoded = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedJPEG2000()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new JpxImage();
                decoder.parse(new Uint8Array(jpegs[ctr]));
                width = decoder.width;
                height = decoder.height;
                decoded = decoder.tiles[0].items;
                numComponents = decoder.componentsCount;

                if (decompressed === null) {
                    decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents));
                }

                daikon.Utils.fillBuffer(decoded, decompressed, (ctr * frameSize * numComponents),
                    parseInt(Math.ceil(this.getBitsAllocated() / 8)));

                decoded = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedJPEGLS()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new JpegLSDecoder();
                var decoded = decoder.decodeJPEGLS(new Uint8Array(jpegs[ctr]), this.getDataType() === daikon.Image.BYTE_TYPE_INTEGER);
                width = decoded.columns;
                height = decoded.rows;
                decoded = decoded.pixelData;
                numComponents = this.getNumberOfSamplesPerPixel();

                if (decompressed === null) {
                    decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents));
                }

                daikon.Utils.fillBuffer(decoded, decompressed, (ctr * frameSize * numComponents),
                    parseInt(Math.ceil(this.getBitsAllocated() / 8)));

                decoded = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedRLE()) {
            rle = this.getRLE();

            for (ctr = 0; ctr < rle.length; ctr+=1) {
                decoder = new daikon.RLE();
                temp = decoder.decode(rle[ctr], this.littleEndian, this.getRows() * this.getCols());
                numComponents = (decoder.numSegments === 3 ? 3 : 1);

                if (decompressed === null) {
                    decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents));
                }

                (new Uint8Array(decompressed.buffer)).set(new Uint8Array(temp.buffer), (ctr * frameSize * numComponents));
                temp = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        }
    }
};


/**
 * Returns true if pixel data is found.
 * @returns {boolean}
 */
daikon.Image.prototype.hasPixelData = function () {
    return (this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])] !== undefined);
};



daikon.Image.prototype.clearPixelData = function () {
    this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = null;
};


/**
 * Returns an orientation string (e.g., XYZ+--).
 * @returns {string}
 */
daikon.Image.prototype.getOrientation = function () {
    var orientation = null,
        dirCos = daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_ORIENTATION[0], daikon.Tag.TAG_IMAGE_ORIENTATION[1])),
        ctr,
        spacing,
        rowSpacing,
        swapZ,
        bigRow = 0, bigCol = 0,
        biggest = 0, orient = '';

    if (!dirCos || (dirCos.length !== 6)) {
        return null;
    }

    spacing = this.getPixelSpacing();

    if (!spacing) {
        return null;
    }

    rowSpacing = spacing[0];
    swapZ = true;

    for (ctr = 0; ctr < 3; ctr += 1) {
        if (Math.abs(dirCos[ctr]) > biggest) {
            biggest = Math.abs(dirCos[ctr]);
            bigRow = ctr;
        }
    }

    biggest = 0;
    for (; ctr < 6; ctr += 1) {
        if (Math.abs(dirCos[ctr]) > biggest) {
            biggest = Math.abs(dirCos[ctr]);
            bigCol = ctr;
        }
    }

    switch (bigRow) {
        case 0:
            orient += ('X');
            if (bigCol === 4) {
                orient += ("YZ");
            } else {
                orient += ("ZY");
            }
            break;
        case 1:
            orient += ('Y');
            if (bigCol === 3) {
                orient += ("XZ");
            } else {
                orient += ("ZX");
            }
            break;
        case 2:
            orient += ('Z');
            if (bigCol === 3) {
                orient += ("XY");
            } else {
                orient += ("YX");
            }
            break;
        default:
            break;
    }

    switch (bigRow) {
        case 0:
            if (dirCos[bigRow] > 0.0) {
                orient += ('-');
            } else {
                orient += ('+');
            }
            if (bigCol === 4) {
                if (dirCos[bigCol] > 0.0) {
                    orient += ('-');
                } else {
                    orient += ('+');
                }
            } else {
                if (dirCos[bigCol] > 0.0) {
                    orient += ('+');
                } else {
                    orient += ('-');
                }
            }
            break;
        case 1:
            if (dirCos[bigRow] > 0.0) {
                orient += ('-');
            } else {
                orient += ('+');
            }
            if (bigCol === 3) {
                if (dirCos[bigCol] > 0.0) {
                    orient += ('-');
                } else {
                    orient += ('+');
                }
            } else {
                if (dirCos[bigCol] > 0.0) {
                    orient += ('+');
                } else {
                    orient += ('-');
                }
            }
            break;
        case 2:
            if (dirCos[bigRow] > 0.0) {
                orient += ('+');
            } else {
                orient += ('-');
            }
            //Has to be X or Y so opposite senses
            if (dirCos[bigCol] > 0.0) {
                orient += ('-');
            } else {
                orient += ('+');
            }
            break;
        default:
            break;
    }

    if (rowSpacing === 0.0) {
        orient += ('+');
        orientation = orient;
    } else {
        if (swapZ) {
            switch (orient.charAt(2)) {
                case 'X':
                    if (rowSpacing > 0.0) {
                        orient += ('-');
                    } else {
                        orient += ('+');
                    }
                    break;
                case 'Y':
                case 'Z':
                    if (rowSpacing > 0.0) {
                        orient += ('+');
                    } else {
                        orient += ('-');
                    }
                    break;
                default:
                    break;
            }
        } else {
            switch (orient.charAt(2)) {
                case 'X':
                    if (rowSpacing > 0.0) {
                        orient += ('+');
                    } else {
                        orient += ('-');
                    }
                    break;
                case 'Y':
                case 'Z':
                    if (rowSpacing > 0.0) {
                        orient += ('-');
                    } else {
                        orient += ('+');
                    }
                    break;
                default:
                    break;
            }
        }

        orientation = orient;
    }

    return orientation;
};


/**
 * Returns true if this image is "mosaic".
 * @returns {boolean}
 */
daikon.Image.prototype.isMosaic = function () {
    var imageType, labeledAsMosaic = false, canReadAsMosaic, ctr, matSize;

    imageType = this.getImageType();

    if (imageType !== null) {
        for (ctr = 0; ctr < imageType.length; ctr += 1) {
            if (imageType[ctr].toUpperCase().indexOf("MOSAIC") !== -1) {
                labeledAsMosaic = true;
                break;
            }
        }
    }

    matSize = this.getAcquisitionMatrix();
    canReadAsMosaic = (matSize[0] > 0) && ((matSize[0] < this.getRows()) || (matSize[1] < this.getCols()));
    return labeledAsMosaic && canReadAsMosaic;
};


/**
 * Returns true if this image uses palette colors.
 * @returns {boolean}
 */
daikon.Image.prototype.isPalette = function () {
    var value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[0], daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[1]), 0);

    if (value !== null) {
        if (value.toLowerCase().indexOf("palette") !== -1) {
            return true;
        }
    }

    return false;
};



daikon.Image.prototype.getMosaicCols = function() {
    return this.getCols() / this.getAcquisitionMatrix()[1];
};



daikon.Image.prototype.getMosaicRows = function() {
    return this.getRows() / this.getAcquisitionMatrix()[0];
};



daikon.Image.prototype.isElscint = function() {
    var tag = this.getTag(daikon.Tag.TAG_DATA_SCALE_ELSCINT[0], daikon.Tag.TAG_DATA_SCALE_ELSCINT[1]);
    return (tag !== undefined);
};


/**
 * Returns true if this image stores compressed data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressed = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG) !== -1) {
            return true;
        } else if (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_RLE) !== -1) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true if this image stores JPEG data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedJPEG = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG) !== -1) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true of this image stores lossless JPEG data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedJPEGLossless = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if ((transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS) !== -1) ||
            (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS_SEL1) !== -1)) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true if this image stores baseline JPEG data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedJPEGBaseline = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if ((transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_8BIT) !== -1) ||
            (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_12BIT) !== -1)) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true if this image stores JPEG2000 data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedJPEG2000 = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if ((transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000) !== -1) ||
            (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000_LOSSLESS) !== -1)) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true if this image stores JPEG-LS data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedJPEGLS = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if ((transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LS) !== -1) ||
            (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LS_LOSSLESS) !== -1)) {
            return true;
        }
    }

    return false;
};


/**
 * Returns true if this image stores RLE data.
 * @returns {boolean}
 */
daikon.Image.prototype.isCompressedRLE = function() {
    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    var transferSyntax = this.getTransferSyntax();
    if (transferSyntax) {
        if (transferSyntax.indexOf(daikon.Parser.TRANSFER_SYNTAX_COMPRESSION_RLE) !== -1) {
            return true;
        }
    }

    return false;
};


/**
 * Returns the number of frames.
 * @returns {number}
 */
daikon.Image.prototype.getNumberOfFrames = function () {
    var value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_NUMBER_OF_FRAMES[0], daikon.Tag.TAG_NUMBER_OF_FRAMES[1]), 0);

    if (value !== null) {
        return value;
    }

    return 1;
};


/**
 * Returns the number of samples per pixel.
 * @returns {number}
 */
daikon.Image.prototype.getNumberOfSamplesPerPixel = function () {
    var value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SAMPLES_PER_PIXEL[0], daikon.Tag.TAG_SAMPLES_PER_PIXEL[1]), 0);

    if (value !== null) {
        return value;
    }

    return 1;
};



daikon.Image.prototype.getNumberOfImplicitFrames = function () {
    var pixelData, length, size;

    if (this.isCompressed()) {
        return 1;
    }

    pixelData = this.getPixelData();
    length = pixelData.offsetEnd - pixelData.offsetValue;
    size = this.getCols() * this.getRows() * (parseInt(this.getBitsAllocated() / 8));

    return parseInt(length / size);
};


/**
 * Returns the pixel representation.
 * @returns {number}
 */
daikon.Image.prototype.getPixelRepresentation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PIXEL_REPRESENTATION[0], daikon.Tag.TAG_PIXEL_REPRESENTATION[1]), 0);
};


/**
 * Returns the photometric interpretation.
 * @returns {string}
 */
daikon.Image.prototype.getPhotometricInterpretation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[0], daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[1]), 0);
};


/**
 * Returns the patient name.
 * @returns {string}
 */
daikon.Image.prototype.getPatientName = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PATIENT_NAME[0], daikon.Tag.TAG_PATIENT_NAME[1]), 0);
};


/**
 * Returns the patient ID.
 * @returns {string}
 */
daikon.Image.prototype.getPatientID = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PATIENT_ID[0], daikon.Tag.TAG_PATIENT_ID[1]), 0);
};


/**
 * Returns the study time.
 * @returns {string}
 */
daikon.Image.prototype.getStudyTime = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_STUDY_TIME[0], daikon.Tag.TAG_STUDY_TIME[1]), 0);
};


/**
 * Returns the transfer syntax.
 * @returns {string}
 */
daikon.Image.prototype.getTransferSyntax = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TRANSFER_SYNTAX[0], daikon.Tag.TAG_TRANSFER_SYNTAX[1]), 0);
};


/**
 * Returns the study date.
 * @returns {string}
 */
daikon.Image.prototype.getStudyDate = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_STUDY_DATE[0], daikon.Tag.TAG_STUDY_DATE[1]), 0);
};


/**
 * Returns the planar configuration.
 * @returns {number}
 */
daikon.Image.prototype.getPlanarConfig = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PLANAR_CONFIG[0], daikon.Tag.TAG_PLANAR_CONFIG[1]), 0);
};


/**
 * Returns all descriptive info for this image.
 * @returns {string}
 */
daikon.Image.prototype.getImageDescription = function () {
    var value, string = "";

    value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_STUDY_DES[0], daikon.Tag.TAG_STUDY_DES[1]), 0);
    if (value !== null) {
        string += (" " + value);
    }

    value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_DESCRIPTION[0], daikon.Tag.TAG_SERIES_DESCRIPTION[1]), 0);
    if (value !== null) {
        string += (" " + value);
    }

    value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_COMMENTS[0], daikon.Tag.TAG_IMAGE_COMMENTS[1]), 0);
    if (value !== null) {
        string += (" " + value);
    }

    return string.trim();
};


/**
 * Returns the datatype (e.g., daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED).
 * @returns {number}
 */
daikon.Image.prototype.getDataType = function () {
    var interp, dataType;

    dataType = this.getPixelRepresentation();

    if (dataType === null) {
        return daikon.Image.BYTE_TYPE_UNKNOWN;
    }

    interp = this.getPhotometricInterpretation();
    if (interp !== null) {
        if ((interp.trim().indexOf('RGB') !== -1) || (interp.trim().indexOf('YBR') !== -1) ||
                (interp.trim().toLowerCase().indexOf('palette') !== -1)) {
            return daikon.Image.BYTE_TYPE_RGB;
        }
    }

    if (dataType === 0) {
        return daikon.Image.BYTE_TYPE_INTEGER_UNSIGNED;
    } else if (dataType === 1) {
        return daikon.Image.BYTE_TYPE_INTEGER;
    } else {
        return daikon.Image.BYTE_TYPE_UNKNOWN;
    }
};



// originally from: http://public.kitware.com/pipermail/insight-users/2005-March/012246.html
daikon.Image.prototype.getAcquiredSliceDirection = function () {
    var dirCos, rowAxis, colAxis, label;

    dirCos = daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_ORIENTATION[0], daikon.Tag.TAG_IMAGE_ORIENTATION[1]));

    if (!dirCos || (dirCos.length !== 6)) {
        return daikon.Image.SLICE_DIRECTION_UNKNOWN;
    }

    rowAxis = daikon.Image.getMajorAxisFromPatientRelativeDirectionCosine(dirCos[0], dirCos[1], dirCos[2]);
    colAxis = daikon.Image.getMajorAxisFromPatientRelativeDirectionCosine(dirCos[3], dirCos[4], dirCos[5]);

    if ((rowAxis !== null) && (colAxis !== null)) {
        if (((rowAxis === "R") || (rowAxis === "L")) && ((colAxis === "A") || (colAxis === "P"))) {
            label = daikon.Image.SLICE_DIRECTION_AXIAL;
        } else if (((colAxis === "R") || (colAxis === "L")) && ((rowAxis === "A") || (rowAxis === "P"))) {
            label = daikon.Image.SLICE_DIRECTION_AXIAL;
        } else if (((rowAxis === "R") || (rowAxis === "L")) && ((colAxis === "H") || (colAxis === "F"))) {
            label = daikon.Image.SLICE_DIRECTION_CORONAL;
        } else if (((colAxis === "R") || (colAxis === "L")) && ((rowAxis === "H") || (rowAxis === "F"))) {
            label = daikon.Image.SLICE_DIRECTION_CORONAL;
        } else if (((rowAxis === "A") || (rowAxis === "P")) && ((colAxis === "H") || (colAxis === "F"))) {
            label = daikon.Image.SLICE_DIRECTION_SAGITTAL;
        } else if (((colAxis === "A") || (colAxis === "P")) && ((rowAxis === "H") || (rowAxis === "F"))) {
            label = daikon.Image.SLICE_DIRECTION_SAGITTAL;
        }
    } else {
        label = daikon.Image.SLICE_DIRECTION_OBLIQUE;
    }

    return label;
};



// returns an array of tags
/**
 * Returns encapsulated data tags.
 * @returns {daikon.Tag[]}
 */
daikon.Image.prototype.getEncapsulatedData = function () {
    var buffer, parser;

    daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);

    buffer = this.getPixelData().value.buffer;
    parser = new daikon.Parser();
    return parser.parseEncapsulated(new DataView(buffer));
};



daikon.Image.prototype.getJpegs = function () {
    var encapTags, numTags, ctr, currentJpeg, data = [], dataConcat = [];

    encapTags = this.getEncapsulatedData();

    // organize data as an array of an array of JPEG parts
    if (encapTags) {
        numTags = encapTags.length;

        for (ctr = 0; ctr < numTags; ctr += 1) {
            if (daikon.CompressionUtils.isHeaderJPEG(encapTags[ctr].value) ||
                daikon.CompressionUtils.isHeaderJPEG2000(encapTags[ctr].value)) {
                currentJpeg = [];
                currentJpeg.push(encapTags[ctr].value.buffer);
                data.push(currentJpeg);
            } else if (currentJpeg && encapTags[ctr].value) {
                currentJpeg.push(encapTags[ctr].value.buffer);
            }
        }
    }

    // concat into an array of full JPEGs
    for (ctr = 0; ctr < data.length; ctr += 1) {
        if (data[ctr].length > 1) {
            dataConcat[ctr] = daikon.Utils.concatArrayBuffers2(data[ctr]);
        } else {
            dataConcat[ctr] = data[ctr][0];
        }

        data[ctr] = null;
    }

    return dataConcat;
};



daikon.Image.prototype.getRLE = function () {
    var encapTags, numTags, ctr, data = [];

    encapTags = this.getEncapsulatedData();

    // organize data as an array of an array of JPEG parts
    if (encapTags) {
        numTags = encapTags.length;

        // the first sublist item contains offsets, need offsets?
        for (ctr = 1; ctr < numTags; ctr += 1) {
            if (encapTags[ctr].value) {
                data.push(encapTags[ctr].value.buffer);
            }
        }
    }

    return data;
};


/**
 * Returns a string of interpreted private data.
 * @returns {string}
 */
daikon.Image.prototype.getAllInterpretedPrivateData = function() {
    var ctr, key, tag, str = "";

    var sorted_keys = Object.keys(this.tags).sort();

    for (ctr = 0; ctr < sorted_keys.length; ctr+=1) {
        key = sorted_keys[ctr];
        if (this.tags.hasOwnProperty(key)) {
            tag = this.tags[key];
            if (tag.hasInterpretedPrivateData()) {
                str += tag.value;
            }
        }
    }

    return str;
};


/**
 * Returns a string representation of this image.
 * @returns {string}
 */
daikon.Image.prototype.toString = function () {
    var ctr, tag, key, str = "";

    var sorted_keys = Object.keys(this.tags).sort();

    for (ctr = 0; ctr < sorted_keys.length; ctr+=1) {
        key = sorted_keys[ctr];
        if (this.tags.hasOwnProperty(key)) {
            tag = this.tags[key];
            str += (tag.toHTMLString() + "<br />");
        }
    }

    str = str.replace(/\n\s*\n/g, '\n');  // replace mutli-newlines with single newline
    str = str.replace(/(?:\r\n|\r|\n)/g, '<br />');  // replace newlines with <br>

    return str;
};



daikon.Image.prototype.getPalleteValues = function (tagID) {
    /*jslint bitwise: true */

    var valsBig, valsLittle, value, numVals, ctr, valsBigMax, valsBigMin, valsLittleMax, valsLittleMin, valsBigDiff,
        valsLittleDiff;

    valsBig = null;
    valsLittle = null;

    value = daikon.Image.getValueSafely(this.getTag(tagID[0], tagID[1]));

    if (value !== null) {
        numVals = value.buffer.byteLength / 2;
        valsBig = [];
        valsLittle = [];

        for (ctr = 0; ctr < numVals; ctr += 1) {
            valsBig[ctr] = (value.getUint16(ctr * 2, false) & 0xFFFF);
            valsLittle[ctr] = (value.getUint16(ctr * 2, true) & 0xFFFF);
        }

        valsBigMax = Math.max.apply(Math, valsBig);
        valsBigMin = Math.min.apply(Math, valsBig);
        valsLittleMax = Math.max.apply(Math, valsLittle);
        valsLittleMin = Math.min.apply(Math, valsLittle);
        valsBigDiff = Math.abs(valsBigMax - valsBigMin);
        valsLittleDiff = Math.abs(valsLittleMax - valsLittleMin);

        if (valsBigDiff < valsLittleDiff) {
            return this.scalePalette(valsBig);
        } else {
            return this.scalePalette(valsLittle);
        }
    }

    return null;
};



daikon.Image.prototype.scalePalette = function (pal) {
    var min, max, ctr, slope, intercept;

    max = Math.max.apply(Math, pal);
    min = Math.min.apply(Math, pal);

    if ((max > 255) || (min < 0)) {
        slope = 255.0 / (max - min);
        intercept = min;

        for (ctr = 0; ctr < pal.length; ctr += 1) {
            pal[ctr] = parseInt(Math.round((pal[ctr] - intercept) * slope));
        }
    }

    return pal;
};



/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Image;
}
