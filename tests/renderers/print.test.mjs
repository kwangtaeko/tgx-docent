import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPrint } from '../../skills/docent/scripts/src/renderers/print.mjs';
import { loadGolden } from '../helpers/golden.mjs';

const withPreset = async (preset) => {
  const input = await loadGolden();
  input.options = { preset, formats: ['pdf'], title: '사용자 매뉴얼', organization: '', revisions: [] };
  return input;
};

test('화면마다 한 섹션, inventory 순서', async () => {
  const input = await withPreset('handover');
  const html = renderPrint(input);
  const ids = [...html.matchAll(/<section class="screen" id="screen-([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(ids, input.inventory.screens.map((s) => s.id));
  assert.ok(html.includes('캡처 없음'));
  assert.ok(html.includes('dataset.ready'));
  assert.ok(html.includes('src="assets/mermaid.min.js"'));
  assert.ok(!/https?:\/\//.test(html));
});

test('delivery는 표지로 시작하고 개정 이력으로 끝나며 근거 주석이 없다', async () => {
  const html = renderPrint(await withPreset('delivery'));
  const body = html.slice(html.indexOf('<main'));
  assert.ok(body.indexOf('class="cover"') < body.indexOf('class="toc"'));
  assert.ok(body.indexOf('class="toc"') < body.indexOf('id="intro"'));
  assert.ok(body.lastIndexOf('id="revisions"') > body.lastIndexOf('class="screen"'));
  assert.ok(!/<!-- (evidence|screens):/.test(html));
  assert.ok(html.includes('href="#screen-orders-new"'));
});

test('portfolio는 화면 카드', async () => {
  const html = renderPrint(await withPreset('portfolio'));
  assert.equal((html.match(/<article class="card"/g) ?? []).length, 8);
  assert.ok(!html.includes('<section class="screen"'));
});

test('인쇄 문서 안의 화면 링크는 모두 내부 앵커', async () => {
  const html = renderPrint(await withPreset('handover'));
  assert.ok(!html.includes('href="screens/'));
});

test('인쇄용 소개의 미리보기는 GIF 대신 캡처 PNG', async () => {
  const input = await loadGolden();
  input.media = { images: new Set(['orders']), gifs: new Set(['orders', 'home']) };
  const html = renderPrint(input);
  assert.ok(html.includes('media/img/orders.png'));
  assert.ok(!html.includes('.gif'));
});

test('인쇄용 HTML의 글꼴 경로는 assets/fonts를 가리킨다', async () => {
  const html = renderPrint(await loadGolden());
  assert.ok(html.includes('url("assets/fonts/PretendardVariable.woff2")'));
  assert.ok(!html.includes('url("fonts/'));
});

test('인쇄용 HTML은 미리보기 캡션을 이미지와 같은 쪽에 두고 다이어그램에 산출물 테마를 쓴다', async () => {
  const html = renderPrint(await loadGolden());
  assert.match(html, /\.preview-item[^{]*\{ break-inside: avoid; \}/);
  assert.ok(html.includes("theme: 'base'"));
  assert.ok(html.includes('startOnLoad: false'));
});
