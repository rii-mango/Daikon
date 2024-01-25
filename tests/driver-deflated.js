import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/deflated.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
const image = daikon.Series.parseImage(data)
let imageData = null

describe('Daikon', function () {
  describe('test deflated', function () {
    it('image size should be 524288', function () {
      assert.equal(
        262144,
        image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)
      )
    })

    it('pixel bytes uncompressed size should be 262144', function (done) {
      imageData = image.getPixelDataBytes()
      assert.equal(262144, imageData.byteLength)
      done()
    })

    it('image data checksum should equal 3700532309', function () {
      const checksum = daikon.Utils.crc32(new DataView(imageData))
      assert.equal(checksum, 3700532309)
    })
  })
})
