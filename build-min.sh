#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

rm -rf build
mkdir build

cat LICENSE > build/daikon-min.js

FILES=src/*.js
for f in $FILES
do
  java -jar lib/yuicompressor-2.4.7.jar $f -o build/file.js
  cat build/file.js >> build/daikon-min.js
  rm build/file.js
done

echo "Done!"