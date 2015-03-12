Daikon 
======

Daikon is a pure JavaScript DICOM parser.  Here are some of its keys features:

- Works in the browser and Node.js environments.
- Supports little/big and explicit/implicit transfer syntaxes.
- Parses header, orders and concatenates multi-file series image data.
- Supports Siemens "Mosaic" image data.
- Robust enough to handle some kinds of missing data.

Click [here](http://rii.uthscsa.edu/mango/daikon/index.html) to try Daikon now...

###Usage (Node.js)
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
        // if its part of the same series, add it
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
