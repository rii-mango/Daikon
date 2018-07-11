
/*jslint browser: true, node: true */
/*global require, module */

"use strict";

/*** Imports ***/
var daikon = daikon || {};
daikon.Parser = daikon.Parser || ((typeof require !== 'undefined') ? require('./parser.js') : null);
daikon.Image = daikon.Image || ((typeof require !== 'undefined') ? require('./image.js') : null);
daikon.OrderedMap = daikon.OrderedMap || ((typeof require !== 'undefined') ? require('./orderedmap.js') : null);
daikon.OrderedMapIterator = daikon.OrderedMapIterator || ((typeof require !== 'undefined') ? require('./iterator.js') : null);
daikon.Utils = daikon.Utils || ((typeof require !== 'undefined') ? require('./utilities.js') : null);


/*** Constructor ***/

/**
 * The Series constructor.
 * @property {daikon.Image[]} images
 * @type {Function}
 */
daikon.Series = daikon.Series || function () {
    this.images = [];
    this.imagesOriginalOrder = null;
    this.isMosaic = false;
    this.isElscint = false;
    this.isCompressed = false;
    this.numberOfFrames = 0;
    this.numberOfFramesInFile = 0;
    this.isMultiFrame = false;
    this.isMultiFrameVolume = false;
    this.isMultiFrameTimeseries = false;
    this.isImplicitTimeseries = false;
    this.sliceSense = false;
    this.sliceDir = daikon.Image.SLICE_DIRECTION_UNKNOWN;
    this.error = null;
};


/*** Static fields ***/
daikon.Series.parserError = null;

/**
 * True to keep original order of images, ignoring metadata-based ordering.
 * @type {boolean}
 */
daikon.Series.useExplicitOrdering = false;

/**
 * A hint to software to use this explicit distance (mm) between slices (see daikon.Series.useExplicitOrdering)
 * @type {number}
 */
daikon.Series.useExplicitSpacing = 0;


/*** Static Methods ***/

/**
 * Parses the DICOM header and return an image object.
 * @param {DataView} data
 * @returns {daikon.Image|null}
 */
daikon.Series.parseImage = function (data) {
    var parser, image;

    parser = new daikon.Parser();
    image = parser.parse(data);

    if (parser.hasError()) {
        daikon.Series.parserError = parser.error;
        return null;
    }

    if (parser.inflated) {
        image.inflated = parser.inflated;
    }

    return image;
};



daikon.Series.getMosaicOffset = function (mosaicCols, mosaicColWidth, mosaicRowHeight, mosaicWidth, xLocVal,
                                          yLocVal, zLocVal) {
    var xLoc, yLoc, zLoc;

    xLoc = xLocVal;
    yLoc = yLocVal;
    zLoc = zLocVal;

    xLoc = ((zLoc % mosaicCols) * mosaicColWidth) + xLoc;
    yLoc = (((parseInt(zLoc / mosaicCols)) * mosaicRowHeight) + yLoc) * mosaicWidth;

    return (xLoc + yLoc);
};



daikon.Series.orderDicoms = function (images, numFrames, sliceDir) {
    var hasImagePosition, hasSliceLocation, hasImageNumber, timeMap, timeIt, ctr, ctrIn, dg, ordered,
        imagesOrderedByTimeAndSpace;

    hasImagePosition = (images[0].getImagePosition() !== null);
    hasSliceLocation = (images[0].getSliceLocation() !== null);
    hasImageNumber = (images[0].getImageNumber() !== null);

    timeMap = daikon.Series.orderByTime(images, numFrames, sliceDir, hasImagePosition, hasSliceLocation);
    timeIt = timeMap.orderedKeys;

    imagesOrderedByTimeAndSpace = [];

    for (ctr = 0; ctr < timeIt.length; ctr += 1) {
        dg = timeMap.get(timeIt[ctr]);

        if (hasImagePosition) {
            ordered = daikon.Series.orderByImagePosition(dg, sliceDir);
        } else if (hasSliceLocation) {
            ordered = daikon.Series.orderBySliceLocation(dg);
        } else if (hasImageNumber) {
            ordered = daikon.Series.orderByImageNumber(dg);
        } else {
            ordered = dg;
        }

        for (ctrIn = 0; ctrIn < ordered.length; ctrIn += 1) {
            imagesOrderedByTimeAndSpace.push(ordered[ctrIn]);
        }
    }

    for (ctrIn = 0; ctrIn < imagesOrderedByTimeAndSpace.length; ctrIn += 1) {
        imagesOrderedByTimeAndSpace[ctrIn].index = ctrIn;
    }

    return imagesOrderedByTimeAndSpace;
};



