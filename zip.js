/*
 * Minimal ZIP archive writer (method 0 = store, no compression).
 * JPEG/PNG images are already compressed, so storing them is the right choice
 * and keeps this app free of external dependencies.
 */
(function () {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosDateTime(date) {
    const d = date || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, day };
  }

  class ZipWriter {
    constructor() {
      this.parts = [];   // Blob parts for the final archive
      this.entries = []; // central directory records
      this.offset = 0;
    }

    /** Add a file. name: forward-slash path, data: Uint8Array */
    add(name, data) {
      const nameBytes = new TextEncoder().encode(name);
      const crc = crc32(data);
      const { time, day } = dosDateTime();

      const header = new DataView(new ArrayBuffer(30));
      header.setUint32(0, 0x04034b50, true);  // local file header signature
      header.setUint16(4, 20, true);          // version needed
      header.setUint16(6, 0x0800, true);      // flags: UTF-8 names
      header.setUint16(8, 0, true);           // method: store
      header.setUint16(10, time, true);
      header.setUint16(12, day, true);
      header.setUint32(14, crc, true);
      header.setUint32(18, data.length, true); // compressed size
      header.setUint32(22, data.length, true); // uncompressed size
      header.setUint16(26, nameBytes.length, true);
      header.setUint16(28, 0, true);           // extra field length

      this.entries.push({ nameBytes, crc, size: data.length, offset: this.offset, time, day });
      this.parts.push(header.buffer, nameBytes, data);
      this.offset += 30 + nameBytes.length + data.length;
    }

    /** Finish the archive and return it as a Blob. */
    finalize() {
      const centralParts = [];
      let centralSize = 0;
      for (const e of this.entries) {
        const rec = new DataView(new ArrayBuffer(46));
        rec.setUint32(0, 0x02014b50, true);   // central directory signature
        rec.setUint16(4, 20, true);           // version made by
        rec.setUint16(6, 20, true);           // version needed
        rec.setUint16(8, 0x0800, true);       // flags: UTF-8 names
        rec.setUint16(10, 0, true);           // method: store
        rec.setUint16(12, e.time, true);
        rec.setUint16(14, e.day, true);
        rec.setUint32(16, e.crc, true);
        rec.setUint32(20, e.size, true);
        rec.setUint32(24, e.size, true);
        rec.setUint16(28, e.nameBytes.length, true);
        rec.setUint32(42, e.offset, true);    // local header offset
        centralParts.push(rec.buffer, e.nameBytes);
        centralSize += 46 + e.nameBytes.length;
      }

      const end = new DataView(new ArrayBuffer(22));
      end.setUint32(0, 0x06054b50, true);            // end of central directory
      end.setUint16(8, this.entries.length, true);   // entries on this disk
      end.setUint16(10, this.entries.length, true);  // total entries
      end.setUint32(12, centralSize, true);
      end.setUint32(16, this.offset, true);          // central directory offset
      centralParts.push(end.buffer);

      return new Blob([...this.parts, ...centralParts], { type: 'application/zip' });
    }
  }

  window.ZipWriter = ZipWriter;
})();
