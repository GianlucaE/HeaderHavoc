/**
 * Generates the toolbar icons — run with `npm run icons`.
 *
 * The mark is drawn from rectangles rather than rasterised from a font or an
 * SVG, so it lands on exact pixel boundaries at every size and stays crisp at
 * 16px where the toolbar actually renders it. Two colour variants are emitted:
 * blue for enabled, gray for disabled. The service worker swaps between them.
 *
 * No dependencies: PNGs are encoded here with node:zlib.
 */
import {deflateSync} from 'node:zlib';
import {mkdirSync, writeFileSync} from 'node:fs';

const SIZES = [16, 32, 48, 128];
const VARIANTS = {
    '': [0x4d, 0x7c, 0xff],      // enabled  — accent blue #4d7cff
    '-off': [0x8f, 0x8f, 0x8f],  // disabled — neutral gray, readable on light and dark toolbars
};

const crcTable = Array.from({length: 256}, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return c >>> 0;
});

function crc32(buf) {
    let c = 0xffffffff;
    for (const byte of buf) {
        c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0);
    ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // colour type: RGBA
    const raw = Buffer.alloc(size * (size * 4 + 1));
    for (let y = 0; y < size; y++) {
        raw[y * (size * 4 + 1)] = 0; // filter: none
        pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(raw, {level: 9})),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

/** A bold H: two stems and a crossbar, sized as fractions of the canvas. */
function drawMark(size, [r, g, b]) {
    const px = Buffer.alloc(size * size * 4); // transparent
    const pad = Math.round(size * 0.125);
    const stroke = Math.max(2, Math.round(size * 0.1875));
    const right = size - pad - stroke;
    const barTop = Math.round((size - stroke) / 2);

    const fill = (x0, y0, x1, y1) => {
        for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
                const i = (y * size + x) * 4;
                px[i] = r;
                px[i + 1] = g;
                px[i + 2] = b;
                px[i + 3] = 255;
            }
        }
    };

    fill(pad, pad, pad + stroke, size - pad);        // left stem
    fill(right, pad, right + stroke, size - pad);    // right stem
    fill(pad, barTop, size - pad, barTop + stroke);  // crossbar

    return encodePng(size, px);
}

mkdirSync('public/icons', {recursive: true});
for (const [suffix, colour] of Object.entries(VARIANTS)) {
    for (const size of SIZES) {
        const file = `public/icons/icon${suffix}-${size}.png`;
        writeFileSync(file, drawMark(size, colour));
        console.log(`wrote ${file}`);
    }
}
