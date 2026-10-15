import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runValidate } from '../../skills/docent/scripts/src/commands/validate.mjs';
import { copyFixture, copyGoldenWorkspace, readJsonFile, writeJsonFile } from '../helpers/fixture.mjs';

async function golden() {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  return { dir, docent };
}

test('골든 그대로면 통과', async () => {
  const { dir } = await golden();
  assert.deepEqual(await runValidate(dir), { ok: true, problems: [] });
});

test('깨진 화면 파일은 그 파일만 보고하고 나머지 검사는 계속한다', async () => {
  const { dir, docent } = await golden();
  await writeFile(join(docent, 'screens', 'login.json'), '{');
  const { ok, problems } = await runValidate(dir);
  assert.equal(ok, false);
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0], /login\.json/);
});

test('workflow 간선이 실제 동작에 없으면 실패', async () => {
  const { dir, docent } = await golden();
  const summary = await readJsonFile(join(docent, 'summary.json'));
  summary.workflows.push({ name: '잘못된 흐름', description: '없는 연결', steps: ['orders', 'orders-id-edit'] });
  await writeJsonFile(join(docent, 'summary.json'), summary);
  const { ok, problems } = await runValidate(dir);
  assert.equal(ok, false);
  assert.ok(problems.some((p) => p.includes('orders → orders-id-edit')), problems.join('\n'));
});

test('확신도 낮은 화면만으로 뒷받침되는 기능은 실패', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'admin-users.json');
  const screen = await readJsonFile(path);
  screen.purpose.confidence = 'low';
  await writeJsonFile(path, screen);
  const summary = await readJsonFile(join(docent, 'summary.json'));
  summary.features.push({ menu: '관리자', value: '권한을 바꿉니다', screens: ['admin-users'] });
  await writeJsonFile(join(docent, 'summary.json'), summary);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.includes('summary.json') && p.includes('권한을 바꿉니다')), problems.join('\n'));
});

test('소스가 바뀌면 다시 분석하라고 알린다', async () => {
  const { dir } = await golden();
  await appendFile(join(dir, 'lib', 'store.ts'), '\n// changed\n');
  const { ok, problems } = await runValidate(dir);
  assert.equal(ok, false);
  assert.ok(problems.some((p) => p.startsWith('orders:') && p.includes('다시 분석')), problems.join('\n'));
});

test('summary의 없는 화면 ID와 inventory·screens 불일치', async () => {
  const { dir, docent } = await golden();
  const summary = await readJsonFile(join(docent, 'summary.json'));
  summary.oneLiner.screens.push('ghost');
  await writeJsonFile(join(docent, 'summary.json'), summary);
  const inv = await readJsonFile(join(docent, 'inventory.json'));
  inv.screens = inv.screens.filter((s) => s.id !== 'home');
  await writeJsonFile(join(docent, 'inventory.json'), inv);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.includes('ghost')), problems.join('\n'));
  assert.ok(problems.some((p) => p.includes('home')), problems.join('\n'));
});

test('라벨 문구가 근거 근처에 없으면 실패', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'login.json');
  const screen = await readJsonFile(path);
  screen.fields[0].label = '사용자 ID';
  await writeJsonFile(path, screen);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.startsWith('login:') && p.includes('사용자 ID')), problems.join('\n'));
});

test('화면이 하나뿐인 워크플로우는 실패', async () => {
  const { dir, docent } = await golden();
  const summary = await readJsonFile(join(docent, 'summary.json'));
  const path = join(docent, 'screens', 'admin-users.json');
  const screen = await readJsonFile(path);
  screen.actions[0].navigatesTo = 'admin-users';
  await writeJsonFile(path, screen);
  summary.workflows.push({ name: '권한 변경', description: '같은 화면', steps: ['admin-users', 'admin-users'] });
  await writeJsonFile(join(docent, 'summary.json'), summary);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.includes('권한 변경') && p.includes('화면 2개 이상')), problems.join('\n'));
});

test('null 같은 객체가 아닌 JSON도 문제로 보고한다', async () => {
  const { dir, docent } = await golden();
  await writeFile(join(docent, 'summary.json'), 'null');
  await writeFile(join(docent, 'screens', 'login.json'), 'null');
  const { ok, problems } = await runValidate(dir);
  assert.equal(ok, false);
  assert.ok(problems.some((p) => p.startsWith('summary.json')), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('screens/login.json')), problems.join('\n'));
});

test('화면 ID를 주면 그 화면의 문제만 본다', async () => {
  const { dir, docent } = await golden();
  const { rm } = await import('node:fs/promises');
  await rm(join(docent, 'screens', 'orders.json'));
  await rm(join(docent, 'summary.json'));
  assert.equal((await runValidate(dir)).ok, false);
  assert.deepEqual(await runValidate(dir, { only: ['login'] }), { ok: true, problems: [] });
  const r = await runValidate(dir, { only: ['orders'] });
  assert.equal(r.ok, false);
  assert.ok(r.problems.every((p) => p.startsWith('orders:') || p.includes('screens/orders.json')), r.problems.join('\n'));
});

test('없는 화면 ID나 깨진 inventory는 화면 하나만 검사해도 문제로 보인다', async () => {
  const { dir, docent } = await golden();
  const r = await runValidate(dir, { only: ['no-such-screen'] });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /no-such-screen/);
  await writeFile(join(docent, 'inventory.json'), '{');
  assert.equal((await runValidate(dir, { only: ['login'] })).ok, false);
});
