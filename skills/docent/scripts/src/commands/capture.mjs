// docent capture [id…] — 화면별 전체 페이지 캡처를 .docent/media/img/<id>.png로 만든다. (설계 문서 9장)
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { clearFailure, ensureMediaDirs, mediaPaths, recordFailure } from '../lib/media.mjs';
import { launchBrowser } from '../lib/playwright.mjs';
import { maskContext, runSteps, usesEnvValue } from '../lib/steps.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';
import { newContext } from './auth.mjs';
import { loadRun } from './run.mjs';

export const CAPTURE_VIEWPORT = { width: 1280, height: 800 };

// 라우트를 그대로 열 수 있으면 그 경로(route group·병렬 슬롯 제거), 동적이면 undefined
export function staticPath(route) {
  if (!route || route.includes('[')) return undefined;
  const parts = route.split('/').filter((seg) => seg && !/^\(.*\)$/.test(seg) && !seg.startsWith('@'));
  return '/' + parts.join('/');
}

export function isLoginPath(path, loginPath) {
  return path.split('?')[0].replace(/\/+$/, '') === loginPath.replace(/\/+$/, '');
}

export async function loadScenario(projectDir, id) {
  try {
    return await readJsonIfExists(join(docentDir(projectDir), 'scenarios', `${id}.json`));
  } catch {
    return undefined;
  }
}

// 페이지를 시나리오 시작 상태로 연다. 실패 이유 문자열 또는 undefined
export async function openScreen(page, { baseUrl, path, setup, loginPath }) {
  let response;
  try {
    response = await page.goto(new URL(path, baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  } catch (err) {
    return `열 수 없습니다: ${err.message.split('\n')[0]}`;
  }
  const landed = new URL(page.url()).pathname;
  if (landed === loginPath && path.split('?')[0] !== loginPath) return '로그인 필요 — docent auth login으로 로그인 상태를 저장하세요';
  if (response && response.status() >= 400) return `HTTP ${response.status()}`;
  const trim = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  if (trim(landed) !== trim(path.split('?')[0])) return `다른 화면(${landed})으로 이동했습니다 — 권한이 없거나 조건이 맞지 않습니다`;
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  if (setup?.length) {
    const r = await runSteps(page, setup);
    if (!r.ok) return `준비 단계 ${r.index + 1}번째 실패: ${r.reason}`;
  }
  return undefined;
}

export async function runCapture(projectDir, ids) {
  const run = await loadRun(projectDir);
  const config = await loadConfig(projectDir);
  const inventory = await readJson(join(docentDir(projectDir), 'inventory.json'));
  const targets = ids?.length ? inventory.screens.filter((s) => ids.includes(s.id)) : inventory.screens;
  const paths = mediaPaths(projectDir);
  const loginPath = config.auth?.loginPath ?? '/login';
  await ensureMediaDirs(projectDir);

  const result = { captured: [], failed: [], skipped: [] };
  const browser = await launchBrowser();
  try {
    const context = await newContext(browser, projectDir, { viewport: CAPTURE_VIEWPORT });
    await maskContext(context, config.mask.selectors);
    // 로그인 화면은 로그인하지 않은 상태로 연다(로그인 사용자를 다른 화면으로 보내는 앱이 많다)
    const anonymous = await browser.newContext({ viewport: CAPTURE_VIEWPORT });
    await maskContext(anonymous, config.mask.selectors);
    for (const screen of targets) {
      const scenario = await loadScenario(projectDir, screen.id);
      const path = scenario?.path ?? staticPath(screen.route);
      if (!path || (screen.kind !== 'page' && !scenario)) {
        result.skipped.push({ id: screen.id, reason: '시나리오에 실제 경로가 필요합니다' });
        continue;
      }
      if (scenario && usesEnvValue(scenario.setup)) {
        result.skipped.push({ id: screen.id, reason: '준비 단계에 환경변수 값(계정 등)이 있어 캡처하지 않습니다' });
        continue;
      }
      const page = await (isLoginPath(path, loginPath) ? anonymous : context).newPage();
      try {
        const failure = await openScreen(page, { baseUrl: run.baseUrl, path, setup: scenario?.setup, loginPath });
        if (failure) {
          await page.screenshot({ path: paths.fail(screen.id), fullPage: true }).catch(() => {});
          await recordFailure(projectDir, { id: screen.id, kind: 'capture', reason: failure });
          result.failed.push({ id: screen.id, reason: failure });
          continue;
        }
        await page.screenshot({ path: paths.img(screen.id), fullPage: true });
        await clearFailure(projectDir, screen.id, 'capture');
        result.captured.push(screen.id);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}
