#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

rm -rf build
mkdir build

cat LICENSE > build/daikon.js


FILES_LIB=lib/*.js
for f in $FILES_LIB
do
  cat $f >> build/daikon.js
done


FILES=src/*.js
for f in $FILES
do
  cat $f >> build/daikon.js
done

echo "Done!"