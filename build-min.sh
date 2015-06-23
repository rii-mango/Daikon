#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

rm -rf build
mkdir build

cat src/license.js > build/daikon-min.js

FILES_LIB=lib/*.js
for f in $FILES_LIB
do
  java -jar lib/yuicompressor-2.4.7.jar $f -o build/file.js
  cat build/file.js >> build/daikon-min.js
  rm build/file.js
done

FILES=src/*.js
for f in $FILES
do
  if [[ $f != *license* ]]
  then
    java -jar lib/yuicompressor-2.4.7.jar $f -o build/file.js
    cat build/file.js >> build/daikon-min.js
    rm build/file.js
  fi
done

echo "Done!"