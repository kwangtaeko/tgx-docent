// React Router 화면 감지기: v7 프레임워크 모드(app/routes.ts, flatRoutes() 포함), Remix v2(app/routes/ 파일 이름), 코드 라우터(createBrowserRouter·useRoutes·<Route>). (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { flatRouteScreens, flatRoutesDirectory } from './flat-routes.mjs';
import { findImport, flattenRoutes, parseJsxRoutes, parseRouteConfig, parseRouteObjects, toDocentPath } from './route-tree.mjs';
import { byRoute, hasDependency, isDir, isFile, isTestFile, loadAliases, resolveImport, screenFiles, walk } from './shared.mjs';

export const name = 'react-router';

const SOURCE_EXT = /\.(tsx|jsx|ts|js)$/;
const ROUTER_HINT = /createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|<Route\b|RouteObject/;

export async function detect(projectDir) {
  return hasDependency(projectDir, ['react-router', 'react-router-dom', '@remix-run/react']);
}

async function routeConfigFile(projectDir) {
  for (const file of ['app/routes.ts', 'app/routes.js', 'app/routes.tsx', 'app/routes.jsx']) {
    if (await isFile(join(projectDir, file))) return file;
  }
  return undefined;
}

function add(screens, route, files, evidence) {
  if (route !== undefined && !screens.has(route)) screens.set(route, { route, files, evidence });
}

// v7: route('경로', '파일') — 파일은 app/ 기준. flatRoutes()가 있으면 파일 이름 라우트도 더한다
async function fromRouteConfig(projectDir, file, aliases, screens) {
  const source = await readFile(join(projectDir, file), 'utf8');
  for (const { path, node } of flattenRoutes(parseRouteConfig(source))) {
    const target = posix.join(posix.dirname(file), node.component.importPath);
    const files = (await isFile(join(projectDir, target))) ? await screenFiles(projectDir, target, aliases) : [file];
    add(screens, toDocentPath(path), files, `${file}:${node.line}`);
  }
  // 같은 경로면 route()로 적은 쪽이 먼저
  const flatDir = flatRoutesDirectory(source);
  if (flatDir) {
    for (const s of await flatRouteScreens(projectDir, posix.join(posix.dirname(file), flatDir))) add(screens, s.route, s.files, s.evidence);
  }
}

async function componentFile(projectDir, file, source, component, aliases) {
  const spec = component.importPath ?? findImport(source, component.name);
  return spec ? resolveImport(projectDir, file, spec, aliases) : undefined;
}

async function fromCodeRouters(projectDir, aliases, screens) {
  const root = (await isDir(join(projectDir, 'src'))) ? 'src' : '';
  for (const file of (await walk(projectDir, root)).filter((f) => SOURCE_EXT.test(f) && !isTestFile(f)).sort()) {
    const source = await readFile(join(projectDir, file), 'utf8');
    if (!ROUTER_HINT.test(source)) continue;
    const routes = [...flattenRoutes(parseRouteObjects(source)), ...flattenRoutes(parseJsxRoutes(source))];
    for (const { path, node } of routes) {
      const target = await componentFile(projectDir, file, source, node.component, aliases);
      // 같은 파일에 정의된 컴포넌트처럼 찾지 못하면 라우터 파일을 화면 파일로 둔다
      const files = target ? await screenFiles(projectDir, target, aliases) : [file];
      add(screens, toDocentPath(path), files, `${file}:${node.line}`);
    }
  }
}

// flatRoutes()를 쓰는데 라우트 파일을 하나도 찾지 못하면 알린다(폴더 이름을 다르게 둔 경우 등)
export async function warnings(projectDir) {
  const config = await routeConfigFile(projectDir);
  if (!config) return [];
  const flatDir = flatRoutesDirectory(await readFile(join(projectDir, config), 'utf8'));
  if (!flatDir || (await listScreens(projectDir)).length) return [];
  const dir = posix.join(posix.dirname(config), flatDir);
  return [`${config}의 flatRoutes()가 가리키는 ${dir}/에서 라우트 파일을 찾지 못했습니다 — route-explorer로 화면을 찾으세요(references/stacks/js-routers.md)`];
}

export async function listScreens(projectDir) {
  const aliases = await loadAliases(projectDir);
  const screens = new Map();
  const config = await routeConfigFile(projectDir);
  if (config) await fromRouteConfig(projectDir, config, aliases, screens);
  // Remix v2는 routes.ts 없이 app/routes/ 파일 이름으로 라우트를 만든다
  else if (await hasDependency(projectDir, ['@remix-run/react'])) for (const s of await flatRouteScreens(projectDir, 'app/routes')) add(screens, s.route, s.files, s.evidence);
  else await fromCodeRouters(projectDir, aliases, screens);
  return [...screens.values()].sort(byRoute);
}
