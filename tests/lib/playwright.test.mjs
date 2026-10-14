import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findPlaywright, launchBrowser, runtimeDir } from '../../skills/docent/scripts/src/lib/playwright.mjs';

const saved = { ...process.env };
afterEach(() => {
  for (const k of ['DOCENT_RUNTIME_DIR', 'DOCENT_PLAYWRIGHT']) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

test('runtimeDir 기본값과 환경변수', () => {
  delete process.env.DOCENT_RUNTIME_DIR;
  assert.match(runtimeDir(), /\.cache[\\/]docent[\\/]runtime$/);
  process.env.DOCENT_RUNTIME_DIR = '/tmp/x';
  assert.equal(runtimeDir(), '/tmp/x');
});

test('런타임 디렉터리의 playwright를 먼저 쓴다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-rt-'));
  await mkdir(join(dir, 'node_modules', 'playwright'), { recursive: true });
  await writeFile(join(dir, 'node_modules', 'playwright', 'package.json'), '{"name":"playwright","version":"0.0.0-fake","main":"index.js"}');
  await writeFile(join(dir, 'node_modules', 'playwright', 'index.js'), "module.exports = { chromium: 'fake' };");
  process.env.DOCENT_RUNTIME_DIR = dir;
  process.env.DOCENT_PLAYWRIGHT = join(dir, 'nope');
  const found = await findPlaywright();
  assert.equal(found.from, 'runtime');
  assert.equal(found.module.chromium, 'fake');
  assert.equal(found.version, '0.0.0-fake');
});

test('개발 의존성으로 설치된 playwright', async () => {
  process.env.DOCENT_RUNTIME_DIR = await mkdtemp(join(tmpdir(), 'docent-rt-empty-'));
  delete process.env.DOCENT_PLAYWRIGHT;
  const found = await findPlaywright();
  assert.equal(found.from, 'local');
  assert.equal(found.version, '1.56.1');
});

test('브라우저를 띄울 수 있다', async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.goto('about:blank');
  assert.equal(page.url(), 'about:blank');
  await browser.close();
});
