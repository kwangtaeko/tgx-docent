import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashFiles } from '../../skills/docent/scripts/src/lib/source-hash.mjs';

async function dirWith(files) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-hash-'));
  for (const [name, content] of Object.entries(files)) await writeFile(join(dir, name), content);
  return dir;
}

test('순서와 무관하다', async () => {
  const dir = await dirWith({ 'a.ts': 'a', 'b.ts': 'b' });
  assert.equal(await hashFiles(dir, ['a.ts', 'b.ts']), await hashFiles(dir, ['b.ts', 'a.ts']));
});

test('CRLF와 LF는 같은 해시', async () => {
  const crlf = await dirWith({ 'a.ts': 'x\r\ny\r\n' });
  const lf = await dirWith({ 'a.ts': 'x\ny\n' });
  assert.equal(await hashFiles(crlf, ['a.ts']), await hashFiles(lf, ['a.ts']));
});

test('내용이 바뀌면 해시가 바뀐다', async () => {
  const one = await dirWith({ 'a.ts': 'x' });
  const two = await dirWith({ 'a.ts': 'y' });
  assert.notEqual(await hashFiles(one, ['a.ts']), await hashFiles(two, ['a.ts']));
});

test('경로도 해시에 들어간다', async () => {
  const dir = await dirWith({ 'a.ts': 'x', 'b.ts': 'x' });
  assert.notEqual(await hashFiles(dir, ['a.ts']), await hashFiles(dir, ['b.ts']));
});

test('형식', async () => {
  const dir = await dirWith({ 'a.ts': 'x' });
  assert.match(await hashFiles(dir, ['a.ts']), /^sha256:[0-9a-f]{64}$/);
});

test('없는 파일은 경로를 담은 에러', async () => {
  const dir = await dirWith({});
  await assert.rejects(hashFiles(dir, ['missing.ts']), /missing\.ts/);
});

test('경로 표기가 달라도 같은 파일이면 같은 해시', async () => {
  const dir = await dirWith({ 'a.ts': 'x' });
  assert.equal(await hashFiles(dir, ['./a.ts']), await hashFiles(dir, ['a.ts']));
  assert.equal(await hashFiles(dir, ['a.ts', 'a.ts']), await hashFiles(dir, ['a.ts']));
});

test('루트 밖 경로는 읽지 않고 에러', async () => {
  const dir = await dirWith({});
  await assert.rejects(hashFiles(dir, ['../a.ts']));
});
