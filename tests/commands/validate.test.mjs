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

test('선택지가 근거 근처에 없으면 실패', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const s = await readJsonFile(path);
  s.fields[0].options = ['소스에 없는 선택지'];
  await writeJsonFile(path, s);
  const { ok, problems } = await runValidate(dir);
  assert.equal(ok, false);
  assert.ok(problems.some((p) => p.includes('소스에 없는 선택지')), problems.join('\n'));
});

test('view는 부모로 닫혀 돌아가는 연결이 아니다(모달·팝업만)', async () => {
  const { dir, docent } = await golden();
  const inventory = await readJsonFile(join(docent, 'inventory.json'));
  const child = inventory.screens.find((s) => s.parentId);
  const summary = await readJsonFile(join(docent, 'summary.json'));
  summary.workflows.push({ name: '닫고 돌아감', description: '하위 화면에서 부모로', steps: [child.id, child.parentId] });
  await writeJsonFile(join(docent, 'summary.json'), summary);
  assert.deepEqual((await runValidate(dir)).problems, []);
  const path = join(docent, 'screens', `${child.id}.json`);
  const screen = await readJsonFile(path);
  screen.kind = 'view';
  await writeJsonFile(path, screen);
  child.kind = 'view';
  await writeJsonFile(join(docent, 'inventory.json'), inventory);
  // 부모가 메뉴에 있으면 메뉴로 옮겨 가는 연결이다
  assert.deepEqual((await runValidate(dir)).problems, []);
  // 메뉴에도 없으면 연결이 없다
  const parentPath = join(docent, 'screens', `${child.parentId}.json`);
  const parent = await readJsonFile(parentPath);
  delete parent.menuPath;
  await writeJsonFile(parentPath, parent);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.includes(`${child.id} → ${child.parentId}`)), problems.join('\n'));
});

test('effectEvidence: 위치가 있어야 하고 파일은 readFiles에 있어야 한다', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const s = await readJsonFile(path);
  const file = s.readFiles[0];
  s.actions[0].effectEvidence = [`${file}:1`];
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);

  s.actions[0].effectEvidence = [`${file}:99999`];
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('99999')));

  s.actions[0].effectEvidence = ['package.json:1'];
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('effectEvidence') && p.includes('package.json')));
});

test('menuPath: 이름마다 근거(evidence·moreEvidence) 중 한 곳 근처에 글자가 있어야 한다', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const s = await readJsonFile(path);
  s.menuPath.value = ['주문관리', '거래처 등록'];
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('"거래처 등록"')));

  // 다른 파일의 근거를 더하면 통과, 그 파일은 readFiles에 있어야 한다
  s.menuPath.value = ['주문관리', '거래처를 선택하세요.'];
  s.menuPath.moreEvidence = ['lib/order-schema.ts:4'];
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);
  s.menuPath.moreEvidence = ['package.json:1'];
  await writeJsonFile(path, s);
  const problems = (await runValidate(dir)).problems;
  assert.ok(problems.some((p) => p.includes('readFiles') && p.includes('package.json')), problems.join('\n'));
});

test('optionsEvidence가 있으면 선택지를 그 근처에서 찾는다', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const s = await readJsonFile(path);
  s.fields[0].options = ['납기일을 입력하세요.'];
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.length > 0);
  s.fields[0].optionsEvidence = 'lib/order-schema.ts:5';
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);
  // 선택지가 두 곳에 나뉘어 있으면 각각 한 곳에서 찾으면 된다(라벨 옆의 첫 선택지 + 상수)
  s.fields[0].options = ['거래처', '납기일을 입력하세요.'];
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);
  s.fields[0].options = ['거래처', '없는 선택지'];
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('없는 선택지')));
});

test('unlabeled 동작은 라벨 글자를 찾지 않고, section은 sections의 제목이어야 한다', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const s = await readJsonFile(path);
  s.actions[0].label = '행 클릭';
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('행 클릭')));
  s.actions[0].unlabeled = true;
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);

  s.actions[0].section = '없는 구획';
  await writeJsonFile(path, s);
  assert.ok((await runValidate(dir)).problems.some((p) => p.includes('"없는 구획"')));
  s.sections = [{ title: '없는 구획', evidence: s.actions[0].evidence }];
  await writeJsonFile(path, s);
  assert.deepEqual((await runValidate(dir)).problems, []);
});

test('워크플로우: 메뉴에 있는 화면으로는 메뉴 이동 연결, 창에서 바로는 안 된다', async () => {
  const { edgeKind } = await import('../../skills/docent/scripts/src/lib/workflow.mjs');
  const screens = new Map([
    ['a', { kind: 'page', actions: [{ label: 'x', opens: 'a--m' }], menuPath: { value: ['A'] } }],
    ['a--m', { kind: 'modal', parentId: 'a', actions: [] }],
    ['b', { kind: 'page', actions: [], menuPath: { value: ['B'] } }],
    ['c', { kind: 'page', actions: [] }],
    ['v', { kind: 'view', parentId: 'b', actions: [] }],
  ]);
  assert.equal(edgeKind(screens, 'a', 'a--m'), 'action');
  assert.equal(edgeKind(screens, 'a--m', 'a'), 'action');
  assert.equal(edgeKind(screens, 'a', 'b'), 'menu');
  assert.equal(edgeKind(screens, 'a--m', 'b'), undefined); // 창을 닫고 돌아간 뒤에 메뉴로
  assert.equal(edgeKind(screens, 'a', 'c'), undefined); // 메뉴에 없는 화면
  assert.equal(edgeKind(screens, 'v', 'b'), 'menu');
  assert.equal(edgeKind(screens, 'a', 'a'), undefined); // 같은 화면에 머무는 단계 // view의 부모는 닫고 돌아감이 아니지만 메뉴에 있으면 메뉴 이동
});
