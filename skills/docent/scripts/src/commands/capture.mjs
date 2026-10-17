// docent capture [id…] — 화면별 전체 페이지 캡처를 .docent/media/img/<id>.png로 만든다. (설계 문서 9장)
import { join } from 'node:path';
import { t } from '../lib/cli-text.mjs';
import { loadConfig } from '../lib/config.mjs';
import { clearFailure, ensureMediaDirs, mediaPaths, recordFailure } from '../lib/media.mjs';
import { launchBrowser } from '../lib/playwright.mjs';
import { maskContext, runSteps, usesEnvValue } from '../lib/steps.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';
import { CONTEXT_PERMISSIONS, newContext } from './auth.mjs';
import { loadRun } from './run.mjs';

export const CAPTURE_VIEWPORT = { width: 1280, height: 800 };
// 휴대폰 우선 웹앱(PWA): 390 폭, 글자가 또렷하게 2배 밀도
export const MOBILE_VIEWPORT = { width: 390, height: 844 };
const MOBILE = { isMobile: true, hasTouch: true };

// 움직임 줄이기: 등장 애니메이션을 끄는 사이트가 많아 캡처에 내용이 다 찍힌다
export function captureContextOptions(device = 'desktop') {
  if (device === 'mobile') return { viewport: MOBILE_VIEWPORT, deviceScaleFactor: 2, ...MOBILE, reducedMotion: 'reduce' };
  return { viewport: CAPTURE_VIEWPORT, reducedMotion: 'reduce' };
}

// 스크롤할 때 나타나는 내용(IntersectionObserver)을 띄운 뒤 맨 위로 돌아간다.
// 처음 문서 높이까지만 내려가 무한 스크롤 목록이 끝없이 늘어나지 않게 한다
export async function prepareForFullPage(page) {
  await page
    .evaluate(async () => {
      const pause = (ms) => new Promise((r) => setTimeout(r, ms));
      const limit = document.documentElement.scrollHeight;
      for (let i = 0; i < 40 && window.scrollY + window.innerHeight < limit; i++) {
        const before = window.scrollY;
        window.scrollTo({ top: Math.min(before + window.innerHeight, limit - window.innerHeight), behavior: 'instant' });
        await pause(120);
        if (window.scrollY === before) break;
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
      await pause(300);
    })
    .catch(() => {}); // 스크롤이 페이지 이동을 일으켜도 캡처는 계속한다
}

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
// 준비 단계가 새 창을 열면 onPage로 그 창을 알린다(새 창으로 뜨는 하위 화면은 그 창을 찍는다)
export async function openScreen(page, { baseUrl, path, setup, loginPath, onPage }) {
  let response;
  try {
    response = await page.goto(new URL(path, baseUrl).href, { waitUntil: 'load', timeout: 30000 });
  } catch (err) {
    return t('열 수 없습니다: {0}', err.message.split('\n')[0]);
  }
  const landed = new URL(page.url()).pathname;
  if (landed === loginPath && path.split('?')[0] !== loginPath) return t('로그인 필요 — docent auth login으로 로그인 상태를 저장하세요');
  if (response && response.status() >= 400) return `HTTP ${response.status()}`;
  const trim = (p) => (p.length > 1 ? p.replace(/\/+$/, '') : p);
  if (trim(landed) !== trim(path.split('?')[0])) return t('다른 화면({0})으로 이동했습니다 — 권한이 없거나 조건이 맞지 않습니다', landed);
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  if (setup?.length) {
    const r = await runSteps(page, setup, { onPage });
    if (!r.ok) return t('준비 단계 {0}번째 실패: {1}', r.index + 1, r.reason);
  }
  return undefined;
}

export async function runCapture(projectDir, ids, { electronLauncher } = {}) {
  const run = await loadRun(projectDir);
  const config = await loadConfig(projectDir);
  const inventory = await readJson(join(docentDir(projectDir), 'inventory.json'));
  const targets = ids?.length ? inventory.screens.filter((s) => ids.includes(s.id)) : inventory.screens;
  const paths = mediaPaths(projectDir);
  const loginPath = config.auth?.loginPath ?? '/login';
  await ensureMediaDirs(projectDir);
  if (run.mode === 'electron') {
    const { captureElectron } = await import('./electron.mjs');
    return captureElectron(projectDir, run, config, targets, { launch: electronLauncher });
  }

  const result = { captured: [], failed: [], skipped: [] };
  const browser = await launchBrowser();
  try {
    const context = await newContext(browser, projectDir, captureContextOptions(config.capture.device));
    await maskContext(context, config.mask.selectors);
    // 로그인 화면은 로그인하지 않은 상태로 연다(로그인 사용자를 다른 화면으로 보내는 앱이 많다)
    const anonymous = await browser.newContext({ ...captureContextOptions(config.capture.device), permissions: CONTEXT_PERMISSIONS });
    await maskContext(anonymous, config.mask.selectors);
    for (const screen of targets) {
      const scenario = await loadScenario(projectDir, screen.id);
      const path = scenario?.path ?? staticPath(screen.route);
      if (!path || (screen.kind !== 'page' && !scenario)) {
        result.skipped.push({ id: screen.id, reason: t('시나리오에 실제 경로가 필요합니다') });
        continue;
      }
      if (scenario && usesEnvValue(scenario.setup)) {
        result.skipped.push({ id: screen.id, reason: t('준비 단계에 환경변수 값(계정 등)이 있어 캡처하지 않습니다') });
        continue;
      }
      const page = await (isLoginPath(path, loginPath) ? anonymous : context).newPage();
      let shown = page;
      try {
        const failure = await openScreen(page, { baseUrl: run.baseUrl, path, setup: scenario?.setup, loginPath, onPage: (p) => (shown = p) });
        if (failure) {
          await shown.screenshot({ path: paths.fail(screen.id), fullPage: true }).catch(() => {});
          await recordFailure(projectDir, { id: screen.id, kind: 'capture', reason: failure });
          result.failed.push({ id: screen.id, reason: failure });
          continue;
        }
        await prepareForFullPage(shown);
        await shown.screenshot({ path: paths.img(screen.id), fullPage: true });
        await clearFailure(projectDir, screen.id, 'capture');
        result.captured.push(screen.id);
      } finally {
        for (const p of page.context().pages()) if (p !== page) await p.close().catch(() => {});
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}
