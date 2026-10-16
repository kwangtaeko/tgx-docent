// /docent validate: 분석 결과가 스키마·근거·연결 규칙을 지키는지 검사한다. (설계 문서 11장 6번)
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { checkEvidence } from '../lib/evidence.mjs';
import { t } from '../lib/cli-text.mjs';
import { validateInventory, validateScenario, validateScreen, validateSummary } from '../lib/schema.mjs';
import { hashFiles } from '../lib/source-hash.mjs';
import { docentDir, readJson } from '../lib/workspace.mjs';

async function load(path, label, problems) {
  try {
    return await readJson(path);
  } catch (err) {
    problems.push(`${label}: ${err.code === 'ENOENT' ? t('파일 없음') : t('JSON 형식 오류 ({0})', err.message)}`);
    return undefined;
  }
}

// [근거, 확인할 글자] 목록. 글자가 없으면 위치만 확인한다
function evidenceChecks(s) {
  const checks = [[s.title.evidence], [s.purpose.evidence]];
  for (const x of [...s.roles, ...s.sections]) checks.push([x.evidence]);
  for (const f of s.fields) {
    checks.push([f.evidence, f.label]);
    // 선택지도 화면 문구 그대로, 근거 근처에 있어야 한다(optionsEvidence가 있으면 두 근거 중 한 곳)
    if (f.optionsEvidence) checks.push([f.optionsEvidence]);
    for (const option of f.options ?? []) checks.push([f.optionsEvidence ? [f.evidence, f.optionsEvidence] : f.evidence, option]);
  }
  for (const a of s.actions) {
    // 글자가 없는 동작(행 클릭 등)은 처리기 위치만 확인한다
    checks.push(a.unlabeled ? [a.evidence] : [a.evidence, a.label]);
    // 결과의 근거: 위치만 확인한다(라벨 글자는 없어도 된다)
    for (const ev of a.effectEvidence ?? []) checks.push([ev]);
  }
  for (const m of s.messages) checks.push([m.evidence, m.text]);
  return checks;
}

const fileOf = (ev) => ev.slice(0, ev.lastIndexOf(':'));

// 메뉴 경로: 이름마다 근거 중 한 곳 근처에 글자가 있어야 한다(그룹 이름과 메뉴 이름이 다른 파일에 있을 수 있다)
async function checkMenuPath(projectDir, s, problems) {
  const places = [s.menuPath.evidence, ...(s.menuPath.moreEvidence ?? [])];
  const located = [];
  for (const ev of places) {
    const r = await checkEvidence(projectDir, ev);
    if (r.ok) located.push(ev);
    else problems.push(`${s.id}: ${r.reason}`);
  }
  if (located.length < places.length) return;
  for (const name of s.menuPath.value) {
    let found = false;
    for (const ev of located) if ((await checkEvidence(projectDir, ev, { expectText: name })).ok) found = true;
    if (!found) problems.push(`${s.id}: ${t('메뉴 경로의 "{0}"이 근거({1}) 근처에 없습니다', name, places.join(', '))}`);
  }
}

