Daikon 
======

Daikon is a pure JavaScript DICOM reader.  Here are some of its keys features:

- Works in the browser and Node.js environments.
- Parses header, orders and concatenates multi-file series image data.
- Supports Siemens "Mosaic" image data.
- Supports JPEG Lossless compressed data.

The following transfer syntaxes are supported:
- 1.2.840.10008.1.2 (Implicit VR Endian)
- 1.2.840.10008.1.2.1 (Explicit VR Little Endian)
- 1.2.840.10008.1.2.2 (Explicit VR Big Endian)
- 1.2.840.10008.1.2.4.57 (JPEG Lossless, Nonhierarchical (Processes 14))
- 1.2.840.10008.1.2.4.70 (JPEG Lossless, Nonhierarchical (Processes 14 [Selection 1]))
- 1.2.840.10008.1.2.5 (RLE Lossless)

[Click here](http://rii.uthscsa.edu/mango/daikon/index.html) to try the Daikon parser now...

[Click here](http://rii.uthscsa.edu/mango/papaya/index.html) to try Papaya, a DICOM viewer that uses Daikon...

###Usage (Node.js)
####Single File
See tests/driver-explicit-little.js to run this example:
```javascript
var buf = fs.readFileSync('./data/explicit_little.dcm');
var data = new DataView(toArrayBuffer(buf));
daikon.Parser.verbose = true;
var image = daikon.Series.parseImage(data);
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
Daikon makes use the [JPEGLosslessDecoderJS](https://github.com/rii-mango/JPEGLosslessDecoderJS) for JPEG Lossless support.
