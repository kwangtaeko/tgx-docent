import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { encodeGif } from '../../skills/docent/scripts/src/renderers/gif.mjs';

function solid(r, g, b, w = 8, h = 6) {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) png.data.set([r, g, b, 255], i * 4);
  return PNG.sync.write(png);
}

function countGce(buf) {
  let n = 0;
  for (let i = 0; i + 1 < buf.length; i++) if (buf[i] === 0x21 && buf[i + 1] === 0xf9) n++;
  return n;
}

test('PNG 프레임을 GIF로 만든다', () => {
  const gif = encodeGif([solid(255, 0, 0), solid(0, 255, 0), solid(0, 0, 255)], { fps: 10, holdLastMs: 1500 });
  assert.equal(gif.subarray(0, 6).toString('latin1'), 'GIF89a');
  assert.equal(countGce(gif), 3);
  // 마지막 Graphic Control Extension의 지연(1/100초 단위, little endian) = 150
  const last = gif.lastIndexOf(Buffer.from([0x21, 0xf9]));
  assert.equal(gif.readUInt16LE(last + 4), 150);
  const first = gif.indexOf(Buffer.from([0x21, 0xf9]));
  assert.equal(gif.readUInt16LE(first + 4), 10);
});
