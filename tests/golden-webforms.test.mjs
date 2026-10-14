import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { goldenSuite, inventoryFromAgent, loadExpected } from './helpers/golden-suite.mjs';

const ROOT = 'fixtures/webforms-sample';
const EXP = 'fixtures/expected/webforms-sample';

goldenSuite({
  root: ROOT,
  expected: EXP,
  pages: 5,
  children: 0,
  edges: ['account-login->default', 'orders-list->orders-edit', 'orders-edit->orders-list'],
});

const golden = await loadExpected(EXP);

test('에이전트 탐색 결과가 inventory 명령을 통과한다', async () => {
  const { inventory, problems } = await inventoryFromAgent(ROOT, EXP);
  assert.deepEqual(problems, []);
  assert.deepEqual(inventory, golden.inventory);
});

test('.aspx 확장자는 화면 ID에서 빠진다', () => {
  assert.deepEqual(golden.inventory.screens.map((s) => s.id).sort(), ['account-login', 'admin-users', 'default', 'orders-edit', 'orders-list']);
});

test('메뉴 근거는 Web.sitemap', () => {
  const withMenu = [...golden.screens.values()].filter((s) => s.menuPath);
  assert.ok(withMenu.length >= 3);
  for (const s of withMenu) assert.match(s.menuPath.evidence, /^Web\.sitemap:/, s.id);
});

test('어떤 골든의 readFiles·files에도 web.config가 없다', () => {
  const all = [...golden.inventory.screens.flatMap((s) => s.files), ...[...golden.screens.values()].flatMap((s) => s.readFiles)];
  assert.ok(!all.some((f) => /(^|\/)web\.config$/i.test(f)), all.join());
});

test('실행하지 않으므로 시나리오가 없고, DB 의존은 확인 필요로 남는다', () => {
  assert.deepEqual(golden.scenarios, []);
  const list = golden.screens.get('orders-list');
  assert.ok(list.unknowns.some((u) => /연결 문자열|DB|데이터베이스/.test(u)), list.unknowns.join());
  assert.ok([list.purpose, ...list.fields, ...list.actions].some((x) => x.confidence === 'low'));
});

test('훅이 픽스처의 web.config 읽기를 막는다', async () => {
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const cwd = await mkdtemp(join(tmpdir(), 'docent-wf-'));
  await mkdir(join(cwd, '.docent'));
  await writeFile(join(cwd, '.docent', '.session'), new Date().toISOString() + '\n');
  const r = spawnSync('node', [resolve('hooks/block-secrets.mjs')], {
    input: JSON.stringify({ cwd, tool_name: 'Read', tool_input: { file_path: resolve(ROOT, 'web.config') } }),
    encoding: 'utf8',
  });
  assert.equal(r.status, 2);
});
