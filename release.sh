#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR

. build.properties

npm test
npm run build
npm run release

npm version $VERSION_ID
npm publish
git push --tags
