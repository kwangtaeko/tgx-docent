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

// 골든 화면을 복제해 화면 n개짜리 입력을 만든다(대규모 테스트용)
export async function loadLarge(n) {
  const base = await loadGolden();
  const template = base.screens.get('orders-new');
  const entry = base.inventory.screens.find((s) => s.id === 'orders-new');
  const inventory = { version: 1, screens: [] };
  const screens = new Map();
  for (let i = 1; i <= n; i++) {
    const id = `screen-${String(i).padStart(3, '0')}`;
    inventory.screens.push({ ...entry, id, route: `/s/${i}` });
    screens.set(id, { ...structuredClone(template), id, route: `/s/${i}`, title: { ...template.title, value: `화면 ${i}` }, actions: [] });
  }
  return { ...base, inventory, screens, summary: { ...base.summary, workflows: [] } };
}
