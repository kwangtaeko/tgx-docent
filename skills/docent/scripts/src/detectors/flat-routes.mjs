// React Router flatRoutes()·Remix v2 파일 이름 라우팅: app/routes/ 아래 파일 이름의 `.`이 경로 구분. (설계 문서 6장 1번)
// 규칙: _index 인덱스, _x 경로 없는 레이아웃, x_ 부모 밖으로, $ 스플랫, $id 매개변수, ($x)·(x) 생략 가능, [..] 글자 그대로
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { toDocentPath } from './route-tree.mjs';
import { byRoute, isDir, isFile, isTestFile, lineOf, loadAliases, screenFiles } from './shared.mjs';

const MODULE_EXT = /\.(tsx|ts|jsx|js)$/;

// 이스케이프([...]) 밖의 '.'으로 나눈다. raw는 원래 글자, text는 이스케이프를 푼 글자, escaped는 이스케이프가 있었는지
export function splitRouteName(name) {
  const segs = [];
  let raw = '';
  let text = '';
  let escaped = false;
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    if (c === '[') {
      const end = name.indexOf(']', i + 1);
      if (end > i) {
        raw += name.slice(i, end + 1);
        text += name.slice(i + 1, end);
        escaped = true;
        i = end;
        continue;
      }
    }
    if (c === '.') {
      segs.push({ raw, text, escaped });
      raw = '';
      text = '';
      escaped = false;
      continue;
    }
    raw += c;
    text += c;
  }
  segs.push({ raw, text, escaped });
  return segs;
}

// 세그먼트 하나 → React Router 경로 조각. undefined면 주소에 나타나지 않는 세그먼트(인덱스·경로 없는 레이아웃)
function pathPart({ raw, text, escaped }) {
  // 이스케이프가 있으면 글자 그대로(끝 밑줄은 이스케이프 밖에 있을 때만 규칙)
  if (escaped) return raw.endsWith('_') ? text.slice(0, -1) : text;
  if (raw === '_index') return undefined;
  if (raw.startsWith('_')) return undefined;
  const seg = raw.replace(/_$/, '');
  if (seg === '$') return '*';
  const optional = /^\((.*)\)$/.exec(seg);
  if (optional) return optional[1].startsWith('$') ? `:${optional[1].slice(1)}?` : `${optional[1]}?`;
  if (seg.startsWith('$')) return `:${seg.slice(1)}`;
  return seg;
}

// 라우트 이름 → React Router 경로('/users/:id')
export function flatRoutePath(name) {
  const parts = splitRouteName(name).map(pathPart).filter((p) => p !== undefined);
  return '/' + parts.join('/');
}

const isPathless = (name) => {
  const last = splitRouteName(name).at(-1);
  return !last.escaped && last.raw.startsWith('_');
};

// routesDir(프로젝트 기준) 바로 아래의 라우트 모듈: 파일 x.tsx, 폴더 x/route.tsx
async function routeModules(projectDir, routesDir) {
  const modules = [];
  for (const entry of await readdir(join(projectDir, routesDir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = `${routesDir}/${entry.name}`;
    if (entry.isFile() && MODULE_EXT.test(entry.name) && !entry.name.endsWith('.d.ts') && !isTestFile(rel)) {
      modules.push({ name: entry.name.replace(MODULE_EXT, ''), file: rel });
    } else if (entry.isDirectory()) {
      for (const ext of ['tsx', 'ts', 'jsx', 'js']) {
        if (await isFile(join(projectDir, rel, `route.${ext}`))) {
          modules.push({ name: entry.name, file: `${rel}/route.${ext}` });
          break;
        }
      }
    }
  }
  return modules.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// → [{ route, files, evidence }] (경로는 projectDir 기준)
export async function flatRouteScreens(projectDir, routesDir) {
  if (!(await isDir(join(projectDir, routesDir)))) return [];
  const aliases = await loadAliases(projectDir);
  const modules = await routeModules(projectDir, routesDir);
  const byName = new Map(modules.map((m) => [m.name, m]));
  // 부모: 이름이 '부모.'으로 시작하는 가장 긴 다른 라우트
  const parentOf = (name) => {
    let best;
    for (const m of modules) if (name.startsWith(`${m.name}.`) && (!best || m.name.length > best.name.length)) best = m;
    return best;
  };
  const children = new Map();
  for (const m of modules) {
    const p = parentOf(m.name);
    if (p) children.set(p.name, [...(children.get(p.name) ?? []), m]);
  }
  const ancestors = (m) => {
    const out = [];
    for (let p = parentOf(m.name); p; p = parentOf(p.name)) out.push(p.file);
    return out;
  };

  const screens = new Map();
  for (const m of modules) {
    const kids = children.get(m.name) ?? [];
    if (kids.length) {
      // 자식이 있는 레이아웃: 인덱스 자식이 있거나 주소가 없으면 화면이 아니다
      if (byName.has(`${m.name}._index`) || isPathless(m.name)) continue;
    }
    const route = toDocentPath(flatRoutePath(m.name));
    if (route === undefined || screens.has(route)) continue;
    const source = await readFile(join(projectDir, m.file), 'utf8');
    const files = await screenFiles(projectDir, m.file, aliases);
    for (const file of ancestors(m)) if (!files.includes(file)) files.push(file);
    screens.set(route, { route, files, evidence: `${m.file}:${lineOf(source, /\bexport\s+default\b/)}` });
  }
  return [...screens.values()].sort(byRoute);
}

// routes.ts의 flatRoutes({ rootDirectory: '...' }) — 없으면 'routes'. app 폴더 기준
export function flatRoutesDirectory(source) {
  if (!/\bflatRoutes\s*\(/.test(source)) return undefined;
  const m = /\bflatRoutes\s*\(\s*\{[^}]*\brootDirectory\s*:\s*['"]([^'"]+)['"]/.exec(source);
  return posix.normalize((m?.[1] ?? 'routes').replace(/^\.\//, '').replace(/\/$/, ''));
}
