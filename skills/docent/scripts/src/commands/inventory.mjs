// /docent-inventory: 감지기 결과와 에이전트 후보를 합쳐 .docent/inventory.json을 만든다. (설계 문서 6장)
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { detectorByName } from '../detectors/index.mjs';
import { loadConfig } from '../lib/config.mjs';
import { checkEvidence } from '../lib/evidence.mjs';
import { normalizeRel } from '../lib/paths.mjs';
import { validateInventory, validateInventoryAgent } from '../lib/schema.mjs';
import { assignIds, childId } from '../lib/screen-id.mjs';
import { docentDir, readJsonIfExists, writeJson } from '../lib/workspace.mjs';

// '*'는 세그먼트 하나, '**'는 여러 세그먼트
function globToRegExp(glob) {
  const body = glob
    .split(/(\*\*|\*)/)
    .map((part) => (part === '**' ? '.*' : part === '*' ? '[^/]*' : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
}

function matchesAny(route, globs) {
  return globs.some((g) => globToRegExp(g).test(route));
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectAgentEntries(projectDir, problems) {
  let data;
  try {
    data = await readJsonIfExists(join(docentDir(projectDir), 'inventory.agent.json'));
  } catch (err) {
    problems.push(`inventory.agent.json: JSON 형식 오류 (${err.message})`);
    return [];
  }
  if (!data) return [];
  const { valid, errors } = validateInventoryAgent(data);
  if (!valid) {
    problems.push(`inventory.agent.json: ${errors.join('; ')}`);
    return [];
  }
  return data.screens;
}

// 경로 정규화, 파일 존재, 근거 확인. 문제가 있으면 undefined
async function checkEntry(projectDir, label, entry, problems) {
  let files;
  try {
    files = [...new Set(entry.files.map(normalizeRel))];
  } catch (err) {
    problems.push(`${label}: ${err.message}`);
    return undefined;
  }
  for (const file of files) {
    if (!(await fileExists(join(projectDir, file)))) {
      problems.push(`${label}: 파일 없음 ${file}`);
      return undefined;
    }
  }
  const ev = await checkEvidence(projectDir, entry.evidence);
  if (!ev.ok) {
    problems.push(`${label}: ${ev.reason}`);
    return undefined;
  }
  return files;
}

export async function runInventory(projectDir) {
  const config = await loadConfig(projectDir);
  const problems = [];
  const previous = await readJsonIfExists(join(docentDir(projectDir), 'inventory.json'));
  const previousIds = new Map((previous?.screens ?? []).filter((s) => s.route).map((s) => [s.route, s.id]));
  const previousMenus = new Map((previous?.screens ?? []).filter((s) => s.menuPath).map((s) => [s.id, s.menuPath]));

  const pages = new Map(); // route → entry
  for (const name of config.detectors) {
    const detector = detectorByName(name);
    if (!detector) {
      problems.push(`config.yaml: 알 수 없는 감지기 ${name}`);
      continue;
    }
    for (const s of await detector.listScreens(projectDir)) {
      if (!pages.has(s.route)) pages.set(s.route, { ...s, kind: 'page', source: `detector:${name}` });
    }
  }

  const agentEntries = await collectAgentEntries(projectDir, problems);
  for (const entry of agentEntries.filter((e) => e.kind === 'page')) {
    if (pages.has(entry.route)) continue; // 감지기 결과 우선
    const files = await checkEntry(projectDir, entry.route, entry, problems);
    if (files) pages.set(entry.route, { route: entry.route, files, evidence: entry.evidence, kind: 'page', source: 'agent' });
  }

  const { include, exclude, idMap } = config.screens;
  for (const route of [...pages.keys()]) {
    if ((include.length && !matchesAny(route, include)) || matchesAny(route, exclude)) pages.delete(route);
  }

  const ids = assignIds([...pages.keys()], previousIds);
  for (const [route, id] of Object.entries(idMap)) {
    if (!ids.has(route) || ids.get(route) === id) continue;
    const owner = [...ids].find(([r, x]) => x === id && r !== route);
    if (owner) {
      problems.push(`config.yaml: idMap의 ${route} → ${id}는 ${owner[0]} 화면의 ID와 겹쳐 적용하지 않았습니다`);
      continue;
    }
    ids.set(route, id);
  }

  const children = new Map(); // parent id → entries
  for (const entry of agentEntries.filter((e) => e.kind !== 'page')) {
    const label = entry.name;
    if (!ids.has(entry.parentRoute)) {
      // 제외 설정으로 빠진 부모는 문제로 보지 않는다
      const excluded = (include.length && !matchesAny(entry.parentRoute, include)) || matchesAny(entry.parentRoute, exclude);
      if (!excluded) problems.push(`${label}: 부모 화면 ${entry.parentRoute} 없음`);
      continue;
    }
    const files = await checkEntry(projectDir, label, entry, problems);
    if (!files) continue;
    const parentId = ids.get(entry.parentRoute);
    const list = children.get(parentId) ?? [];
    list.push({ id: childId(parentId, entry.name), route: null, kind: entry.kind, parentId, files, evidence: entry.evidence, source: 'agent' });
    children.set(parentId, list);
  }

  // 메뉴 경로: 분석된 화면 JSON의 값 > 이전 inventory의 값
  const menuOf = async (id) => {
    try {
      const analyzed = await readJsonIfExists(join(docentDir(projectDir), 'screens', `${id}.json`));
      if (analyzed?.menuPath?.value?.length) return analyzed.menuPath.value;
    } catch {
      // 깨진 화면 파일은 validate가 보고한다
    }
    return previousMenus.get(id);
  };

  const screens = [];
  for (const route of [...pages.keys()].sort()) {
    const page = pages.get(route);
    const id = ids.get(route);
    const menuPath = await menuOf(id);
    screens.push({
      id,
      route,
      kind: 'page',
      files: page.files,
      ...(menuPath ? { menuPath } : {}),
      evidence: page.evidence,
      source: page.source,
    });
    for (const child of (children.get(id) ?? []).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const childMenu = await menuOf(child.id);
      screens.push(childMenu ? { ...child, menuPath: childMenu } : child);
    }
  }

  const inventory = { version: 1, screens };
  const { valid, errors } = validateInventory(inventory);
  if (!valid) throw new Error(`inventory.json 스키마 오류: ${errors.join('; ')}`);
  await writeJson(join(docentDir(projectDir), 'inventory.json'), inventory);
  return { inventory, problems };
}
