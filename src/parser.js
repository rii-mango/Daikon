import { inflateRaw } from 'pako'
import { Image } from './image.js'
import { concatArrayBuffers, getStringAt } from './utilities.js'
import { getVR } from './dictionary.js'
import { Tag } from './tag.js'

export class Parser {
  static MAGIC_COOKIE_OFFSET = 128
  static MAGIC_COOKIE = [68, 73, 67, 77]
  static VRS = [
    'AE',
    'AS',
    'AT',
    'CS',
    'DA',
    'DS',
    'DT',
    'FL',
    'FD',
    'IS',
    'LO',
    'LT',
    'OB',
    'OD',
    'OF',
    'OW',
    'PN',
    'SH',
    'SL',
    'SS',
    'ST',
    'TM',
    'UI',
    'UL',
    'UN',
    'US',
    'UT',
    'UC'
  ]

  static DATA_VRS = ['OB', 'OW', 'OF', 'SQ', 'UT', 'UN', 'UC']
  static RAW_DATA_VRS = ['OB', 'OD', 'OF', 'OW', 'UN']
  static TRANSFER_SYNTAX_IMPLICIT_LITTLE = '1.2.840.10008.1.2'
  static TRANSFER_SYNTAX_EXPLICIT_LITTLE = '1.2.840.10008.1.2.1'
  static TRANSFER_SYNTAX_EXPLICIT_BIG = '1.2.840.10008.1.2.2'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG = '1.2.840.10008.1.2.4'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS = '1.2.840.10008.1.2.4.57'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_LOSSLESS_SEL1 = '1.2.840.10008.1.2.4.70'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_8BIT = '1.2.840.10008.1.2.4.50'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_BASELINE_12BIT = '1.2.840.10008.1.2.4.51'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_LS_LOSSLESS = '1.2.840.10008.1.2.4.80'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_LS = '1.2.840.10008.1.2.4.81'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_2000_LOSSLESS = '1.2.840.10008.1.2.4.90'
  static TRANSFER_SYNTAX_COMPRESSION_JPEG_2000 = '1.2.840.10008.1.2.4.91'
  static TRANSFER_SYNTAX_COMPRESSION_RLE = '1.2.840.10008.1.2.5'
  static TRANSFER_SYNTAX_COMPRESSION_DEFLATE = '1.2.840.10008.1.2.1.99'
  static UNDEFINED_LENGTH = 0xffffffff

  littleEndian = true
  explicit = true
  metaFound = false
  metaFinished = false
  metaFinishedOffset = -1
  needsDeflate = false
  inflated = null
  encapsulation = false
  level = 0
  error = null
  verbose = false

  /**
   * Returns true if the DICOM magic cookie is found.
   * @param {DataView} data
   * @returns {boolean}
   */
  static isMagicCookieFound(data) {
    const offset = Parser.MAGIC_COOKIE_OFFSET
    const magicCookieLength = Parser.MAGIC_COOKIE.length

    for (let ctr = 0; ctr < magicCookieLength; ctr += 1) {
      if (data.getUint8(offset + ctr) !== Parser.MAGIC_COOKIE[ctr]) {
        return false
      }
    }

    return true
  }

  /**
   * Parses this data and returns an image object.
   * @param {DataView} data
   * @returns {daikon.Image|null}
   */
  parse(data) {
    let image = null
    let offset
    let tag
    let copyMeta
    let copyDeflated

    try {
      image = new Image()
      offset = this.findFirstTagOffset(data)
      tag = this.getNextTag(data, offset)

      while (tag !== null) {
        if (this.verbose) {
          console.info(tag.toString())
        }

        image.putTag(tag)

        if (tag.isPixelData()) {
          break
        }

        if (this.needsDeflate && tag.offsetEnd >= this.metaFinishedOffset) {
          this.needsDeflate = false
          copyMeta = data.buffer.slice(0, tag.offsetEnd)
          copyDeflated = data.buffer.slice(tag.offsetEnd)
          this.inflated = concatArrayBuffers(copyMeta, inflateRaw(copyDeflated))
          // this.inflated = daikon.Utils.concatArrayBuffers(copyMeta, fflate.decompressSync(new Uint8Array(copyDeflated)));
          data = new DataView(this.inflated)
        }

        tag = this.getNextTag(data, tag.offsetEnd)
      }
    } catch (err) {
      this.error = err
    }

    if (image !== null) {
      image.littleEndian = this.littleEndian
    }

    return image
  }

