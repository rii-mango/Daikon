
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Tag = daikon.Tag || ((typeof require !== 'undefined') ? require('./tag.js') : null);
daikon.CompressionUtils = daikon.CompressionUtils || ((typeof require !== 'undefined') ? require('./compression-utils.js') : null);
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);
daikon.RLE = daikon.RLE || ((typeof require !== 'undefined') ? require('./rle.js') : null);

var jpeg = jpeg || ((typeof require !== 'undefined') ? require('../lib/lossless.js') : null);

var JpegDecoder = JpegDecoder || ((typeof require !== 'undefined') ? require('../lib/jpg.js').JpegDecoder : null);
var JpxImage = JpxImage || ((typeof require !== 'undefined') ? require('../lib/jpx.js') : null);


/*** Constructor ***/
daikon.Image = daikon.Image || function () {
    this.tags = {};
    this.littleEndian = false;
    this.index = -1;
    this.decompressed = false;
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

daikon.Image.prototype.getCols = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_COLS[0], daikon.Tag.TAG_COLS[1]), 0);
};



daikon.Image.prototype.getRows = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ROWS[0], daikon.Tag.TAG_ROWS[1]), 0);
};



daikon.Image.prototype.getSeriesDescription = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_DESCRIPTION[0], daikon.Tag.TAG_SERIES_DESCRIPTION[1]), 0);
};



daikon.Image.prototype.getSeriesInstanceUID = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_INSTANCE_UID[0], daikon.Tag.TAG_SERIES_INSTANCE_UID[1]), 0);
};



daikon.Image.prototype.getSeriesNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SERIES_NUMBER[0], daikon.Tag.TAG_SERIES_NUMBER[1]), 0);
};



daikon.Image.prototype.getEchoNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ECHO_NUMBER[0], daikon.Tag.TAG_ECHO_NUMBER[1]), 0);
};



daikon.Image.prototype.getImagePosition = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_POSITION[0], daikon.Tag.TAG_IMAGE_POSITION[1]));
};



daikon.Image.prototype.getImagePositionSliceDir = function (sliceDir) {
    var imagePos = daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_POSITION[0], daikon.Tag.TAG_IMAGE_POSITION[1]));
    if (imagePos) {
        if (sliceDir >= 0) {
            return imagePos[sliceDir];
        }
    }

    return 0;
};



daikon.Image.prototype.getSliceLocation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_LOCATION[0], daikon.Tag.TAG_SLICE_LOCATION[1]), 0);
};



daikon.Image.prototype.getSliceLocationVector = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_SLICE_LOCATION_VECTOR[0], daikon.Tag.TAG_SLICE_LOCATION_VECTOR[1]));
};



daikon.Image.prototype.getImageNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_NUM[0], daikon.Tag.TAG_IMAGE_NUM[1]), 0);
};



daikon.Image.prototype.getTemporalPosition = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TEMPORAL_POSITION[0], daikon.Tag.TAG_TEMPORAL_POSITION[1]), 0);
};



daikon.Image.prototype.getTemporalNumber = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_NUMBER_TEMPORAL_POSITIONS[0], daikon.Tag.TAG_NUMBER_TEMPORAL_POSITIONS[1]), 0);
};



daikon.Image.prototype.getSliceGap = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_GAP[0], daikon.Tag.TAG_SLICE_GAP[1]), 0);
};



daikon.Image.prototype.getSliceThickness = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_SLICE_THICKNESS[0], daikon.Tag.TAG_SLICE_THICKNESS[1]), 0);
};



daikon.Image.prototype.getImageMax = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_MAX[0], daikon.Tag.TAG_IMAGE_MAX[1]), 0);
};



daikon.Image.prototype.getImageMin = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_MIN[0], daikon.Tag.TAG_IMAGE_MIN[1]), 0);
};



daikon.Image.prototype.getDataScaleSlope = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_DATA_SCALE_SLOPE[0], daikon.Tag.TAG_DATA_SCALE_SLOPE[1]), 0);
};



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



daikon.Image.prototype.getWindowWidth = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_WINDOW_WIDTH[0], daikon.Tag.TAG_WINDOW_WIDTH[1]), 0);
};



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

    return id;
};



daikon.Image.prototype.getPixelSpacing = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_PIXEL_SPACING[0], daikon.Tag.TAG_PIXEL_SPACING[1]));
};



daikon.Image.prototype.getImageType = function () {
    return daikon.Image.getValueSafely(this.getTag(daikon.Tag.TAG_IMAGE_TYPE[0], daikon.Tag.TAG_IMAGE_TYPE[1]));
};



daikon.Image.prototype.getBitsStored = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_BITS_STORED[0], daikon.Tag.TAG_BITS_STORED[1]), 0);
};



daikon.Image.prototype.getBitsAllocated = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_BITS_ALLOCATED[0], daikon.Tag.TAG_BITS_ALLOCATED[1]), 0);
};



daikon.Image.prototype.getFrameTime = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_FRAME_TIME[0], daikon.Tag.TAG_FRAME_TIME[1]), 0);
};



daikon.Image.prototype.getAcquisitionMatrix = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_ACQUISITION_MATRIX[0], daikon.Tag.TAG_ACQUISITION_MATRIX[1]), 0);
};



daikon.Image.prototype.getTR = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TR, daikon.Tag.TAG_TR[1]), 0);
};



daikon.Image.prototype.putTag = function (tag) {
    this.tags[tag.id] = tag;
};



daikon.Image.prototype.getTag = function (group, element) {
    return this.tags[daikon.Tag.createId(group, element)];
};



