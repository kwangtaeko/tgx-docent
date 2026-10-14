import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goldenSuite, inventoryFromAgent, loadExpected } from './helpers/golden-suite.mjs';

const ROOT = 'fixtures/spring-jsp-sample';
const EXP = 'fixtures/expected/spring-jsp-sample';

goldenSuite({
  root: ROOT,
  expected: EXP,
  pages: 7,
  children: 1,
  edges: ['login->home', 'products->products-new', 'products-new->products', 'products->products-id', 'products-id->products-id-edit', 'products-new->products-new--partner-search'],
});

const golden = await loadExpected(EXP);

test('에이전트 탐색 결과가 inventory 명령을 그대로 통과한다', async () => {
  const { inventory, problems } = await inventoryFromAgent(ROOT, EXP);
  assert.deepEqual(problems, []);
  assert.deepEqual(inventory, golden.inventory);
});

test('감지기 없이 모든 화면의 source는 agent', () => {
  assert.ok(golden.inventory.screens.every((s) => s.source === 'agent'));
});

test('거래처 검색은 popup 하위 화면', () => {
  const s = golden.screens.get('products-new--partner-search');
  assert.equal(s.kind, 'popup');
  assert.equal(s.parentId, 'products-new');
});

test('관리자 권한 근거는 인터셉터', () => {
  assert.match(golden.screens.get('admin-users').roles[0].evidence, /AuthInterceptor\.java:/);
});

test('라우트의 {id}는 [id]로, 화면 파일은 컨트롤러와 JSP', () => {
  const entry = golden.inventory.screens.find((s) => s.id === 'products-id');
  assert.equal(entry.route, '/products/[id]');
  assert.ok(entry.files.some((f) => f.endsWith('ProductController.java')));
  assert.ok(entry.files.some((f) => f.endsWith('products/detail.jsp')));
});