daikon.Series.orderByImagePosition = function (images, sliceDir) {
    var dicomMap, ctr;
    dicomMap = new daikon.OrderedMap();

    for (ctr = 0; ctr < images.length; ctr += 1) {
        dicomMap.put(images[ctr].getImagePositionSliceDir(sliceDir), images[ctr]);
    }

    return dicomMap.getOrderedValues();
};



daikon.Series.orderBySliceLocation = function (images) {
    var dicomMap, ctr;
    dicomMap = new daikon.OrderedMap();

    for (ctr = 0; ctr < images.length; ctr += 1) {
        dicomMap.put(images[ctr].getSliceLocation(), images[ctr]);
    }

    return dicomMap.getOrderedValues();
};



daikon.Series.orderByImageNumber = function (images) {
    var dicomMap, ctr;
    dicomMap = new daikon.OrderedMap();

    for (ctr = 0; ctr < images.length; ctr += 1) {
        dicomMap.put(images[ctr].getImageNumber(), images[ctr]);
    }

    return dicomMap.getOrderedValues();
};



daikon.Series.hasMatchingSlice = function (dg, image, sliceDir, doImagePos, doSliceLoc) {
    var matchingNum = 0, ctr, current, imagePos, sliceLoc, imageNum;

    if (doImagePos) {
        matchingNum = image.getImagePositionSliceDir(sliceDir);
    } else if (doSliceLoc) {
        matchingNum = image.getSliceLocation();
    } else {
        matchingNum = image.getImageNumber();
    }

    for (ctr = 0; ctr < dg.length; ctr += 1) {
        current = dg[ctr];

        if (doImagePos) {
            imagePos = current.getImagePositionSliceDir(sliceDir);
            if (imagePos === matchingNum) {
                return true;
            }
        } else if (doSliceLoc) {
            sliceLoc = current.getSliceLocation();
            if (sliceLoc === matchingNum) {
                return true;
            }
        } else {
            imageNum = current.getImageNumber();
            if (imageNum === matchingNum) {
                return true;
            }
        }
    }

    return false;
};



