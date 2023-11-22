export class RLE {
  static HEADER_SIZE = 64

  rawData = null
  bytesRead = 0
  bytesPut = 0
  segElemPut = 0
  numSegments = 0
  segmentOffsets = []
  littleEndian = true
  segmentIndex = 0
  numElements = 0
  size = 0
  output = null

  /**
   * Decodes the RLE data.
   * @param {ArrayBuffer} data
   * @param {boolean} littleEndian
   * @param {number} numElements
   * @returns {DataView}
   */
  decode(data, littleEndian, numElements) {
    this.rawData = new DataView(data)
    this.littleEndian = littleEndian
    this.numElements = numElements

    this.readHeader()
    this.output = new DataView(new ArrayBuffer(this.size))

    for (let ctr = 0; ctr < this.numSegments; ctr += 1) {
      this.readNextSegment()
    }

    return this.processData()
  }

  processData() {
    if (this.numSegments === 1) {
      return this.output
    } else if (this.numSegments === 2) {
      const outputProcessed = new DataView(new ArrayBuffer(this.size))

      for (let ctr = 0; ctr < this.numElements; ctr += 1) {
        const temp1 = this.output.getInt8(ctr)
        const temp2 = this.output.getInt8(ctr + this.numElements)
        const value = ((temp1 & 0xff) << 8) | (temp2 & 0xff)
        outputProcessed.setInt16(ctr * 2, value, this.littleEndian)
      }

      return outputProcessed
    } else if (this.numSegments === 3) {
      // rgb
      const outputProcessed = new DataView(new ArrayBuffer(this.size))
      const offset = 2 * this.numElements

      for (let ctr = 0; ctr < this.numElements; ctr += 1) {
        outputProcessed.setInt8(ctr * 3, this.output.getInt8(ctr))
        outputProcessed.setInt8(ctr * 3 + 1, this.output.getInt8(ctr + this.numElements))
        outputProcessed.setInt8(ctr * 3 + 2, this.output.getInt8(ctr + offset))
      }

      return outputProcessed
    } else {
      throw new Error('RLE data with ' + this.numSegments + ' segments is not supported!')
    }
  }

  readHeader() {
    this.numSegments = this.getInt32()
    this.size = this.numElements * this.numSegments

    for (let ctr = 0; ctr < this.numSegments; ctr += 1) {
      this.segmentOffsets[ctr] = this.getInt32()
    }

    this.bytesRead = RLE.HEADER_SIZE
  }

  hasValidInput() {
    return (
      this.bytesRead < this.rawData.buffer.byteLength && this.bytesPut < this.size && this.segElemPut < this.numElements
    )
  }

  readNextSegment() {
    let code

    this.bytesRead = this.segmentOffsets[this.segmentIndex]
    this.segElemPut = 0

    while (this.hasValidInput()) {
      code = this.get()

      if (code >= 0 && code < 128) {
        this.readLiteral(code)
      } else if (code <= -1 && code > -128) {
        this.readEncoded(code)
      } else if (code === -128) {
        console.warn('RLE: unsupported code!')
      }
    }

    this.segmentIndex += 1
  }

  readLiteral(code) {
    const length = code + 1

    if (this.hasValidInput()) {
      for (let ctr = 0; ctr < length; ctr += 1) {
        this.put(this.get())
      }
    } else {
      console.warn('RLE: insufficient data!')
    }
  }

  readEncoded(code) {
    const runLength = 1 - code
    const encoded = this.get()

    for (let ctr = 0; ctr < runLength; ctr += 1) {
      this.put(encoded)
    }
  }

  getInt32() {
    const value = this.rawData.getInt32(this.bytesRead, this.littleEndian)
    this.bytesRead += 4
    return value
  }

  getInt16() {
    const value = this.rawData.getInt16(this.bytesRead, this.littleEndian)
    this.bytesRead += 2
    return value
  }

  get() {
    const value = this.rawData.getInt8(this.bytesRead)
    this.bytesRead += 1
    return value
  }

  put(val) {
    this.output.setInt8(this.bytesPut, val)
    this.bytesPut += 1
    this.segElemPut += 1
  }
}
