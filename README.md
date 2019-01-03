Daikon 
======

Daikon is a pure JavaScript DICOM reader.  Here are some of its features:

- Works in the browser and Node.js environments.
- Parses DICOM headers and reads image data.
- Supports compressed DICOM data.
- Orders and concatenates multi-file image data.
- Supports RGB and Palette data.
- Supports Siemens "Mosaic" image data.
- Parses Siemens CSA header.

### Supported Transfer Syntax

Uncompressed:
- 1.2.840.10008.1.2 (Implicit VR Little Endian)
- 1.2.840.10008.1.2.1 (Explicit VR Little Endian)
- 1.2.840.10008.1.2.2 (Explicit VR Big Endian)
 
Compressed:
- 1.2.840.10008.1.2.1.99 (Deflated Explicit VR Little Endian)
- 1.2.840.10008.1.2.4.50 (JPEG Baseline (Process 1) Lossy JPEG 8-bit)
- 1.2.840.10008.1.2.4.51 (JPEG Baseline (Processes 2 & 4) Lossy JPEG 12-bit)
- 1.2.840.10008.1.2.4.57 (JPEG Lossless, Nonhierarchical (Processes 14))
- 1.2.840.10008.1.2.4.70 (JPEG Lossless, Nonhierarchical (Processes 14 [Selection 1]))
- 1.2.840.10008.1.2.4.80 (JPEG-LS Image Compression (Lossless Only))
- 1.2.840.10008.1.2.4.81 (JPEG-LS Image Compression)
- 1.2.840.10008.1.2.4.90 (JPEG 2000 Image Compression (Lossless Only))
- 1.2.840.10008.1.2.4.91 (JPEG 2000 Image Compression)
- 1.2.840.10008.1.2.5 (RLE Lossless)


### Usage
[API](https://github.com/rii-mango/Daikon/wiki/API) and [more examples](https://github.com/rii-mango/Daikon/tree/master/tests)

#### Simple Example
```javascript
daikon.Parser.verbose = true;
var image = daikon.Series.parseImage(data);
var rawData = image.getRawData();  // ArrayBuffer
var interpretedData = image.getInterpretedData();  // Float32Array (handles byte order, datatype, scale, mask)
//var interpretedData = image.getInterpretedData(true);  // Array
//var interpretedData = image.getInterpretedData(false, true);  // Object with properties: data, min, max, minIndex, maxIndex, numCols, numRows
```

#### Series Example
```javascript
var series = new daikon.Series();
var files = fs.readdirSync('./data/volume/');

// iterate over files
for (var ctr in files) {
    var name = './data/volume/' + files[ctr];
    var buf = fs.readFileSync(name);
    
    // parse DICOM file
    var image = daikon.Series.parseImage(new DataView(toArrayBuffer(buf)));

    if (image === null) {
        console.error(daikon.Series.parserError);
    } else if (image.hasPixelData()) {
        // if it's part of the same series, add it
        if ((series.images.length === 0) || 
                (image.getSeriesId() === series.images[0].getSeriesId())) {
            series.addImage(image);
        }
    }
}

// order the image files, determines number of frames, etc.
series.buildSeries();

// output some header info
console.log("Number of images read is " + series.images.length);
console.log("Each slice is " + series.images[0].getCols() + " x " + series.images[0].getRows());
console.log("Each voxel is " + series.images[0].getBitsAllocated() + " bits, " + 
    (series.images[0].littleEndian ? "little" : "big") + " endian");

// concat the image data into a single ArrayBuffer
series.concatenateImageData(null, function (imageData) {
    console.log("Total image data size is " + imageData.byteLength + " bytes");
});
```
#### Browser
See [tests/browser.html](https://github.com/rii-mango/Daikon/blob/master/tests/browser.html) for an example.  For a more advanced example, see [this class](https://github.com/rii-mango/Papaya/blob/master/src/js/volume/dicom/header-dicom.js) in Papaya.

### Install
Get a packaged source file:

* [daikon.js](https://raw.githubusercontent.com/rii-mango/Daikon/master/release/current/daikon.js)
* [daikon-min.js](https://raw.githubusercontent.com/rii-mango/Daikon/master/release/current/daikon-min.js)

Or install via [NPM](https://www.npmjs.com/):

```
npm install daikon
```

Or install via [Bower](http://bower.io/):

```
bower install daikon
```

### Testing
```
npm test
```

### Building
See the [release folder](https://github.com/rii-mango/Daikon/tree/master/release) for the latest builds or build it yourself using:
```
npm run build
```
This will output daikon.js and daikon-min.js to build/.

### Acknowledgments
Daikon makes use of [JPEGLosslessDecoderJS](https://github.com/rii-mango/JPEGLosslessDecoderJS) for JPEG Lossless support as well as the following third-party libraries:
- [g-squared](https://github.com/g-squared/cornerstoneWADOImageLoader) for JPEG Baseline support.
- [image-JPEG2000](https://github.com/OHIF/image-JPEG2000) for JPEG 2000 support.

Also thanks to these contributors:
- [@DLiblik](https://github.com/DLiblik)
- [@nickhingston](https://github.com/nickhingston)

### Disclaimer
The authors of this software have not sought nor received approval for clinical/diagnostic use of this software library.
