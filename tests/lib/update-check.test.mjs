import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkForUpdate, installedVersion, isNewer } from '../../skills/docent/scripts/src/lib/update-check.mjs';

const fakeFetch = (version, calls) => async (url) => {
  calls.push(url);
  return { ok: true, json: async () => ({ version }) };
};
const env = async () => ({ DOCENT_CACHE_DIR: await mkdtemp(join(tmpdir(), 'docent-upd-')) });
const withCache = async (fn) => {
  const e = await env();
  const before = process.env.DOCENT_CACHE_DIR;
  process.env.DOCENT_CACHE_DIR = e.DOCENT_CACHE_DIR;
  try {
    return await fn(e);
  } finally {
    if (before === undefined) delete process.env.DOCENT_CACHE_DIR;
    else process.env.DOCENT_CACHE_DIR = before;
  }
};

test('버전 비교와 설치된 버전(plugin.json)', async () => {
  assert.equal(isNewer('1.2.10', '1.2.9'), true);
  assert.equal(isNewer('1.0.0', '1.0.0'), false);
  assert.equal(isNewer('0.9.9', '1.0.0'), false);
  assert.equal(isNewer('v2', '1.0.0'), false);
  const plugin = JSON.parse(await readFile('.claude-plugin/plugin.json', 'utf8'));
  assert.equal(installedVersion(), plugin.version);
});

test('새 버전이 있으면 알리고, 하루 안에는 다시 묻지 않는다', async () => {
  await withCache(async (e) => {
    const calls = [];
    const now = Date.UTC(2026, 9, 17);
    assert.deepEqual(await checkForUpdate({ now, fetchImpl: fakeFetch('1.1.0', calls), current: '1.0.0', env: e }), { current: '1.0.0', latest: '1.1.0' });
    assert.deepEqual(await checkForUpdate({ now: now + 3600_000, fetchImpl: fakeFetch('9.9.9', calls), current: '1.0.0', env: e }), { current: '1.0.0', latest: '1.1.0' });
    assert.equal(calls.length, 1);
    await checkForUpdate({ now: now + 25 * 3600_000, fetchImpl: fakeFetch('1.1.0', calls), current: '1.0.0', env: e });
    assert.equal(calls.length, 2);
  });
});

test('최신이거나, 끄거나, CI거나, 네트워크가 실패하면 조용히 넘어간다', async () => {
  await withCache(async (e) => {
    const calls = [];
    assert.equal(await checkForUpdate({ fetchImpl: fakeFetch('1.0.0', calls), current: '1.0.0', env: e }), undefined);
    assert.equal(await checkForUpdate({ fetchImpl: fakeFetch('2.0.0', calls), current: '1.0.0', env: { ...e, DOCENT_NO_UPDATE_CHECK: '1' } }), undefined);
    assert.equal(await checkForUpdate({ fetchImpl: fakeFetch('2.0.0', calls), current: '1.0.0', env: { ...e, CI: 'true' } }), undefined);
  });
  await withCache(async (e) => {
    const broken = async () => {
      throw new Error('offline');
    };
    assert.equal(await checkForUpdate({ fetchImpl: broken, current: '1.0.0', env: e }), undefined);
  });
});
