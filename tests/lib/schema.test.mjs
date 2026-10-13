import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateInventory, validateScreen } from '../../skills/docent/scripts/src/lib/schema.mjs';

const HASH = 'sha256:' + 'a'.repeat(64);

function screen() {
  return {
    id: 'orders-new',
    kind: 'page',
    route: '/orders/new',
    title: { value: '주문 등록', evidence: 'app/orders/new/page.tsx:12' },
    menuPath: { value: ['주문관리', '주문 등록'], evidence: 'components/nav.tsx:40' },
    purpose: { value: '신규 주문을 등록한다', evidence: 'app/orders/new/page.tsx:12-80', confidence: 'high' },
    roles: [{ value: '영업담당', evidence: 'middleware.ts:22', confidence: 'medium' }],
    sections: [],
    fields: [
      { label: '거래처', type: 'select', required: true, evidence: 'app/orders/new/page.tsx:41', confidence: 'high' },
    ],
    actions: [
      {
        label: '저장',
        effect: '주문을 저장하고 목록으로 이동한다',
        navigatesTo: 'orders',
        evidence: 'app/orders/new/actions.ts:saveOrder',
        confidence: 'medium',
      },
    ],
    messages: [{ text: '저장되었습니다.', when: '저장 성공', evidence: 'app/orders/page.tsx:30' }],
    unknowns: [],
    readFiles: ['app/orders/new/page.tsx'],
    sourceHash: HASH,
  };
}

function inventory() {
  return {
    version: 1,
    screens: [
      {
        id: 'orders-new',
        route: '/orders/new',
        kind: 'page',
        files: ['app/orders/new/page.tsx'],
        evidence: 'app/orders/new/page.tsx:1',
        source: 'detector:nextjs',
      },
      {
        id: 'orders-new--customer-search',
        route: null,
        kind: 'modal',
        parentId: 'orders-new',
        files: ['app/orders/new/customer-search.tsx'],
        evidence: 'app/orders/new/page.tsx:50',
        source: 'agent',
      },
    ],
  };
}

test('유효한 screen은 통과한다', () => {
  const r = validateScreen(screen());
  assert.deepEqual(r, { valid: true, errors: [] });
});

test('evidence가 빠지면 실패한다', () => {
  const s = screen();
  delete s.fields[0].evidence;
  const r = validateScreen(s);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('evidence')), r.errors.join('\n'));
});

test('confidence 값은 high·medium·low만', () => {
  const s = screen();
  s.purpose.confidence = 'unknown';
  assert.equal(validateScreen(s).valid, false);
});

test('modal은 parentId가 필수', () => {
  const s = screen();
  s.kind = 'modal';
  s.route = null;
  assert.equal(validateScreen(s).valid, false);
  s.parentId = 'orders';
  assert.equal(validateScreen(s).valid, true);
});

test('page는 route가 문자열이어야 한다', () => {
  const s = screen();
  s.route = null;
  assert.equal(validateScreen(s).valid, false);
});

test('sourceHash 형식', () => {
  const s = screen();
  s.sourceHash = 'abc';
  assert.equal(validateScreen(s).valid, false);
});

test('역슬래시·드라이브 문자 근거는 실패한다', () => {
  const s = screen();
  s.title.evidence = 'C:\\src\\a.ts:3';
  assert.equal(validateScreen(s).valid, false);
});

test('알 수 없는 필드는 실패한다', () => {
  const s = screen();
  s.foo = 1;
  assert.equal(validateScreen(s).valid, false);
});

test('유효한 inventory는 통과한다', () => {
  assert.deepEqual(validateInventory(inventory()), { valid: true, errors: [] });
});

test('inventory source는 정해진 값만', () => {
  const inv = inventory();
  inv.screens[0].source = 'guess';
  assert.equal(validateInventory(inv).valid, false);
});

test('inventory files는 비어 있을 수 없다', () => {
  const inv = inventory();
  inv.screens[0].files = [];
  assert.equal(validateInventory(inv).valid, false);
});

test('inventory modal도 parentId가 필수', () => {
  const inv = inventory();
  delete inv.screens[1].parentId;
  assert.equal(validateInventory(inv).valid, false);
});

test('readFiles·files는 정규화된 상대 경로만', () => {
  for (const bad of ['../x.ts', './x.ts', '/abs.ts']) {
    const s = screen();
    s.readFiles = [bad];
    assert.equal(validateScreen(s).valid, false, bad);
    const inv = inventory();
    inv.screens[0].files = [bad];
    assert.equal(validateInventory(inv).valid, false, bad);
  }
});
