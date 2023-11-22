import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/jpeg_2000.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
const image = daikon.Series.parseImage(data)

describe('Daikon', function () {
  describe('test jpeg 2000', function () {
    it('image size should be 524288', function () {
      assert.equal(
        524288,
        image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)
      )
    })

    it('pixel bytes compressed size should be 7560', function (done) {
      assert.equal(7560, image.getPixelData().value.buffer.byteLength)
      done()
    })

    it('pixel bytes uncompressed size should be 524288', function (done) {
      const imageData = image.getPixelDataBytes()
      assert.equal(524288, imageData.byteLength)
      done()
    })

    it('image data checksum should equal 2592514340', function () {
      const imageData = image.getPixelDataBytes()
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 717203911)
    })
  })
})
