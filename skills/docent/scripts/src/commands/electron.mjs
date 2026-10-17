// 데스크톱 앱(Electron)의 캡처·녹화. 화면마다 앱을 새로 띄우고, 메뉴로 바뀌는 화면(view)은 시나리오 준비 단계로 연다.
import { writeFile } from 'node:fs/promises';
import { t } from '../lib/cli-text.mjs';
import { launchElectron } from '../lib/electron.mjs';
import { clearFailure, mediaPaths, recordFailure } from '../lib/media.mjs';
import { maskContext, maskPage, runSteps, usesEnvValue } from '../lib/steps.mjs';
import { docentDir, readJson } from '../lib/workspace.mjs';
import { join } from 'node:path';
import { opensDirectly } from './scenarios.mjs';
import { CAPTURE_VIEWPORT, loadScenario } from './capture.mjs';
import { framesToGif, GIF_VIEWPORT, recordSkipReason, recordSteps } from './record.mjs';
import { approved, childEnv, describeCommands, runCwd } from './run.mjs';

// 앱 코드를 실행하므로 run.json이 이 컴퓨터에서 승인됐는지 먼저 본다
async function launcherFor(projectDir, run, launch) {
  if (!(await approved(projectDir, run))) {
    throw new Error(
      t('.docent/run.json의 명령이 이 컴퓨터에서 아직 승인되지 않았습니다. 아래 명령을 사용자에게 보여 주고 동의를 받은 뒤 `docent run approve`를 실행하세요:') +
        `\n${describeCommands(run)}`,
    );
  }
  const options = { cwd: runCwd(projectDir, run), main: run.electron.main, args: run.electron.args ?? [], env: childEnv(run) };
  return (size) => launch({ ...options, size });
}

// 앱이 처음 띄우는 화면(주소 / 의 page)은 시나리오 없이, 그 밖에는 준비 단계(메뉴 클릭 등)가 있는 시나리오가 필요하다(opensDirectly)
const NEEDS_SETUP = () => t('데스크톱 앱에서 이 화면을 여는 준비 단계(메뉴 클릭 등)가 시나리오에 필요합니다');

async function openOnApp(handle, config, setup) {
  // 이미 뜬 첫 창에는 스타일을 바로, 이후 새 창·새로 읽는 문서에는 init script로 가린다
  await maskContext(handle.context, config.mask.selectors);
  await maskPage(handle.page, config.mask.selectors);
  let shown = handle.page;
  if (setup?.length) {
    const r = await runSteps(handle.page, setup, { onPage: (p) => (shown = p) });
    if (!r.ok) return { shown, failure: t('준비 단계 {0}번째 실패: {1}', r.index + 1, r.reason) };
  }
  return { shown };
}

export async function captureElectron(projectDir, run, config, targets, { launch = launchElectron } = {}) {
  const start = await launcherFor(projectDir, run, launch);
  const paths = mediaPaths(projectDir);
  const result = { captured: [], failed: [], skipped: [] };
  for (const screen of targets) {
    const scenario = await loadScenario(projectDir, screen.id);
    if (!opensDirectly(screen) && !scenario?.setup?.length) {
      result.skipped.push({ id: screen.id, reason: NEEDS_SETUP() });
      continue;
    }
    if (scenario && usesEnvValue(scenario.setup)) {
      result.skipped.push({ id: screen.id, reason: t('준비 단계에 환경변수 값(계정 등)이 있어 캡처하지 않습니다') });
      continue;
    }
    const handle = await start(CAPTURE_VIEWPORT);
    try {
      const { shown, failure } = await openOnApp(handle, config, scenario?.setup);
      if (failure) {
        await shown.screenshot({ path: paths.fail(screen.id) }).catch(() => {});
        await recordFailure(projectDir, { id: screen.id, kind: 'capture', reason: failure });
        result.failed.push({ id: screen.id, reason: failure });
        continue;
      }
      await shown.screenshot({ path: paths.img(screen.id) });
      await clearFailure(projectDir, screen.id, 'capture');
      result.captured.push(screen.id);
    } finally {
      await handle.close();
    }
  }
  return result;
}

export async function recordElectron(projectDir, run, config, ids, { launch = launchElectron } = {}) {
  const start = await launcherFor(projectDir, run, launch);
  const paths = mediaPaths(projectDir);
  const result = { recorded: [], failed: [], skipped: [] };
  const entries = new Map((await readJson(join(docentDir(projectDir), 'inventory.json'))).screens.map((e) => [e.id, e]));
  for (const id of ids) {
    const scenario = await loadScenario(projectDir, id);
    const skip = (await recordSkipReason(projectDir, id, scenario)) ?? (entries.get(id) && !opensDirectly(entries.get(id)) && !scenario.setup.length ? NEEDS_SETUP() : undefined);
    if (skip) {
      result.skipped.push({ id, reason: skip });
      continue;
    }
    const handle = await start(GIF_VIEWPORT);
    try {
      const { shown, failure } = await openOnApp(handle, config, scenario.setup);
      if (failure) {
        await shown.screenshot({ path: paths.fail(id) }).catch(() => {});
        await recordFailure(projectDir, { id, kind: 'record', reason: failure });
        result.failed.push({ id, reason: failure });
        continue;
      }
      const { result: stepResult, frames } = await recordSteps(shown, scenario.steps, shown === handle.page ? [] : [handle.page]);
      if (!stepResult.ok) {
        await shown.screenshot({ path: paths.fail(id) }).catch(() => {});
        await recordFailure(projectDir, { id, kind: 'record', step: stepResult.index, reason: stepResult.reason });
        result.failed.push({ id, reason: t('{0}번째 단계 — {1}', stepResult.index + 1, stepResult.reason) });
        continue;
      }
      const gif = framesToGif(frames);
      if (!gif) {
        const reason = t('GIF가 2MB를 넘습니다. 시나리오 단계를 줄이세요');
        await recordFailure(projectDir, { id, kind: 'record', reason });
        result.failed.push({ id, reason });
        continue;
      }
      await writeFile(paths.gif(id), gif);
      await clearFailure(projectDir, id, 'record');
      result.recorded.push(id);
    } finally {
      await handle.close();
    }
  }
  return result;
}
