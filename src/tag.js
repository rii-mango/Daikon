import xss from 'xss'
import { getDescription } from './dictionary.js'
import { Siemens } from './siemens.js'
import {
  bytesToDouble,
  convertCamcelCaseToTitleCase,
  dec2hex,
  getStringAt,
  isString,
  isValidDate,
  safeParseFloat,
  safeParseInt,
  trim
} from './utilities.js'

export class Tag {
  static PRIVATE_DATA_READERS = [Siemens]

  static VR_AE_MAX_LENGTH = 16
  static VR_AS_MAX_LENGTH = 4
  static VR_AT_MAX_LENGTH = 4
  static VR_CS_MAX_LENGTH = 16
  static VR_DA_MAX_LENGTH = 8
  static VR_DS_MAX_LENGTH = 16
  static VR_DT_MAX_LENGTH = 26
  static VR_FL_MAX_LENGTH = 4
  static VR_FD_MAX_LENGTH = 8
  static VR_IS_MAX_LENGTH = 12
  static VR_LO_MAX_LENGTH = 64
  static VR_LT_MAX_LENGTH = 10240
  static VR_OB_MAX_LENGTH = -1
  static VR_OD_MAX_LENGTH = -1
  static VR_OF_MAX_LENGTH = -1
  static VR_OW_MAX_LENGTH = -1
  static VR_PN_MAX_LENGTH = 64 * 5
  static VR_SH_MAX_LENGTH = 16
  static VR_SL_MAX_LENGTH = 4
  static VR_SS_MAX_LENGTH = 2
  static VR_ST_MAX_LENGTH = 1024
  static VR_TM_MAX_LENGTH = 16
  static VR_UI_MAX_LENGTH = 64
  static VR_UL_MAX_LENGTH = 4
  static VR_UN_MAX_LENGTH = -1
  static VR_US_MAX_LENGTH = 2
  static VR_UT_MAX_LENGTH = -1
  static VR_UC_MAX_LENGTH = -1

  // metadata
  static TAG_TRANSFER_SYNTAX = [0x0002, 0x0010]
  static TAG_META_LENGTH = [0x0002, 0x0000]

  // sublists
  static TAG_SUBLIST_ITEM = [0xfffe, 0xe000]
  static TAG_SUBLIST_ITEM_DELIM = [0xfffe, 0xe00d]
  static TAG_SUBLIST_SEQ_DELIM = [0xfffe, 0xe0dd]

  // image dims
  static TAG_ROWS = [0x0028, 0x0010]
  static TAG_COLS = [0x0028, 0x0011]
  static TAG_ACQUISITION_MATRIX = [0x0018, 0x1310]
  static TAG_NUMBER_OF_FRAMES = [0x0028, 0x0008]
  static TAG_NUMBER_TEMPORAL_POSITIONS = [0x0020, 0x0105]

  // voxel dims
  static TAG_PIXEL_SPACING = [0x0028, 0x0030]
  static TAG_SLICE_THICKNESS = [0x0018, 0x0050]
  static TAG_SLICE_GAP = [0x0018, 0x0088]
  static TAG_TR = [0x0018, 0x0080]
  static TAG_FRAME_TIME = [0x0018, 0x1063]

  // datatype
  static TAG_BITS_ALLOCATED = [0x0028, 0x0100]
  static TAG_BITS_STORED = [0x0028, 0x0101]
  static TAG_PIXEL_REPRESENTATION = [0x0028, 0x0103]
  static TAG_HIGH_BIT = [0x0028, 0x0102]
  static TAG_PHOTOMETRIC_INTERPRETATION = [0x0028, 0x0004]
  static TAG_SAMPLES_PER_PIXEL = [0x0028, 0x0002]
  static TAG_PLANAR_CONFIG = [0x0028, 0x0006]
  static TAG_PALETTE_RED = [0x0028, 0x1201]
  static TAG_PALETTE_GREEN = [0x0028, 0x1202]
  static TAG_PALETTE_BLUE = [0x0028, 0x1203]

  // data scale
  static TAG_DATA_SCALE_SLOPE = [0x0028, 0x1053]
  static TAG_DATA_SCALE_INTERCEPT = [0x0028, 0x1052]
  static TAG_DATA_SCALE_ELSCINT = [0x0207, 0x101f]
  static TAG_PIXEL_BANDWIDTH = [0x0018, 0x0095]

  // range
  static TAG_IMAGE_MIN = [0x0028, 0x0106]
  static TAG_IMAGE_MAX = [0x0028, 0x0107]
  static TAG_WINDOW_CENTER = [0x0028, 0x1050]
  static TAG_WINDOW_WIDTH = [0x0028, 0x1051]

