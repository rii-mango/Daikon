#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

rm -rf build
mkdir build

cat LICENSE > build/daikon.js

cat lib/lossless.js >> build/daikon.js

FILES=src/*.js
for f in $FILES
do
  cat $f >> build/daikon.js
done

echo "Done!"