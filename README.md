Daikon 
======

Daikon is a pure JavaScript DICOM reader.  Here are some of its keys features:

- Works in the browser and Node.js environments.
- Parses DICOM headers and reads image data.
- Supports most common DICOM compressed formats.
- Orders and concatenates multi-file image data.
- Supports Siemens "Mosaic" image data.

###Supported Transfer Syntax

Uncompressed:
- 1.2.840.10008.1.2 (Implicit VR Little Endian)
- 1.2.840.10008.1.2.1 (Explicit VR Little Endian)
- 1.2.840.10008.1.2.2 (Explicit VR Big Endian)
 
Compressed:
- 1.2.840.10008.1.2.4.50 (JPEG Baseline (Process 1) Lossy JPEG 8-bit)
- 1.2.840.10008.1.2.4.57 (JPEG Lossless, Nonhierarchical (Processes 14))
- 1.2.840.10008.1.2.4.70 (JPEG Lossless, Nonhierarchical (Processes 14 [Selection 1]))
- 1.2.840.10008.1.2.4.90 (JPEG 2000 Image Compression (Lossless Only))
- 1.2.840.10008.1.2.4.91 (JPEG 2000 Image Compression)
- 1.2.840.10008.1.2.5 (RLE Lossless)

[Click here](http://rii.uthscsa.edu/mango/daikon/index.html) to try the Daikon parser now...

[Click here](http://rii.uthscsa.edu/mango/papayabeta/) to try Papaya, a DICOM viewer that uses Daikon...

###Usage (Node.js)
####Single File
See tests/driver-explicit-little.js to run this example:
```javascript
var buf = fs.readFileSync('./data/explicit_little.dcm');
var data = new DataView(toArrayBuffer(buf));
daikon.Parser.verbose = true;
var image = daikon.Series.parseImage(data);
```

####Compressed File
See tests/driver-jpeg-2000.js to run this example:
```javascript
var buf = fs.readFileSync('./data/jpeg_2000.dcm');
var data = new DataView(toArrayBuffer(buf));
var image = daikon.Series.parseImage(data);
console.log("size of image (bytes) = " + (image.getRows() * image.getCols() * image.getNumberOfFrames() * (image.getBitsAllocated() / 8)));
console.log("pixel bytes (compressed) = " + image.getPixelData().value.buffer.byteLength);
image.decompress();
console.log("pixel bytes (decompressed) = " + image.getPixelData().value.buffer.byteLength);
```

####Series
See tests/driver.js to run this example:
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
###Usage (browser)
See tests/debug.html for an example.  For a more advanced example, see [this class](https://github.com/rii-mango/Papaya/blob/master/src/js/volume/dicom/header-dicom.js) in Papaya.

###Building
```shell
./build.sh # normal build
./build-min.sh # minimized build
```

###Acknowledgments
Daikon makes use of [JPEGLosslessDecoderJS](https://github.com/rii-mango/JPEGLosslessDecoderJS) for JPEG Lossless support as well as the following third-party libraries:
- [jpgjs](https://github.com/notmasteryet/jpgjs) for JPEG Baseline support.
- [image-JPEG2000](https://github.com/OHIF/image-JPEG2000) for JPEG 2000 support.
