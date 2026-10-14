// docent update — 코드가 바뀐 뒤 무엇을 다시 할지 계획한다(실행은 SKILL 흐름). (설계 문서 13장)
// 사라진 화면의 분석 결과·시나리오·캡처는 지우지 않고 삭제 후보로만 알린다.
import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { mediaPaths } from '../lib/media.mjs';
import { docentDir, readJsonIfExists } from '../lib/workspace.mjs';
import { runInventory } from './inventory.mjs';
import { runPending } from './pending.mjs';
import { runScenarios } from './scenarios.mjs';

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function idsIn(dir, ext) {
  try {
    return (await readdir(dir)).filter((n) => n.endsWith(ext)).map((n) => n.slice(0, -ext.length));
  } catch {
    return [];
  }
}

export async function runUpdate(projectDir) {
  const dir = docentDir(projectDir);
  const before = new Set(((await readJsonIfExists(join(dir, 'inventory.json'))) ?? { screens: [] }).screens.map((s) => s.id));
  const { inventory } = await runInventory(projectDir);
  const now = new Set(inventory.screens.map((s) => s.id));

  const added = [...now].filter((id) => !before.has(id)).sort();
  const media = mediaPaths(projectDir);
  const leftovers = new Set([
    ...(await idsIn(join(dir, 'screens'), '.json')),
    ...(await idsIn(join(dir, 'scenarios'), '.json')),
    ...(await idsIn(join(media.root, 'img'), '.png')),
    ...(await idsIn(join(media.root, 'gif'), '.gif')),
  ]);
  const removed = [...leftovers].filter((id) => !now.has(id)).sort();

  const reanalyze = await runPending(projectDir);
  const rescenario = await runScenarios(projectDir);
  const recapture = [];
  for (const { id } of reanalyze) if (await exists(media.img(id))) recapture.push(id);
  return { added, removed, reanalyze, rescenario, recapture };
}
