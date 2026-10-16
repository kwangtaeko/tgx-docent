import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../skills/docent/scripts/src/commands/init.mjs';
import { loadConfig } from '../../skills/docent/scripts/src/lib/config.mjs';
import { copyFixture } from '../helpers/fixture.mjs';
import { project } from '../helpers/project.mjs';

test('Next.js 프로젝트에서 설정과 .gitignore를 만든다', async () => {
  const dir = await copyFixture();
  assert.deepEqual(await runInit(dir), { created: true, detectors: ['nextjs'] });
  assert.deepEqual((await loadConfig(dir)).detectors, ['nextjs']);
  const ignore = (await readFile(join(dir, '.docent', '.gitignore'), 'utf8')).split('\n');
  for (const line of ['auth/', 'out/', '.session']) assert.ok(ignore.includes(line), line);
});

test('이미 설정이 있으면 덮어쓰지 않는다', async () => {
  const dir = await copyFixture();
  await runInit(dir);
  const before = await readFile(join(dir, '.docent', 'config.yaml'), 'utf8');
  assert.deepEqual(await runInit(dir), { created: false, detectors: ['nextjs'] });
  assert.equal(await readFile(join(dir, '.docent', 'config.yaml'), 'utf8'), before);
});

test('package.json이 없어도 실패하지 않는다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-init-'));
  assert.deepEqual(await runInit(dir), { created: true, detectors: [] });
  assert.deepEqual((await loadConfig(dir)).detectors, []);
});

test('예전 .gitignore에 빠진 줄만 덧붙인다', async () => {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const dir = await mkdtemp(join(tmpdir(), 'docent-init-'));
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', '.gitignore'), 'auth/\nout/\n.session\nmine/\n');
  await runInit(dir);
  const lines = (await readFile(join(dir, '.docent', '.gitignore'), 'utf8')).split('\n');
  for (const l of ['auth/', 'out/', '.session', 'mine/', 'media/', 'run.log', '.run-pid', '.run-approved']) assert.ok(lines.includes(l), l);
  assert.equal(lines.filter((l) => l === 'auth/').length, 1);
});

test('설정 템플릿에 auth·mask·gif 예시가 주석으로 있다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-init-'));
  await runInit(dir);
  const text = await readFile(join(dir, '.docent', 'config.yaml'), 'utf8');
  for (const key of ['# auth:', '#   loginPath:', '#     - label:', '#       env:', '#   submit:', '# mask:', '# gif:']) assert.ok(text.includes(key), key);
});

const NEXT_APP = { 'package.json': '{"dependencies":{"next":"15"}}', 'app/page.tsx': 'export default function Home() {}\n' };
const prefixed = (prefix, files) => Object.fromEntries(Object.entries(files).map(([k, v]) => [`${prefix}/${k}`, v]));

test('모노레포에서 앱이 하나면 그 폴더를 app으로 쓴다', async () => {
  const dir = await project({ 'package.json': '{"private":true,"workspaces":["apps/*","packages/*"]}', ...prefixed('apps/web', NEXT_APP), 'packages/ui/package.json': '{"dependencies":{"react":"19"}}' });
  assert.deepEqual(await runInit(dir), { created: true, detectors: ['nextjs'], app: 'apps/web' });
  const config = await loadConfig(dir);
  assert.equal(config.app, 'apps/web');
  assert.deepEqual(config.detectors, ['nextjs']);
});

test('앱이 여럿이면 설정을 만들지 않고 후보를 돌려준다, --app으로 고른다', async () => {
  const dir = await project({
    'package.json': '{"private":true}',
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - '!apps/legacy'\n",
    ...prefixed('apps/web', NEXT_APP),
    'apps/admin/package.json': '{"dependencies":{"vue-router":"4"}}',
  });
  assert.deepEqual(await runInit(dir), { created: false, detectors: [], apps: [{ dir: 'apps/admin', detectors: ['vue'] }, { dir: 'apps/web', detectors: ['nextjs'] }] });
  await assert.rejects(readFile(join(dir, '.docent', 'config.yaml')));
  assert.deepEqual(await runInit(dir, { app: './apps/admin/' }), { created: true, detectors: ['vue'], app: 'apps/admin' });
  assert.equal((await loadConfig(dir)).app, 'apps/admin');
  assert.deepEqual(await runInit(dir), { created: false, detectors: ['vue'], app: 'apps/admin' });
});

test('--app이 없는 폴더나 프로젝트 밖이면 오류', async () => {
  const dir = await project({ 'package.json': '{}' });
  await assert.rejects(runInit(dir, { app: 'apps/none' }), /폴더가 없습니다/);
  await assert.rejects(runInit(dir, { app: '../x' }), /프로젝트 안의 폴더/);
});

test('루트에서 감지되면 하위 앱은 찾지 않는다', async () => {
  const dir = await project({ ...NEXT_APP, ...prefixed('apps/admin', NEXT_APP) });
  assert.deepEqual(await runInit(dir), { created: true, detectors: ['nextjs'] });
});