async function checkScreen(projectDir, s, ids, problems) {
  for (const [ev, text] of evidenceChecks(s)) {
    // 근거가 여럿이면 한 곳에서라도 글자가 보이면 된다(문제는 마지막 근거의 것으로 알린다)
    let r;
    for (const one of [ev].flat()) {
      r = await checkEvidence(projectDir, one, text === undefined ? {} : { expectText: text });
      if (r.ok) break;
    }
    if (!r.ok) problems.push(`${s.id}: ${r.reason}`);
  }
  if (s.menuPath) await checkMenuPath(projectDir, s, problems);
  // 결과 근거 파일은 readFiles에 있어야 그 파일이 바뀔 때 다시 분석한다
  const read = new Set(s.readFiles ?? []);
  for (const a of s.actions) {
    for (const ev of a.effectEvidence ?? []) {
      const file = fileOf(ev);
      if (file && !read.has(file)) problems.push(`${s.id}: ${t('"{0}"의 effectEvidence 파일 {1}이 readFiles에 없습니다', a.label, file)}`);
    }
  }
  for (const ev of [...(s.menuPath?.moreEvidence ?? []), ...s.fields.flatMap((f) => (f.optionsEvidence ? [f.optionsEvidence] : []))]) {
    const file = fileOf(ev);
    if (file && !read.has(file)) problems.push(`${s.id}: ${t('근거 파일 {0}이 readFiles에 없습니다', file)}`);
  }
  // section은 sections의 title 중 하나여야 한다(같은 라벨을 구획으로 구분하는 값)
  const titles = new Set(s.sections.map((x) => x.title));
  for (const x of [...s.fields, ...s.actions]) {
    if (x.section !== undefined && !titles.has(x.section)) problems.push(`${s.id}: ${t('"{0}"의 section "{1}"이 sections에 없습니다', x.label, x.section)}`);
  }
  if (s.parentId && !ids.has(s.parentId)) problems.push(`${s.id}: ${t('없는 부모 화면 {0}', s.parentId)}`);
  for (const a of s.actions) {
    for (const key of ['navigatesTo', 'opens']) {
      if (a[key] && !ids.has(a[key])) problems.push(`${s.id}: ${t('"{0}"의 {1}가 없는 화면 {2}', a.label, key, a[key])}`);
    }
  }
  try {
    if (s.sourceHash !== (await hashFiles(projectDir, s.readFiles))) {
      problems.push(`${s.id}: ${t('소스가 바뀌었습니다. 다시 분석하세요')}`);
    }
  } catch (err) {
    problems.push(`${s.id}: ${err.message}`);
  }
}

// a → b: a의 버튼이 b로 이동·b를 열거나, a가 b의 하위 화면(닫고 돌아감)
// a → b: a의 버튼이 b로 가거나 b를 열거나, a가 b 위에 뜬 창(모달·팝업)이라 닫으면 b로 돌아간다.
// view(메뉴로 바뀌는 화면)는 닫히는 창이 아니므로 부모로 돌아가는 연결로 보지 않는다
function hasEdge(screens, a, b) {
  const s = screens.get(a);
  return (s.parentId === b && s.kind !== 'view') || s.actions.some((x) => x.navigatesTo === b || x.opens === b);
}

// known: 존재하는 화면 ID(파일이 깨져 읽지 못한 화면 포함). 읽지 못한 화면은 따로 보고됐으므로 여기서는 건너뛴다.
function checkSummary(summary, screens, known, problems) {
  const exists = (id) => known.has(id);
  const loaded = (id) => screens.has(id);
  const supported = (ids) => ids.some((id) => !loaded(id) || screens.get(id).purpose.confidence !== 'low');
  const claims = [[t('한 줄 소개'), summary.oneLiner], ...summary.features.map((f) => [f.value, f])];
  for (const [label, claim] of claims) {
    for (const id of claim.screens) if (!exists(id)) problems.push(`summary.json: ${t('"{0}"의 없는 화면 {1}', label, id)}`);
    if (!supported(claim.screens)) problems.push(`summary.json: ${t('"{0}"를 뒷받침하는 화면이 모두 확신도 low입니다', label)}`);
  }
  for (const wf of summary.workflows) {
    const missing = wf.steps.filter((id) => !exists(id));
    if (missing.length) {
      problems.push(`summary.json: ${t('워크플로우 "{0}"의 없는 화면 {1}', wf.name, missing.join(', '))}`);
      continue;
    }
    if (new Set(wf.steps).size < 2) {
      problems.push(`summary.json: ${t('워크플로우 "{0}"는 화면 2개 이상을 오가야 합니다', wf.name)}`);
      continue;
    }
    for (let i = 0; i + 1 < wf.steps.length; i++) {
      const [a, b] = [wf.steps[i], wf.steps[i + 1]];
      if (!loaded(a) || !loaded(b)) continue;
      if (!hasEdge(screens, a, b)) problems.push(`summary.json: ${t('워크플로우 "{0}"의 {1} → {2} 연결이 화면 동작에 없습니다', wf.name, a, b)}`);
    }
  }
}

