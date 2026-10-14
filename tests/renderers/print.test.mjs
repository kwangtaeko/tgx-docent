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
