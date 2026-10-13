import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { assignIds, childId } from '../skills/docent/scripts/src/lib/screen-id.mjs';
import { hashFiles } from '../skills/docent/scripts/src/lib/source-hash.mjs';
import { validateInventory, validateScreen } from '../skills/docent/scripts/src/lib/schema.mjs';
import { checkEvidence } from '../skills/docent/scripts/src/lib/evidence.mjs';

const ROOT = 'fixtures/nextjs-sample';
const EXP = 'fixtures/expected/nextjs-sample';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const inventory = await readJson(join(EXP, 'inventory.json'));
const screenFiles = (await readdir(join(EXP, 'screens'))).filter((f) => f.endsWith('.json'));
const screens = new Map();
for (const f of screenFiles) screens.set(f.replace(/\.json$/, ''), await readJson(join(EXP, 'screens', f)));
const ids = new Set(screens.keys());

test('inventory가 스키마를 통과한다', () => {
  const r = validateInventory(inventory);
  assert.ok(r.valid, r.errors.join('\n'));
});

test('모든 screen 파일이 스키마를 통과하고 파일명 = id', () => {
  for (const [name, s] of screens) {
    const r = validateScreen(s);
    assert.ok(r.valid, `${name}: ${r.errors.join('\n')}`);
    assert.equal(s.id, name);
  }
});

test('inventory의 id 집합 = screens 폴더의 id 집합, page 7·modal 1', () => {
  assert.deepEqual(new Set(inventory.screens.map((s) => s.id)), ids);
  assert.equal(inventory.screens.filter((s) => s.kind === 'page').length, 7);
  assert.equal(inventory.screens.filter((s) => s.kind === 'modal').length, 1);
});

test('page id는 assignIds 결과, 하위 화면 id는 childId 형식', () => {
  const pages = inventory.screens.filter((s) => s.kind === 'page');
  const expected = assignIds(pages.map((p) => p.route));
  for (const p of pages) assert.equal(p.id, expected.get(p.route));
  for (const s of inventory.screens.filter((x) => x.kind !== 'page')) {
    assert.ok(ids.has(s.parentId), s.id);
    assert.ok(s.id.startsWith(`${s.parentId}--`), s.id);
    assert.equal(childId(s.parentId, s.id.slice(s.parentId.length + 2)), s.id);
  }
});

test('navigatesTo·opens가 가리키는 id가 모두 존재', () => {
  for (const s of screens.values()) {
    for (const a of s.actions) {
      if (a.navigatesTo) assert.ok(ids.has(a.navigatesTo), `${s.id}: ${a.navigatesTo}`);
      if (a.opens) assert.ok(ids.has(a.opens), `${s.id}: ${a.opens}`);
    }
  }
});

function evidenceChecks(s) {
  const checks = [[s.title.evidence], [s.purpose.evidence]];
  if (s.menuPath) checks.push([s.menuPath.evidence]);
  for (const x of [...s.roles, ...s.sections]) checks.push([x.evidence]);
  for (const f of s.fields) checks.push([f.evidence, f.label]);
  for (const a of s.actions) checks.push([a.evidence, a.label]);
  for (const m of s.messages) checks.push([m.evidence, m.text]);
  return checks;
}

test('모든 evidence가 실제 위치를 가리키고, 라벨·메시지 문구가 근처에 있다', async () => {
  const failures = [];
  for (const entry of inventory.screens) {
    const r = await checkEvidence(ROOT, entry.evidence);
    if (!r.ok) failures.push(`inventory ${entry.id}: ${r.reason}`);
  }
  for (const s of screens.values()) {
    for (const [ev, text] of evidenceChecks(s)) {
      const r = await checkEvidence(ROOT, ev, text === undefined ? {} : { expectText: text });
      if (!r.ok) failures.push(`${s.id}: ${r.reason}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('sourceHash = hashFiles(readFiles)', async () => {
  for (const s of screens.values()) {
    assert.equal(s.sourceHash, await hashFiles(ROOT, s.readFiles), s.id);
  }
});

test('주문 등록에는 여신 확인 불명확성이 low confidence와 unknowns로 남는다', () => {
  const s = screens.get('orders-new');
  const all = [s.purpose, ...s.roles, ...s.fields, ...s.actions];
  assert.ok(all.some((x) => x.confidence === 'low'));
  assert.ok(s.unknowns.some((u) => /여신/.test(u)));
});

test('사용자 관리의 권한 근거는 middleware.ts', () => {
  assert.match(screens.get('admin-users').roles[0].evidence, /^middleware\.ts:/);
});

test('워크플로우 연결', () => {
  const edges = new Set();
  for (const s of screens.values()) {
    for (const a of s.actions) if (a.navigatesTo) edges.add(`${s.id}->${a.navigatesTo}`);
  }
  for (const e of [
    'login->home',
    'orders->orders-new',
    'orders-new->orders',
    'orders->orders-id',
    'orders-id->orders-id-edit',
    'orders-id-edit->orders-id',
  ]) {
    assert.ok(edges.has(e), e);
  }
});

test('summary가 스키마를 통과하고 workflow 간선이 실제 동작 간선이다', async () => {
  const { validateSummary } = await import('../skills/docent/scripts/src/lib/schema.mjs');
  const summary = await readJson(join(EXP, 'summary.json'));
  const r = validateSummary(summary);
  assert.ok(r.valid, r.errors.join('\n'));
  for (const wf of summary.workflows) {
    for (let i = 0; i + 1 < wf.steps.length; i++) {
      const [a, b] = [wf.steps[i], wf.steps[i + 1]];
      const viaAction = screens.get(a).actions.some((x) => x.navigatesTo === b || x.opens === b);
      const closeToParent = screens.get(a).parentId === b; // 하위 화면을 닫고 부모로 돌아감
      assert.ok(viaAction || closeToParent, `${wf.name}: ${a} → ${b}`);
    }
  }
});

test('골든 서술은 합니다체다', () => {
  for (const s of screens.values()) {
    assert.match(s.purpose.value, /니다$/, s.id);
    for (const a of s.actions) assert.match(a.effect, /니다\.?$/, `${s.id} ${a.label}`);
  }
});