// 시나리오: 스키마, 파일명 = screenId, 있는 화면, 단계 근거와 문구
async function checkScenarios(projectDir, dir, ids, problems) {
  let files = [];
  try {
    files = (await readdir(join(dir, 'scenarios'))).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return;
  }
  for (const file of files) {
    const label = `scenarios/${file}`;
    const sc = await load(join(dir, 'scenarios', file), label, problems);
    if (sc === undefined) continue;
    const r = validateScenario(sc);
    if (!r.valid) {
      problems.push(`${label}: ${r.errors.join('; ')}`);
      continue;
    }
    if (`${sc.screenId}.json` !== file) problems.push(`${label}: ${t('파일 이름과 screenId({0})가 다릅니다', sc.screenId)}`);
    if (!ids.has(sc.screenId)) problems.push(`${label}: ${t('없는 화면 {0}', sc.screenId)}`);
    for (const step of [...sc.setup, ...sc.steps]) {
      const text = step.label ?? step.text;
      const res = await checkEvidence(projectDir, step.evidence, text === undefined ? {} : { expectText: text });
      if (!res.ok) problems.push(`${label}: ${res.reason}`);
    }
  }
}

// only: 화면 ID 목록이면 그 화면에 관한 문제만 돌려준다(화면 분석 에이전트가 자기 화면만 확인할 때)
export async function runValidate(projectDir, { only = [] } = {}) {
  const dir = docentDir(projectDir);
  const problems = [];

  const inventory = await load(join(dir, 'inventory.json'), 'inventory.json', problems);
  if (inventory) {
    const r = validateInventory(inventory);
    if (!r.valid) problems.push(`inventory.json: ${r.errors.join('; ')}`);
  }
  const inventoryIds = new Set((inventory?.screens ?? []).map((s) => s.id));

  const screens = new Map();
  let files = [];
  try {
    files = (await readdir(join(dir, 'screens'))).filter((f) => f.endsWith('.json')).sort();
  } catch {
    problems.push(`screens/: ${t('디렉터리 없음')}`);
  }
  for (const file of files) {
    const s = await load(join(dir, 'screens', file), `screens/${file}`, problems);
    if (s === undefined) continue;
    const r = validateScreen(s);
    if (!r.valid) {
      problems.push(`screens/${file}: ${r.errors.join('; ')}`);
      continue;
    }
    if (`${s.id}.json` !== file) problems.push(`screens/${file}: ${t('파일 이름과 id({0})가 다릅니다', s.id)}`);
    screens.set(s.id, s);
  }
  const fileIds = new Set(files.map((f) => f.replace(/\.json$/, '')));
  for (const id of inventoryIds) if (!fileIds.has(id)) problems.push(`${id}: ${t('inventory에는 있지만 분석 결과(screens/{0}.json)가 없습니다', id)}`);
  for (const id of fileIds) if (inventory && !inventoryIds.has(id)) problems.push(`${id}: ${t('분석 결과는 있지만 inventory에 없습니다')}`);

  const allIds = new Set([...inventoryIds, ...fileIds]);
  for (const s of screens.values()) await checkScreen(projectDir, s, allIds, problems);

  await checkScenarios(projectDir, dir, allIds, problems);

  const summary = await load(join(dir, 'summary.json'), 'summary.json', problems);
  if (summary !== undefined) {
    const r = validateSummary(summary);
    if (!r.valid) problems.push(`summary.json: ${r.errors.join('; ')}`);
    else checkSummary(summary, screens, allIds, problems);
  }
  // inventory·screens 폴더 자체의 문제는 어떤 화면을 검사하든 보인다
  const shared = (p) => p.startsWith('inventory.json:') || p.startsWith('screens/:');
  const mine = (p) => shared(p) || only.some((id) => p.startsWith(`${id}:`) || p.startsWith(`screens/${id}.json:`) || p.startsWith(`scenarios/${id}.json:`));
  const result = only.length ? problems.filter(mine) : problems;
  for (const id of only) {
    if (!inventoryIds.has(id) && !fileIds.has(id)) result.push(`${id}: ${t('inventory와 분석 결과 어디에도 없는 화면 ID입니다')}`);
  }
  return { ok: result.length === 0, problems: result };
}
