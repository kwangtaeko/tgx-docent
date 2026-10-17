import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { copyFixture, EXPECTED, writeAgentModal } from './helpers/fixture.mjs';

const CLI = resolve('skills/docent/scripts/dist/docent.mjs');

function run(args, cwd) {
  // 새 버전 확인(네트워크)은 테스트에서 끈다
  return spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DOCENT_NO_UPDATE_CHECK: '1' } });
}

test('번들 CLI로 init → inventory → validate → build', async () => {
  const dir = await copyFixture();
  let r = run(['init'], dir);
  assert.equal(r.status, 0, r.stderr);
  await writeAgentModal(dir);
  r = run(['inventory', '--project', dir], '/');
  assert.equal(r.status, 0, r.stderr);
  const docent = join(dir, '.docent');
  await cp(join(EXPECTED, 'screens'), join(docent, 'screens'), { recursive: true });
  await cp(join(EXPECTED, 'summary.json'), join(docent, 'summary.json'));
  r = run(['validate'], dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  r = run(['review'], dir);
  assert.equal(r.status, 0, r.stderr);
  r = run(['build'], dir);
  assert.equal(r.status, 0, r.stderr);
  assert.ok((await stat(join(docent, 'out', 'html', 'assets', 'mermaid.min.js'))).size > 100_000);
  assert.ok((await readFile(join(docent, 'out', 'README.md'), 'utf8')).startsWith('# nextjs-sample'));
});

test('validate 실패는 exit 1', async () => {
  const dir = await copyFixture();
  run(['init'], dir);
  await writeFile(join(dir, '.docent', 'inventory.json'), '{');
  const r = run(['validate'], dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /inventory\.json/);
});

test('session start/end', async () => {
  const dir = await copyFixture();
  run(['init'], dir);
  assert.equal(run(['session', 'start'], dir).status, 0);
  assert.match(await readFile(join(dir, '.docent', '.session'), 'utf8'), /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(run(['session', 'end'], dir).status, 0);
  await assert.rejects(stat(join(dir, '.docent', '.session')));
});

test('알 수 없는 명령은 exit 2', () => {
  const r = run(['nope'], '.');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /사용법/);
});

test('hash는 hashFiles와 같은 값을 출력한다', async () => {
  const dir = await copyFixture();
  const r = run(['hash', 'app/login/page.tsx', './lib/auth.ts'], dir);
  assert.equal(r.status, 0, r.stderr);
  const { hashFiles } = await import('../skills/docent/scripts/src/lib/source-hash.mjs');
  assert.equal(r.stdout.trim(), await hashFiles(dir, ['app/login/page.tsx', 'lib/auth.ts']));
});

test('runtime status는 찾은 Playwright 위치를 보여 준다', () => {
  const r = run(['runtime', 'status'], '.');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1\.56\.1/);
});

test('build --preset portfolio --format html', async () => {
  const dir = await copyFixture();
  run(['init'], dir);
  await writeAgentModal(dir);
  run(['inventory'], dir);
  const docent = join(dir, '.docent');
  await cp(join(EXPECTED, 'screens'), join(docent, 'screens'), { recursive: true });
  await cp(join(EXPECTED, 'summary.json'), join(docent, 'summary.json'));
  const r = run(['build', '--preset', 'portfolio', '--format', 'html'], dir);
  assert.equal(r.status, 0, r.stderr);
  await assert.rejects(stat(join(docent, 'out', 'html', 'screens')));
  await assert.rejects(stat(join(docent, 'out', 'README.md')));
});

test('--format 값이 비면 실패 코드', async () => {
  const dir = await copyFixture();
  run(['init'], dir);
  await writeAgentModal(dir);
  run(['inventory'], dir);
  const docent = join(dir, '.docent');
  await cp(join(EXPECTED, 'screens'), join(docent, 'screens'), { recursive: true });
  await cp(join(EXPECTED, 'summary.json'), join(docent, 'summary.json'));
  const r = run(['build', '--format', ','], dir);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout + r.stderr, /만들 형식이 없습니다/);
});

test('--workspace: 앱 작업 폴더(.docent/apps/<이름>/)에서 init → inventory, 세션 표시는 루트에', async () => {
  const dir = await copyFixture();
  let r = run(['init', '--workspace', 'web'], dir);
  assert.equal(r.status, 0, r.stderr);
  await stat(join(dir, '.docent', 'apps', 'web', 'config.yaml'));
  r = run(['inventory', '--workspace', 'web'], dir);
  assert.equal(r.status, 0, r.stderr);
  await stat(join(dir, '.docent', 'apps', 'web', 'inventory.json'));
  r = run(['session', 'start', '--workspace', 'web'], dir);
  assert.equal(r.status, 0, r.stderr);
  await stat(join(dir, '.docent', '.session'));
  r = run(['inventory', '--workspace', 'Bad_Name'], dir);
  assert.equal(r.status, 1);
});