  // descriptors
  static TAG_SPECIFIC_CHAR_SET = [0x0008, 0x0005]
  static TAG_PATIENT_NAME = [0x0010, 0x0010]
  static TAG_PATIENT_ID = [0x0010, 0x0020]
  static TAG_STUDY_DATE = [0x0008, 0x0020]
  static TAG_STUDY_TIME = [0x0008, 0x0030]
  static TAG_STUDY_DES = [0x0008, 0x1030]
  static TAG_IMAGE_TYPE = [0x0008, 0x0008]
  static TAG_IMAGE_COMMENTS = [0x0020, 0x4000]
  static TAG_SEQUENCE_NAME = [0x0018, 0x0024]
  static TAG_MODALITY = [0x0008, 0x0060]

  // session ID
  static TAG_FRAME_OF_REF_UID = [0x0020, 0x0052]

  // study ID
  static TAG_STUDY_UID = [0x0020, 0x000d]

  // volume ID
  static TAG_SERIES_DESCRIPTION = [0x0008, 0x103e]
  static TAG_SERIES_INSTANCE_UID = [0x0020, 0x000e]
  static TAG_SERIES_NUMBER = [0x0020, 0x0011]
  static TAG_ECHO_NUMBER = [0x0018, 0x0086]
  static TAG_TEMPORAL_POSITION = [0x0020, 0x0100]

  // slice ID
  static TAG_IMAGE_NUM = [0x0020, 0x0013]
  static TAG_SLICE_LOCATION = [0x0020, 0x1041]

  // orientation
  static TAG_IMAGE_ORIENTATION = [0x0020, 0x0037]
  static TAG_IMAGE_POSITION = [0x0020, 0x0032]
  static TAG_SLICE_LOCATION_VECTOR = [0x0018, 0x2005]

  // LUT shape
  static TAG_LUT_SHAPE = [0x2050, 0x0020]

  // pixel data
  static TAG_PIXEL_DATA = [0x7fe0, 0x0010]

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

  constructor(group, element, vr, value, offsetStart, offsetValue, offsetEnd, littleEndian, charset) {
    this.group = group
    this.element = element
    this.vr = vr
    this.offsetStart = offsetStart
    this.offsetValue = offsetValue
    this.offsetEnd = offsetEnd
    this.sublist = false
    this.preformatted = false
    this.id = Tag.createId(group, element)

    if (value instanceof Array) {
      this.value = value
      this.sublist = true
    } else if (value !== null) {
      const dv = new DataView(value)
      this.value = this.convertValue(vr, dv, littleEndian, charset)

      if (this.value === dv && this.isPrivateData()) {
        this.value = this.convertPrivateValue(group, element, dv)
        this.preformatted = this.value !== dv
      }
    } else {
      this.value = null
    }
  }

  /**
   * Create an ID string based on the specified group and element
   * @param {number} group
   * @param {number} element
   * @returns {string}
   */
  static createId(group, element) {
    const groupStr = dec2hex(group)
    const elemStr = dec2hex(element)
    return groupStr + elemStr
  }

  getUnsignedInteger16(rawData, littleEndian) {
    const mul = rawData.byteLength / 2
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getUint16(ctr * 2, littleEndian)
    }