  parseEncapsulated(data) {
    const offset = 0
    let tag
    const tags = []

    this.encapsulation = true

    try {
      tag = this.getNextTag(data, offset)

      while (tag !== null) {
        if (tag.isSublistItem()) {
          tags.push(tag)
        }

        if (this.verbose) {
          console.info(tag.toString())
        }

        tag = this.getNextTag(data, tag.offsetEnd)
      }
    } catch (err) {
      this.error = err
    }

    return tags
  }

  testForValidTag(data) {
    let offset
    let tag = null

    try {
      offset = this.findFirstTagOffset(data)
      tag = this.getNextTag(data, offset, false)
    } catch (err) {
      this.error = err
    }

    return tag
  }

  getNextTag(data, offset, testForTag) {
    let group = 0
    let value = null
    const offsetStart = offset
    let length = 0
    let little = true
    let vr = null

    if (offset >= data.byteLength) {
      return null
    }

    if (this.metaFinished) {
      little = this.littleEndian
      group = data.getUint16(offset, little)
    } else {
      group = data.getUint16(offset, true)

      if ((this.metaFinishedOffset !== -1 && offset >= this.metaFinishedOffset) || group !== 0x0002) {
        this.metaFinished = true
        little = this.littleEndian
        group = data.getUint16(offset, little)
      } else {
        little = true
      }
    }

    if (!this.metaFound && group === 0x0002) {
      this.metaFound = true
    }

    offset += 2

    const element = data.getUint16(offset, little)
    offset += 2
    if (this.explicit || !this.metaFinished) {
      vr = getStringAt(data, offset, 2)

      if (!this.metaFound && this.metaFinished && Parser.VRS.indexOf(vr) === -1) {
        vr = getVR(group, element)
        length = data.getUint32(offset, little)
        offset += 4
        this.explicit = false
      } else {
        offset += 2

        if (Parser.DATA_VRS.indexOf(vr) !== -1) {
          offset += 2 // skip two empty bytes

          length = data.getUint32(offset, little)
          offset += 4
        } else {
          length = data.getUint16(offset, little)
          offset += 2
        }
      }
    } else {
      vr = getVR(group, element)
      length = data.getUint32(offset, little)

      if (length === Parser.UNDEFINED_LENGTH) {
        vr = 'SQ'
      }

      offset += 4
    }

    const offsetValue = offset

    const isPixelData = group === Tag.TAG_PIXEL_DATA[0] && element === Tag.TAG_PIXEL_DATA[1]
    /*
    color lookup data will be in (0028,12XX), so don't try to treat these as a sublist even though it can look like a list. Example:
      (0028,1201) OW 0000\ffff\ffff\0000\ffff\ffff\0000\cccc\0000\0000\1e1e\0000\0101... # 512, 1 RedPaletteColorLookupTableData
      (0028,1202) OW 0000\ffff\0000\ffff\8080\3333\ffff\b3b3\0000\0000\1e1e\0000\0101... # 512, 1 GreenPaletteColorLookupTableData
      (0028,1203) OW 0000\0000\ffff\ffff\0000\4d4d\0000\0000\0000\0000\1e1e\0000\0101... # 512, 1 BluePaletteColorLookupTableData
    */
    const isLookupTableData = group === 0x0028 && element >= 0x1201 && element < 0x1300

    if (
      vr === 'SQ' ||
      (!isLookupTableData && !isPixelData && !this.encapsulation && Parser.DATA_VRS.indexOf(vr) !== -1 && vr !== 'UC')
    ) {
      value = this.parseSublist(data, offset, length, vr !== 'SQ')

      if (length === Parser.UNDEFINED_LENGTH) {
        length = value[value.length - 1].offsetEnd - offset
      }
    } else if (length > 0 && !testForTag) {
      if (length === Parser.UNDEFINED_LENGTH) {
        if (isPixelData) {
          length = data.byteLength - offset
        }
      }

      value = data.buffer.slice(offset, offset + length)
    }

    offset += length
    const tag = new Tag(group, element, vr, value, offsetStart, offsetValue, offset, this.littleEndian, this.charset)

    if (tag.value) {
      if (tag.isTransformSyntax()) {
        this.transformSyntaxAlreadyExist = true
        if (tag.value[0] === Parser.TRANSFER_SYNTAX_IMPLICIT_LITTLE) {
          this.explicit = false
          this.littleEndian = true
        } else if (tag.value[0] === Parser.TRANSFER_SYNTAX_EXPLICIT_BIG) {
          this.explicit = true
          this.littleEndian = false
        } else if (tag.value[0] === Parser.TRANSFER_SYNTAX_COMPRESSION_DEFLATE) {
          this.needsDeflate = true
          this.explicit = true
          this.littleEndian = true
        } else {
          this.explicit = true
          this.littleEndian = true
        }
      } else if (tag.isMetaLength()) {
        this.metaFinishedOffset = tag.value[0] + offset
      } else if (tag.isCharset()) {
        let charset = tag.value
        if (charset.length === 2) {
          charset = (charset[0] || 'ISO 2022 IR 6') + '\\' + charset[1]
        } else if (charset.length === 1) {
          charset = charset[0]
        }
        this.charset = charset
      }
    }

    return tag
  }

