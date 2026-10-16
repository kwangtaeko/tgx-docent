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

// ignoredRouteFiles의 glob(routes 폴더 기준 경로): ** 여러 단계, * 한 단계 안, ? 한 글자, {a,b} 둘 중 하나
export function globMatcher(globs) {
  const res = globs.map((g) => {
    let re = '';
    for (let i = 0; i < g.length; i++) {
      const c = g[i];
      if (c === '*' && g[i + 1] === '*') {
        re += g[i + 2] === '/' ? '(?:.*/)?' : '.*';
        i += g[i + 2] === '/' ? 2 : 1;
      } else if (c === '*') re += '[^/]*';
      else if (c === '?') re += '[^/]';
      else if (c === '{') {
        const end = g.indexOf('}', i);
        if (end < 0) re += '\\{';
        else {
          re += `(?:${g.slice(i + 1, end).split(',').map((x) => x.replace(/[.+^$()|[\]\\]/g, '\\$&')).join('|')})`;
          i = end;
        }
      } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
    }
    return new RegExp(`^${re}$`);
  });
  return (rel) => res.some((r) => r.test(rel));
}

// → [{ route, files, evidence }] (경로는 projectDir 기준)
// prefix: prefix('docs', flatRoutes())로 감싼 경로 앞부분, ignored: ignoredRouteFiles glob 목록
export async function flatRouteScreens(projectDir, routesDir, { prefix = '', ignored = [] } = {}) {
  if (!(await isDir(join(projectDir, routesDir)))) return [];
  const aliases = await loadAliases(projectDir);
  const isIgnored = globMatcher(ignored);
  const modules = (await routeModules(projectDir, routesDir)).filter((m) => !isIgnored(m.file.slice(routesDir.length + 1)));
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
    const path = flatRoutePath(m.name);
    const route = toDocentPath(prefix ? `/${prefix.replace(/^\/|\/$/g, '')}${path === '/' ? '' : path}` : path);
    if (route === undefined || screens.has(route)) continue;
    const source = await readFile(join(projectDir, m.file), 'utf8');
    const files = await screenFiles(projectDir, m.file, aliases);
    for (const file of ancestors(m)) if (!files.includes(file)) files.push(file);
    screens.set(route, { route, files, evidence: `${m.file}:${lineOf(source, /\bexport\s+default\b/)}` });
  }
  return [...screens.values()].sort(byRoute);
}

// 문자열 리터럴 배열 ['a', "b"] → ['a', 'b']
const stringList = (text) => [...(text ?? '').matchAll(/(['"`])((?:(?!\1).)*)\1/g)].map((m) => m[2]);

// routes.ts의 flatRoutes() 호출들 → [{ dir, prefix, ignored }]. dir은 app 폴더 기준(rootDirectory, 기본 'routes')
export function flatRoutesCalls(source) {
  const calls = [];
  for (const m of source.matchAll(/\bflatRoutes\s*\(\s*(\{[^}]*\})?/g)) {
    const options = m[1] ?? '';
    const root = /\brootDirectory\s*:\s*['"]([^'"]+)['"]/.exec(options)?.[1] ?? 'routes';
    const ignored = stringList(/\bignoredRouteFiles\s*:\s*\[([^\]]*)\]/.exec(options)?.[1]);
    // ...prefix('docs', await flatRoutes(...)) 처럼 바로 감싼 prefix
    const before = source.slice(0, m.index);
    const prefix = /\bprefix\s*\(\s*['"]([^'"]*)['"]\s*,\s*(?:await\s+)?(?:\(\s*)?$/.exec(before)?.[1] ?? '';
    calls.push({ dir: posix.normalize(root.replace(/^\.\//, '').replace(/\/$/, '')), prefix, ignored });
  }
  return calls;
}

// Remix v2: vite.config의 remix({ ignoredRouteFiles }) 또는 remix.config의 ignoredRouteFiles
export async function remixIgnoredRouteFiles(projectDir) {
  for (const file of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts', 'remix.config.js', 'remix.config.cjs', 'remix.config.mjs']) {
    let source;
    try {
      source = await readFile(join(projectDir, file), 'utf8');
    } catch {
      continue;
    }
    const m = /\bignoredRouteFiles\s*:\s*\[([^\]]*)\]/.exec(source);
    if (m) return stringList(m[1]);
  }
  return [];
}
