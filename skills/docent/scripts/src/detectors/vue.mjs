// Vue 화면 감지기: Nuxt 파일 라우팅(pages/)과 Vue Router 라우트 선언. (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { findImport, flattenRoutes, parseRouteObjects, toDocentPath, unreadWarnings } from './route-tree.mjs';
import { byRoute, hasDependency, isDir, isFile, isTestFile, lineOf, loadAliases, resolveImport, screenFiles, walk } from './shared.mjs';

export const name = 'vue';

// create-vue·Nuxt가 기본으로 두는 별칭(tsconfig에 없을 때를 위해)
const VUE_ALIASES = [{ prefix: '@/', wildcard: true, targets: ['src/*'] }];
// ~/·@/는 srcDir, ~~/·@@/는 프로젝트 루트
const nuxtAliases = (srcDir) => {
  const src = srcDir ? `${srcDir}/*` : '*';
  return [
    { prefix: '~~/', wildcard: true, targets: ['*'] },
    { prefix: '@@/', wildcard: true, targets: ['*'] },
    { prefix: '~/', wildcard: true, targets: [src] },
    { prefix: '@/', wildcard: true, targets: [src] },
  ];
};
const NUXT_CONFIGS = ['nuxt.config.ts', 'nuxt.config.js', 'nuxt.config.mjs', 'nuxt.config.mts'];
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

// 프로젝트 안의 상대 경로만 받는다('./src/' → 'src'). 밖을 가리키거나 절대 경로면 undefined
function relDir(value) {
  if (value === undefined) return undefined;
  const dir = posix.normalize(value.replace(/\\/g, '/')).replace(/^\.(\/|$)/, '').replace(/\/$/, '');
  if (dir.startsWith('/') || dir === '..' || dir.startsWith('../') || /^[A-Za-z]:/.test(dir)) return undefined;
  return dir;
}

// nuxt.config의 srcDir·dir.pages(문자열 리터럴만)
export async function nuxtDirs(projectDir) {
  for (const file of NUXT_CONFIGS) {
    let source;
    try {
      source = await readFile(join(projectDir, file), 'utf8');
    } catch {
      continue;
    }
    const srcDir = relDir(/\bsrcDir\s*:\s*['"`]([^'"`]*)['"`]/.exec(source)?.[1]);
    const pages = relDir(/\bdir\s*:\s*\{[^}]*?\bpages\s*:\s*['"`]([^'"`]+)['"`]/s.exec(source)?.[1]);
    return { srcDir, pages };
  }
  return {};
}

async function nuxtScreens(projectDir) {
  const config = await nuxtDirs(projectDir);
  // srcDir가 없으면 Nuxt 4 기본(app/)에 pages가 있는지 보고, 없으면 루트(Nuxt 3)
  const srcDir = config.srcDir ?? ((await isDir(join(projectDir, 'app', config.pages ?? 'pages'))) ? 'app' : '');
  const pagesDir = posix.join(srcDir || '.', config.pages ?? 'pages');
  if (!(await isDir(join(projectDir, pagesDir)))) return [];
  const aliases = await loadAliases(projectDir, nuxtAliases(srcDir));
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

// 라우터 파일마다 → { file, source, nodes }
async function routerFiles(projectDir) {
  const root = (await isDir(join(projectDir, 'src'))) ? 'src' : '';
  const out = [];
  for (const file of (await walk(projectDir, root)).filter((f) => SOURCE_EXT.test(f) && !isTestFile(f)).sort()) {
    const source = await readFile(join(projectDir, file), 'utf8');
    if (/createRouter\s*\(|RouteRecordRaw/.test(source) || /(^|\/)router\//.test(file)) out.push({ file, source, nodes: parseRouteObjects(source) });
  }
  return out;
}

async function routerScreens(projectDir) {
  const aliases = await loadAliases(projectDir, VUE_ALIASES);
  const screens = new Map();
  for (const { file, source, nodes } of await routerFiles(projectDir)) {
    for (const { path, node } of flattenRoutes(nodes)) {
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

// Vue Router에서 경로를 읽지 못한 라우트가 있으면 알린다
export async function warnings(projectDir, inApp = (p) => p) {
  if (await hasDependency(projectDir, ['nuxt'])) return [];
  return unreadWarnings((await routerFiles(projectDir)).map(({ file, nodes }) => ({ file: inApp(file), nodes })));
}

export async function listScreens(projectDir) {
  if (await hasDependency(projectDir, ['nuxt'])) return nuxtScreens(projectDir);
  return routerScreens(projectDir);
}