daikon.Image.prototype.getPixelData = function () {
    return this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])];
};



daikon.Image.prototype.getPixelDataBytes = function () {
    if (this.isCompressed()) {
        this.decompress();
    }

    return this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value.buffer;
};



daikon.Image.prototype.decompress = function () {
    var jpegs, rle, decoder, decompressed, size, frameSize, temp, ctr, width, height, numComponents, decoded;

    if (!this.decompressed) {
        this.decompressed = true;

        frameSize = this.getRows() * this.getCols() * parseInt(this.getBitsAllocated() / 8);
        size = frameSize * this.getNumberOfFrames();
        decompressed = new DataView(new ArrayBuffer(size));

        if (this.isCompressedJPEGLossless()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new jpeg.lossless.Decoder(jpegs[ctr], parseInt(this.getBitsAllocated() / 8));
                temp = decoder.decode();
                (new Uint8Array(decompressed.buffer)).set(new Uint8Array(temp.buffer), (ctr * frameSize));
                temp = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedJPEGBaseline()) {
            jpegs = this.getJpegs();

            for (ctr = 0; ctr < jpegs.length; ctr+=1) {
                decoder = new JpegDecoder();
                temp = decoder.parse(new Uint8Array(jpegs[ctr]));
                width = decoder.width;
                height = decoder.height;
                numComponents = decoder.numComponents;
                decoded = decoder.getData(width, height);

                if (this.getDataType() === daikon.Image.BYTE_TYPE_RGB) {
                    daikon.Utils.fillBufferRGB(decoded, decompressed, (ctr * frameSize));
                } else {
                    daikon.Utils.fillBuffer(decoded, decompressed, (ctr * frameSize), parseInt(this.getBitsAllocated() / 8));
                }

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

                if (this.getDataType() === daikon.Image.BYTE_TYPE_RGB) {
                    daikon.Utils.fillBufferRGB(decoded, decompressed, (ctr * frameSize));
                } else {
                    daikon.Utils.fillBuffer(decoded, decompressed, (ctr * frameSize), parseInt(this.getBitsAllocated() / 8));
                }

                decoded = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        } else if (this.isCompressedRLE()) {
            rle = this.getRLE();

            for (ctr = 0; ctr < rle.length; ctr+=1) {
                decoder = new daikon.RLE();
                temp = decoder.decode(rle[ctr], this.littleEndian, this.getRows() * this.getCols());
                (new Uint8Array(decompressed.buffer)).set(new Uint8Array(temp.buffer), (ctr * frameSize));
                temp = null;
            }

            this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = decompressed;
        }
    }
};



daikon.Image.prototype.hasPixelData = function () {
    return (this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])] !== undefined);
};



daikon.Image.prototype.clearPixelData = function () {
    this.tags[daikon.Tag.createId(daikon.Tag.TAG_PIXEL_DATA[0], daikon.Tag.TAG_PIXEL_DATA[1])].value = null;
};



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
    canReadAsMosaic = (matSize > 0) && ((matSize < this.getRows()) || (matSize < this.getCols()));
    return labeledAsMosaic && canReadAsMosaic;
};



daikon.Image.prototype.getMosaicCols = function() {
    return this.getCols() / this.getAcquisitionMatrix();
};



daikon.Image.prototype.getMosaicRows = function() {
    return this.getRows() / this.getAcquisitionMatrix();
};



daikon.Image.prototype.isElscint = function() {
    var tag = this.getTag(daikon.Tag.TAG_DATA_SCALE_ELSCINT[0], daikon.Tag.TAG_DATA_SCALE_ELSCINT[1]);
    return (tag !== undefined);
};



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



daikon.Image.prototype.getNumberOfFrames = function () {
    var value = daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_NUMBER_OF_FRAMES[0], daikon.Tag.TAG_NUMBER_OF_FRAMES[1]), 0);

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



daikon.Image.prototype.getPixelRepresentation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PIXEL_REPRESENTATION[0], daikon.Tag.TAG_PIXEL_REPRESENTATION[1]), 0);
};



daikon.Image.prototype.getPhotometricInterpretation = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[0], daikon.Tag.TAG_PHOTOMETRIC_INTERPRETATION[1]), 0);
};



daikon.Image.prototype.getPatientName = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PATIENT_NAME[0], daikon.Tag.TAG_PATIENT_NAME[1]), 0);
};



daikon.Image.prototype.getPatientID = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_PATIENT_ID[0], daikon.Tag.TAG_PATIENT_ID[1]), 0);
};



daikon.Image.prototype.getStudyTime = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_STUDY_TIME[0], daikon.Tag.TAG_STUDY_TIME[1]), 0);
};



daikon.Image.prototype.getTransferSyntax = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_TRANSFER_SYNTAX[0], daikon.Tag.TAG_TRANSFER_SYNTAX[1]), 0);
};



daikon.Image.prototype.getStudyDate = function () {
    return daikon.Image.getSingleValueSafely(this.getTag(daikon.Tag.TAG_STUDY_DATE[0], daikon.Tag.TAG_STUDY_DATE[1]), 0);
};



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



daikon.Image.prototype.getDataType = function () {
    var interp, dataType;

    dataType = this.getPixelRepresentation();

    if (dataType === null) {
        return daikon.Image.BYTE_TYPE_UNKNOWN;
    }

    interp = this.getPhotometricInterpretation();
    if (interp !== null) {
        if ((interp.trim().indexOf('RGB') !== -1) || (interp.trim().indexOf('YBR') !== -1)) {
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


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Image;
}
