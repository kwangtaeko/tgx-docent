import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const HOOK = resolve('hooks/block-secrets.mjs');

async function project({ session, config } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-hook-'));
  await mkdir(join(dir, '.docent'));
  if (session) await writeFile(join(dir, '.docent', '.session'), session.toISOString() + '\n');
  if (config) await writeFile(join(dir, '.docent', 'config.yaml'), config);
  return dir;
}

function hook(cwd, tool_name, tool_input) {
  return spawnSync('node', [HOOK], { input: JSON.stringify({ cwd, tool_name, tool_input }), encoding: 'utf8' });
}

test('세션이 없으면 막지 않는다', async () => {
  const dir = await project();
  assert.equal(hook(dir, 'Read', { file_path: join(dir, '.env') }).status, 0);
});

test('세션 중에는 비밀 파일을 막는다', async () => {
  const dir = await project({ session: new Date() });
  const r = hook(dir, 'Read', { file_path: join(dir, '.env') });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /\.env/);
  assert.equal(hook(dir, 'Read', { file_path: join(dir, 'config/appsettings.Production.json') }).status, 2);
  assert.equal(hook(dir, 'Read', { file_path: 'web.config' }).status, 2);
  assert.equal(hook(dir, 'Glob', { pattern: '**/.env*' }).status, 2);
  assert.equal(hook(dir, 'Grep', { pattern: 'password', path: join(dir, 'web.config') }).status, 2);
  assert.equal(hook(dir, 'Read', { file_path: join(dir, 'lib/store.ts') }).status, 0);
  assert.equal(hook(dir, 'Read', { file_path: join(dir, '.env.example') }).status, 0);
  assert.equal(hook(dir, 'Grep', { pattern: 'process.env', path: dir }).status, 0);
});

test('12시간 넘은 세션은 무시한다', async () => {
  const dir = await project({ session: new Date(Date.now() - 13 * 3600_000) });
  assert.equal(hook(dir, 'Read', { file_path: join(dir, '.env') }).status, 0);
});

test('config.yaml의 secrets.paths를 더한다', async () => {
  const dir = await project({ session: new Date(), config: 'secrets:\n  paths:\n    - secrets/*.json\n' });
  assert.equal(hook(dir, 'Read', { file_path: join(dir, 'secrets/a.json') }).status, 2);
  assert.equal(hook(dir, 'Read', { file_path: join(dir, 'other/a.json') }).status, 0);
});

test('입력이 깨져도 막지 않고 끝난다', () => {
  const r = spawnSync('node', [HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
});

test('Grep의 glob 인자로 비밀 파일을 겨냥하면 막는다', async () => {
  const dir = await project({ session: new Date() });
  assert.equal(hook(dir, 'Grep', { pattern: 'KEY', glob: '.env*' }).status, 2);
  assert.equal(hook(dir, 'Grep', { pattern: 'KEY', glob: '*.ts' }).status, 0);
});

test('./로 시작하는 경로도 디렉터리 패턴과 맞춘다', async () => {
  const dir = await project({ session: new Date(), config: 'secrets:\n  paths:\n    - config/secret.yml\n' });
  assert.equal(hook(dir, 'Read', { file_path: './config/secret.yml' }).status, 2);
  assert.equal(hook(dir, 'Read', { file_path: 'config/./secret.yml' }).status, 2);
  assert.equal(hook(dir, 'Read', { file_path: 'config/other.yml' }).status, 0);
});

test('앱 작업(.docent/apps/*/config.yaml)의 secrets.paths도 더한다', async () => {
  const dir = await project({ session: new Date() });
  await mkdir(join(dir, '.docent', 'apps', 'admin'), { recursive: true });
  await writeFile(join(dir, '.docent', 'apps', 'admin', 'config.yaml'), 'secrets:\n  paths:\n    - admin.secret.json\n');
  assert.equal(hook(dir, 'Read', { file_path: join(dir, 'admin.secret.json') }).status, 2);
});
