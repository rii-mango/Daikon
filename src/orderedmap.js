
/*jslint browser: true, node: true */
/*global require */

"use strict";

// Based on: http://stackoverflow.com/questions/3549894/javascript-data-structure-for-fast-lookup-and-ordered-looping

/*** Imports ***/
var daikon = daikon || {};
daikon.OrderedMapIterator = daikon.OrderedMapIterator || ((typeof require !== 'undefined') ? require('./iterator.js') : null);


/*** Constructor ***/
daikon.OrderedMap = daikon.OrderedMap || function () {
    this.map = {};
    this.orderedKeys = [];
};



daikon.OrderedMap.prototype.put = function(key, value) {
    if (key in this.map) { // key already exists, replace value
        this.map[key] = value;
    } else { // insert new key and value
        this.orderedKeys.push(key);
        this.orderedKeys.sort(function(a, b) { return parseFloat(a) - parseFloat(b); });
        this.map[key] = value;
    }
};



daikon.OrderedMap.prototype.remove = function(key) {
    var index = this.orderedKeys.indexOf(key);
    if(index === -1) {
        throw new Error('key does not exist');
    }

    this.orderedKeys.splice(index, 1);
    delete this.map[key];
};



daikon.OrderedMap.prototype.get = function(key) {
    if (key in this.map) {
        return this.map[key];
    }

    return null;
};



daikon.OrderedMap.prototype.iterator = function() {
    return new daikon.OrderedMapIterator(this);
};



daikon.OrderedMap.prototype.getOrderedValues = function() {
    var orderedValues = [], it = this.iterator();

    while (it.hasNext()) {
        orderedValues.push(it.next());
    }

    return orderedValues;
};



/*** Exports ***/

var moduleType = typeof module;
if ((moduleType !== 'undefined') && module.exports) {
    module.exports = daikon.OrderedMap;
}
