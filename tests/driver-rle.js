import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/rle.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
const image = daikon.Series.parseImage(data)
let imageData = null

describe('Daikon', function () {
  describe('test rle', function () {
    it('image size should be 524288', function () {
      assert.equal(
        524288,
        image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)
      )
    })

    it('pixel bytes compressed size should be 248496', function (done) {
      assert.equal(248496, image.getPixelData().value.buffer.byteLength)
      done()
    })

    it('pixel bytes uncompressed size should be 524288', function (done) {
      imageData = image.getPixelDataBytes()
      assert.equal(524288, imageData.byteLength)
      done()
    })

    it('image data checksum should equal 1052635650', function () {
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 1052635650)
    })
  })
})