daikon.Series.orderByTime = function (images, numFrames, sliceDir, hasImagePosition, hasSliceLocation) {
    var dicomMap, hasTemporalPosition, hasTemporalNumber, ctr, image, tempPos, dg, timeBySliceMap, imageNum,
        sliceMarker, slice, dicomsCopy, dicomsCopyIndex, sliceIt, timeIt, dgFound, it;

    dicomMap = new daikon.OrderedMap();
    hasTemporalPosition = (numFrames > 1) && (images[0].getTemporalPosition() !== null);
    hasTemporalNumber = (numFrames > 1) && (images[0].getTemporalNumber() !== null) && (images[0].getTemporalNumber() === numFrames);

    if (hasTemporalPosition && hasTemporalNumber) { // explicit series
        for (ctr = 0; ctr < images.length; ctr += 1) {
            image = images[ctr];

            tempPos = image.getTemporalPosition();
            dg = dicomMap.get(tempPos);
            if (!dg) {
                dg = [];
                dicomMap.put(tempPos, dg);
            }

            dg.push(image);
        }
    } else { // implicit series
        // order data by slice then time
        timeBySliceMap = new daikon.OrderedMap();
        for (ctr = 0; ctr < images.length; ctr += 1) {
            if (images[ctr] !== null) {
                imageNum = images[ctr].getImageNumber();
                sliceMarker = ctr;
                if (hasImagePosition) {
                    sliceMarker = images[ctr].getImagePositionSliceDir(sliceDir);
                } else if (hasSliceLocation) {
                    sliceMarker = images[ctr].getSliceLocation();
                }

                slice = timeBySliceMap.get(sliceMarker);
                if (slice === null) {
                    slice = new daikon.OrderedMap();
                    timeBySliceMap.put(sliceMarker, slice);
                }

                slice.put(ctr, images[ctr]);
            }
        }

        // copy into DICOM array (ordered by slice by time)
        dicomsCopy = [];
        dicomsCopyIndex = 0;
        sliceIt = timeBySliceMap.iterator();
        while (sliceIt.hasNext()) {
            slice = sliceIt.next();
            timeIt = slice.iterator();
            while (timeIt.hasNext()) {
                dicomsCopy[dicomsCopyIndex] = timeIt.next();
                dicomsCopyIndex += 1;
            }
        }

        // groups dicoms by timepoint
        for (ctr = 0; ctr < dicomsCopy.length; ctr += 1) {
            if (dicomsCopy[ctr] !== null) {
                dgFound = null;
                it = dicomMap.iterator();
                while (it.hasNext()) {
                    dg = it.next();
                    if (!daikon.Series.hasMatchingSlice(dg, dicomsCopy[ctr], sliceDir, hasImagePosition, hasSliceLocation)) {
                        dgFound = dg;
                        break;
                    }
                }

                if (dgFound === null) {
                    dgFound = [];
                    dicomMap.put(dicomMap.orderedKeys.length, dgFound);
                }

                dgFound.push(dicomsCopy[ctr]);
            }
        }
    }

    return dicomMap;
};


/*** Prototype Methods ***/

daikon.Series.prototype.getOrder = function () {
    var ctr, order = [];

    for (ctr = 0; ctr < this.imagesOriginalOrder.length; ctr += 1) {
        order[ctr] = this.imagesOriginalOrder[ctr].index;
    }

    return order;
};


/**
 * Returns the series ID.
 * @returns {string}
 */
daikon.Series.prototype.toString = function () {
    return this.images[0].getSeriesId();
};


/**
 * Returns a nice name for the series.
 * @returns {string|null}
 */
daikon.Series.prototype.getName = function () {
    var des = this.images[0].getSeriesDescription();
    var uid = this.images[0].getSeriesInstanceUID();

    if (des !== null) {
        return des;
    }

    if (uid !== null) {
        return uid;
    }

    return null;
};


/**
 * Adds an image to the series.
 * @param {daikon.Image} image
 */
daikon.Series.prototype.addImage = function (image) {
    this.images.push(image);
};


/**
 * Returns true if the specified image is part of the series (or if no images are yet part of the series).
 * @param {daikon.Image} image
 * @returns {boolean}
 */
daikon.Series.prototype.matchesSeries = function (image) {
    if (this.images.length === 0) {
        return true;
    }

    return (this.images[0].getSeriesId() === image.getSeriesId());
};


/**
 * Orders and organizes the images in this series.
 */