  parseSublist(data, offset, length, raw) {
    let sublistItem
    const offsetEnd = offset + length
    const tags = []

    this.level++

    if (length === Parser.UNDEFINED_LENGTH) {
      sublistItem = this.parseSublistItem(data, offset, raw)

      while (!sublistItem.isSequenceDelim()) {
        tags.push(sublistItem)
        offset = sublistItem.offsetEnd
        sublistItem = this.parseSublistItem(data, offset, raw)
      }

      tags.push(sublistItem)
    } else {
      while (offset < offsetEnd) {
        sublistItem = this.parseSublistItem(data, offset, raw)
        tags.push(sublistItem)
        offset = sublistItem.offsetEnd
      }
    }

    this.level--

    return tags
  }

  parseSublistItem(data, offset, raw) {
    let offsetEnd
    let tag
    const offsetStart = offset
    let value = null
    const tags = []

    const group = data.getUint16(offset, this.littleEndian)
    offset += 2

    const element = data.getUint16(offset, this.littleEndian)
    offset += 2

    const length = data.getUint32(offset, this.littleEndian)
    offset += 4

    const offsetValue = offset

    if (length === Parser.UNDEFINED_LENGTH) {
      tag = this.getNextTag(data, offset)

      while (tag && !tag.isSublistItemDelim()) {
        tags.push(tag)
        offset = tag.offsetEnd
        tag = this.getNextTag(data, offset)
      }

      tag && tags.push(tag)
      tag && (offset = tag.offsetEnd)
    } else if (raw) {
      value = data.buffer.slice(offset, offset + length)
      offset = offset + length
    } else {
      offsetEnd = offset + length

      while (offset < offsetEnd) {
        tag = this.getNextTag(data, offset)
        tags.push(tag)
        offset = tag.offsetEnd
      }
    }

    const sublistItemTag = new Tag(
      group,
      element,
      null,
      value || tags,
      offsetStart,
      offsetValue,
      offset,
      this.littleEndian
    )

    return sublistItemTag
  }

  findFirstTagOffset(data) {
    let offset = 0
    const magicCookieLength = Parser.MAGIC_COOKIE.length
    const searchOffsetMax = Parser.MAGIC_COOKIE_OFFSET * 5
    let found = false
    let ch = 0

    if (Parser.isMagicCookieFound(data)) {
      offset = Parser.MAGIC_COOKIE_OFFSET + magicCookieLength
    } else {
      for (let ctr = 0; ctr < searchOffsetMax; ctr += 1) {
        ch = data.getUint8(ctr)
        if (ch === Parser.MAGIC_COOKIE[0]) {
          found = true
          for (let ctrIn = 1; ctrIn < magicCookieLength; ctrIn += 1) {
            if (data.getUint8(ctr + ctrIn) !== Parser.MAGIC_COOKIE[ctrIn]) {
              found = false
            }
          }

          if (found) {
            offset = ctr + magicCookieLength
            break
          }
        }
      }
    }

    return offset
  }

  hasError() {
    return this.error !== null
  }
}
