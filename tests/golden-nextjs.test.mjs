import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { goldenSuite, loadExpected } from './helpers/golden-suite.mjs';

const ROOT = 'fixtures/nextjs-sample';
const EXP = 'fixtures/expected/nextjs-sample';

goldenSuite({
  root: ROOT,
  expected: EXP,
  pages: 7,
  children: 1,
  edges: ['login->home', 'orders->orders-new', 'orders-new->orders', 'orders->orders-id', 'orders-id->orders-id-edit', 'orders-id-edit->orders-id'],
});

const { screens } = await loadExpected(EXP);

test('주문 등록에는 여신 확인 불명확성이 low confidence와 unknowns로 남는다', () => {
  const s = screens.get('orders-new');
  const all = [s.purpose, ...s.roles, ...s.fields, ...s.actions];
  assert.ok(all.some((x) => x.confidence === 'low'));
  assert.ok(s.unknowns.some((u) => /여신/.test(u)));
});

test('사용자 관리의 권한 근거는 middleware.ts', () => {
  assert.match(screens.get('admin-users').roles[0].evidence, /^middleware\.ts:/);
});

test('하위 화면은 modal', () => {
  assert.equal(screens.get('orders-new--customer-search').kind, 'modal');
});

test('골든 시나리오는 6개 이상', async () => {
  assert.ok((await readdir(`${EXP}/scenarios`)).length >= 6);
});
