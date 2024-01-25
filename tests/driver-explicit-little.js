import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/explicit_little.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
let dataInterpreted = null
let image = null

describe('Daikon', function () {
  describe('test explicit little', function () {
    it('should not throw error', function (done) {
      assert.doesNotThrow(function () {
        image = daikon.Series.parseImage(data)
        done()
      })
    })

    it('image data checksum should equal 2095278243', function () {
      const imageData = image.getPixelDataBytes()
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 2095278243)
    })

    it('image max should equal 252', function () {
      dataInterpreted = image.getInterpretedData(false, true)
      assert.equal(dataInterpreted.data[dataInterpreted.maxIndex], 252)
    })
  })
})
