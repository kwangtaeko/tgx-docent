// 모노레포의 앱 후보 찾기: package.json workspaces, pnpm-workspace.yaml, 없으면 apps/*·packages/*와 루트 바로 아래 폴더(frontend/·web/ 등).
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parse } from 'yaml';
import { DETECTORS } from '../detectors/index.mjs';
import { isDir, isFile, readJsonc, SKIP_DIRS } from '../detectors/shared.mjs';

// 워크스페이스 설정 없이 frontend/·backend/처럼 나눈 저장소도 있다
const FALLBACK = ['apps/*', 'packages/*', '*'];

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

// 화면이 있는 앱으로 볼 의존성(감지기가 없는 라우터 없는 앱·데스크톱 앱도 찾기 위해)
const UI_DEPS = ['react', 'vue', 'svelte', 'solid-js', 'preact', '@angular/core', 'electron', '@tauri-apps/api'];

const depsOf = async (dir) => {
  const pkg = await readJsonc(join(dir, 'package.json'));
  return new Set([...Object.keys(pkg?.dependencies ?? {}), ...Object.keys(pkg?.devDependencies ?? {})]);
};

// 브라우저로 띄울 수 없는 데스크톱 앱: 'electron' | 'tauri' | undefined
export async function desktopKind(dir) {
  const deps = await depsOf(dir);
  if (deps.has('electron')) return 'electron';
  if (deps.has('@tauri-apps/api') || deps.has('@tauri-apps/cli')) return 'tauri';
  return undefined;
}

// → [{ dir, detectors, desktop? }] 워크스페이스 폴더 중 감지기가 맞는 앱(이름순).
// 감지기가 맞는 앱이 하나도 없으면, 화면 라이브러리(React·Vue 등)나 데스크톱 런타임을 쓰는 폴더를 detectors: []로 돌려준다
export async function findWorkspaceApps(projectDir) {
  const dirs = new Set();
  for (const pattern of await patterns(projectDir)) for (const dir of await expand(projectDir, pattern)) dirs.add(dir);
  const detected = [];
  const ui = [];
  for (const dir of [...dirs].sort()) {
    const abs = join(projectDir, dir);
    if (!(await isFile(join(abs, 'package.json')))) continue;
    const desktop = await desktopKind(abs);
    const deps = await depsOf(abs);
    const detectors = [];
    for (const d of DETECTORS) if (await d.detect(abs)) detectors.push(d.name);
    const entry = { dir, detectors, ...(desktop ? { desktop } : {}) };
    if (detectors.length) detected.push(entry);
    else if (desktop || UI_DEPS.some((d) => deps.has(d))) ui.push(entry);
  }
  return detected.length ? detected : ui;
}
