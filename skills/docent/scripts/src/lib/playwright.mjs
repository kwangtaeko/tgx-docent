// Playwright 런타임 로더. 번들에 넣지 않고 설치된 곳에서 찾는다. (설계 문서 14장)
// 찾는 순서: DOCENT_PLAYWRIGHT → 런타임 캐시(~/.cache/docent/runtime) → 이 패키지 기준 node_modules → 전역 npm
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const PLAYWRIGHT_VERSION = '1.56.1';

export class PlaywrightMissing extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlaywrightMissing';
  }
}

export function runtimeDir() {
  return process.env.DOCENT_RUNTIME_DIR || join(homedir(), '.cache', 'docent', 'runtime');
}

const require = createRequire(import.meta.url);

// 디렉터리(패키지 루트)에서 불러온다. 없으면 undefined
function loadFromDir(pkgDir) {
  const pkgJson = join(pkgDir, 'package.json');
  if (!existsSync(pkgJson)) return undefined;
  const { version } = JSON.parse(readFileSync(pkgJson, 'utf8'));
  return { module: require(pkgDir), version };
}

function globalRoot() {
  try {
    return execFileSync('npm', ['root', '-g'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}

export async function findPlaywright() {
  const candidates = [];
  if (process.env.DOCENT_PLAYWRIGHT) candidates.push(['env', process.env.DOCENT_PLAYWRIGHT]);
  candidates.push(['runtime', join(runtimeDir(), 'node_modules', 'playwright')]);
  try {
    candidates.push(['local', dirname(require.resolve('playwright/package.json'))]);
  } catch {
    // 개발 환경이 아님
  }
  const root = globalRoot();
  if (root) candidates.push(['global', join(root, 'playwright')]);
  for (const [from, dir] of candidates) {
    const found = loadFromDir(dir);
    if (found) return { ...found, from, dir };
  }
  return undefined;
}

export async function requirePlaywright() {
  const found = await findPlaywright();
  if (!found) {
    throw new PlaywrightMissing(
      '화면 캡처·녹화에 필요한 Playwright가 없습니다. 사용자 동의를 받은 뒤 `docent runtime install`로 설치하세요 ' +
        `(${runtimeDir()}에 playwright@${PLAYWRIGHT_VERSION}와 Chromium을 받습니다).`,
    );
  }
  return found.module;
}

export async function launchBrowser(options = {}) {
  const { chromium } = await requirePlaywright();
  try {
    return await chromium.launch(options);
  } catch (err) {
    if (/Executable doesn't exist|browserType\.launch/.test(err.message)) {
      throw new PlaywrightMissing(`Chromium을 찾을 수 없습니다. \`docent runtime install\`(또는 npx playwright install chromium)로 설치하세요.\n${err.message.split('\n')[0]}`);
    }
    throw err;
  }
}
