// 새 버전 알림: GitHub에 올라간 plugin.json의 version과 설치된 version을 비교한다.
// 공개 파일 하나를 읽기만 하고(보내는 정보 없음), 하루에 한 번만 확인하며, 실패하면 조용히 넘어간다.
// 끄기: DOCENT_NO_UPDATE_CHECK=1 (CI 환경에서는 자동으로 끈다)
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const LATEST_URL = 'https://raw.githubusercontent.com/kwangtaeko/tgx-docent/main/.claude-plugin/plugin.json';
export const MARKETPLACE = 'tgx-docent';
export const PLUGIN = 'docent';
const DAY_MS = 24 * 3600_000;
const TIMEOUT_MS = 2000;

// 설치된 플러그인의 version: 이 파일(번들이면 dist/docent.mjs)에서 위로 올라가며 .claude-plugin/plugin.json을 찾는다
export function installedVersion(from = fileURLToPath(import.meta.url)) {
  let dir = dirname(from);
  for (let i = 0; i < 8; i++) {
    const file = join(dir, '.claude-plugin', 'plugin.json');
    if (existsSync(file)) {
      try {
        return JSON.parse(readFileSync(file, 'utf8')).version;
      } catch {
        return undefined;
      }
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return undefined;
}

// 1.2.10 > 1.2.9 (숫자 세 칸만 본다. 형식이 다르면 비교하지 않는다)
const parse = (v) => (typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : undefined);
export function isNewer(latest, current) {
  const [a, b] = [parse(latest), parse(current)];
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

const cacheFile = () => join(process.env.DOCENT_CACHE_DIR || join(homedir(), '.cache', 'docent'), 'update-check.json');

async function fetchLatest(fetchImpl) {
  const res = await fetchImpl(LATEST_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return undefined;
  return (await res.json())?.version;
}

// → { current, latest } (새 버전이 있을 때만) 또는 undefined. 어떤 실패도 던지지 않는다
export async function checkForUpdate({ now = Date.now(), fetchImpl = globalThis.fetch, current = installedVersion(), env = process.env } = {}) {
  if (env.DOCENT_NO_UPDATE_CHECK || env.CI || !current || typeof fetchImpl !== 'function') return undefined;
  try {
    let cached;
    try {
      cached = JSON.parse(await readFile(cacheFile(), 'utf8'));
    } catch {
      // 처음이거나 깨진 캐시
    }
    let latest = cached?.latest;
    if (!cached || typeof cached.checkedAt !== 'number' || now - cached.checkedAt >= DAY_MS || now < cached.checkedAt) {
      latest = await fetchLatest(fetchImpl);
      await mkdir(dirname(cacheFile()), { recursive: true });
      await writeFile(cacheFile(), JSON.stringify({ checkedAt: now, latest: latest ?? null }) + '\n');
    }
    return isNewer(latest, current) ? { current, latest } : undefined;
  } catch {
    return undefined;
  }
}

// 업데이트 명령(셸). Claude Code 안에서는 /plugin 메뉴로도 할 수 있다
export const UPDATE_COMMANDS = [`claude plugin marketplace update ${MARKETPLACE}`, `claude plugin update ${PLUGIN}@${MARKETPLACE}`];
