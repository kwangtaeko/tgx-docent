import { join } from 'node:path';
import { EXPECTED, readJsonFile } from './fixture.mjs';

// 골든 산출물을 렌더러 입력 형태로 읽는다.
export async function loadGolden() {
  const inventory = await readJsonFile(join(EXPECTED, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) screens.set(id, await readJsonFile(join(EXPECTED, 'screens', `${id}.json`)));
  const summary = await readJsonFile(join(EXPECTED, 'summary.json'));
  return { inventory, screens, summary, date: '2026-10-13', projectName: 'nextjs-sample' };
}
