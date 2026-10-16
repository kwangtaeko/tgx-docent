import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { backdrop, cropForSlide, renderPptx } from '../../skills/docent/scripts/src/renderers/pptx.mjs';
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

test('버튼 설명이 길면 높이 기준으로 다음 장으로 넘긴다', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  const s = input.screens.get('orders');
  const long = '목록에서 주문 번호를 누르면 주문 상세 화면으로 이동하고, 상세 화면에서는 거래처와 납기일, 수량, 비고, 상태를 확인할 수 있습니다. 상태에 따라 수정이 제한됩니다.';
  s.fields = [];
  s.actions = Array.from({ length: 8 }, (_, i) => ({ ...s.actions[0], label: `버튼${i + 1}`, effect: long }));
  const all = (await slides(await renderPptx(input, { mediaDir: await emptyMedia() }))).map(text);
  const first = all.findIndex((t) => t.includes('버튼1 '));
  assert.ok(first > 0);
  assert.match(all[first + 1], /\(계속\)/);
  assert.ok(!all[first].includes('버튼8 '), '한 장에 다 넣으면 넘친다');
});

test('메뉴 구조가 길면 여러 장으로 나눈다', async () => {
  const input = await loadLarge(60);
  input.options = opts('handover');
  const all = (await slides(await renderPptx(input, { mediaDir: await emptyMedia() }))).map(text);
  const menus = all.filter((t) => t.startsWith('메뉴 구조'));
  assert.ok(menus.length >= 2, String(menus.length));
  assert.match(menus[1], /\(계속\)/);
});

test('세로로 긴 캡처는 위쪽만 잘라 넣는다', () => {
  const tall = new PNG({ width: 100, height: 1000 });
  const cropped = PNG.sync.read(cropForSlide(PNG.sync.write(tall), 6.0, 5.6));
  assert.equal(cropped.width, 100);
  assert.equal(cropped.height, Math.round(100 * (5.6 / 6.0) * 1.5));
  const short = PNG.sync.write(new PNG({ width: 100, height: 100 }));
  assert.equal(cropForSlide(short, 6.0, 5.6), short);
});

test('HTML과 같은 색 토큰: 그라데이션 표지·강조 막대·기능 카드·단계 칩', async () => {
  const input = await loadGolden();
  input.options = opts('handover');
  const all = await slides(await renderPptx(input, { mediaDir: await emptyMedia() }));
  assert.match(all[0], /<p:bg><p:bgPr><a:blipFill/, '표지 배경 그림');
  assert.match(all[1], /4F46E5/, '제목 강조 막대');
  assert.ok((all[1].match(/prstGeom prst="roundRect"/g) ?? []).length >= input.summary.features.length, '기능마다 카드');
  assert.match(all[4], /EEF2FF/, '단계 칩');
});

test('배경 그림: 본문은 옅은 바탕, 표지는 진한 그라데이션', () => {
  const px = (uri, x, y) => {
    const png = PNG.sync.read(Buffer.from(uri.split(',')[1], 'base64'));
    const o = (y * png.width + x) * 4;
    return [png.data[o], png.data[o + 1], png.data[o + 2]];
  };
  const body = backdrop('body');
  assert.ok(px(body, 660, 700).every((v) => v > 230), '본문 아래쪽은 밝다');
  assert.ok(px(body, 30, 10)[2] > px(body, 30, 10)[0], '왼쪽 위는 남색 번짐');
  assert.ok(px(backdrop('cover'), 600, 400)[0] < 120, '표지는 진하다');
});