    return data
  }

  getSignedInteger16(rawData, littleEndian) {
    const mul = rawData.byteLength / 2
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getInt16(ctr * 2, littleEndian)
    }

    return data
  }

  getFloat32(rawData, littleEndian) {
    const mul = rawData.byteLength / 4
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getFloat32(ctr * 4, littleEndian)
    }

    return data
  }

  getSignedInteger32(rawData, littleEndian) {
    const mul = rawData.byteLength / 4
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getInt32(ctr * 4, littleEndian)
    }

    return data
  }

  getUnsignedInteger32(rawData, littleEndian) {
    const mul = rawData.byteLength / 4
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getUint32(ctr * 4, littleEndian)
    }

    return data
  }

  getFloat64(rawData, littleEndian) {
    if (rawData.byteLength < 8) {
      return 0
    }

    const mul = rawData.byteLength / 8
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = rawData.getFloat64(ctr * 8, littleEndian)
    }

    return data
  }

  getDoubleElscint(rawData) {
    let data = []
    const reordered = []

    for (let ctr = 0; ctr < 8; ctr += 1) {
      data[ctr] = rawData.getUint8(ctr)
    }

    reordered[0] = data[3]
    reordered[1] = data[2]
    reordered[2] = data[1]
    reordered[3] = data[0]
    reordered[4] = data[7]
    reordered[5] = data[6]
    reordered[6] = data[5]
    reordered[7] = data[4]

    data = [bytesToDouble(reordered)]

    return data
  }

  getFixedLengthStringValue(rawData, maxLength, charset, vr) {
    const mul = Math.floor(rawData.byteLength / maxLength)
    const data = []
    for (let ctr = 0; ctr < mul; ctr += 1) {
      data[ctr] = getStringAt(rawData, ctr * maxLength, maxLength, charset, vr)
    }

    return data
  }

  getStringValue(rawData, charset, vr) {
    const data = getStringAt(rawData, 0, rawData.byteLength, charset, vr).split('\\')

    for (let ctr = 0; ctr < data.length; ctr += 1) {
      data[ctr] = trim(data[ctr])
    }

    return data
  }

  getDateStringValue(rawData) {
    const dotFormat = this.getSingleStringValue(rawData)[0].indexOf('.') !== -1
    const stringData = this.getFixedLengthStringValue(rawData, dotFormat ? 10 : Tag.VR_DA_MAX_LENGTH)
    let parts = null
    const data = []

    for (let ctr = 0; ctr < stringData.length; ctr += 1) {
      if (dotFormat) {
        parts = stringData[ctr].split('.')
        if (parts.length === 3) {
          data[ctr] = new Date(safeParseInt(parts[0]), safeParseInt(parts[1]) - 1, safeParseInt(parts[2]))
        } else {
          data[ctr] = new Date()
        }
      } else if (stringData[ctr].length === 8) {
        data[ctr] = new Date(
          safeParseInt(stringData[ctr].substring(0, 4)),
          safeParseInt(stringData[ctr].substring(4, 6)) - 1,
          safeParseInt(stringData[ctr].substring(6, 8))
        )
      } else {
        data[ctr] = Date.parse(stringData[ctr])
      }

      if (!isValidDate(data[ctr])) {
        data[ctr] = stringData[ctr]
      }
    }

    return data
  }

  getDateTimeStringValue(rawData) {
    const stringData = this.getStringValue(rawData)
    const data = []
    let year = null
    let month = null
    let date = null
    let hours = null
    let minutes = null
    let seconds = null

    for (let ctr = 0; ctr < stringData.length; ctr += 1) {
      if (stringData[ctr].length >= 4) {
        year = parseInt(stringData[ctr].substring(0, 4), 10) // required

        if (stringData[ctr].length >= 6) {
          month = safeParseInt(stringData[ctr].substring(4, 6)) - 1
        }

        if (stringData[ctr].length >= 8) {
          date = safeParseInt(stringData[ctr].substring(6, 8))
        }

        if (stringData[ctr].length >= 10) {
          hours = safeParseInt(stringData[ctr].substring(8, 10))
        }

        if (stringData[ctr].length >= 12) {
          minutes = safeParseInt(stringData[ctr].substring(10, 12))
        }

        if (stringData[ctr].length >= 14) {
          seconds = safeParseInt(stringData[ctr].substring(12, 14))
        }

        data[ctr] = new Date(year, month, date, hours, minutes, seconds)
      } else {
        data[ctr] = Date.parse(stringData[ctr])
      }

      if (!isValidDate(data[ctr])) {
        data[ctr] = stringData[ctr]
      }
    }

    return data
  }

  getTimeStringValue(rawData, ms) {
    const stringData = this.getStringValue(rawData)
    const data = []

    if (ms) {
      let parts = null
      let hours = 0
      let minutes = 0
      let seconds = 0

      for (let ctr = 0; ctr < stringData.length; ctr += 1) {
        if (stringData[ctr].indexOf(':') !== -1) {
          parts = stringData[ctr].split(':')
          hours = safeParseInt(parts[0])

          if (parts.length > 1) {
            minutes = safeParseInt(parts[1])
          }

          if (parts.length > 2) {
            seconds = safeParseFloat(parts[2])
          }
        } else {
          if (stringData[ctr].length >= 2) {
            hours = safeParseInt(stringData[ctr].substring(0, 2))
          }

          if (stringData[ctr].length >= 4) {
            minutes = safeParseInt(stringData[ctr].substring(2, 4))
          }

          if (stringData[ctr].length >= 6) {
            seconds = safeParseFloat(stringData[ctr].substring(4))
          }
        }

        data[ctr] = Math.round(hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000)
      }

      return data
    }

    return stringData
  }

  getDoubleStringValue(rawData) {
    const stringData = this.getStringValue(rawData)
    const data = []

    for (let ctr = 0; ctr < stringData.length; ctr += 1) {
      data[ctr] = parseFloat(stringData[ctr])
    }

    return data
  }

  getIntegerStringValue(rawData) {
    const stringData = this.getStringValue(rawData)
    const data = []

    for (let ctr = 0; ctr < stringData.length; ctr += 1) {
      data[ctr] = parseInt(stringData[ctr], 10)
    }

    return data
  }

  getSingleStringValue(rawData, maxLength, charset, vr) {
    let len = rawData.byteLength
    if (maxLength) {
      len = Math.min(rawData.byteLength, maxLength)
    }
    return [trim(getStringAt(rawData, 0, len, charset, vr))]
  }

  getPersonNameStringValue(rawData, charset, vr) {
    const stringData = this.getStringValue(rawData, charset, vr)
    const data = []

    for (let ctr = 0; ctr < stringData.length; ctr += 1) {
      data[ctr] = stringData[ctr].replace('^', ' ')
    }

    return data
  }

  convertPrivateValue(group, element, rawData) {
    for (let ctr = 0; ctr < Tag.PRIVATE_DATA_READERS.length; ctr += 1) {
      const privReader = new Tag.PRIVATE_DATA_READERS[ctr](rawData.buffer)
      if (privReader.canRead(group, element)) {
        return privReader.readHeader()
      }
    }

    return rawData
  }

  convertValue(vr, rawData, littleEndian, charset) {
    let data = null
    // http://dicom.nema.org/dicom/2013/output/chtml/part05/sect_6.2.html
    if (vr === 'AE') {
      data = this.getSingleStringValue(rawData, Tag.VR_AE_MAX_LENGTH)
    } else if (vr === 'AS') {
      data = this.getFixedLengthStringValue(rawData, Tag.VR_AS_MAX_LENGTH)
    } else if (vr === 'AT') {
      data = this.getUnsignedInteger16(rawData, littleEndian)
    } else if (vr === 'CS') {
      data = this.getStringValue(rawData)
    } else if (vr === 'DA') {
      data = this.getDateStringValue(rawData)
    } else if (vr === 'DS') {
      data = this.getDoubleStringValue(rawData)
    } else if (vr === 'DT') {
      data = this.getDateTimeStringValue(rawData)
    } else if (vr === 'FL') {
      data = this.getFloat32(rawData, littleEndian)
    } else if (vr === 'FD') {
      data = this.getFloat64(rawData, littleEndian)
    } else if (vr === 'FE') {
      // special Elscint double (see dictionary)
      data = this.getDoubleElscint(rawData, littleEndian)
    } else if (vr === 'IS') {
      data = this.getIntegerStringValue(rawData)
    } else if (vr === 'LO') {
      data = this.getStringValue(rawData, charset, vr)
    } else if (vr === 'LT') {
      data = this.getSingleStringValue(rawData, Tag.VR_AT_MAX_LENGTH, charset, vr)
    } else if (vr === 'OB') {
      data = rawData
    } else if (vr === 'OD') {
      data = rawData
    } else if (vr === 'OF') {
      data = rawData
    } else if (vr === 'OW') {
      data = rawData
    } else if (vr === 'PN') {
      data = this.getPersonNameStringValue(rawData, charset, vr)
    } else if (vr === 'SH') {
      data = this.getStringValue(rawData, charset, vr)
    } else if (vr === 'SL') {
      data = this.getSignedInteger32(rawData, littleEndian)
    } else if (vr === 'SQ') {
      data = null
    } else if (vr === 'SS') {
      data = this.getSignedInteger16(rawData, littleEndian)
    } else if (vr === 'ST') {
      data = this.getSingleStringValue(rawData, Tag.VR_ST_MAX_LENGTH, charset, vr)
    } else if (vr === 'TM') {
      data = this.getTimeStringValue(rawData)
    } else if (vr === 'UI') {
      data = this.getStringValue(rawData)
    } else if (vr === 'UL') {
      data = this.getUnsignedInteger32(rawData, littleEndian)
    } else if (vr === 'UN') {
      data = rawData
    } else if (vr === 'US') {
      data = this.getUnsignedInteger16(rawData, littleEndian)
    } else if (vr === 'UT') {
      data = this.getSingleStringValue(rawData, Number.MAX_SAFE_INTEGER, charset, vr)
    } else if (vr === 'UC') {
      data = this.getStringValue(rawData)
    }

    return data
  }

  /** * Prototype Methods ***/

  /**
   * Returns a string representation of this tag.
   * @param {number} [level] - the indentation level
   * @param {boolean} [html]
   * @returns {string}
   */
  toString(level, html) {
    let valueStr = ''
    const groupStr = dec2hex(this.group)
    const elemStr = dec2hex(this.element)
    let tagStr = '(' + groupStr + ',' + elemStr + ')'
    let des = ''
    let padding = ''

    if (level === undefined) {
      level = 0
    }

    for (let ctr = 0; ctr < level; ctr += 1) {
      if (html) {
        padding += '&nbsp;&nbsp;'
      } else {
        padding += '  '
      }
    }

    if (this.sublist) {
      for (let ctr = 0; ctr < this.value.length; ctr += 1) {
        valueStr += '\n' + this.value[ctr].toString(level + 1, html)
      }
    } else if (this.vr === 'SQ') {
      valueStr = ''
    } else if (this.isPixelData()) {
      valueStr = ''
    } else if (!this.value) {
      valueStr = ''
    } else {
      if (html && this.preformatted) {
        valueStr = '[<pre>' + this.value + '</pre>]'
      } else {
        valueStr = '[' + this.value + ']'
      }
    }

    if (this.isSublistItem()) {
      tagStr = 'Sequence Item'
    } else if (this.isSublistItemDelim()) {
      tagStr = 'Sequence Item Delimiter'
    } else if (this.isSequenceDelim()) {
      tagStr = 'Sequence Delimiter'
    } else if (this.isPixelData()) {
      tagStr = 'Pixel Data'
    } else {
      des = convertCamcelCaseToTitleCase(getDescription(this.group, this.element))
    }

    // filter for xss
    valueStr = xss(valueStr)

    if (html) {
      return (
        padding +
        "<span style='color:#B5CBD3'>" +
        tagStr +
        '</span>&nbsp;&nbsp;&nbsp;' +
        des +
        '&nbsp;&nbsp;&nbsp;' +
        valueStr
      )
    } else {
      return padding + ' ' + tagStr + ' ' + des + ' ' + valueStr
    }
  }

  /**
   * Returns an HTML string representation of this tag.
   * @param {number} level - the indentation level
   * @returns {string}
   */
  toHTMLString(level) {
    return this.toString(level, true)
  }

  /**
   * Returns true if this is the transform syntax tag.
   * @returns {boolean}
   */
  isTransformSyntax() {
    return this.group === Tag.TAG_TRANSFER_SYNTAX[0] && this.element === Tag.TAG_TRANSFER_SYNTAX[1]
  }

  /**
   * Returns true if this is the char set tag.
   * @returns {boolean}
   */
  isCharset() {
    return this.group === Tag.TAG_SPECIFIC_CHAR_SET[0] && this.element === Tag.TAG_SPECIFIC_CHAR_SET[1]
  }

  /**
   * Returns true if this is the pixel data tag.
   * @returns {boolean}
   */
  isPixelData() {
    return this.group === Tag.TAG_PIXEL_DATA[0] && this.element === Tag.TAG_PIXEL_DATA[1]
  }

  /**
   * Returns true if this tag contains private data.
   * @returns {boolean}
   */
  isPrivateData() {
    return (this.group & 1) === 1
  }

  /**
   * Returns true if this tag contains private data that can be read.
   * @returns {boolean}
   */
  hasInterpretedPrivateData() {
    return this.isPrivateData() && isString(this.value)
  }

  /**
   * Returns true if this tag is a sublist item.
   * @returns {boolean}
   */
  isSublistItem() {
    return this.group === Tag.TAG_SUBLIST_ITEM[0] && this.element === Tag.TAG_SUBLIST_ITEM[1]
  }

  /**
   * Returns true if this tag is a sublist item delimiter.
   * @returns {boolean}
   */
  isSublistItemDelim() {
    return this.group === Tag.TAG_SUBLIST_ITEM_DELIM[0] && this.element === Tag.TAG_SUBLIST_ITEM_DELIM[1]
  }

  /**
   * Returns true if this tag is a sequence delimiter.
   * @returns {boolean}
   */
  isSequenceDelim() {
    return this.group === Tag.TAG_SUBLIST_SEQ_DELIM[0] && this.element === Tag.TAG_SUBLIST_SEQ_DELIM[1]
  }

  /**
   * Returns true if this is a meta length tag.
   * @returns {boolean}
   */
  isMetaLength() {
    return this.group === Tag.TAG_META_LENGTH[0] && this.element === Tag.TAG_META_LENGTH[1]
  }
}
