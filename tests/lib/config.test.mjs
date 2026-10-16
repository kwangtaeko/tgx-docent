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

test('값을 비운 키는 기본값을 쓴다', async () => {
  const c = await loadConfig(await project('detectors:\nscreens:\n  include:\n'));
  assert.deepEqual(c.detectors, []);
  assert.deepEqual(c.screens, DEFAULT_CONFIG.screens);
});

test('형식이 틀린 값은 키 경로를 담은 오류', async () => {
  await assert.rejects(loadConfig(await project('detectors: nextjs\n')), /config\.yaml: detectors는 목록이어야 합니다/);
  await assert.rejects(loadConfig(await project('analyze:\n  concurrency: 0\n')), /config\.yaml: analyze\.concurrency는 양의 정수여야 합니다/);
  await assert.rejects(loadConfig(await project('screens:\n  idMap: [a]\n')), /config\.yaml: screens\.idMap는 객체여야 합니다/);
  await assert.rejects(loadConfig(await project('output:\n  title: [a]\n')), /config\.yaml: output\.title는 문자열이어야 합니다/);
});

test('output.formats는 문자열 하나도 받는다', async () => {
  assert.deepEqual((await loadConfig(await project('output:\n  formats: pdf\n'))).output.formats, ['pdf']);
});

test('문자열 항목에 숫자를 적어도 문자열로 받는다', async () => {
  const c = await loadConfig(await project('output:\n  title: 2026\n  organization: 1234\n'));
  assert.equal(c.output.title, '2026');
  assert.equal(c.output.organization, '1234');
});

test('app은 프로젝트 안 상대 경로로 정리하고, 밖을 가리키면 오류', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-cfg-'));
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'app: ./apps/web/\n');
  assert.equal((await loadConfig(dir)).app, 'apps/web');
  await writeFile(join(dir, '.docent', 'config.yaml'), 'app: ../other\n');
  await assert.rejects(loadConfig(dir), /app은 프로젝트 안의 폴더/);
});

test('language는 ko·en만 받는다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-cfg-'));
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'language: en\n');
  assert.equal((await loadConfig(dir)).language, 'en');
  await writeFile(join(dir, '.docent', 'config.yaml'), 'language: ja\n');
  await assert.rejects(loadConfig(dir), /language는 ko, en 중 하나/);
});
