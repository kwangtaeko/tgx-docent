// 모노레포의 앱 후보 찾기: package.json workspaces, pnpm-workspace.yaml, 없으면 apps/*·packages/*.
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parse } from 'yaml';
import { DETECTORS } from '../detectors/index.mjs';
import { isDir, isFile, readJsonc, SKIP_DIRS } from '../detectors/shared.mjs';

const FALLBACK = ['apps/*', 'packages/*'];

async function patterns(projectDir) {
  const pkg = await readJsonc(join(projectDir, 'package.json'));
  const fromPkg = Array.isArray(pkg?.workspaces) ? pkg.workspaces : pkg?.workspaces?.packages;
  let fromPnpm;
  try {
    fromPnpm = parse(await readFile(join(projectDir, 'pnpm-workspace.yaml'), 'utf8'))?.packages;
  } catch {
    // 없거나 깨진 파일은 다른 출처로
  }
  const list = [...(Array.isArray(fromPkg) ? fromPkg : []), ...(Array.isArray(fromPnpm) ? fromPnpm : [])].filter((p) => typeof p === 'string');
  return list.length ? list : FALLBACK;
}

// 'apps/*'·'apps/**'는 apps 바로 아래 폴더, 그 밖에는 적힌 경로 그대로('!' 제외 패턴은 뺀다)
async function expand(projectDir, pattern) {
  if (pattern.startsWith('!')) return [];
  const clean = posix.normalize(pattern.replace(/^\.\//, '')).replace(/\/$/, '');
  if (clean.startsWith('..') || clean.startsWith('/')) return [];
  const star = /^(.*?)\/?\*\*?$/.exec(clean);
  if (!star) return (await isDir(join(projectDir, clean))) ? [clean] : [];
  const base = star[1];
  if (base.includes('*') || !(await isDir(join(projectDir, base)))) return [];
  const entries = await readdir(join(projectDir, base), { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name)).map((e) => (base ? `${base}/${e.name}` : e.name));
}

// → [{ dir, detectors }] 감지기가 하나라도 맞는 워크스페이스 폴더(이름순)
export async function findWorkspaceApps(projectDir) {
  const dirs = new Set();
  for (const pattern of await patterns(projectDir)) for (const dir of await expand(projectDir, pattern)) dirs.add(dir);
  const apps = [];
  for (const dir of [...dirs].sort()) {
    if (!(await isFile(join(projectDir, dir, 'package.json')))) continue;
    const detectors = [];
    for (const d of DETECTORS) if (await d.detect(join(projectDir, dir))) detectors.push(d.name);
    if (detectors.length) apps.push({ dir, detectors });
  }
  return apps;
}