daikon.Series.prototype.buildSeries = function () {
    var hasFrameTime, ctr, sliceLoc, orderedImages, sliceLocationFirst, sliceLocationLast, sliceLocDiff,
        sliceLocations, orientation, imagePos;

    this.isMosaic = this.images[0].isMosaic();
    this.isElscint = this.images[0].isElscint();
    this.isCompressed = this.images[0].isCompressed();

    // check for multi-frame
    this.numberOfFrames = this.images[0].getNumberOfFrames();
    this.numberOfFramesInFile = this.images[0].getNumberOfImplicitFrames();
    this.isMultiFrame = (this.numberOfFrames > 1) || (this.isMosaic && (this.images[0].length > 1));
    this.isMultiFrameVolume = false;
    this.isMultiFrameTimeseries = false;
    this.isImplicitTimeseries = false;

    if (this.isMultiFrame) {
        hasFrameTime = (this.images[0].getFrameTime() > 0);
        if (this.isMosaic) {
            this.isMultiFrameTimeseries = true;
        } else {
            if (hasFrameTime) {
                this.isMultiFrameTimeseries = true;
            } else if (this.numberOfFramesInFile > 1) {
                this.isMultiFrameTimeseries = true;
                this.numberOfFrames = this.images.length;
            } else {
                this.isMultiFrameVolume = true;
            }
        }
    }

    if (!this.isMosaic && (this.numberOfFrames <= 1)) { // check for implicit frame count
        imagePos = (this.images[0].getImagePosition() || []);
        sliceLoc = imagePos.toString();
        this.numberOfFrames = 0;

        for (ctr = 0; ctr < this.images.length; ctr += 1) {
            imagePos = (this.images[ctr].getImagePosition() || []);

            if (imagePos.toString() === sliceLoc) {
                this.numberOfFrames += 1;
            }
        }

        if (this.numberOfFrames > 1) {
            this.isImplicitTimeseries = true;
        }
    }

    this.sliceDir = this.images[0].getAcquiredSliceDirection();

    if (daikon.Series.useExplicitOrdering) {
        orderedImages = this.images.slice();
    } else {
        orderedImages = daikon.Series.orderDicoms(this.images, this.numberOfFrames, this.sliceDir);
    }

    sliceLocationFirst = orderedImages[0].getImagePositionSliceDir(this.sliceDir);
    sliceLocationLast = orderedImages[orderedImages.length - 1].getImagePositionSliceDir(this.sliceDir);
    sliceLocDiff = sliceLocationLast - sliceLocationFirst;

    if (daikon.Series.useExplicitOrdering) {
        this.sliceSense = false;
    } else if (this.isMosaic) {
        this.sliceSense = true;
    } else if (this.isMultiFrame) {
        sliceLocations = orderedImages[0].getSliceLocationVector();
        if (sliceLocations !== null) {
            orientation = orderedImages[0].getOrientation();

            if (orientation.charAt(2) === 'Z') {
                this.sliceSense = (sliceLocations[0] - sliceLocations[sliceLocations.length - 1]) < 0;
            } else {
                this.sliceSense = (sliceLocations[0] - sliceLocations[sliceLocations.length - 1]) > 0;
            }
        } else {
            this.sliceSense = sliceLocationFirst < 0 ? false : true; // maybe???
        }
    } else {
        /*
         * "The direction of the axes is defined fully by the patient's orientation. The x-axis is increasing to the left hand side of the patient. The
         * y-axis is increasing to the posterior side of the patient. The z-axis is increasing toward the head of the patient."
         */
        if ((this.sliceDir === daikon.Image.SLICE_DIRECTION_SAGITTAL) || (this.sliceDir === daikon.Image.SLICE_DIRECTION_CORONAL)) {
            if (sliceLocDiff > 0) {
                this.sliceSense = false;
            } else {
                this.sliceSense = true;
            }
        } else {
            if (sliceLocDiff > 0) {
                this.sliceSense = true;
            } else {
                this.sliceSense = false;
            }
        }
    }

    this.imagesOriginalOrder = this.images;
    this.images = orderedImages;
};


/**
 * Concatenates image data (asynchronously).
 * @param {object} progressMeter -- the object must have a drawProgress(percent, label) function [e.g., drawProgress(.5, "Loading...")]
 * @param {Function} onFinishedImageRead -- callback
 */
