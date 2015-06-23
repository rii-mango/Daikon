#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

rm -rf build
mkdir build

cat src/license.js > build/daikon.js

FILES_LIB=lib/*.js
for f in $FILES_LIB
do
  cat $f >> build/daikon.js
done


FILES=src/*.js
for f in $FILES
do
  if [[ $f != *license* ]]
  then
    cat $f >> build/daikon.js
  fi
done

echo "Done!"