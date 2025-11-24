// Small, dependency-free ZIP builder (no compression) to reliably
// create ZIP files inside the extension without needing JSZip.
// Supports adding multiple files (binary) and returns a Blob.
function crc32(buf) {
  const table = (function () {
    let c;
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
      }
      tbl[n] = c >>> 0;
    }
    return tbl;
  })();

  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatUint8(arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function uint32ToLE(n) {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

function uint16ToLE(n) {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}

function strToU8(str) {
  return new TextEncoder().encode(str);
}

function base64ToU8(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildZip(files) {
  // files: [{ name: 'path/to/file', data: Uint8Array }]
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = strToU8(file.name);
    const data = file.data;
    const crc = crc32(data);
    const compressedSize = data.length;
    const uncompressedSize = data.length;

    // local file header
    const localHeader = concatUint8([
      uint32ToLE(0x04034b50), // local file header signature
      uint16ToLE(20), // version needed to extract
      uint16ToLE(0), // flags
      uint16ToLE(0), // compression method (0 = store)
      uint16ToLE(0), // mod time
      uint16ToLE(0), // mod date
      uint32ToLE(crc), // crc32
      uint32ToLE(compressedSize),
      uint32ToLE(uncompressedSize),
      uint16ToLE(nameBuf.length),
      uint16ToLE(0), // extra len
      nameBuf,
    ]);

    localParts.push(localHeader, data);

    // central directory header
    const centralHeader = concatUint8([
      uint32ToLE(0x02014b50), // central file header signature
      uint16ToLE(20), // version made by
      uint16ToLE(20), // version needed
      uint16ToLE(0), // flags
      uint16ToLE(0), // compression method
      uint16ToLE(0), // mod time
      uint16ToLE(0), // mod date
      uint32ToLE(crc),
      uint32ToLE(compressedSize),
      uint32ToLE(uncompressedSize),
      uint16ToLE(nameBuf.length),
      uint16ToLE(0), // extra
      uint16ToLE(0), // comment
      uint16ToLE(0), // disk number start
      uint16ToLE(0), // internal attrs
      uint32ToLE(0), // external attrs
      uint32ToLE(offset), // relative offset of local header
      nameBuf,
    ]);

    centralParts.push(centralHeader);

    // update offset: local header length + data length
    offset += localHeader.length + data.length;
  }

  const centralDir = concatUint8(centralParts);
  const centralSize = centralDir.length;
  const centralOffset = offset;

  const endRecord = concatUint8([
    uint32ToLE(0x06054b50), // end of central dir signature
    uint16ToLE(0), // disk number
    uint16ToLE(0), // start disk
    uint16ToLE(files.length), // entries this disk
    uint16ToLE(files.length), // total entries
    uint32ToLE(centralSize),
    uint32ToLE(centralOffset),
    uint16ToLE(0), // comment length
  ]);

  const all = concatUint8([...localParts, centralDir, endRecord]);
  return new Blob([all], { type: 'application/zip' });
}

async function exportAsZip(screenshotsData) {
  try {
    // Build files array: screenshots inside screenshots/ and metadata.json at root
    const files = [];

    for (let i = 0; i < screenshotsData.length; i++) {
      const item = screenshotsData[i];
      const base64 = item.screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
      const data = base64ToU8(base64);
      files.push({ name: `screenshots/capture_${i + 1}.png`, data });
    }

    const metadata = screenshotsData.map((item, index) => ({
      screenshotFile: `screenshots/capture_${index + 1}.png`,
      timestamp: item.timestamp,
      metadata: item.metadata,
    }));
    const metaStr = JSON.stringify(metadata, null, 2);
    files.push({ name: 'metadata.json', data: strToU8(metaStr) });

    const blob = buildZip(files);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captures.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('ZIP creation failed, falling back to individual downloads', err);
    // Fallback: download PNGs individually (no metadata file)
    for (let index = 0; index < screenshotsData.length; index++) {
      const item = screenshotsData[index];
      const filename = `capture_${index + 1}.png`;
      const a = document.createElement('a');
      a.href = item.screenshot;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }
}
