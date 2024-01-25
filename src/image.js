import jpeg from 'jpeg-lossless-decoder-js'
import { JpxImage } from 'jpeg2000'
import { JpegImage } from '../lib/jpeg-baseline.js'
import { decodeJPEGLS } from '../lib/jpeg-ls.js'

import { Tag } from './tag.js'
import { MAX_VALUE, MIN_VALUE, concatArrayBuffers2, createBitMask, fillBuffer } from './utilities.js'
import { RLE } from './rle.js'
import { Parser } from './parser.js'
import { isHeaderJPEG, isHeaderJPEG2000 } from './compression-utils.js'

export class Image {
  static SLICE_DIRECTION_UNKNOWN = -1
  static SLICE_DIRECTION_AXIAL = 2
  static SLICE_DIRECTION_CORONAL = 1
  static SLICE_DIRECTION_SAGITTAL = 0
  static SLICE_DIRECTION_OBLIQUE = 3
  static OBLIQUITY_THRESHOLD_COSINE_VALUE = 0.8
  static BYTE_TYPE_UNKNOWN = 0
  static BYTE_TYPE_BINARY = 1
  static BYTE_TYPE_INTEGER = 2
  static BYTE_TYPE_INTEGER_UNSIGNED = 3
  static BYTE_TYPE_FLOAT = 4
  static BYTE_TYPE_COMPLEX = 5
  static BYTE_TYPE_RGB = 6

  tags = {} // a map of tag id to tag (see Tag.createId)
  tagsFlat = {} // a flattened map of tags
  littleEndian = false
  index = -1
  decompressed = false
  privateDataAll = null
  convertedPalette = false
  skipPaletteConversion = false

  getSingleValueSafely(tag, index) {
    if (tag && tag.value) {
      return tag.value[index]
    }

    return null
  }

  getValueSafely(tag) {
    if (tag) {
      return tag.value
    }

    return null
  }

  // originally from: http://public.kitware.com/pipermail/insight-users/2005-March/012246.html
  getMajorAxisFromPatientRelativeDirectionCosine(x, y, z) {
    const orientationX = x < 0 ? 'R' : 'L'
    const orientationY = y < 0 ? 'A' : 'P'
    const orientationZ = z < 0 ? 'F' : 'H'

    const absX = Math.abs(x)
    const absY = Math.abs(y)
    const absZ = Math.abs(z)

    // The tests here really don't need to check the other dimensions,
    // just the threshold, since the sum of the squares should be == 1.0
    // but just in case ...

    let axis
    if (absX > Image.OBLIQUITY_THRESHOLD_COSINE_VALUE && absX > absY && absX > absZ) {
      axis = orientationX
    } else if (absY > Image.OBLIQUITY_THRESHOLD_COSINE_VALUE && absY > absX && absY > absZ) {
      axis = orientationY
    } else if (absZ > Image.OBLIQUITY_THRESHOLD_COSINE_VALUE && absZ > absX && absZ > absY) {
      axis = orientationZ
    } else {
      axis = null
    }

    return axis
  }

