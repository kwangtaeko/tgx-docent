// docent record [id…] — 시나리오를 실행하며 화면을 찍어 조작 GIF(.docent/media/gif/<id>.gif)를 만든다. (설계 문서 9장)
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { clearFailure, ensureMediaDirs, mediaPaths, recordFailure } from '../lib/media.mjs';
import { launchBrowser } from '../lib/playwright.mjs';
import { maskContext, runSteps, usesEnvValue } from '../lib/steps.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';
import { encodeGif } from '../renderers/gif.mjs';
import { CONTEXT_PERMISSIONS, newContext } from './auth.mjs';
import { isLoginPath, loadScenario, openScreen } from './capture.mjs';
import { loadRun } from './run.mjs';
import { gifTargets } from './scenarios.mjs';

export const GIF_VIEWPORT = { width: 800, height: 600 };
export const GIF_MAX_BYTES = 2 * 1024 * 1024;
const FPS = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadScreen(projectDir, id) {
  try {
    return await readJsonIfExists(join(docentDir(projectDir), 'screens', `${id}.json`));
  } catch {
    return undefined;
  }
}

// 단계를 실행하는 동안 1000/fps 간격으로 화면을 찍는다. 새 창이 열리면 그 창을 찍는다
async function recordSteps(page, steps, openers = []) {
  const frames = [];
  let active = page;
  let recording = true;
  const interval = 1000 / FPS;
  const loop = (async () => {
    while (recording) {
      const started = Date.now();
      try {
        frames.push(await active.screenshot({ type: 'png' }));
      } catch {
        // 페이지 이동 중에는 한 프레임 건너뛴다
      }
      const wait = interval - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }
  })();
  const result = await runSteps(page, steps, {
    onStep: () => sleep(300),
    onPage: (p) => {
      active = p;
    },
    openers,
  });
  if (result.ok) await sleep(1000);
  recording = false;
  await loop;
  return { result, frames };
}

export async function runRecord(projectDir, ids) {
  const run = await loadRun(projectDir);
  const config = await loadConfig(projectDir);
  const inventory = await readJson(join(docentDir(projectDir), 'inventory.json'));
  const paths = mediaPaths(projectDir);
  const loginPath = config.auth?.loginPath ?? '/login';

  let targetIds = ids;
  if (!targetIds?.length) {
    const screens = [];
    for (const { id } of inventory.screens) {
      const s = await loadScreen(projectDir, id);
      if (s) screens.push(s);
    }
    targetIds = gifTargets(screens, config);
  }
  await ensureMediaDirs(projectDir);

  const result = { recorded: [], failed: [], skipped: [] };
  const browser = await launchBrowser();
  try {
    const context = await newContext(browser, projectDir, { viewport: GIF_VIEWPORT });
    await maskContext(context, config.mask.selectors);
    const anonymous = await browser.newContext({ viewport: GIF_VIEWPORT, permissions: CONTEXT_PERMISSIONS });
    await maskContext(anonymous, config.mask.selectors);
    for (const id of targetIds) {
      const scenario = await loadScenario(projectDir, id);
      if (!scenario) {
        result.skipped.push({ id, reason: '시나리오가 없습니다' });
        continue;
      }
      if (!scenario.steps.length) {
        result.skipped.push({ id, reason: '보여 줄 조작 단계가 없습니다' });
        continue;
      }
      if (usesEnvValue([...scenario.setup, ...scenario.steps])) {
        result.skipped.push({ id, reason: '환경변수 값(계정 등)을 입력하는 단계가 있어 GIF로 만들지 않습니다' });
        continue;
      }
      const screen = await loadScreen(projectDir, id);
      if (!scenario.locked && screen && screen.sourceHash !== scenario.sourceHash) {
        result.skipped.push({ id, reason: '시나리오가 낡았습니다' });
        continue;
      }
      // 로그인 화면은 로그인하지 않은 상태로 연다(로그인 사용자를 다른 화면으로 보내는 앱이 많다)
      const page = await (isLoginPath(scenario.path, loginPath) ? anonymous : context).newPage();
      // 준비 단계에서 새 창이 열리면(새 창으로 뜨는 하위 화면) 그 창에서 녹화한다
      let start = page;
      try {
        const opened = await openScreen(page, { baseUrl: run.baseUrl, path: scenario.path, setup: scenario.setup, loginPath, onPage: (p) => (start = p) });
        if (opened) {
          await start.screenshot({ path: paths.fail(id) }).catch(() => {});
          await recordFailure(projectDir, { id, kind: 'record', reason: opened });
          result.failed.push({ id, reason: opened });
          continue;
        }
        const { result: stepResult, frames } = await recordSteps(start, scenario.steps, start === page ? [] : [page]);
        if (!stepResult.ok) {
          await start.screenshot({ path: paths.fail(id) }).catch(() => {});
          await recordFailure(projectDir, { id, kind: 'record', step: stepResult.index, reason: stepResult.reason });
          result.failed.push({ id, reason: `${stepResult.index + 1}번째 단계 — ${stepResult.reason}` });
          continue;
        }
        let gif = encodeGif(frames, { fps: FPS, holdLastMs: 1500 });
        if (gif.length > GIF_MAX_BYTES) gif = encodeGif(frames.filter((_, i) => i % 2 === 0), { fps: FPS / 2, holdLastMs: 1500 });
        if (gif.length > GIF_MAX_BYTES) {
          const reason = 'GIF가 2MB를 넘습니다. 시나리오 단계를 줄이세요';
          await recordFailure(projectDir, { id, kind: 'record', reason });
          result.failed.push({ id, reason });
          continue;
        }
        await writeFile(paths.gif(id), gif);
        await clearFailure(projectDir, id, 'record');
        result.recorded.push(id);
      } finally {
        // 이 화면에서 열린 새 창도 닫는다(화면마다 창을 하나만 열어 두므로 나머지는 모두 이 화면의 것)
        for (const p of page.context().pages()) if (p !== page) await p.close().catch(() => {});
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  return result;
}
