Daikon 
======

Daikon is a pure JavaScript DICOM parser.  Here are some of its keys features:

- Works in the browser and Node.js environments.
- Supports little/big and explicit/implicit transfer syntaxes.
- Parses header, orders and concatenates multi-file series image data.
- Supports Siemens "Mosaic" image data.
- Robust enough to handle some kinds of missing data.

```javascript
var series = new daikon.Series();
var files = fs.readdirSync('/path/to/data/');

for (var ctr in files) {
    var name = '/path/to/data/' + files[ctr];
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

series.concatenateImageData(null, function onFinishedReadImageData(imageData) {
    console.log("Number of images read is " + series.images.length);
    console.log("Each slice is " + 
        series.images[0].getCols() + " x " + series.images[0].getRows());
    console.log("Each voxel is " + series.images[0].getBitsAllocated() + " bits");
    console.log("Total image data size is " + imageData.byteLength + " bytes");
});
```
