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
  const decoded = frames.map((buf) => PNG.sync.read(buf));
  const { width, height } = decoded[0];
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