  /**
   * Returns the number of columns.
   * @returns {number}
   */
  getCols() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_COLS[0], Tag.TAG_COLS[1]), 0)
  }

  /**
   * Returns the number of rows.
   * @returns {number}
   */
  getRows() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_ROWS[0], Tag.TAG_ROWS[1]), 0)
  }

  /**
   * Returns the series description.
   * @returns {string}
   */
  getSeriesDescription() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SERIES_DESCRIPTION[0], Tag.TAG_SERIES_DESCRIPTION[1]), 0)
  }

  /**
   * Returns the series instance UID.
   * @returns {string}
   */
  getSeriesInstanceUID() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SERIES_INSTANCE_UID[0], Tag.TAG_SERIES_INSTANCE_UID[1]), 0)
  }

  /**
   * Returns the series number.
   * @returns {number}
   */
  getSeriesNumber() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SERIES_NUMBER[0], Tag.TAG_SERIES_NUMBER[1]), 0)
  }

  /**
   * Returns the echo number.
   * @returns {number}
   */
  getEchoNumber() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_ECHO_NUMBER[0], Tag.TAG_ECHO_NUMBER[1]), 0)
  }

  /**
   * Returns the image position.
   * @return {number[]}
   */
  getImagePosition() {
    return this.getValueSafely(this.getTag(Tag.TAG_IMAGE_POSITION[0], Tag.TAG_IMAGE_POSITION[1]))
  }

  /**
   * Returns the image axis directions
   * @return {number[]}
   */
  getImageDirections() {
    return this.getValueSafely(this.getTag(Tag.TAG_IMAGE_ORIENTATION[0], Tag.TAG_IMAGE_ORIENTATION[1]))
  }

  /**
   * Returns the image position value by index.
   * @param {number} sliceDir - the index
   * @returns {number}
   */
  getImagePositionSliceDir(sliceDir) {
    const imagePos = this.getValueSafely(this.getTag(Tag.TAG_IMAGE_POSITION[0], Tag.TAG_IMAGE_POSITION[1]))
    if (imagePos) {
      if (sliceDir >= 0) {
        return imagePos[sliceDir]
      }
    }

    return 0
  }

  /**
   * Returns the modality
   * @returns {string}
   */
  getModality() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_MODALITY[0], Tag.TAG_MODALITY[1]), 0)
  }

  /**
   * Returns the slice location.
   * @returns {number}
   */
  getSliceLocation() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SLICE_LOCATION[0], Tag.TAG_SLICE_LOCATION[1]), 0)
  }

  /**
   * Returns the slice location vector.
   * @returns {number[]}
   */
  getSliceLocationVector() {
    return this.getValueSafely(this.getTag(Tag.TAG_SLICE_LOCATION_VECTOR[0], Tag.TAG_SLICE_LOCATION_VECTOR[1]))
  }

  /**
   * Returns the image number.
   * @returns {number}
   */
  getImageNumber() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_IMAGE_NUM[0], Tag.TAG_IMAGE_NUM[1]), 0)
  }

  /**
   * Returns the temporal position.
   * @returns {number}
   */
  getTemporalPosition() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_TEMPORAL_POSITION[0], Tag.TAG_TEMPORAL_POSITION[1]), 0)
  }

  /**
   * Returns the temporal number.
   * @returns {number}
   */
  getTemporalNumber() {
    return this.getSingleValueSafely(
      this.getTag(Tag.TAG_NUMBER_TEMPORAL_POSITIONS[0], Tag.TAG_NUMBER_TEMPORAL_POSITIONS[1]),
      0
    )
  }

  /**
   * Returns the slice gap.
   * @returns {number}
   */
  getSliceGap() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SLICE_GAP[0], Tag.TAG_SLICE_GAP[1]), 0)
  }

  /**
   * Returns the slice thickness.
   * @returns {number}
   */
  getSliceThickness() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_SLICE_THICKNESS[0], Tag.TAG_SLICE_THICKNESS[1]), 0)
  }

  /**
   * Returns the image maximum.
   * @returns {number}
   */
  getImageMax() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_IMAGE_MAX[0], Tag.TAG_IMAGE_MAX[1]), 0)
  }

  /**
   * Returns the image minimum.
   * @returns {number}
   */
  getImageMin() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_IMAGE_MIN[0], Tag.TAG_IMAGE_MIN[1]), 0)
  }

  /**
   * Returns the rescale slope.
   * @returns {number}
   */
  getDataScaleSlope() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_DATA_SCALE_SLOPE[0], Tag.TAG_DATA_SCALE_SLOPE[1]), 0)
  }

  /**
   * Returns the rescale intercept.
   * @returns {number}
   */
  getDataScaleIntercept() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_DATA_SCALE_INTERCEPT[0], Tag.TAG_DATA_SCALE_INTERCEPT[1]), 0)
  }

  getDataScaleElscint() {
    let scale = this.getSingleValueSafely(this.getTag(Tag.TAG_DATA_SCALE_ELSCINT[0], Tag.TAG_DATA_SCALE_ELSCINT[1]), 0)

    if (!scale) {
      scale = 1
    }

    const bandwidth = this.getPixelBandwidth()
    scale = Math.sqrt(bandwidth) / (10 * scale)

    if (scale <= 0) {
      scale = 1
    }

    return scale
  }

  /**
   * Returns the window width.
   * @returns {number}
   */
  getWindowWidth() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_WINDOW_WIDTH[0], Tag.TAG_WINDOW_WIDTH[1]), 0)
  }

  /**
   * Returns the window center.
   * @returns {number}
   */
  getWindowCenter() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_WINDOW_CENTER[0], Tag.TAG_WINDOW_CENTER[1]), 0)
  }

  getPixelBandwidth() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_PIXEL_BANDWIDTH[0], Tag.TAG_PIXEL_BANDWIDTH[1]), 0)
  }

  getSeriesId() {
    const des = this.getSeriesDescription()
    const uid = this.getSeriesInstanceUID()
    const num = this.getSeriesNumber()
    const echo = this.getEchoNumber()
    const orientation = this.getOrientation()
    const cols = this.getCols()
    const rows = this.getRows()

    let id = ''

    if (des !== null) {
      id += ' ' + des
    }

    if (uid !== null) {
      id += ' ' + uid
    }

    if (num !== null) {
      id += ' ' + num
    }

    if (echo !== null) {
      id += ' ' + echo
    }

    if (orientation !== null) {
      id += ' ' + orientation
    }

    id += ' (' + cols + ' x ' + rows + ')'

    return id
  }

  /**
   * Returns the pixel spacing.
   * @returns {number[]}
   */
  getPixelSpacing() {
    return this.getValueSafely(this.getTag(Tag.TAG_PIXEL_SPACING[0], Tag.TAG_PIXEL_SPACING[1]))
  }

  /**
   * Returns the image type.
   * @returns {string[]}
   */
  getImageType() {
    return this.getValueSafely(this.getTag(Tag.TAG_IMAGE_TYPE[0], Tag.TAG_IMAGE_TYPE[1]))
  }

  /**
   * Returns the number of bits stored.
   * @returns {number}
   */
  getBitsStored() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_BITS_STORED[0], Tag.TAG_BITS_STORED[1]), 0)
  }

  /**
   * Returns the number of bits allocated.
   * @returns {number}
   */
  getBitsAllocated() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_BITS_ALLOCATED[0], Tag.TAG_BITS_ALLOCATED[1]), 0)
  }

  /**
   * Returns the frame time.
   * @returns {number}
   */
  getFrameTime() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_FRAME_TIME[0], Tag.TAG_FRAME_TIME[1]), 0)
  }

  /**
   * Returns the acquisition matrix (e.g., "mosaic" data).
   * @returns {number[]}
   */
  getAcquisitionMatrix() {
    let matPrivate, start, end, str

    const mat = [0, 0]
    mat[0] = this.getSingleValueSafely(this.getTag(Tag.TAG_ACQUISITION_MATRIX[0], Tag.TAG_ACQUISITION_MATRIX[1]), 0)

    if (this.privateDataAll === null) {
      this.privateDataAll = this.getAllInterpretedPrivateData()
    }

    if (this.privateDataAll !== null && this.privateDataAll.length > 0) {
      start = this.privateDataAll.indexOf('AcquisitionMatrixText')
      if (start !== -1) {
        end = this.privateDataAll.indexOf('\n', start)

        if (end !== -1) {
          str = this.privateDataAll.substring(start, end)
          matPrivate = str.match(/\d+/g)

          if (matPrivate !== null && matPrivate.length === 2) {
            mat[0] = matPrivate[0]
            mat[1] = matPrivate[1]
          } else if (matPrivate !== null && matPrivate.length === 1) {
            mat[0] = matPrivate[0]
          }
        }
      }
    }

    if (mat[1] === 0) {
      mat[1] = mat[0]
    }

    return mat
  }

  /**
   * Returns the TR.
   * @returns {number}
   */
  getTR() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_TR, Tag.TAG_TR[1]), 0)
  }

  putTag(tag) {
    if (this.tags[tag.id] && this.tags[tag.id].value[0] !== tag.value[0]) {
      return
    }
    this.tags[tag.id] = tag
    this.putFlattenedTag(this.tagsFlat, tag)
  }

  putFlattenedTag(tags, tag) {
    if (tag.sublist) {
      for (let ctr = 0; ctr < tag.value.length; ctr += 1) {
        this.putFlattenedTag(tags, tag.value[ctr])
      }
    } else {
      if (!tags[tag.id]) {
        tags[tag.id] = tag
      }
    }
  }

  /**
   * Returns a tag matching the specified group and element.
   * @param {number} group
   * @param {number} element
   * @returns {daikon.Tag}
   */
  getTag(group, element) {
    const tagId = Tag.createId(group, element)

    if (this.tags[tagId]) {
      return this.tags[tagId]
    }

    return this.tagsFlat[tagId]
  }

  /**
   * Returns the pixel data tag.
   * @returns {daikon.Tag}
   */
  getPixelData() {
    return this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])]
  }

  getPixelDataBytes() {
    if (this.isCompressed()) {
      this.decompress()
    }

    if (this.isPalette() && !this.skipPaletteConversion) {
      this.convertPalette()
    }

    return this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value.buffer
  }

  /**
   * Returns the raw pixel data.
   * @returns {ArrayBuffer}
   */
  getRawData() {
    return this.getPixelDataBytes()
  }

  /**
   * Returns interpreted pixel data (considers datatype, byte order, data scales).
   * @param {boolean} asArray - if true, the returned data is a JavaScript Array
   * @param {boolean} asObject - if true, an object is returned with properties: data, min, max, minIndex, maxIndex, numCols, numRows
   * @param {number} frameIndex - if provided, only the desired frame in a multi-frame dataset is returned
   * @returns {Float32Array|Array|object}
   */
  getInterpretedData(asArray, asObject, frameIndex) {
    let data, min, max, value, minIndex, maxIndex, rawValue
    const allFrames = arguments.length < 3
    const mask = createBitMask(
      this.getBitsAllocated() / 8,
      this.getBitsStored(),
      this.getDataType() === Image.BYTE_TYPE_INTEGER_UNSIGNED
    )
    const datatype = this.getPixelRepresentation() ? Image.BYTE_TYPE_INTEGER : Image.BYTE_TYPE_INTEGER_UNSIGNED
    const numBytes = this.getBitsAllocated() / 8
    const rawData = this.getRawData()
    const dataView = new DataView(rawData)
    const totalElements = rawData.byteLength / numBytes
    const elementsPerFrame = totalElements / this.getNumberOfFrames()
    const numElements = allFrames ? totalElements : elementsPerFrame
    const offset = allFrames ? 0 : frameIndex * elementsPerFrame
    const slope = this.getDataScaleSlope() || 1
    const intercept = this.getDataScaleIntercept() || 0
    min = MAX_VALUE
    max = MIN_VALUE
    minIndex = -1
    maxIndex = -1
    const littleEndian = this.littleEndian

    if (asArray) {
      data = new Array(numElements)
    } else {
      data = new Float32Array(numElements)
    }
    let getWord
    if (datatype === Image.BYTE_TYPE_INTEGER) {
      if (numBytes === 1) {
        getWord = dataView.getInt8.bind(dataView)
      } else if (numBytes === 2) {
        getWord = dataView.getInt16.bind(dataView)
      }
    } else if (datatype === Image.BYTE_TYPE_INTEGER_UNSIGNED) {
      if (numBytes === 1) {
        getWord = dataView.getUint8.bind(dataView)
      } else if (numBytes === 2) {
        getWord = dataView.getUint16.bind(dataView)
      }
    }

    // invert pixel values if INVERTED or MONOCHROME1
    let invert = this.getSingleValueSafely(this.getTag(Tag.TAG_LUT_SHAPE[0], Tag.TAG_LUT_SHAPE[1]), 0) === 'INVERSE'
    invert = invert || this.getPhotometricInterpretation() === 'MONOCHROME1'
    if (invert) {
      let maxVal = Math.pow(2, this.getBitsStored()) - 1
      let minVal = 0
      if (datatype === Image.BYTE_TYPE_INTEGER) {
        maxVal /= 2
        minVal = -maxVal
      }
      const originalGetWord = getWord
      getWord = (offset, endian) => {
        const val = maxVal - originalGetWord(offset, endian)
        return Math.min(maxVal, Math.max(minVal, val))
      }
    }

    for (let ctr = offset, dataCtr = 0; dataCtr < numElements; ctr++, dataCtr++) {
      rawValue = getWord(ctr * numBytes, littleEndian)

      value = (rawValue & mask) * slope + intercept
      data[dataCtr] = value

      if (value < min) {
        min = value
        minIndex = dataCtr
      }

      if (value > max) {
        max = value
        maxIndex = dataCtr
      }
    }

    if (asObject) {
      return {
        data,
        min,
        minIndex,
        max,
        maxIndex,
        numCols: this.getCols(),
        numRows: this.getRows()
      }
    }

    return data
  }

  convertPalette() {
    let data, rgb, numBytes, numElements, index, rVal, gVal, bVal

    data = this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value

    const reds = this.getPalleteValues(Tag.TAG_PALETTE_RED)
    const greens = this.getPalleteValues(Tag.TAG_PALETTE_GREEN)
    const blues = this.getPalleteValues(Tag.TAG_PALETTE_BLUE)

    if (
      reds !== null &&
      reds.length > 0 &&
      greens !== null &&
      greens.length > 0 &&
      blues !== null &&
      blues.length > 0 &&
      !this.convertedPalette
    ) {
      rgb = new DataView(new ArrayBuffer(this.getRows() * this.getCols() * this.getNumberOfFrames() * 3))
      numBytes = parseInt(Math.ceil(this.getBitsAllocated() / 8))
      numElements = data.byteLength / numBytes

      if (numBytes === 1) {
        for (let ctr = 0; ctr < numElements; ctr += 1) {
          index = data.getUint8(ctr)
          rVal = reds[index]
          gVal = greens[index]
          bVal = blues[index]
          rgb.setUint8(ctr * 3, rVal)
          rgb.setUint8(ctr * 3 + 1, gVal)
          rgb.setUint8(ctr * 3 + 2, bVal)
        }
      } else if (numBytes === 2) {
        for (let ctr = 0; ctr < numElements; ctr += 1) {
          index = data.getUint16(ctr * 2)
          rVal = reds[index]
          gVal = greens[index]
          bVal = blues[index]
          rgb.setUint8(ctr * 3, rVal)
          rgb.setUint8(ctr * 3 + 1, gVal)
          rgb.setUint8(ctr * 3 + 2, bVal)
        }
      }

      data = rgb
      this.convertedPalette = true
    }

    this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = data
  }

  decompressJPEG(jpg) {
    if (this.isCompressedJPEGLossless()) {
      const decoder = new jpeg.lossless.Decoder()
      return decoder.decode(jpg)
    } else if (this.isCompressedJPEGBaseline()) {
      const decoder = new JpegImage()
      decoder.parse(new Uint8Array(jpg))
      const width = decoder.width
      const height = decoder.height

      let decoded
      if (this.getBitsAllocated() === 8) {
        decoded = decoder.getData(width, height)
      } else if (this.getBitsAllocated() === 16) {
        decoded = decoder.getData16(width, height)
      }

      return decoded
    } else if (this.isCompressedJPEG2000()) {
      const decoder = new JpxImage()
      decoder.parse(new Uint8Array(jpg))
      return decoder.tiles[0].items
    } else if (this.isCompressedJPEGLS()) {
      return decodeJPEGLS(new Uint8Array(jpg), this.getDataType() === Image.BYTE_TYPE_INTEGER)
    }
  }

  decompress() {
    let decoded, jpegs, rle, decoder, decompressed, numFrames, frameSize, temp, width, height, numComponents

    decompressed = null

    if (!this.decompressed) {
      this.decompressed = true

      frameSize = this.getRows() * this.getCols() * parseInt(Math.ceil(this.getBitsAllocated() / 8))
      numFrames = this.getNumberOfFrames()

      if (this.isCompressedJPEGLossless()) {
        jpegs = this.getJpegs()

        for (let ctr = 0; ctr < jpegs.length; ctr += 1) {
          decoder = new jpeg.lossless.Decoder()
          temp = decoder.decode(jpegs[ctr])
          numComponents = decoder.numComp

          if (decompressed === null) {
            decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents))
          }

          new Uint8Array(decompressed.buffer).set(new Uint8Array(temp.buffer), ctr * frameSize * numComponents)
          temp = null
        }

        this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = decompressed
      } else if (this.isCompressedJPEGBaseline()) {
        jpegs = this.getJpegs()

        for (let ctr = 0; ctr < jpegs.length; ctr += 1) {
          decoder = new JpegImage()
          decoder.parse(new Uint8Array(jpegs[ctr]))
          width = decoder.width
          height = decoder.height
          numComponents = decoder.components.length

          if (decompressed === null) {
            decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents))
          }

          if (this.getBitsAllocated() === 8) {
            decoded = decoder.getData(width, height)
          } else if (this.getBitsAllocated() === 16) {
            decoded = decoder.getData16(width, height)
          }

          fillBuffer(
            decoded,
            decompressed,
            ctr * frameSize * numComponents,
            parseInt(Math.ceil(this.getBitsAllocated() / 8))
          )

          decoded = null
        }

        this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = decompressed
      } else if (this.isCompressedJPEG2000()) {
        jpegs = this.getJpegs()

        for (let ctr = 0; ctr < jpegs.length; ctr += 1) {
          decoder = new JpxImage()
          decoder.parse(Buffer.from(new Uint8Array(jpegs[ctr])))
          width = decoder.width
          height = decoder.height
          decoded = decoder.tiles[0].items
          numComponents = decoder.componentsCount

          if (decompressed === null) {
            decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents))
          }

          fillBuffer(
            decoded,
            decompressed,
            ctr * frameSize * numComponents,
            parseInt(Math.ceil(this.getBitsAllocated() / 8))
          )

          decoded = null
        }

        this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = decompressed
      } else if (this.isCompressedJPEGLS()) {
        jpegs = this.getJpegs()

        for (let ctr = 0; ctr < jpegs.length; ctr += 1) {
          decoded = decodeJPEGLS(new Uint8Array(jpegs[ctr]), this.getDataType() === Image.BYTE_TYPE_INTEGER)
          width = decoded.columns
          height = decoded.rows
          decoded = decoded.pixelData
          numComponents = this.getNumberOfSamplesPerPixel()

          if (decompressed === null) {
            decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents))
          }

          fillBuffer(
            decoded,
            decompressed,
            ctr * frameSize * numComponents,
            parseInt(Math.ceil(this.getBitsAllocated() / 8))
          )

          decoded = null
        }

        this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = decompressed
      } else if (this.isCompressedRLE()) {
        rle = this.getRLE()

        for (let ctr = 0; ctr < rle.length; ctr += 1) {
          decoder = new RLE()
          temp = decoder.decode(rle[ctr], this.littleEndian, this.getRows() * this.getCols())
          numComponents = decoder.numSegments === 3 ? 3 : 1

          if (decompressed === null) {
            decompressed = new DataView(new ArrayBuffer(frameSize * numFrames * numComponents))
          }

          new Uint8Array(decompressed.buffer).set(new Uint8Array(temp.buffer), ctr * frameSize * numComponents)
          temp = null
        }

        this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = decompressed
      }
    }
  }

  /**
   * Returns true if pixel data is found.
   * @returns {boolean}
   */
  hasPixelData() {
    return this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])] !== undefined
  }

  clearPixelData() {
    this.tags[Tag.createId(Tag.TAG_PIXEL_DATA[0], Tag.TAG_PIXEL_DATA[1])].value = null
  }

  /**
   * Returns an orientation string (e.g., XYZ+--).
   * @returns {string}
   */
  getOrientation() {
    let orientation = null
    const dirCos = this.getValueSafely(this.getTag(Tag.TAG_IMAGE_ORIENTATION[0], Tag.TAG_IMAGE_ORIENTATION[1]))
    let ctr
    let bigRow = 0
    let bigCol = 0
    let biggest = 0
    let orient = ''

    if (!dirCos || dirCos.length !== 6) {
      return null
    }

    const spacing = this.getPixelSpacing()

    if (!spacing) {
      return null
    }

    const rowSpacing = spacing[0]
    const swapZ = true

    for (ctr = 0; ctr < 3; ctr += 1) {
      if (Math.abs(dirCos[ctr]) > biggest) {
        biggest = Math.abs(dirCos[ctr])
        bigRow = ctr
      }
    }

    biggest = 0
    // TODO: clean up this mess
    for (; ctr < 6; ctr += 1) {
      if (Math.abs(dirCos[ctr]) > biggest) {
        biggest = Math.abs(dirCos[ctr])
        bigCol = ctr
      }
    }

    switch (bigRow) {
      case 0:
        orient += 'X'
        if (bigCol === 4) {
          orient += 'YZ'
        } else {
          orient += 'ZY'
        }
        break
      case 1:
        orient += 'Y'
        if (bigCol === 3) {
          orient += 'XZ'
        } else {
          orient += 'ZX'
        }
        break
      case 2:
        orient += 'Z'
        if (bigCol === 3) {
          orient += 'XY'
        } else {
          orient += 'YX'
        }
        break
      default:
        break
    }

    switch (bigRow) {
      case 0:
        if (dirCos[bigRow] > 0.0) {
          orient += '-'
        } else {
          orient += '+'
        }
        if (bigCol === 4) {
          if (dirCos[bigCol] > 0.0) {
            orient += '-'
          } else {
            orient += '+'
          }
        } else {
          if (dirCos[bigCol] > 0.0) {
            orient += '+'
          } else {
            orient += '-'
          }
        }
        break
      case 1:
        if (dirCos[bigRow] > 0.0) {
          orient += '-'
        } else {
          orient += '+'
        }
        if (bigCol === 3) {
          if (dirCos[bigCol] > 0.0) {
            orient += '-'
          } else {
            orient += '+'
          }
        } else {
          if (dirCos[bigCol] > 0.0) {
            orient += '+'
          } else {
            orient += '-'
          }
        }
        break
      case 2:
        if (dirCos[bigRow] > 0.0) {
          orient += '+'
        } else {
          orient += '-'
        }
        // Has to be X or Y so opposite senses
        if (dirCos[bigCol] > 0.0) {
          orient += '-'
        } else {
          orient += '+'
        }
        break
      default:
        break
    }

    if (rowSpacing === 0.0) {
      orient += '+'
      orientation = orient
    } else {
      if (swapZ) {
        switch (orient.charAt(2)) {
          case 'X':
            if (rowSpacing > 0.0) {
              orient += '-'
            } else {
              orient += '+'
            }
            break
          case 'Y':
          case 'Z':
            if (rowSpacing > 0.0) {
              orient += '+'
            } else {
              orient += '-'
            }
            break
          default:
            break
        }
      } else {
        switch (orient.charAt(2)) {
          case 'X':
            if (rowSpacing > 0.0) {
              orient += '+'
            } else {
              orient += '-'
            }
            break
          case 'Y':
          case 'Z':
            if (rowSpacing > 0.0) {
              orient += '-'
            } else {
              orient += '+'
            }
            break
          default:
            break
        }
      }

      orientation = orient
    }

    return orientation
  }

  /**
   * Returns true if this image is "mosaic".
   * @returns {boolean}
   */
  isMosaic() {
    let labeledAsMosaic = false

    const imageType = this.getImageType()

    if (imageType !== null) {
      for (let ctr = 0; ctr < imageType.length; ctr += 1) {
        if (imageType[ctr].toUpperCase().indexOf('MOSAIC') !== -1) {
          labeledAsMosaic = true
          break
        }
      }
    }

    const matSize = this.getAcquisitionMatrix()
    const canReadAsMosaic = matSize[0] > 0 && (matSize[0] < this.getRows() || matSize[1] < this.getCols())
    return labeledAsMosaic && canReadAsMosaic
  }

  /**
   * Returns true if this image uses palette colors.
   * @returns {boolean}
   */
  isPalette() {
    const value = this.getSingleValueSafely(
      this.getTag(Tag.TAG_PHOTOMETRIC_INTERPRETATION[0], Tag.TAG_PHOTOMETRIC_INTERPRETATION[1]),
      0
    )

    if (value !== null) {
      if (value.toLowerCase().indexOf('palette') !== -1) {
        return true
      }
    }

    return false
  }

  getMosaicCols() {
    return this.getCols() / this.getAcquisitionMatrix()[1]
  }

  getMosaicRows() {
    return this.getRows() / this.getAcquisitionMatrix()[0]
  }

  isElscint() {
    const tag = this.getTag(Tag.TAG_DATA_SCALE_ELSCINT[0], Tag.TAG_DATA_SCALE_ELSCINT[1])
    return tag !== undefined
  }

  /**
   * Returns true if this image stores compressed data.
   * @returns {boolean}
   */
  isCompressed() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG) !== -1) {
        return true
      } else if (transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_RLE) !== -1) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true if this image stores JPEG data.
   * @returns {boolean}
   */
  isCompressedJPEG() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG) !== -1) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true of this image stores lossless JPEG data.
   * @returns {boolean}
   */
  isCompressedJPEGLossless() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS) !== -1 ||
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS_SEL1) !== -1
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true if this image stores baseline JPEG data.
   * @returns {boolean}
   */
  isCompressedJPEGBaseline() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_8BIT) !== -1 ||
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_12BIT) !== -1
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true if this image stores JPEG2000 data.
   * @returns {boolean}
   */
  isCompressedJPEG2000() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000) !== -1 ||
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_2000_LOSSLESS) !== -1
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true if this image stores JPEG-LS data.
   * @returns {boolean}
   */
  isCompressedJPEGLS() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LS) !== -1 ||
        transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_JPEG_LS_LOSSLESS) !== -1
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Returns true if this image stores RLE data.
   * @returns {boolean}
   */
  isCompressedRLE() {
    const transferSyntax = this.getTransferSyntax()
    if (transferSyntax) {
      if (transferSyntax.indexOf(Parser.TRANSFER_SYNTAX_COMPRESSION_RLE) !== -1) {
        return true
      }
    }

    return false
  }

  /**
   * Returns the number of frames.
   * @returns {number}
   */
  getNumberOfFrames() {
    const value = this.getSingleValueSafely(this.getTag(Tag.TAG_NUMBER_OF_FRAMES[0], Tag.TAG_NUMBER_OF_FRAMES[1]), 0)

    if (value !== null) {
      return value
    }

    return 1
  }

  /**
   * Returns the number of samples per pixel.
   * @returns {number}
   */
  getNumberOfSamplesPerPixel() {
    const value = this.getSingleValueSafely(this.getTag(Tag.TAG_SAMPLES_PER_PIXEL[0], Tag.TAG_SAMPLES_PER_PIXEL[1]), 0)

    if (value !== null) {
      return value
    }

    return 1
  }

  getNumberOfImplicitFrames() {
    if (this.isCompressed()) {
      return 1
    }

    const pixelData = this.getPixelData()
    const length = pixelData.offsetEnd - pixelData.offsetValue
    const size = this.getCols() * this.getRows() * parseInt(this.getBitsAllocated() / 8)

    return parseInt(length / size)
  }

  /**
   * Returns the pixel representation.
   * @returns {number}
   */
  getPixelRepresentation() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_PIXEL_REPRESENTATION[0], Tag.TAG_PIXEL_REPRESENTATION[1]), 0)
  }

  /**
   * Returns the photometric interpretation.
   * @returns {string}
   */
  getPhotometricInterpretation() {
    return this.getSingleValueSafely(
      this.getTag(Tag.TAG_PHOTOMETRIC_INTERPRETATION[0], Tag.TAG_PHOTOMETRIC_INTERPRETATION[1]),
      0
    )
  }

  /**
   * Returns the patient name.
   * @returns {string}
   */
  getPatientName() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_PATIENT_NAME[0], Tag.TAG_PATIENT_NAME[1]), 0)
  }

  /**
   * Returns the patient ID.
   * @returns {string}
   */
  getPatientID() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_PATIENT_ID[0], Tag.TAG_PATIENT_ID[1]), 0)
  }

  /**
   * Returns the study time.
   * @returns {string}
   */
  getStudyTime() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_STUDY_TIME[0], Tag.TAG_STUDY_TIME[1]), 0)
  }

  /**
   * Returns the transfer syntax.
   * @returns {string}
   */
  getTransferSyntax() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_TRANSFER_SYNTAX[0], Tag.TAG_TRANSFER_SYNTAX[1]), 0)
  }

  /**
   * Returns the study date.
   * @returns {string}
   */
  getStudyDate() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_STUDY_DATE[0], Tag.TAG_STUDY_DATE[1]), 0)
  }

  /**
   * Returns the planar configuration.
   * @returns {number}
   */
  getPlanarConfig() {
    return this.getSingleValueSafely(this.getTag(Tag.TAG_PLANAR_CONFIG[0], Tag.TAG_PLANAR_CONFIG[1]), 0)
  }

  /**
   * Returns all descriptive info for this image.
   * @returns {string}
   */
  getImageDescription() {
    let value
    let string = ''

    value = this.getSingleValueSafely(this.getTag(Tag.TAG_STUDY_DES[0], Tag.TAG_STUDY_DES[1]), 0)
    if (value !== null) {
      string += ' ' + value
    }

    value = this.getSingleValueSafely(this.getTag(Tag.TAG_SERIES_DESCRIPTION[0], Tag.TAG_SERIES_DESCRIPTION[1]), 0)
    if (value !== null) {
      string += ' ' + value
    }

    value = this.getSingleValueSafely(this.getTag(Tag.TAG_IMAGE_COMMENTS[0], Tag.TAG_IMAGE_COMMENTS[1]), 0)
    if (value !== null) {
      string += ' ' + value
    }

    return string.trim()
  }

  /**
   * Returns the datatype (e.g., Image.BYTE_TYPE_INTEGER_UNSIGNED).
   * @returns {number}
   */
  getDataType() {
    const dataType = this.getPixelRepresentation()

    if (dataType === null) {
      return Image.BYTE_TYPE_UNKNOWN
    }

    const interp = this.getPhotometricInterpretation()
    if (interp !== null) {
      if (
        interp.trim().indexOf('RGB') !== -1 ||
        interp.trim().indexOf('YBR') !== -1 ||
        interp.trim().toLowerCase().indexOf('palette') !== -1
      ) {
        return Image.BYTE_TYPE_RGB
      }
    }

    if (dataType === 0) {
      return Image.BYTE_TYPE_INTEGER_UNSIGNED
    } else if (dataType === 1) {
      return Image.BYTE_TYPE_INTEGER
    } else {
      return Image.BYTE_TYPE_UNKNOWN
    }
  }

  // originally from: http://public.kitware.com/pipermail/insight-users/2005-March/012246.html
  getAcquiredSliceDirection() {
    let label

    const dirCos = this.getValueSafely(this.getTag(Tag.TAG_IMAGE_ORIENTATION[0], Tag.TAG_IMAGE_ORIENTATION[1]))

    if (!dirCos || dirCos.length !== 6) {
      return Image.SLICE_DIRECTION_UNKNOWN
    }

    const rowAxis = this.getMajorAxisFromPatientRelativeDirectionCosine(dirCos[0], dirCos[1], dirCos[2])
    const colAxis = this.getMajorAxisFromPatientRelativeDirectionCosine(dirCos[3], dirCos[4], dirCos[5])

    if (rowAxis !== null && colAxis !== null) {
      if ((rowAxis === 'R' || rowAxis === 'L') && (colAxis === 'A' || colAxis === 'P')) {
        label = Image.SLICE_DIRECTION_AXIAL
      } else if ((colAxis === 'R' || colAxis === 'L') && (rowAxis === 'A' || rowAxis === 'P')) {
        label = Image.SLICE_DIRECTION_AXIAL
      } else if ((rowAxis === 'R' || rowAxis === 'L') && (colAxis === 'H' || colAxis === 'F')) {
        label = Image.SLICE_DIRECTION_CORONAL
      } else if ((colAxis === 'R' || colAxis === 'L') && (rowAxis === 'H' || rowAxis === 'F')) {
        label = Image.SLICE_DIRECTION_CORONAL
      } else if ((rowAxis === 'A' || rowAxis === 'P') && (colAxis === 'H' || colAxis === 'F')) {
        label = Image.SLICE_DIRECTION_SAGITTAL
      } else if ((colAxis === 'A' || colAxis === 'P') && (rowAxis === 'H' || rowAxis === 'F')) {
        label = Image.SLICE_DIRECTION_SAGITTAL
      }
    } else {
      label = Image.SLICE_DIRECTION_OBLIQUE
    }

    return label
  }

  // returns an array of tags
  /**
   * Returns encapsulated data tags.
   * @returns {daikon.Tag[]}
   */
  getEncapsulatedData() {
    const buffer = this.getPixelData().value.buffer
    const parser = new Parser()
    return parser.parseEncapsulated(new DataView(buffer))
  }

  getJpegs() {
    let numTags
    let currentJpeg
    const data = []
    const dataConcat = []

    const encapTags = this.getEncapsulatedData()

    // organize data as an array of an array of JPEG parts
    if (encapTags) {
      numTags = encapTags.length

      for (let ctr = 0; ctr < numTags; ctr += 1) {
        if (isHeaderJPEG(encapTags[ctr].value) || isHeaderJPEG2000(encapTags[ctr].value)) {
          currentJpeg = []
          currentJpeg.push(encapTags[ctr].value.buffer)
          data.push(currentJpeg)
        } else if (currentJpeg && encapTags[ctr].value) {
          currentJpeg.push(encapTags[ctr].value.buffer)
        }
      }
    }

    // concat into an array of full JPEGs
    for (let ctr = 0; ctr < data.length; ctr += 1) {
      if (data[ctr].length > 1) {
        dataConcat[ctr] = concatArrayBuffers2(data[ctr])
      } else {
        dataConcat[ctr] = data[ctr][0]
      }

      data[ctr] = null
    }

    return dataConcat
  }

  getRLE() {
    let numTags
    const data = []

    const encapTags = this.getEncapsulatedData()

    // organize data as an array of an array of JPEG parts
    if (encapTags) {
      numTags = encapTags.length

      // the first sublist item contains offsets, need offsets?
      for (let ctr = 1; ctr < numTags; ctr += 1) {
        if (encapTags[ctr].value) {
          data.push(encapTags[ctr].value.buffer)
        }
      }
    }

    return data
  }

  /**
   * Returns a string of interpreted private data.
   * @returns {string}
   */
  getAllInterpretedPrivateData() {
    let key
    let tag
    let str = ''

    const sorted_keys = Object.keys(this.tags).sort()

    for (let ctr = 0; ctr < sorted_keys.length; ctr += 1) {
      key = sorted_keys[ctr]
      if (this.tags[key] !== undefined) {
        tag = this.tags[key]
        if (tag.hasInterpretedPrivateData()) {
          str += tag.value
        }
      }
    }

    return str
  }

  /**
   * Returns a string representation of this image.
   * @returns {string}
   */
  toString() {
    let tag
    let key
    let str = ''

    const sorted_keys = Object.keys(this.tags).sort()

    for (let ctr = 0; ctr < sorted_keys.length; ctr += 1) {
      key = sorted_keys[ctr]
      if (this.tags[key] !== undefined) {
        tag = this.tags[key]
        str += tag.toHTMLString() + '<br />'
      }
    }

    str = str.replace(/\n\s*\n/g, '\n') // replace mutli-newlines with single newline
    str = str.replace(/(?:\r\n|\r|\n)/g, '<br />') // replace newlines with <br>

    return str
  }

  getPalleteValues(tagID) {
    const value = this.getValueSafely(this.getTag(tagID[0], tagID[1]))

    if (value !== null) {
      const numVals = value.buffer.byteLength / 2
      const valsBig = []
      const valsLittle = []

      for (let ctr = 0; ctr < numVals; ctr += 1) {
        valsBig[ctr] = value.getUint16(ctr * 2, false) & 0xffff
        valsLittle[ctr] = value.getUint16(ctr * 2, true) & 0xffff
      }

      const valsBigMax = Math.max.apply(Math, valsBig)
      const valsBigMin = Math.min.apply(Math, valsBig)
      const valsLittleMax = Math.max.apply(Math, valsLittle)
      const valsLittleMin = Math.min.apply(Math, valsLittle)
      const valsBigDiff = Math.abs(valsBigMax - valsBigMin)
      const valsLittleDiff = Math.abs(valsLittleMax - valsLittleMin)

      if (valsBigDiff < valsLittleDiff) {
        return this.scalePalette(valsBig)
      } else {
        return this.scalePalette(valsLittle)
      }
    }

    return null
  }

  scalePalette(pal) {
    const max = Math.max.apply(Math, pal)
    const min = Math.min.apply(Math, pal)

    if (max > 255 || min < 0) {
      const slope = 255.0 / (max - min)
      const intercept = min

      for (let ctr = 0; ctr < pal.length; ctr += 1) {
        pal[ctr] = parseInt(Math.round((pal[ctr] - intercept) * slope))
      }
    }

    return pal
  }
}
