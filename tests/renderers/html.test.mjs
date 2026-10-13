import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeComment, escapeHtml } from '../../skills/docent/scripts/src/renderers/escape.mjs';
import { renderSite } from '../../skills/docent/scripts/src/renderers/html.mjs';
import { loadGolden } from '../helpers/golden.mjs';

test('escape', () => {
  assert.equal(escapeHtml(`<b>&"'`), '&lt;b&gt;&amp;&quot;&#39;');
  assert.ok(!escapeComment('a --> b').includes('--'));
});

test('파일 목록', async () => {
  const site = renderSite(await loadGolden());
  const ids = (await loadGolden()).inventory.screens.map((s) => `screens/${s.id}.html`);
  assert.deepEqual([...site.keys()].sort(), ['assets/style.css', 'index.html', 'screens.html', 'workflows.html', ...ids].sort());
});

test('화면별 매뉴얼', async () => {
  const html = renderSite(await loadGolden()).get('screens/orders-new.html');
  for (const text of ['거래처', '납기일', '<mark>[확인 필요]</mark>', '<!-- evidence: app/orders/new/order-form.tsx:32 -->', 'href="orders.html"', 'href="orders-new--customer-search.html"']) {
    assert.ok(html.includes(text), text);
  }
});

test('워크플로우 페이지', async () => {
  const html = renderSite(await loadGolden()).get('workflows.html');
  assert.ok(html.includes('orders --> orders_new'));
  assert.ok(html.includes('src="assets/mermaid.min.js"'));
});

test('소개·목록 페이지', async () => {
  const site = renderSite(await loadGolden());
  const index = site.get('index.html');
  assert.ok(index.includes('거래처 주문을 등록하고 조회·수정·삭제하는 주문 관리 시스템입니다'));
  for (const role of ['영업담당', '관리자']) assert.ok(index.includes(role), role);
  const list = site.get('screens.html');
  for (const id of ['login', 'orders-new--customer-search', 'admin-users']) assert.ok(list.includes(`href="screens/${id}.html"`), id);
});

test('외부 URL 없음', async () => {
  for (const [path, content] of renderSite(await loadGolden())) {
    assert.ok(!/https?:\/\//.test(content), path);
  }
});

test('결정적 출력', async () => {
  const a = renderSite(await loadGolden());
  const b = renderSite(await loadGolden());
  assert.deepEqual([...a], [...b]);
});

test('특수문자', async () => {
  const input = await loadGolden();
  const s = input.screens.get('login');
  s.fields[0].label = '<b>&"';
  s.fields[0].evidence = 'app/login/page.tsx:11';
  s.purpose.value = '닫기 --> 시도';
  const html = renderSite(input).get('screens/login.html');
  assert.ok(html.includes('&lt;b&gt;&amp;&quot;'));
  assert.ok(!html.includes('<b>&"'));
  const comments = html.match(/<!--[\s\S]*?-->/g) ?? [];
  for (const c of comments) assert.ok(!c.slice(4, -3).includes('--'), c);
});
