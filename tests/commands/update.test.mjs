import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, appendFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runBuild } from '../../skills/docent/scripts/src/commands/build.mjs';
import { runUpdate } from '../../skills/docent/scripts/src/commands/update.mjs';
import { copyFixture, copyGoldenWorkspace, EXPECTED, writeAgentModal } from '../helpers/fixture.mjs';

async function golden() {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  await cp(join(EXPECTED, 'scenarios'), join(docent, 'scenarios'), { recursive: true });
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\ndetectors: [nextjs]\n');
  await writeAgentModal(dir);
  return { dir, docent };
}

test('변화가 없으면 할 일이 없다', async () => {
  const { dir } = await golden();
  assert.deepEqual(await runUpdate(dir), { added: [], removed: [], reanalyze: [], rescenario: [], recapture: [] });
});

test('공통 파일이 바뀌면 그 파일을 읽은 화면을 다시 분석하고, 캡처가 있는 화면만 다시 찍는다', async () => {
  const { dir, docent } = await golden();
  await mkdir(join(docent, 'media', 'img'), { recursive: true });
  await writeFile(join(docent, 'media', 'img', 'orders.png'), 'png');
  await appendFile(join(dir, 'lib', 'store.ts'), '\n// changed\n');
  const r = await runUpdate(dir);
  const ids = r.reanalyze.map((x) => x.id);
  assert.ok(ids.includes('orders') && ids.includes('home') && ids.includes('admin-users'));
  assert.ok(!ids.includes('login'));
  assert.ok(r.reanalyze.every((x) => x.reason === '소스 변경'));
  assert.deepEqual(r.recapture, ['orders']);
});

test('라우트가 사라지면 삭제 후보로 보고하고 자동으로 지우지 않으며, build에서 빠진다', async () => {
  const { dir, docent } = await golden();
  await rm(join(dir, 'app', 'admin', 'users'), { recursive: true });
  const r = await runUpdate(dir);
  assert.deepEqual(r.removed, ['admin-users']);
  await access(join(docent, 'screens', 'admin-users.json'));
  await access(join(docent, 'scenarios', 'admin-users.json'));
});

test('새 라우트는 added와 reanalyze(분석 결과 없음)', async () => {
  const { dir } = await golden();
  await mkdir(join(dir, 'app', 'reports'), { recursive: true });
  await writeFile(join(dir, 'app', 'reports', 'page.tsx'), 'export default function Reports() {\n  return <h2>보고서</h2>;\n}\n');
  const r = await runUpdate(dir);
  assert.deepEqual(r.added, ['reports']);
  assert.ok(r.reanalyze.some((x) => x.id === 'reports' && x.reason === '분석 결과 없음'));
});

test('build는 inventory에 없는 화면을 넣지 않는다', async () => {
  const { dir, docent } = await golden();
  await rm(join(dir, 'app', 'admin', 'users'), { recursive: true });
  await runUpdate(dir);
  // 사라진 화면의 분석 결과·summary 참조를 정리한 뒤 build
  await rm(join(docent, 'screens', 'admin-users.json'));
  await rm(join(docent, 'scenarios', 'admin-users.json'));
  const { readJsonFile, writeJsonFile } = await import('../helpers/fixture.mjs');
  const summary = await readJsonFile(join(docent, 'summary.json'));
  summary.features = summary.features.filter((f) => !f.screens.includes('admin-users'));
  await writeJsonFile(join(docent, 'summary.json'), summary);
  const { files } = await runBuild(dir, { assetsDir: 'skills/docent/assets', formats: ['html'] });
  assert.ok(!files.some((f) => f.includes('admin-users')));
});

test('삭제된 화면을 가리키는 화면도 다시 분석 대상', async () => {
  const { dir } = await golden();
  await rm(join(dir, 'app', 'orders', '[id]', 'edit'), { recursive: true });
  const r = await runUpdate(dir);
  assert.deepEqual(r.removed, ['orders-id-edit']);
  assert.ok(r.reanalyze.some((x) => x.id === 'orders-id' && x.reason === '삭제된 화면 참조'), JSON.stringify(r.reanalyze));
});
