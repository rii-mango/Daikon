import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/jpeg_ls.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
const image = daikon.Series.parseImage(data)
let imageData = null

describe('Daikon', function () {
  describe('test jpegls', function () {
    it('image size should be 2097152', function () {
      assert.equal(
        2097152,
        image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)
      )
    })

    it('pixel bytes compressed size should be 279654', function (done) {
      assert.equal(279654, image.getPixelData().value.buffer.byteLength)
      done()
    })

    it('pixel bytes uncompressed size should be 2097152', function (done) {
      imageData = image.getPixelDataBytes()
      assert.equal(2097152, imageData.byteLength)
      done()
    })

    it('image data checksum should equal 157645463', function () {
      imageData = image.getPixelDataBytes()
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 157645463)
    })
  })
})
