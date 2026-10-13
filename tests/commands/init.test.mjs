import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../skills/docent/scripts/src/commands/init.mjs';
import { loadConfig } from '../../skills/docent/scripts/src/lib/config.mjs';
import { copyFixture } from '../helpers/fixture.mjs';

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
