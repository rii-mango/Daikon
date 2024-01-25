export class OrderedMapIterator {
  index = 0
  orderedMap

  constructor(orderedMap) {
    this.orderedMap = orderedMap
  }

  hasNext() {
    return this.index < this.orderedMap.orderedKeys.length
  }

  next() {
    const item = this.orderedMap.get(this.orderedMap.orderedKeys[this.index])
    this.index += 1
    return item
  }
}
