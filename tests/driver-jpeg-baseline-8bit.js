import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/jpeg_baseline_8bit.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
const image = daikon.Series.parseImage(data)
let imageData = null

describe('Daikon', function () {
  describe('test jpeg baseline 8bit', function () {
    it('image size should be 25165824', function () {
      assert.equal(
        25165824,
        image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)
      )
    })

    it('pixel bytes compressed size should be 1691672', function (done) {
      assert.equal(1691672, image.getPixelData().value.buffer.byteLength)
      done()
    })

    it('pixel bytes uncompressed size should be 25165824', function (done) {
      imageData = image.getPixelDataBytes()
      assert.equal(25165824, imageData.byteLength)
      done()
    })

    it('image data checksum should equal 3962430437', function () {
      imageData = image.getPixelDataBytes()
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 3962430437)
    })
  })
})
