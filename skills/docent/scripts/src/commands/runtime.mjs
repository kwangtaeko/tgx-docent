// docent runtime status | install — Playwright와 Chromium을 사용자 캐시에 설치한다(사용자 동의 후 실행).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { findPlaywright, PLAYWRIGHT_VERSION, runtimeDir } from '../lib/playwright.mjs';

export async function runtimeStatus() {
  const found = await findPlaywright();
  return found ? { installed: true, from: found.from, dir: found.dir, version: found.version } : { installed: false, dir: runtimeDir() };
}

function run(command, args) {
  const r = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) throw new Error(`${command} ${args.join(' ')} 실패 (exit ${r.status})`);
}

export async function runtimeInstall() {
  const dir = runtimeDir();
  mkdirSync(dir, { recursive: true });
  run('npm', ['install', '--prefix', dir, '--no-save', '--no-package-lock', `playwright@${PLAYWRIGHT_VERSION}`]);
  run(join(dir, 'node_modules', '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright'), ['install', 'chromium']);
  return runtimeStatus();
}
