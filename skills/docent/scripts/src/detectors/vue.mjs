// Vue 화면 감지기: Nuxt 파일 라우팅(pages/)과 Vue Router 라우트 선언. (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findImport, flattenRoutes, parseRouteObjects, toDocentPath } from './route-tree.mjs';
import { byRoute, hasDependency, isDir, isFile, lineOf, loadAliases, resolveImport, screenFiles, walk } from './shared.mjs';

export const name = 'vue';

// create-vue·Nuxt가 기본으로 두는 별칭(tsconfig에 없을 때를 위해)
const VUE_ALIASES = [{ prefix: '@/', wildcard: true, targets: ['src/*'] }];
const NUXT_ALIASES = [
  { prefix: '~/', wildcard: true, targets: ['*'] },
  { prefix: '@/', wildcard: true, targets: ['*'] },
];
const SOURCE_EXT = /\.(ts|js|mjs)$/;

export async function detect(projectDir) {
  return hasDependency(projectDir, ['vue-router', 'nuxt']);
}

function isCatchAllOnly(route) {
  const segs = route.split('/').filter(Boolean);
  return segs.length === 1 && /^\[\[?\.\.\./.test(segs[0]);
}

// pages/a/b/index.vue → /a/b
function pageRoute(pagesDir, file) {
  const parts = file.slice(pagesDir.length + 1).replace(/\.vue$/, '').split('/');
  if (parts.at(-1) === 'index') parts.pop();
  return '/' + parts.join('/');
}

async function nuxtScreens(projectDir) {
  const pagesDir = (await isDir(join(projectDir, 'app', 'pages'))) ? 'app/pages' : 'pages';
  if (!(await isDir(join(projectDir, pagesDir)))) return [];
  const aliases = await loadAliases(projectDir, NUXT_ALIASES);
  const files = (await walk(projectDir, pagesDir)).filter((f) => f.endsWith('.vue'));
  const dirs = new Set(files.map((f) => f.slice(0, f.lastIndexOf('/'))));
  const screens = [];
  for (const file of files) {
    // x.vue 옆에 x/ 폴더가 있으면 x.vue는 자식 화면을 감싸는 부모(레이아웃)
    if (dirs.has(file.replace(/\.vue$/, ''))) continue;
    const route = pageRoute(pagesDir, file);
    if (isCatchAllOnly(route)) continue;
    const source = await readFile(join(projectDir, file), 'utf8');
    const list = await screenFiles(projectDir, file, aliases);
    // index.vue는 부모 x.vue 안에 그려지므로 부모도 화면 파일이다
    const parent = file.endsWith('/index.vue') ? `${file.slice(0, -'/index.vue'.length)}.vue` : undefined;
    if (parent && files.includes(parent) && !list.includes(parent)) list.push(parent);
    screens.push({ route, files: list, evidence: `${file}:${lineOf(source, /<template\b/)}` });
  }
  return screens.sort(byRoute);
}

async function routerScreens(projectDir) {
  const aliases = await loadAliases(projectDir, VUE_ALIASES);
  const root = (await isDir(join(projectDir, 'src'))) ? 'src' : '';
  const screens = new Map();
  for (const file of (await walk(projectDir, root)).filter((f) => SOURCE_EXT.test(f)).sort()) {
    const source = await readFile(join(projectDir, file), 'utf8');
    if (!/createRouter\s*\(|RouteRecordRaw/.test(source) && !/(^|\/)router\//.test(file)) continue;
    for (const { path, node } of flattenRoutes(parseRouteObjects(source))) {
      const route = toDocentPath(path);
      if (route === undefined || screens.has(route)) continue;
      const spec = node.component.importPath ?? findImport(source, node.component.name);
      const target = spec ? await resolveImport(projectDir, file, spec, aliases) : undefined;
      const files = target && (await isFile(join(projectDir, target))) ? await screenFiles(projectDir, target, aliases) : [file];
      screens.set(route, { route, files, evidence: `${file}:${node.line}` });
    }
  }
  return [...screens.values()].sort(byRoute);
}

export async function listScreens(projectDir) {
  if (await hasDependency(projectDir, ['nuxt'])) return nuxtScreens(projectDir);
  return routerScreens(projectDir);
}
