import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeToId, childId, assignIds } from '../../skills/docent/scripts/src/lib/screen-id.mjs';

test('기본 규칙', () => {
  assert.equal(routeToId('/'), 'home');
  assert.equal(routeToId('/order/[id]/edit'), 'order-id-edit');
  assert.equal(routeToId('/Orders/New'), 'orders-new');
  assert.equal(routeToId('/order/new.aspx'), 'order-new-aspx');
});

test('route group과 병렬 슬롯은 ID에서 빠진다', () => {
  assert.equal(routeToId('/(auth)/login'), 'login');
  assert.equal(routeToId('/@modal/(.)photo/[id]'), 'photo-id');
  assert.equal(routeToId('/feed/(..)(..)photo'), 'feed-photo');
});

test('catch-all', () => {
  assert.equal(routeToId('/docs/[...slug]'), 'docs-slug');
  assert.equal(routeToId('/shop/[[...slug]]'), 'shop-slug');
});

test('ASCII가 아닌 세그먼트는 해시 기반으로 결정적이고 서로 다르다', () => {
  const a = routeToId('/주문/목록');
  const b = routeToId('/주문/등록');
  assert.notEqual(a, b);
  assert.equal(a, routeToId('/주문/목록'));
  assert.match(a, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test('충돌은 사전순으로 -2, -3', () => {
  const ids = assignIds(['/order/new', '/order-new', '/order_new']);
  assert.equal(ids.get('/order-new'), 'order-new');
  assert.equal(ids.get('/order/new'), 'order-new-2');
  assert.equal(ids.get('/order_new'), 'order-new-3');
});

test('하위 화면', () => {
  assert.equal(childId('orders-new', 'Customer Search'), 'orders-new--customer-search');
});

test('충돌 접미어가 다른 라우트의 기본 ID와 겹치지 않는다', () => {
  const ids = assignIds(['/a/b', '/a-b', '/a-b-2']);
  assert.equal(new Set(ids.values()).size, 3);
});

test('기존 ID는 새 라우트가 추가돼도 유지된다', () => {
  const before = assignIds(['/a/b', '/a/b-2']);
  const after = assignIds(['/a/b', '/a/b-2', '/a-b'], before);
  assert.equal(after.get('/a/b'), before.get('/a/b'));
  assert.equal(after.get('/a/b-2'), before.get('/a/b-2'));
  assert.equal(new Set(after.values()).size, 3);
});

test('사라진 라우트의 ID는 이전 맵에 있어도 쓰이지 않는다', () => {
  const before = assignIds(['/x']);
  const after = assignIds(['/y'], before);
  assert.deepEqual([...after.keys()], ['/y']);
});
