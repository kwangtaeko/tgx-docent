import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { gifTargets, runScenarios } from '../../skills/docent/scripts/src/commands/scenarios.mjs';
import { runValidate } from '../../skills/docent/scripts/src/commands/validate.mjs';
import { DEFAULT_CONFIG } from '../../skills/docent/scripts/src/lib/config.mjs';
import { copyFixture, copyGoldenWorkspace, EXPECTED, readJsonFile, writeJsonFile } from '../helpers/fixture.mjs';
import { loadGolden } from '../helpers/golden.mjs';

const cfg = (screens) => ({ ...DEFAULT_CONFIG, gif: { screens } });

test('GIF 대상: 버튼 동작이 있는 화면, include·exclude', async () => {
  const { screens } = await loadGolden();
  const list = [...screens.values()];
  const all = gifTargets(list, DEFAULT_CONFIG);
  assert.deepEqual(all, list.filter((s) => s.actions.length).map((s) => s.id));
  assert.deepEqual(gifTargets(list, cfg({ include: ['orders-new'], exclude: [] })), ['orders-new']);
  assert.ok(!gifTargets(list, cfg({ include: [], exclude: ['login'] })).includes('login'));
});

async function golden({ scenarios = true } = {}) {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  if (scenarios) await cp(join(EXPECTED, 'scenarios'), join(docent, 'scenarios'), { recursive: true });
  return { dir, docent };
}

test('시나리오가 없으면 경로가 필요한 화면과 GIF 대상을 알려 준다', async () => {
  const { dir } = await golden({ scenarios: false });
  const list = await runScenarios(dir);
  const reasons = Object.fromEntries(list.map((x) => [x.id, x.reason]));
  assert.equal(reasons['orders-id'], '캡처 경로 필요');
  assert.equal(reasons['orders-new--customer-search'], '캡처 경로 필요');
  assert.equal(reasons['orders-new'], 'GIF 대상');
});

test('골든 시나리오가 있으면 할 일이 없다', async () => {
  const { dir } = await golden();
  assert.deepEqual(await runScenarios(dir), []);
  assert.deepEqual(await runValidate(dir), { ok: true, problems: [] });
});

test('화면이 바뀌면 시나리오가 낡음, locked면 제외', async () => {
  const { dir, docent } = await golden();
  const path = join(docent, 'screens', 'orders-new.json');
  const screen = await readJsonFile(path);
  const scPath = join(docent, 'scenarios', 'orders-new.json');
  const sc = await readJsonFile(scPath);
  sc.sourceHash = 'sha256:' + 'c'.repeat(64);
  await writeJsonFile(scPath, sc);
  assert.deepEqual(await runScenarios(dir), [{ id: 'orders-new', reason: '낡음' }]);
  await writeJsonFile(scPath, { ...sc, locked: true });
  assert.deepEqual(await runScenarios(dir), []);
  assert.ok(screen);
});

test('시나리오 단계의 근거가 맞지 않으면 validate 실패', async () => {
  const { dir, docent } = await golden();
  const scPath = join(docent, 'scenarios', 'orders-new.json');
  const sc = await readJsonFile(scPath);
  sc.steps[0].label = '거래처 검색';
  await writeJsonFile(scPath, sc);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.startsWith('scenarios/orders-new.json') && p.includes('거래처 검색')), problems.join('\n'));
});

test('없는 화면의 시나리오와 파일명 불일치', async () => {
  const { dir, docent } = await golden();
  const sc = await readJsonFile(join(docent, 'scenarios', 'orders-new.json'));
  await writeJsonFile(join(docent, 'scenarios', 'ghost.json'), { ...sc, screenId: 'ghost' });
  await writeJsonFile(join(docent, 'scenarios', 'other.json'), sc);
  const { problems } = await runValidate(dir);
  assert.ok(problems.some((p) => p.includes('ghost')), problems.join('\n'));
  assert.ok(problems.some((p) => p.startsWith('scenarios/other.json')), problems.join('\n'));
  await rm(join(docent, 'scenarios', 'ghost.json'));
  await mkdir(join(docent, 'scenarios'), { recursive: true });
});

test('GIF 대상: 글자 없는 동작(행 클릭)만 있는 화면은 뺀다', () => {
  const list = [{ id: 'a', actions: [{ label: '행 클릭', unlabeled: true }] }, { id: 'b', actions: [{ label: '저장' }] }];
  assert.deepEqual(gifTargets(list, DEFAULT_CONFIG), ['b']);
});
