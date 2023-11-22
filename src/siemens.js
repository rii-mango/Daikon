import { swap32 } from './utilities.js'

export class Siemens {
  static CSA2_MAGIC_NUMBER = [83, 86, 49, 48]
  static NAME_LENGTH = 64
  static ELEMENT_CSA1 = 0x1010
  static ELEMENT_CSA2 = 0x1020
  static GROUP_CSA = 0x029

  output = ''

  constructor(buffer) {
    this.data = new DataView(buffer, 0)
  }

  /**
   * Reads the Siemens header.  (See http://nipy.org/nibabel/dicom/siemens_csa.html)
   * @returns {string}
   */
  readHeader() {
    try {
      if (this.data.byteLength > Siemens.CSA2_MAGIC_NUMBER.length) {
        let match = true

        for (let ctr = 0; ctr < Siemens.CSA2_MAGIC_NUMBER.length; ctr += 1) {
          match &= this.data.getUint8(ctr) === Siemens.CSA2_MAGIC_NUMBER[ctr]
        }

        if (match) {
          this.readHeaderAtOffset(Siemens.CSA2_MAGIC_NUMBER.length + 4)
        } else {
          this.readHeaderAtOffset(0)
        }
      }
    } catch (error) {
      console.error(error)
    }

    return this.output
  }

  readHeaderAtOffset(offset) {
    this.output += '\n'

    const numTags = swap32(this.data.getUint32(offset))

    if (numTags < 1 || numTags > 128) {
      return this.output
    }

    offset += 4

    offset += 4 // unused

    for (let ctr = 0; ctr < numTags; ctr += 1) {
      offset = this.readTag(offset)

      if (offset === -1) {
        break
      }
    }

    return this.output
  }

  readTag(offset) {
    const name = this.readString(offset, Siemens.NAME_LENGTH)

    offset += Siemens.NAME_LENGTH

    offset += 4 // vm

    offset += 4

    offset += 4 // syngodt

    const numItems = swap32(this.data.getUint32(offset))

    offset += 4

    offset += 4 // unused

    this.output += '    ' + name + '='

    for (let ctr = 0; ctr < numItems; ctr += 1) {
      offset = this.readItem(offset)

      if (offset === -1) {
        break
      } else if (offset % 4 !== 0) {
        offset += 4 - (offset % 4)
      }
    }

    this.output += '\n'

    return offset
  }

  readString(offset, length) {
    let str = ''

    for (let ctr = 0; ctr < length; ctr += 1) {
      const char2 = this.data.getUint8(offset + ctr)

      if (char2 === 0) {
        break
      }

      str += String.fromCharCode(char2)
    }

    return str
  }

  readItem(offset) {
    const itemLength = swap32(this.data.getUint32(offset))

    if (offset + itemLength > this.data.buffer.length) {
      return -1
    }

    offset += 16

    if (itemLength > 0) {
      this.output += this.readString(offset, itemLength) + ' '
    }

    return offset + itemLength
  }

  /**
   * Returns true if the specified group and element indicate this tag can be read.
   * @param {number} group
   * @param {number} element
   * @returns {boolean}
   */
  canRead(group, element) {
    return group === Siemens.GROUP_CSA && (element === Siemens.ELEMENT_CSA1 || element === Siemens.ELEMENT_CSA2)
  }
}
