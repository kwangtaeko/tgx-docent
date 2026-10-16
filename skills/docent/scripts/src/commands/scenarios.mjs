// 시나리오 관련: GIF 대상 화면 선정과 시나리오 작성 대상. (설계 문서 9장)
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { t } from '../lib/cli-text.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';

// screens: 화면 JSON 배열. 기본값은 버튼 동작이 있는 화면, config.gif.screens로 지정·제외
export function gifTargets(screens, config) {
  const { include = [], exclude = [] } = config.gif?.screens ?? {};
  return screens
    .filter((s) => (include.length ? include.includes(s.id) : (s.actions ?? []).length > 0))
    .filter((s) => !exclude.includes(s.id))
    .map((s) => s.id);
}

const isStale = (scenario, screen) => !scenario.locked && screen.sourceHash !== scenario.sourceHash;
const needsPath = (entry) => entry.kind !== 'page' || !entry.route || entry.route.includes('[');

// 시나리오를 (다시) 써야 하는 화면: 캡처 경로 필요(동적·하위 화면), GIF 대상, 낡음
export async function runScenarios(projectDir) {
  const dir = docentDir(projectDir);
  const config = await loadConfig(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) {
    const s = await readJsonIfExists(join(dir, 'screens', `${id}.json`)).catch(() => undefined);
    if (s?.sourceHash) screens.set(id, s);
  }
  const gif = new Set(gifTargets([...screens.values()], config));
  const list = [];
  for (const entry of inventory.screens) {
    const screen = screens.get(entry.id);
    if (!screen) continue;
    const scenario = await readJsonIfExists(join(dir, 'scenarios', `${entry.id}.json`)).catch(() => undefined);
    if (!scenario) {
      if (needsPath(entry)) list.push({ id: entry.id, reason: t('캡처 경로 필요') });
      else if (gif.has(entry.id)) list.push({ id: entry.id, reason: t('GIF 대상') });
    } else if (isStale(scenario, screen)) {
      list.push({ id: entry.id, reason: t('낡음') });
    }
  }
  return list;
}