daikon.Series.prototype.concatenateImageData = function (progressMeter, onFinishedImageRead) {
    var buffer, data, length;

    if (this.isMosaic) {
        data = this.getMosaicData(this.images[0], this.images[0].getPixelDataBytes());
    } else {
        data = this.images[0].getPixelDataBytes();
    }

    length = this.validatePixelDataLength(this.images[0]);
    this.images[0].clearPixelData();
    buffer = new Uint8Array(new ArrayBuffer(length * this.images.length));
    buffer.set(new Uint8Array(data, 0, length), 0);

    setTimeout(daikon.Utils.bind(this, function() { this.concatenateNextImageData(buffer, length, progressMeter, 1, onFinishedImageRead)}), 0);
};



daikon.Series.prototype.concatenateNextImageData = function (buffer, frameSize, progressMeter, index,
                                                             onFinishedImageRead) {
    var data, length;

    if (index >= this.images.length) {
        if (progressMeter) {
            progressMeter.drawProgress(1, "Reading DICOM Images");
        }

        onFinishedImageRead(buffer.buffer);
    } else {
        if (progressMeter) {
            progressMeter.drawProgress(index / this.images.length, "Reading DICOM Images");
        }

        if (this.isMosaic) {
            data = this.getMosaicData(this.images[index], this.images[index].getPixelDataBytes());
        } else {
            data = this.images[index].getPixelDataBytes();
        }

        length = this.validatePixelDataLength(this.images[index]);
        this.images[index].clearPixelData();
        buffer.set(new Uint8Array(data, 0, length), (frameSize * index));

        setTimeout(daikon.Utils.bind(this, function() {this.concatenateNextImageData(buffer, frameSize, progressMeter,
            index + 1, onFinishedImageRead);}), 0);
    }
};



daikon.Series.prototype.validatePixelDataLength = function (image) {
    var length = image.getPixelDataBytes().byteLength,
        sliceLength = image.getCols() * image.getRows();

    // pixel data length should be divisible by slice size, if not, try to figure out correct pixel data length
    if ((length % sliceLength) === 0) {
        return length;
    }

    return sliceLength * image.getNumberOfFrames() * image.getNumberOfSamplesPerPixel() * (image.getBitsAllocated() / 8);
};



daikon.Series.prototype.getMosaicData = function (image, data) {
    var mosaicWidth, mosaicHeight, mosaicRows, mosaicCols, mosaicRowHeight, mosaicColWidth,
        numBytes, ctrS, ctrR, ctrC, numSlices, numRows, numCols, buffer, dataTyped, offset, ctr, index = 0;

    numBytes = parseInt(this.images[0].getBitsAllocated() / 8);
    numSlices = this.images[0].getMosaicCols() * this.images[0].getMosaicRows();
    numRows = parseInt(this.images[0].getRows() / this.images[0].getMosaicRows());
    numCols = parseInt(this.images[0].getCols() / this.images[0].getMosaicCols());

    mosaicWidth = this.images[0].getCols();
    mosaicHeight = this.images[0].getRows();
    mosaicRows = this.images[0].getMosaicRows();
    mosaicCols = this.images[0].getMosaicCols();
    mosaicRowHeight = parseInt(mosaicHeight / mosaicRows);
    mosaicColWidth = parseInt(mosaicWidth / mosaicCols);

    buffer = new Uint8Array(new ArrayBuffer(numSlices * numRows * numCols * numBytes));
    dataTyped = new Uint8Array(data);

    for (ctrS = 0; ctrS < numSlices; ctrS += 1) {
        for (ctrR = 0; ctrR < numRows; ctrR += 1) {
            for (ctrC = 0; ctrC < numCols; ctrC += 1) {
                offset = daikon.Series.getMosaicOffset(mosaicCols, mosaicColWidth, mosaicRowHeight, mosaicWidth, ctrC,
                    ctrR, ctrS);
                for (ctr = 0; ctr < numBytes; ctr += 1) {
                    buffer[index] = dataTyped[(offset * numBytes) + ctr];
                    index += 1;
                }
            }
        }
    }

    return buffer.buffer;
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.Series;
}
