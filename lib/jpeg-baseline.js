/*
 Copyright 2011 notmasteryet

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

// - The JPEG specification can be found in the ITU CCITT Recommendation T.81
//   (www.w3.org/Graphics/JPEG/itu-t81.pdf)
// - The JFIF specification can be found in the JPEG File Interchange Format
//   (www.w3.org/Graphics/JPEG/jfif3.pdf)
// - The Adobe Application-Specific JPEG markers in the Supporting the DCT Filters
//   in PostScript Level 2, Technical Note #5116
//   (partners.adobe.com/public/developer/en/ps/sdk/5116.DCT_Filter.pdf)

export class JpegImage {
  static ColorSpace = { Unkown: 0, Grayscale: 1, AdobeRGB: 2, RGB: 3, CYMK: 4 }
  static dctZigZag = new Int32Array([
    0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21,
    28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54,
    47, 55, 62, 63
  ])

  static dctCos1 = 4017 // cos(pi/16)
  static dctSin1 = 799 // sin(pi/16)
  static dctCos3 = 3406 // cos(3*pi/16)
  static dctSin3 = 2276 // sin(3*pi/16)
  static dctCos6 = 1567 // cos(6*pi/16)
  static dctSin6 = 3784 // sin(6*pi/16)
  static dctSqrt2 = 5793 // sqrt(2)
  static dctSqrt1d2 = 2896 // sqrt(2) / 2

  static buildHuffmanTable(codeLengths, values) {
    let k = 0
    const code = []
    let i
    let j
    let length = 16
    while (length > 0 && !codeLengths[length - 1]) length--
    code.push({ children: [], index: 0 })
    let p = code[0]
    let q
    for (i = 0; i < length; i++) {
      for (j = 0; j < codeLengths[i]; j++) {
        p = code.pop()
        p.children[p.index] = values[k]
        while (p.index > 0) {
          p = code.pop()
        }
        p.index++
        code.push(p)
        while (code.length <= i) {
          code.push((q = { children: [], index: 0 }))
          p.children[p.index] = q.children
          p = q
        }
        k++
      }
      if (i + 1 < length) {
        // p here points to last code
        code.push((q = { children: [], index: 0 }))
        p.children[p.index] = q.children
        p = q
      }
    }
    return code[0].children
  }

  static getBlockBufferOffset(component, row, col) {
    return 64 * ((component.blocksPerLine + 1) * row + col)
  }

  static decodeScan(
    data,
    offset,
    frame,
    components,
    resetInterval,
    spectralStart,
    spectralEnd,
    successivePrev,
    successive
  ) {
    const mcusPerLine = frame.mcusPerLine
    const progressive = frame.progressive

    const startOffset = offset
    let bitsData = 0
    let bitsCount = 0

    function readBit() {
      if (bitsCount > 0) {
        bitsCount--
        return (bitsData >> bitsCount) & 1
      }
      bitsData = data[offset++]
      if (bitsData === 0xff) {
        const nextByte = data[offset++]
        if (nextByte) {
          throw new Error('unexpected marker: ' + ((bitsData << 8) | nextByte).toString(16))
        }
        // unstuff 0
      }
      bitsCount = 7
      return bitsData >>> 7
    }

    function decodeHuffman(tree) {
      let node = tree
      let bit
      while ((bit = readBit()) !== null) {
        node = node[bit]
        if (typeof node === 'number') return node
        if (typeof node !== 'object') throw new Error('invalid huffman sequence')
      }
      return null
    }

    function receive(length) {
      let n = 0
      while (length > 0) {
        const bit = readBit()
        if (bit === null) return
        n = (n << 1) | bit
        length--
      }
      return n
    }

    function receiveAndExtend(length) {
      const n = receive(length)
      if (n >= 1 << (length - 1)) return n
      return n + (-1 << length) + 1
    }

    function decodeBaseline(component, offset) {
      const t = decodeHuffman(component.huffmanTableDC)
      const diff = t === 0 ? 0 : receiveAndExtend(t)
      component.blockData[offset] = component.pred += diff
      let k = 1
      while (k < 64) {
        const rs = decodeHuffman(component.huffmanTableAC)
        const s = rs & 15
        const r = rs >> 4
        if (s === 0) {
          if (r < 15) break
          k += 16
          continue
        }
        k += r
        const z = JpegImage.dctZigZag[k]
        component.blockData[offset + z] = receiveAndExtend(s)
        k++
      }
    }

    function decodeDCFirst(component, offset) {
      const t = decodeHuffman(component.huffmanTableDC)
      const diff = t === 0 ? 0 : receiveAndExtend(t) << successive
      component.blockData[offset] = component.pred += diff
    }

    function decodeDCSuccessive(component, offset) {
      component.blockData[offset] |= readBit() << successive
    }

    let eobrun = 0
    function decodeACFirst(component, offset) {
      if (eobrun > 0) {
        eobrun--
        return
      }
      let k = spectralStart
      const e = spectralEnd
      while (k <= e) {
        const rs = decodeHuffman(component.huffmanTableAC)
        const s = rs & 15
        const r = rs >> 4
        if (s === 0) {
          if (r < 15) {
            eobrun = receive(r) + (1 << r) - 1
            break
          }
          k += 16
          continue
        }
        k += r
        const z = JpegImage.dctZigZag[k]
        component.blockData[offset + z] = receiveAndExtend(s) * (1 << successive)
        k++
      }
    }

    let successiveACState = 0
    let successiveACNextValue
    function decodeACSuccessive(component, offset) {
      let k = spectralStart
      const e = spectralEnd
      let r = 0
      while (k <= e) {
        const z = JpegImage.dctZigZag[k]
        switch (successiveACState) {
          case 0: // initial state
            {
              const rs = decodeHuffman(component.huffmanTableAC)
              const s = rs & 15
              r = rs >> 4
              if (s === 0) {
                if (r < 15) {
                  eobrun = receive(r) + (1 << r)
                  successiveACState = 4
                } else {
                  r = 16
                  successiveACState = 1
                }
              } else {
                if (s !== 1) throw new Error('invalid ACn encoding')
                successiveACNextValue = receiveAndExtend(s)
                successiveACState = r ? 2 : 3
              }
            }
            continue
          case 1: // skipping r zero items
          case 2:
            if (component.blockData[offset + z]) {
              component.blockData[offset + z] += readBit() << successive
            } else {
              r--
              if (r === 0) successiveACState = successiveACState === 2 ? 3 : 0
            }
            break
          case 3: // set value for a zero item
            if (component.blockData[offset + z]) {
              component.blockData[offset + z] += readBit() << successive
            } else {
              component.blockData[offset + z] = successiveACNextValue << successive
              successiveACState = 0
            }
            break
          case 4: // eob
            if (component.blockData[offset + z]) {
              component.blockData[offset + z] += readBit() << successive
            }
            break
        }
        k++
      }
      if (successiveACState === 4) {
        eobrun--
        if (eobrun === 0) successiveACState = 0
      }
    }

    function decodeMcu(component, decode, mcu, row, col) {
      const mcuRow = (mcu / mcusPerLine) | 0
      const mcuCol = mcu % mcusPerLine
      const blockRow = mcuRow * component.v + row
      const blockCol = mcuCol * component.h + col
      const offset = JpegImage.getBlockBufferOffset(component, blockRow, blockCol)
      decode(component, offset)
    }

    function decodeBlock(component, decode, mcu) {
      const blockRow = (mcu / component.blocksPerLine) | 0
      const blockCol = mcu % component.blocksPerLine
      const offset = JpegImage.getBlockBufferOffset(component, blockRow, blockCol)
      decode(component, offset)
    }

    const componentsLength = components.length
    let component, i, j, k, n
    let decodeFn
    if (progressive) {
      if (spectralStart === 0) decodeFn = successivePrev === 0 ? decodeDCFirst : decodeDCSuccessive
      else decodeFn = successivePrev === 0 ? decodeACFirst : decodeACSuccessive
    } else {
      decodeFn = decodeBaseline
    }

    let mcu = 0
    let marker
    let mcuExpected
    if (componentsLength === 1) {
      mcuExpected = components[0].blocksPerLine * components[0].blocksPerColumn
    } else {
      mcuExpected = mcusPerLine * frame.mcusPerColumn
    }
    if (!resetInterval) {
      resetInterval = mcuExpected
    }

    let h, v
    while (mcu < mcuExpected) {
      // reset interval stuff
      for (i = 0; i < componentsLength; i++) {
        components[i].pred = 0
      }
      eobrun = 0

      if (componentsLength === 1) {
        component = components[0]
        for (n = 0; n < resetInterval; n++) {
          decodeBlock(component, decodeFn, mcu)
          mcu++
        }
      } else {
        for (n = 0; n < resetInterval; n++) {
          for (i = 0; i < componentsLength; i++) {
            component = components[i]
            h = component.h
            v = component.v
            for (j = 0; j < v; j++) {
              for (k = 0; k < h; k++) {
                decodeMcu(component, decodeFn, mcu, j, k)
              }
            }
          }
          mcu++
        }
      }

      // find marker
      bitsCount = 0
      marker = (data[offset] << 8) | data[offset + 1]
      if (marker <= 0xff00) {
        throw new Error('marker was not found')
      }

      if (marker >= 0xffd0 && marker <= 0xffd7) {
        // RSTx
        offset += 2
      } else {
        break
      }
    }

    return offset - startOffset
  }

  // A port of poppler's IDCT method which in turn is taken from:
  //   Christoph Loeffler, Adriaan Ligtenberg, George S. Moschytz,
  //   "Practical Fast 1-D DCT Algorithms with 11 Multiplications",
  //   IEEE Intl. Conf. on Acoustics, Speech & Signal Processing, 1989,
  //   988-991.
  static quantizeAndInverse(component, blockBufferOffset, p) {
    const qt = component.quantizationTable
    let v0, v1, v2, v3, v4, v5, v6, v7, t
    let i

    // dequant
    for (i = 0; i < 64; i++) {
      p[i] = component.blockData[blockBufferOffset + i] * qt[i]
    }

    // inverse DCT on rows
    for (i = 0; i < 8; ++i) {
      const row = 8 * i

      // check for all-zero AC coefficients
      if (
        p[1 + row] === 0 &&
        p[2 + row] === 0 &&
        p[3 + row] === 0 &&
        p[4 + row] === 0 &&
        p[5 + row] === 0 &&
        p[6 + row] === 0 &&
        p[7 + row] === 0
      ) {
        t = (JpegImage.dctSqrt2 * p[0 + row] + 512) >> 10
        p[0 + row] = t
        p[1 + row] = t
        p[2 + row] = t
        p[3 + row] = t
        p[4 + row] = t
        p[5 + row] = t
        p[6 + row] = t
        p[7 + row] = t
        continue
      }

      // stage 4
      v0 = (JpegImage.dctSqrt2 * p[0 + row] + 128) >> 8
      v1 = (JpegImage.dctSqrt2 * p[4 + row] + 128) >> 8
      v2 = p[2 + row]
      v3 = p[6 + row]
      v4 = (JpegImage.dctSqrt1d2 * (p[1 + row] - p[7 + row]) + 128) >> 8
      v7 = (JpegImage.dctSqrt1d2 * (p[1 + row] + p[7 + row]) + 128) >> 8
      v5 = p[3 + row] << 4
      v6 = p[5 + row] << 4

      // stage 3
      t = (v0 - v1 + 1) >> 1
      v0 = (v0 + v1 + 1) >> 1
      v1 = t
      t = (v2 * JpegImage.dctSin6 + v3 * JpegImage.dctCos6 + 128) >> 8
      v2 = (v2 * JpegImage.dctCos6 - v3 * JpegImage.dctSin6 + 128) >> 8
      v3 = t
      t = (v4 - v6 + 1) >> 1
      v4 = (v4 + v6 + 1) >> 1
      v6 = t
      t = (v7 + v5 + 1) >> 1
      v5 = (v7 - v5 + 1) >> 1
      v7 = t

      // stage 2
      t = (v0 - v3 + 1) >> 1
      v0 = (v0 + v3 + 1) >> 1
      v3 = t
      t = (v1 - v2 + 1) >> 1
      v1 = (v1 + v2 + 1) >> 1
      v2 = t
      t = (v4 * JpegImage.dctSin3 + v7 * JpegImage.dctCos3 + 2048) >> 12
      v4 = (v4 * JpegImage.dctCos3 - v7 * JpegImage.dctSin3 + 2048) >> 12
      v7 = t
      t = (v5 * JpegImage.dctSin1 + v6 * JpegImage.dctCos1 + 2048) >> 12
      v5 = (v5 * JpegImage.dctCos1 - v6 * JpegImage.dctSin1 + 2048) >> 12
      v6 = t

      // stage 1
      p[0 + row] = v0 + v7
      p[7 + row] = v0 - v7
      p[1 + row] = v1 + v6
      p[6 + row] = v1 - v6
      p[2 + row] = v2 + v5
      p[5 + row] = v2 - v5
      p[3 + row] = v3 + v4
      p[4 + row] = v3 - v4
    }

    // inverse DCT on columns
    for (i = 0; i < 8; ++i) {
      const col = i

      // check for all-zero AC coefficients
      if (
        p[1 * 8 + col] === 0 &&
        p[2 * 8 + col] === 0 &&
        p[3 * 8 + col] === 0 &&
        p[4 * 8 + col] === 0 &&
        p[5 * 8 + col] === 0 &&
        p[6 * 8 + col] === 0 &&
        p[7 * 8 + col] === 0
      ) {
        t = (JpegImage.dctSqrt2 * p[i + 0] + 8192) >> 14
        p[0 * 8 + col] = t
        p[1 * 8 + col] = t
        p[2 * 8 + col] = t
        p[3 * 8 + col] = t
        p[4 * 8 + col] = t
        p[5 * 8 + col] = t
        p[6 * 8 + col] = t
        p[7 * 8 + col] = t
        continue
      }

      // stage 4
      v0 = (JpegImage.dctSqrt2 * p[0 * 8 + col] + 2048) >> 12
      v1 = (JpegImage.dctSqrt2 * p[4 * 8 + col] + 2048) >> 12
      v2 = p[2 * 8 + col]
      v3 = p[6 * 8 + col]
      v4 = (JpegImage.dctSqrt1d2 * (p[1 * 8 + col] - p[7 * 8 + col]) + 2048) >> 12
      v7 = (JpegImage.dctSqrt1d2 * (p[1 * 8 + col] + p[7 * 8 + col]) + 2048) >> 12
      v5 = p[3 * 8 + col]
      v6 = p[5 * 8 + col]

      // stage 3
      t = (v0 - v1 + 1) >> 1
      v0 = (v0 + v1 + 1) >> 1
      v1 = t
      t = (v2 * JpegImage.dctSin6 + v3 * JpegImage.dctCos6 + 2048) >> 12
      v2 = (v2 * JpegImage.dctCos6 - v3 * JpegImage.dctSin6 + 2048) >> 12
      v3 = t
      t = (v4 - v6 + 1) >> 1
      v4 = (v4 + v6 + 1) >> 1
      v6 = t
      t = (v7 + v5 + 1) >> 1
      v5 = (v7 - v5 + 1) >> 1
      v7 = t

      // stage 2
      t = (v0 - v3 + 1) >> 1
      v0 = (v0 + v3 + 1) >> 1
      v3 = t
      t = (v1 - v2 + 1) >> 1
      v1 = (v1 + v2 + 1) >> 1
      v2 = t
      t = (v4 * JpegImage.dctSin3 + v7 * JpegImage.dctCos3 + 2048) >> 12
      v4 = (v4 * JpegImage.dctCos3 - v7 * JpegImage.dctSin3 + 2048) >> 12
      v7 = t
      t = (v5 * JpegImage.dctSin1 + v6 * JpegImage.dctCos1 + 2048) >> 12
      v5 = (v5 * JpegImage.dctCos1 - v6 * JpegImage.dctSin1 + 2048) >> 12
      v6 = t

      // stage 1
      p[0 * 8 + col] = v0 + v7
      p[7 * 8 + col] = v0 - v7
      p[1 * 8 + col] = v1 + v6
      p[6 * 8 + col] = v1 - v6
      p[2 * 8 + col] = v2 + v5
      p[5 * 8 + col] = v2 - v5
      p[3 * 8 + col] = v3 + v4
      p[4 * 8 + col] = v3 - v4
    }

    // convert to 8-bit integers
    for (i = 0; i < 64; ++i) {
      const index = blockBufferOffset + i
      let q = p[i]
      q =
        q <= -2056 / component.bitConversion
          ? 0
          : q >= 2024 / component.bitConversion
            ? 255 / component.bitConversion
            : (q + 2056 / component.bitConversion) >> 4
      component.blockData[index] = q
    }
  }

  static buildComponentData(frame, component) {
    const blocksPerLine = component.blocksPerLine
    const blocksPerColumn = component.blocksPerColumn
    const computationBuffer = new Int32Array(64)

    for (let blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
      for (let blockCol = 0; blockCol < blocksPerLine; blockCol++) {
        const offset = JpegImage.getBlockBufferOffset(component, blockRow, blockCol)
        JpegImage.quantizeAndInverse(component, offset, computationBuffer)
      }
    }
    return component.blockData
  }

  static clampToUint8(a) {
    return a <= 0 ? 0 : a >= 255 ? 255 : a | 0
  }

  load(path) {
    const handleData = function (data) {
      this.parse(data)
      if (this.onload) this.onload()
    }.bind(this)

    if (path.indexOf('data:') > -1) {
      const offset = path.indexOf('base64,') + 7
      const data = atob(path.substring(offset))
      const arr = new Uint8Array(data.length)
      for (let i = data.length - 1; i >= 0; i--) {
        arr[i] = data.charCodeAt(i)
      }
      handleData(data)
    } else {
      const xhr = new XMLHttpRequest()
      xhr.open('GET', path, true)
      xhr.responseType = 'arraybuffer'
      xhr.onload = function () {
        // TODO catch parse error
        const data = new Uint8Array(xhr.response)
        handleData(data)
      }
      xhr.send(null)
    }
  }

  parse(data) {
    function readUint16() {
      const value = (data[offset] << 8) | data[offset + 1]
      offset += 2
      return value
    }

    function readDataBlock() {
      const length = readUint16()
      const array = data.subarray(offset, offset + length - 2)
      offset += array.length
      return array
    }

    function prepareComponents(frame) {
      const mcusPerLine = Math.ceil(frame.samplesPerLine / 8 / frame.maxH)
      const mcusPerColumn = Math.ceil(frame.scanLines / 8 / frame.maxV)
      for (let i = 0; i < frame.components.length; i++) {
        const component = frame.components[i]
        const blocksPerLine = Math.ceil((Math.ceil(frame.samplesPerLine / 8) * component.h) / frame.maxH)
        const blocksPerColumn = Math.ceil((Math.ceil(frame.scanLines / 8) * component.v) / frame.maxV)
        const blocksPerLineForMcu = mcusPerLine * component.h
        const blocksPerColumnForMcu = mcusPerColumn * component.v

        const blocksBufferSize = 64 * blocksPerColumnForMcu * (blocksPerLineForMcu + 1)
        component.blockData = new Int16Array(blocksBufferSize)
        component.blocksPerLine = blocksPerLine
        component.blocksPerColumn = blocksPerColumn
      }
      frame.mcusPerLine = mcusPerLine
      frame.mcusPerColumn = mcusPerColumn
    }

    let offset = 0
    let jfif = null
    let adobe = null
    let frame, resetInterval
    const quantizationTables = []
    const huffmanTablesAC = []
    const huffmanTablesDC = []
    let fileMarker = readUint16()
    if (fileMarker !== 0xffd8) {
      // SOI (Start of Image)
      throw new Error('SOI not found')
    }

    fileMarker = readUint16()
    while (fileMarker !== 0xffd9) {
      // EOI (End of image)
      let i, j, l
      switch (fileMarker) {
        case 0xffe0: // APP0 (Application Specific)
        case 0xffe1: // APP1
        case 0xffe2: // APP2
        case 0xffe3: // APP3
        case 0xffe4: // APP4
        case 0xffe5: // APP5
        case 0xffe6: // APP6
        case 0xffe7: // APP7
        case 0xffe8: // APP8
        case 0xffe9: // APP9
        case 0xffea: // APP10
        case 0xffeb: // APP11
        case 0xffec: // APP12
        case 0xffed: // APP13
        case 0xffee: // APP14
        case 0xffef: // APP15
        case 0xfffe: // COM (Comment)
          {
            const appData = readDataBlock()

            if (fileMarker === 0xffe0) {
              if (
                appData[0] === 0x4a &&
                appData[1] === 0x46 &&
                appData[2] === 0x49 &&
                appData[3] === 0x46 &&
                appData[4] === 0
              ) {
                // 'JFIF\x00'
                jfif = {
                  version: { major: appData[5], minor: appData[6] },
                  densityUnits: appData[7],
                  xDensity: (appData[8] << 8) | appData[9],
                  yDensity: (appData[10] << 8) | appData[11],
                  thumbWidth: appData[12],
                  thumbHeight: appData[13],
                  thumbData: appData.subarray(14, 14 + 3 * appData[12] * appData[13])
                }
              }
            }
            // TODO APP1 - Exif
            if (fileMarker === 0xffee) {
              if (
                appData[0] === 0x41 &&
                appData[1] === 0x64 &&
                appData[2] === 0x6f &&
                appData[3] === 0x62 &&
                appData[4] === 0x65 &&
                appData[5] === 0
              ) {
                // 'Adobe\x00'
                adobe = {
                  version: appData[6],
                  flags0: (appData[7] << 8) | appData[8],
                  flags1: (appData[9] << 8) | appData[10],
                  transformCode: appData[11]
                }
              }
            }
          }
          break

        case 0xffdb: // DQT (Define Quantization Tables)
          {
            const quantizationTablesLength = readUint16()
            const quantizationTablesEnd = quantizationTablesLength + offset - 2
            while (offset < quantizationTablesEnd) {
              const quantizationTableSpec = data[offset++]
              const tableData = new Int32Array(64)
              if (quantizationTableSpec >> 4 === 0) {
                // 8 bit values
                for (j = 0; j < 64; j++) {
                  const z = JpegImage.dctZigZag[j]
                  tableData[z] = data[offset++]
                }
              } else if (quantizationTableSpec >> 4 === 1) {
                // 16 bit
                for (j = 0; j < 64; j++) {
                  const zz = JpegImage.dctZigZag[j]
                  tableData[zz] = readUint16()
                }
              } else throw new Error('DQT: invalid table spec')
              quantizationTables[quantizationTableSpec & 15] = tableData
            }
          }
          break

        case 0xffc0: // SOF0 (Start of Frame, Baseline DCT)
        case 0xffc1: // SOF1 (Start of Frame, Extended DCT)
        case 0xffc2: // SOF2 (Start of Frame, Progressive DCT)
          {
            if (frame) {
              throw new Error('Only single frame JPEGs supported')
            }
            readUint16() // skip data length
            frame = {}
            frame.extended = fileMarker === 0xffc1
            frame.progressive = fileMarker === 0xffc2
            frame.precision = data[offset++]
            frame.scanLines = readUint16()
            frame.samplesPerLine = readUint16()
            frame.components = []
            frame.componentIds = {}
            const componentsCount = data[offset++]
            let componentId
            let maxH = 0
            let maxV = 0
            for (i = 0; i < componentsCount; i++) {
              componentId = data[offset]
              const h = data[offset + 1] >> 4
              const v = data[offset + 1] & 15
              if (maxH < h) maxH = h
              if (maxV < v) maxV = v
              const qId = data[offset + 2]
              l = frame.components.push({
                h,
                v,
                quantizationTable: quantizationTables[qId],
                quantizationTableId: qId,
                bitConversion: 255 / ((1 << frame.precision) - 1)
              })
              frame.componentIds[componentId] = l - 1
              offset += 3
            }
            frame.maxH = maxH
            frame.maxV = maxV
            prepareComponents(frame)
          }
          break

        case 0xffc4: // DHT (Define Huffman Tables)
          {
            const huffmanLength = readUint16()
            for (i = 2; i < huffmanLength; ) {
              const huffmanTableSpec = data[offset++]
              const codeLengths = new Uint8Array(16)
              let codeLengthSum = 0
              for (j = 0; j < 16; j++, offset++) codeLengthSum += codeLengths[j] = data[offset]
              const huffmanValues = new Uint8Array(codeLengthSum)
              for (j = 0; j < codeLengthSum; j++, offset++) huffmanValues[j] = data[offset]
              i += 17 + codeLengthSum
              ;(huffmanTableSpec >> 4 === 0 ? huffmanTablesDC : huffmanTablesAC)[huffmanTableSpec & 15] =
                JpegImage.buildHuffmanTable(codeLengths, huffmanValues)
            }
          }
          break

        case 0xffdd: // DRI (Define Restart Interval)
          readUint16() // skip data length
          resetInterval = readUint16()
          break

        case 0xffda: // SOS (Start of Scan)
          {
            // unused scan length
            readUint16()

            const selectorsCount = data[offset++]
            const components = []
            let component
            for (i = 0; i < selectorsCount; i++) {
              const componentIndex = frame.componentIds[data[offset++]]
              component = frame.components[componentIndex]
              const tableSpec = data[offset++]
              component.huffmanTableDC = huffmanTablesDC[tableSpec >> 4]
              component.huffmanTableAC = huffmanTablesAC[tableSpec & 15]
              components.push(component)
            }
            const spectralStart = data[offset++]
            const spectralEnd = data[offset++]
            const successiveApproximation = data[offset++]
            const processed = JpegImage.decodeScan(
              data,
              offset,
              frame,
              components,
              resetInterval,
              spectralStart,
              spectralEnd,
              successiveApproximation >> 4,
              successiveApproximation & 15
            )
            offset += processed
          }
          break
        default:
          if (data[offset - 3] === 0xff && data[offset - 2] >= 0xc0 && data[offset - 2] <= 0xfe) {
            // could be incorrect encoding -- last 0xFF byte of the previous
            // block was eaten by the encoder
            offset -= 3
            break
          }
          throw new Error('unknown JPEG marker ' + fileMarker.toString(16))
      }
      fileMarker = readUint16()
    }

    this.width = frame.samplesPerLine
    this.height = frame.scanLines
    this.jfif = jfif
    this.adobe = adobe
    this.components = []
    switch (frame.components.length) {
      case 1:
        this.colorspace = JpegImage.ColorSpace.Grayscale
        break
      case 3:
        if (this.adobe) this.colorspace = JpegImage.ColorSpace.AdobeRGB
        else this.colorspace = JpegImage.ColorSpace.RGB
        break
      case 4:
        this.colorspace = JpegImage.ColorSpace.CYMK
        break
      default:
        this.colorspace = JpegImage.ColorSpace.Unknown
    }
    for (let i = 0; i < frame.components.length; i++) {
      const component = frame.components[i]
      if (!component.quantizationTable && component.quantizationTableId !== null)
        component.quantizationTable = quantizationTables[component.quantizationTableId]
      this.components.push({
        output: JpegImage.buildComponentData(frame, component),
        scaleX: component.h / frame.maxH,
        scaleY: component.v / frame.maxV,
        blocksPerLine: component.blocksPerLine,
        blocksPerColumn: component.blocksPerColumn,
        bitConversion: component.bitConversion
      })
    }
  }

  getData16(width, height) {
    if (this.components.length !== 1) throw new Error('Unsupported color mode')
    const scaleX = this.width / width
    const scaleY = this.height / height

    let component, componentScaleX, componentScaleY
    let x, y, i
    let offset = 0
    const numComponents = this.components.length
    const dataLength = width * height * numComponents
    const data = new Uint16Array(dataLength)

    // lineData is reused for all components. Assume first component is
    // the biggest
    const lineData = new Uint16Array((this.components[0].blocksPerLine << 3) * this.components[0].blocksPerColumn * 8)

    // First construct image data ...
    for (i = 0; i < numComponents; i++) {
      component = this.components[i]
      const blocksPerLine = component.blocksPerLine
      const blocksPerColumn = component.blocksPerColumn
      const samplesPerLine = blocksPerLine << 3

      for (let blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
        const scanLine = blockRow << 3
        for (let blockCol = 0; blockCol < blocksPerLine; blockCol++) {
          const bufferOffset = JpegImage.getBlockBufferOffset(component, blockRow, blockCol)
          offset = 0
          const sample = blockCol << 3
          for (let j = 0; j < 8; j++) {
            const lineOffset = (scanLine + j) * samplesPerLine
            for (let k = 0; k < 8; k++) {
              lineData[lineOffset + sample + k] = component.output[bufferOffset + offset++]
            }
          }
        }
      }

      componentScaleX = component.scaleX * scaleX
      componentScaleY = component.scaleY * scaleY
      offset = i

      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          const cy = 0 | (y * componentScaleY)
          const cx = 0 | (x * componentScaleX)
          const index = cy * samplesPerLine + cx
          data[offset] = lineData[index]
          offset += numComponents
        }
      }
    }
    return data
  }

  getData(width, height) {
    const scaleX = this.width / width
    const scaleY = this.height / height

    let component, componentScaleX, componentScaleY
    let x, y, i
    let offset = 0
    let Y, Cb, Cr, C, M, R, G, B
    let colorTransform
    const numComponents = this.components.length
    const dataLength = width * height * numComponents
    const data = new Uint8Array(dataLength)

    // lineData is reused for all components. Assume first component is
    // the biggest
    const lineData = new Uint8Array((this.components[0].blocksPerLine << 3) * this.components[0].blocksPerColumn * 8)

    // First construct image data ...
    for (i = 0; i < numComponents; i++) {
      component = this.components[i]
      const blocksPerLine = component.blocksPerLine
      const blocksPerColumn = component.blocksPerColumn
      const samplesPerLine = blocksPerLine << 3

      for (let blockRow = 0; blockRow < blocksPerColumn; blockRow++) {
        const scanLine = blockRow << 3
        for (let blockCol = 0; blockCol < blocksPerLine; blockCol++) {
          const bufferOffset = JpegImage.getBlockBufferOffset(component, blockRow, blockCol)
          let offset = 0
          const sample = blockCol << 3
          for (let j = 0; j < 8; j++) {
            const lineOffset = (scanLine + j) * samplesPerLine
            for (let k = 0; k < 8; k++) {
              lineData[lineOffset + sample + k] = component.output[bufferOffset + offset++] * component.bitConversion
            }
          }
        }
      }

      componentScaleX = component.scaleX * scaleX
      componentScaleY = component.scaleY * scaleY
      offset = i

      for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
          const cy = 0 | (y * componentScaleY)
          const cx = 0 | (x * componentScaleX)
          const index = cy * samplesPerLine + cx
          data[offset] = lineData[index]
          offset += numComponents
        }
      }
    }

    // ... then transform colors, if necessary
    switch (numComponents) {
      case 1:
      case 2:
        break
      // no color conversion for one or two compoenents

      case 3:
        // The default transform for three components is true
        colorTransform = true
        // The adobe transform marker overrides any previous setting
        if (this.adobe && this.adobe.transformCode) colorTransform = true
        else if (typeof this.colorTransform !== 'undefined') colorTransform = !!this.colorTransform

        if (colorTransform) {
          for (i = 0; i < dataLength; i += numComponents) {
            Y = data[i]
            Cb = data[i + 1]
            Cr = data[i + 2]

            R = JpegImage.clampToUint8(Y - 179.456 + 1.402 * Cr)
            G = JpegImage.clampToUint8(Y + 135.459 - 0.344 * Cb - 0.714 * Cr)
            B = JpegImage.clampToUint8(Y - 226.816 + 1.772 * Cb)

            data[i] = R
            data[i + 1] = G
            data[i + 2] = B
          }
        }
        break
      case 4:
        if (!this.adobe) throw new Error('Unsupported color mode (4 components)')
        // The default transform for four components is false
        colorTransform = false
        // The adobe transform marker overrides any previous setting
        if (this.adobe && this.adobe.transformCode) colorTransform = true
        else if (typeof this.colorTransform !== 'undefined') colorTransform = !!this.colorTransform

        if (colorTransform) {
          for (i = 0; i < dataLength; i += numComponents) {
            Y = data[i]
            Cb = data[i + 1]
            Cr = data[i + 2]

            C = JpegImage.clampToUint8(434.456 - Y - 1.402 * Cr)
            M = JpegImage.clampToUint8(119.541 - Y + 0.344 * Cb + 0.714 * Cr)
            Y = JpegImage.clampToUint8(481.816 - Y - 1.772 * Cb)

            data[i] = C
            data[i + 1] = M
            data[i + 2] = Y
            // K is unchanged
          }
        }
        break
      default:
        throw new Error('Unsupported color mode')
    }
    return data
  }
}
