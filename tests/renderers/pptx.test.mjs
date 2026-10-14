import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { renderPptx } from '../../skills/docent/scripts/src/renderers/pptx.mjs';
import { loadGolden, loadLarge } from '../helpers/golden.mjs';

async function slides(buf) {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  names.sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
  return Promise.all(names.map((n) => zip.file(n).async('string')));
}
const text = (xml) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ');
const opts = (preset) => ({ preset, formats: ['pptx'], title: '사용자 매뉴얼', organization: '샘플㈜', revisions: [] });
const emptyMedia = async () => mkdtemp(join(tmpdir(), 'docent-media-'));

test('handover: 표지·소개·메뉴·워크플로우 3·화면 8 = 14장', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  const all = await slides(await renderPptx(input, { mediaDir: await emptyMedia() }));
  assert.equal(all.length, 14);
  assert.match(text(all[0]), /nextjs-sample/);
  assert.match(text(all[0]), /사용자 매뉴얼/);
  const screenText = all.slice(6).map(text).join(' ');
  assert.match(screenText, /주문 등록/);
  assert.match(screenText, /캡처 없음/);
});

test('delivery는 개정 이력 장이 더해진다', async () => {
  const input = await loadGolden();
  input.options = opts('delivery');
  const all = await slides(await renderPptx(input, { mediaDir: await emptyMedia() }));
  assert.equal(all.length, 15);
  assert.match(text(all.at(-1)), /개정 이력/);
});

test('입력 항목이 많으면 (계속) 장으로 넘긴다', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  const s = input.screens.get('orders-new');
  s.fields = Array.from({ length: 12 }, (_, i) => ({ ...s.fields[0], label: `항목${i + 1}` }));
  const all = (await slides(await renderPptx(input, { mediaDir: await emptyMedia() }))).map(text);
  const idx = all.findIndex((t) => t.includes('항목1 '));
  assert.ok(idx > 0);
  assert.match(all[idx + 1], /\(계속\)/);
  assert.match(all[idx + 1], /항목12/);
});

test('다이어그램이 없으면 단계 목록 텍스트, 있으면 이미지', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  let all = (await slides(await renderPptx(input, { mediaDir: await emptyMedia() }))).map(text);
  assert.match(all.slice(3, 6).join(' | '), /주문 목록.*→.*주문 등록/);
  const png = new PNG({ width: 400, height: 100 });
  const diagrams = input.summary.workflows.map(() => PNG.sync.write(png));
  const zip = await JSZip.loadAsync(await renderPptx(input, { mediaDir: await emptyMedia(), diagrams }));
  assert.ok(Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/')).length >= 3);
});

test('캡처가 있으면 화면 장에 이미지', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  const mediaDir = await emptyMedia();
  await mkdir(join(mediaDir, 'img'), { recursive: true });
  await writeFile(join(mediaDir, 'img', 'orders.png'), PNG.sync.write(new PNG({ width: 1280, height: 2000 })));
  input.media = { images: new Set(['orders']), gifs: new Set() };
  const zip = await JSZip.loadAsync(await renderPptx(input, { mediaDir }));
  assert.ok(Object.keys(zip.files).some((n) => n.startsWith('ppt/media/')));
});

test('portfolio는 GIF가 있는 화면만', async () => {
  const input = await loadGolden();
  input.options = opts('portfolio');
  const all = await slides(await renderPptx(input, { mediaDir: await emptyMedia() }));
  assert.equal(all.length, 6);
});

test('화면 60개도 60초 안에', { timeout: 60000 }, async () => {
  const input = await loadLarge(60);
  input.options = opts('handover');
  const all = await slides(await renderPptx(input, { mediaDir: await emptyMedia() }));
  assert.ok(all.length >= 63);
});
