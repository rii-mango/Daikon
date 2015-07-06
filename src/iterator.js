
/*jslint browser: true, node: true */
/*global require */

"use strict";

/*** Imports ***/
var daikon = daikon || {};


/*** Constructor ***/
daikon.OrderedMapIterator = daikon.OrderedMapIterator || function (orderedMap) {
    this.orderedMap = orderedMap;
    this.index = 0;
};


/*** Prototype Methods ***/

daikon.OrderedMapIterator.prototype.hasNext = function() {
    return (this.index < this.orderedMap.orderedKeys.length);
};



daikon.OrderedMapIterator.prototype.next = function() {
    var item = this.orderedMap.get(this.orderedMap.orderedKeys[this.index]);
    this.index += 1;
    return item;
};


/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.OrderedMapIterator;
}
