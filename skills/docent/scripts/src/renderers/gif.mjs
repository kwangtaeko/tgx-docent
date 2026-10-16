// PNG 프레임 → GIF. 순수 JS(pngjs, gifenc)라 ffmpeg가 필요 없다. (설계 문서 9장)
import * as gifencModule from 'gifenc';
import { PNG } from 'pngjs';

const { GIFEncoder, quantize, applyPalette } = gifencModule.default ?? gifencModule;

// 처음·가운데·마지막 프레임 색으로 팔레트 하나를 만들어 모든 프레임에 쓴다
function sharedPalette(decoded) {
  const picks = [...new Set([0, Math.floor(decoded.length / 2), decoded.length - 1])].map((i) => decoded[i].data);
  const total = picks.reduce((n, d) => n + d.length, 0);
  const sample = new Uint8Array(total);
  let offset = 0;
  for (const d of picks) {
    sample.set(d, offset);
    offset += d.length;
  }
  return quantize(sample, 256);
}

export function encodeGif(frames, { fps = 10, holdLastMs = 1500 } = {}) {
  if (!frames.length) throw new Error('GIF로 만들 프레임이 없습니다');
  const first = PNG.sync.read(frames[0]);
  const { width, height } = first;
  // 새 창으로 옮겨 가 크기가 다른 프레임은 첫 프레임 크기에 맞춘다(왼쪽 위 기준, 남는 곳은 흰색)
  const decoded = frames.map((buf, i) => {
    const png = i ? PNG.sync.read(buf) : first;
    if (png.width === width && png.height === height) return png;
    const out = new PNG({ width, height });
    out.data.fill(255);
    PNG.bitblt(png, out, 0, 0, Math.min(width, png.width), Math.min(height, png.height), 0, 0);
    return out;
  });
  const palette = sharedPalette(decoded);
  const gif = GIFEncoder();
  decoded.forEach((png, i) => {
    const index = applyPalette(png.data, palette);
    const delay = i === decoded.length - 1 ? holdLastMs : Math.round(1000 / fps);
    gif.writeFrame(index, width, height, { palette: i === 0 ? palette : undefined, delay, repeat: 0 });
  });
  gif.finish();
  return Buffer.from(gif.bytes());
}
