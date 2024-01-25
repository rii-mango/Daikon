import assert from 'assert'
import fs from 'fs'
import * as daikon from '../src/main.js'

const buf = fs.readFileSync('./tests/data/jpeg_baseline_8bit.dcm')
const data = new DataView(daikon.Utils.toArrayBuffer(buf))
// daikon.Parser.verbose = true;
const image = daikon.Series.parseImage(data)

describe('Daikon', function () {
  describe('test jpeg verify tags', function () {
    it('private tags are correctly read', function () {
      const tags = image.tags
      assert.equal(tags['50000005'].value[0], 2)
      assert.equal(tags['50000010'].value[0], 3840)
      assert.equal(tags['50000020'].value[0], 'ECG')
      assert.equal(tags['50000030'].value[0], 'DPPS')
      assert.equal(tags['50000103'].value[0], 0)
    })
  })

  describe('verify xss strings are filtered out', function () {
    it('script tags and event handlers are removed', function () {
      // add xss tags from https://cheatsheetseries.owasp.org/cheatsheets/XSS_Filter_Evasion_Cheat_Sheet.html
      const xssTag = image.tags[50000020]
      xssTag.value = [
        'allowed',
        'values',
        '<SCRIPT SRC=https://cdn.jsdelivr.net/gh/Moksh45/host-xss.rocks/index.js></SCRIPT>',
        "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>",
        '\\<a onmouseover=alert(document.cookie)\\>xxs link\\</a\\>',
        '<IMG """><SCRIPT>alert("XSS")</SCRIPT>"\\>',
        '<IMG SRC=javascript:alert(String.fromCharCode(88,83,83))>',
        '<IMG SRC=# onmouseover="alert(\'xxs\')">',
        '</span><script>alert("Hi!")</script><span>'
      ].join('\n')

      const tagText = xssTag.toString()

      const re = /(<script)|(onmouseover=")|(javascript:alert)/i
      assert.doesNotMatch(tagText, re)
    })
  })
})
// daikon.Parser.verbose = false;
