import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReadme } from '../../skills/docent/scripts/src/renderers/readme.mjs';
import { loadGolden } from '../helpers/golden.mjs';

test('소개 README 구성', async () => {
  const md = renderReadme(await loadGolden());
  assert.ok(md.startsWith('# nextjs-sample\n'));
  assert.ok(md.includes('거래처 주문을 등록하고 조회·수정·삭제하는 주문 관리 시스템입니다'));
  const features = md.split('## 주요 기능\n')[1].split('\n## ')[0].trim().split('\n');
  assert.equal(features.length, 3);
  assert.ok(md.includes('<!-- screens: orders, orders-new, orders-id-edit -->'));
  for (const h of ['## 메뉴 구조', '## 사용자 역할', '## 더 보기']) assert.ok(md.includes(h), h);
  assert.ok(md.includes('(html/index.html)'));
  assert.ok(md.includes('(html/screens.html)'));
  assert.ok(!md.includes('npm install'));
});

test('메뉴 구조는 트리 목록', async () => {
  const md = renderReadme(await loadGolden());
  assert.ok(md.includes('- 주문관리\n  - 주문 목록\n  - 주문 등록'));
});

test('README 화면 미리보기', async () => {
  const input = await loadGolden();
  assert.ok(renderReadme(input).includes('> 화면 캡처 없이 소스만으로 만들었습니다.'));
  input.media = { images: new Set(['login']), gifs: new Set(['login', 'home', 'orders', 'orders-new']) };
  const md = renderReadme(input);
  assert.ok(md.includes('## 화면 미리보기'));
  assert.equal((md.match(/!\[[^\]]+\]\(html\/media\/gif\/[^)]+\.gif\)/g) ?? []).length, 3);
  assert.ok(md.includes('![로그인](html/media/gif/login.gif)'));
});
