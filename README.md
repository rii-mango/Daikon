Daikon 
======

Daikon is a pure JavaScript DICOM parser.  Here are some of its keys features:

- Works in the browser and Node.js environments.
- Supports little/big and explicit/implicit transfer syntaxes.
- Parses header, orders and concatenates multi-file series image data.
- Supports Siemens "Mosaic" image data.
- Robust enough to handle some kinds of missing data.

###Usage (Node.js)
See tests/driver.js to run this example:

```javascript
var series = new daikon.Series();
var files = fs.readdirSync('./data/volume/');

for (var ctr in files) {
    var name = './data/volume/' + files[ctr];
    var buf = fs.readFileSync(name);
    var image = daikon.Series.parseImage(new DataView(toArrayBuffer(buf)));

    if (image === null) {
        console.error(daikon.Series.parserError);
    } else if (image.hasPixelData()) {
        if ((series.images.length === 0) || 
                (image.getSeriesId() === series.images[0].getSeriesId())) {
            series.addImage(image);
        }
    }
}

series.buildSeries();

console.log("Number of images read is " + series.images.length);
console.log("Each slice is " + series.images[0].getCols() + " x " + series.images[0].getRows());
console.log("Each voxel is " + series.images[0].getBitsAllocated() + " bits");

series.concatenateImageData(null, function (imageData) {
    console.log("Total image data size is " + imageData.byteLength + " bytes");
});
```
###Usage (browser)
Daikon provides DICOM parsing support in [Papaya](https://github.com/rii-mango/Papaya).  See [here](https://github.com/rii-mango/Papaya/blob/master/src/js/volume/dicom/header-dicom.js) for an example of how to use Daikon in browser code.
