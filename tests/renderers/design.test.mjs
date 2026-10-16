import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSite, STYLE } from '../../skills/docent/scripts/src/renderers/html.mjs';
import { loadGolden } from '../helpers/golden.mjs';

const withMedia = async () => {
  const input = await loadGolden();
  input.media = { images: new Set(['orders-new', 'orders']), gifs: new Set(['orders-new']) };
  return input;
};

test('스타일: 디자인 토큰, 다크 모드, 번들 글꼴, 한국어 줄바꿈', async () => {
  const css = renderSite(await loadGolden()).get('assets/style.css');
  for (const t of ['--accent:', '--radius:', '--shadow', '@media (prefers-color-scheme: dark)', '@font-face', 'fonts/PretendardVariable.woff2', 'word-break: keep-all']) {
    assert.ok(css.includes(t), t);
  }
});

test('캡처는 경로가 보이는 브라우저 틀에 넣고 누르면 확대된다', async () => {
  const site = renderSite(await withMedia());
  const page = site.get('screens/orders-new.html');
  assert.match(page, /<figure class="frame">[\s\S]*?<span class="frame-url">\/orders\/new<\/span>[\s\S]*?<img src="\.\.\/media\/img\/orders-new\.png" alt="주문 등록 화면" data-zoomable>/);
  assert.ok(page.includes('src="../assets/zoom.min.js"'));
  assert.ok(page.includes("mediumZoom('[data-zoomable]'"));
});

test('입력 항목은 이름과 형식·필수 배지로 된 목록', async () => {
  const page = renderSite(await loadGolden()).get('screens/orders-new.html');
  assert.match(page, /<ul class="fields">[\s\S]*?<span class="field-name">거래처<\/span>[\s\S]*?<span class="badge">텍스트<\/span>[\s\S]*?<span class="badge required">필수<\/span>/);
});

test('확인 필요는 주의 배지, 확인 필요 목록과 안내 메시지는 안내 상자', async () => {
  const page = renderSite(await loadGolden()).get('screens/orders-new.html');
  assert.ok(page.includes('<mark class="flag">확인 필요</mark>'));
  assert.match(page, /<aside class="callout caution">[\s\S]*?여신/);
  const login = renderSite(await loadGolden()).get('screens/login.html');
  assert.match(login, /<aside class="callout note">[\s\S]*?아이디 또는 비밀번호가 올바르지 않습니다\./);
});

test('소개는 히어로와 화면·워크플로우·역할 수, 기능 카드', async () => {
  const index = renderSite(await loadGolden()).get('index.html');
  assert.match(index, /<section class="hero">[\s\S]*?<h1>nextjs-sample<\/h1>/);
  assert.match(index, /<ul class="stats">[\s\S]*?<b>8<\/b><span>화면<\/span>[\s\S]*?<b>3<\/b><span>워크플로우<\/span>[\s\S]*?<b>2<\/b><span>역할<\/span>/);
  assert.equal((index.match(/<article class="feature">/g) ?? []).length, 3);
});

test('머리말에서 지금 페이지 메뉴를 표시한다', async () => {
  const site = renderSite(await loadGolden());
  assert.ok(site.get('workflows.html').includes('<a href="workflows.html" aria-current="page">워크플로우</a>'));
  assert.ok(site.get('screens/login.html').includes('<a href="../screens.html" aria-current="page">화면 목록</a>'));
});

test('워크플로우 다이어그램은 산출물 색에 맞춘 테마로 그린다', async () => {
  const html = renderSite(await loadGolden()).get('workflows.html');
  assert.ok(html.includes("theme: 'base'") && html.includes('themeVariables'));
  assert.match(html, /<ol class="steps">/);
});

test('배경은 흰색 대신 옅은 색 번짐·점 격자, 소개 머리는 그라데이션 배너', () => {
  assert.match(STYLE, /--glow-1:/);
  assert.match(STYLE, /body::before \{[^}]*background-size: 22px 22px/);
  assert.match(STYLE, /\.hero \{[^}]*linear-gradient\(135deg/);
  assert.match(STYLE, /@media print \{[\s\S]*body::before \{ display: none; \}/);
});
