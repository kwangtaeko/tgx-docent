import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXPECTED, readJsonFile, writeJsonFile } from './helpers/fixture.mjs';

function compare(actual, expected) {
  return spawnSync('node', ['scripts/compare-golden.mjs', actual, expected], { encoding: 'utf8' });
}

test('골든 대 골든은 100%', () => {
  const r = compare(EXPECTED, EXPECTED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /일치율 100%/);
});

test('빠진 입력 항목과 화면을 보고한다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-cmp-'));
  await cp(EXPECTED, dir, { recursive: true });
  const path = join(dir, 'screens', 'login.json');
  const screen = await readJsonFile(path);
  screen.fields = screen.fields.filter((f) => f.label !== '비밀번호');
  await writeJsonFile(path, screen);
  const inv = await readJsonFile(join(dir, 'inventory.json'));
  inv.screens = inv.screens.filter((s) => s.id !== 'home');
  await writeJsonFile(join(dir, 'inventory.json'), inv);
  const r = compare(dir, EXPECTED);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /login.*비밀번호/);
  assert.match(r.stdout, /home/);
  assert.doesNotMatch(r.stdout, /일치율 100%/);
});
