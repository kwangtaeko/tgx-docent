import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { runRecord } from '../../skills/docent/scripts/src/commands/record.mjs';
import { readFailures } from '../../skills/docent/scripts/src/lib/media.mjs';
import { writeJsonFile } from '../helpers/fixture.mjs';
import { HASH, mediaProject, startMediaSite } from '../helpers/media-site.mjs';

const site = await startMediaSite();
after(() => site.close());

const SAVE = {
  screenId: 'home',
  path: '/',
  setup: [],
  steps: [
    { do: 'fill', label: '이름', value: '홍길동', evidence: 'x.ts:1' },
    { do: 'click', role: 'button', label: '저장', evidence: 'x.ts:1' },
    { do: 'expectText', text: '저장되었습니다.', evidence: 'x.ts:1' },
  ],
  sourceHash: HASH,
};

async function project(scenario, screenHash = HASH) {
  const dir = await mediaProject(site.url, { scenarios: { home: scenario } });
  await mkdir(join(dir, '.docent', 'screens'), { recursive: true });
  await writeJsonFile(join(dir, '.docent', 'screens', 'home.json'), { id: 'home', sourceHash: screenHash, actions: [{ label: '저장' }] });
  return dir;
}

const gifFrames = (buf) => {
  let n = 0;
  for (let i = 0; i + 1 < buf.length; i++) if (buf[i] === 0x21 && buf[i + 1] === 0xf9) n++;
  return n;
};

test('시나리오를 녹화해 GIF를 만든다', async () => {
  const dir = await project(SAVE);
  const r = await runRecord(dir, ['home']);
  assert.deepEqual(r.recorded, ['home']);
  const path = join(dir, '.docent', 'media', 'gif', 'home.gif');
  assert.ok((await stat(path)).size < 2 * 1024 * 1024);
  const { readFile } = await import('node:fs/promises');
  assert.ok(gifFrames(await readFile(path)) >= 5);
});

test('단계가 실패하면 GIF를 만들지 않고 단계 번호를 남긴다', async () => {
  const bad = structuredClone(SAVE);
  bad.steps[1].label = '전송';
  const dir = await project(bad);
  const r = await runRecord(dir, ['home']);
  assert.equal(r.failed.length, 1);
  await assert.rejects(access(join(dir, '.docent', 'media', 'gif', 'home.gif')));
  const [f] = await readFailures(dir);
  assert.deepEqual([f.id, f.kind, f.step], ['home', 'record', 1]);
  await access(join(dir, '.docent', 'media', 'fail', 'home.png'));
});

test('낡은 시나리오는 건너뛰고, locked면 녹화한다', async () => {
  const stale = 'sha256:' + 'b'.repeat(64);
  let dir = await project(SAVE, stale);
  let r = await runRecord(dir, ['home']);
  assert.deepEqual(r.skipped, [{ id: 'home', reason: '시나리오가 낡았습니다' }]);
  dir = await project({ ...SAVE, locked: true }, stale);
  r = await runRecord(dir, ['home']);
  assert.deepEqual(r.recorded, ['home']);
});

test('단계가 없는 시나리오는 GIF 대상이 아니다', async () => {
  const dir = await project({ ...SAVE, steps: [] });
  const r = await runRecord(dir, ['home']);
  assert.deepEqual(r.skipped, [{ id: 'home', reason: '보여 줄 조작 단계가 없습니다' }]);
});
