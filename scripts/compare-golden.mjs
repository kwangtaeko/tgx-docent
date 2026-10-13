// 개발용: docent 분석 결과(.docent)와 골든 기대 산출물을 비교해 일치율을 보고한다. (설계 문서 17장)
// 사용법: node scripts/compare-golden.mjs <분석 결과 디렉터리> <기대 산출물 디렉터리>
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function keysOf(s) {
  return [
    ...s.fields.map((f) => `입력 ${f.label} (${f.type}${f.required ? ', 필수' : ''})`),
    ...s.actions.map((a) => `버튼 ${a.label}${a.navigatesTo ? ` → ${a.navigatesTo}` : ''}${a.opens ? ` ⇢ ${a.opens}` : ''}`),
    ...s.messages.map((m) => `메시지 ${m.text}`),
  ];
}

const [actualDir, expectedDir] = process.argv.slice(2);
if (!actualDir || !expectedDir) {
  console.error('사용법: node scripts/compare-golden.mjs <분석 결과 디렉터리> <기대 산출물 디렉터리>');
  process.exit(2);
}

const expectedInv = await readJson(join(expectedDir, 'inventory.json'));
const actualInv = (await readJson(join(actualDir, 'inventory.json'))) ?? { screens: [] };
const actualIds = new Set(actualInv.screens.map((s) => s.id));
let total = 0;
let matched = 0;
const rows = [];

for (const { id } of expectedInv.screens) {
  total++;
  if (!actualIds.has(id)) {
    rows.push(`- ${id}: 화면 없음`);
    continue;
  }
  matched++;
  const expected = await readJson(join(expectedDir, 'screens', `${id}.json`));
  const actual = await readJson(join(actualDir, 'screens', `${id}.json`));
  const want = keysOf(expected);
  const got = new Set(actual ? keysOf(actual) : []);
  total += want.length;
  const missing = want.filter((k) => !got.has(k));
  matched += want.length - missing.length;
  const extra = [...got].filter((k) => !want.includes(k));
  if (!actual) rows.push(`- ${id}: 분석 결과 없음`);
  for (const k of missing) rows.push(`- ${id}: 빠짐 ${k}`);
  for (const k of extra) rows.push(`- ${id}: 추가 ${k}`);
}
for (const id of actualIds) if (!expectedInv.screens.some((s) => s.id === id)) rows.push(`- ${id}: 기대에 없는 화면`);

console.log(rows.length ? rows.join('\n') : '차이 없음');
console.log(`일치율 ${Math.floor((matched / total) * 1000) / 10}% (${matched}/${total})`);
