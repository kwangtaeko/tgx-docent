import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig, DEFAULT_CONFIG } from '../../skills/docent/scripts/src/lib/config.mjs';

async function project(yaml) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-cfg-'));
  if (yaml !== undefined) {
    await mkdir(join(dir, '.docent'));
    await writeFile(join(dir, '.docent', 'config.yaml'), yaml);
  }
  return dir;
}

test('설정 파일이 없으면 기본값', async () => {
  assert.deepEqual(await loadConfig(await project()), DEFAULT_CONFIG);
});

test('기본값 내용', () => {
  assert.equal(DEFAULT_CONFIG.language, 'ko');
  assert.deepEqual(DEFAULT_CONFIG.detectors, []);
  assert.equal(DEFAULT_CONFIG.analyze.concurrency, 4);
  for (const p of ['.env', '.env.*', 'appsettings*.json', 'web.config', '*.pem', '*.key', '*.pfx', 'id_rsa*']) {
    assert.ok(DEFAULT_CONFIG.secrets.paths.includes(p), p);
  }
});

test('일부만 적으면 기본값과 병합', async () => {
  const cfg = await loadConfig(await project('screens:\n  exclude:\n    - /admin/*\n'));
  assert.deepEqual(cfg.screens, { include: [], exclude: ['/admin/*'], idMap: {} });
  assert.equal(cfg.language, 'ko');
  assert.deepEqual(cfg.secrets, DEFAULT_CONFIG.secrets);
});

test('YAML 문법 오류는 config.yaml을 담은 에러', async () => {
  await assert.rejects(loadConfig(await project('screens: [\n')), /config\.yaml/);
});

test('기본값 객체는 호출 간에 공유되지 않는다', async () => {
  const cfg = await loadConfig(await project());
  cfg.screens.exclude.push('/x');
  assert.deepEqual(DEFAULT_CONFIG.screens.exclude, []);
});
