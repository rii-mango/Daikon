/** * Static Pseudo-constants ***/
export const JPEG_MAGIC_NUMBER = [0xff, 0xd8]
export const JPEG2000_MAGIC_NUMBER = [0xff, 0x4f, 0xff, 0x51]

export const isHeaderJPEG = (data) => {
  if (data) {
    if (data.getUint8(0) !== JPEG_MAGIC_NUMBER[0]) {
      return false
    }

    if (data.getUint8(1) !== JPEG_MAGIC_NUMBER[1]) {
      return false
    }

    return true
  }

  return false
}

export const isHeaderJPEG2000 = (data) => {
  if (data) {
    for (let ctr = 0; ctr < JPEG2000_MAGIC_NUMBER.length; ctr += 1) {
      if (data.getUint8(ctr) !== JPEG2000_MAGIC_NUMBER[ctr]) {
        return false
      }
    }

    return true
  }

  return false
}
