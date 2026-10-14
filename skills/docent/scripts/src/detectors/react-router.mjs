// React Router 화면 감지기: v7 프레임워크 모드(app/routes.ts)와 코드 라우터(createBrowserRouter·useRoutes·<Route>). (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { findImport, flattenRoutes, parseJsxRoutes, parseRouteConfig, parseRouteObjects, toDocentPath } from './route-tree.mjs';
import { byRoute, hasDependency, isDir, isFile, isTestFile, loadAliases, resolveImport, screenFiles, walk } from './shared.mjs';

export const name = 'react-router';

const SOURCE_EXT = /\.(tsx|jsx|ts|js)$/;
const ROUTER_HINT = /createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|<Route\b|RouteObject/;

export async function detect(projectDir) {
  return hasDependency(projectDir, ['react-router', 'react-router-dom']);
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

// v7: route('경로', '파일') — 파일은 app/ 기준
async function fromRouteConfig(projectDir, file, aliases, screens) {
  const source = await readFile(join(projectDir, file), 'utf8');
  for (const { path, node } of flattenRoutes(parseRouteConfig(source))) {
    const target = posix.join(posix.dirname(file), node.component.importPath);
    const files = (await isFile(join(projectDir, target))) ? await screenFiles(projectDir, target, aliases) : [file];
    add(screens, toDocentPath(path), files, `${file}:${node.line}`);
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

export async function listScreens(projectDir) {
  const aliases = await loadAliases(projectDir);
  const screens = new Map();
  const config = await routeConfigFile(projectDir);
  if (config) await fromRouteConfig(projectDir, config, aliases, screens);
  else await fromCodeRouters(projectDir, aliases, screens);
  return [...screens.values()].sort(byRoute);
}
