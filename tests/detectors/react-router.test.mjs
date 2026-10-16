import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as reactRouter from '../../skills/docent/scripts/src/detectors/react-router.mjs';
import { project } from '../helpers/project.mjs';

const expected = async (name) => JSON.parse(await readFile(`fixtures/expected/detectors/${name}.json`, 'utf8'));

test('이름과 detect', async () => {
  assert.equal(reactRouter.name, 'react-router');
  assert.equal(await reactRouter.detect('fixtures/detectors/react-router'), true);
  assert.equal(await reactRouter.detect('fixtures/detectors/react-router-v7'), true);
  assert.equal(await reactRouter.detect(await project({ 'package.json': '{"dependencies":{"@remix-run/react":"2"}}' })), true);
  assert.equal(await reactRouter.detect(await project({ 'package.json': '{"dependencies":{"next":"15"}}' })), false);
});

test('픽스처 결과가 기대값과 같다', async () => {
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router'), await expected('react-router'));
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router-v7'), await expected('react-router-v7'));
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router-flat'), await expected('react-router-flat'));
});

const ROUTER = (eol) =>
  ["import A from './A';", "import { createBrowserRouter } from 'react-router-dom';", '', 'export const r = createBrowserRouter([', "  { path: ROUTES.x, element: <A /> },", "  { path: '/a', element: <A /> },", ']);', ''].join(eol);

test('리터럴이 아닌 path는 건너뛴다', async () => {
  const dir = await project({ 'package.json': '{"dependencies":{"react-router-dom":"6"}}', 'src/router.tsx': ROUTER('\n'), 'src/A.tsx': 'export default function A() {}\n' });
  assert.deepEqual(await reactRouter.listScreens(dir), [{ route: '/a', files: ['src/A.tsx'], evidence: 'src/router.tsx:6' }]);
});

test('CRLF 파일도 줄 번호가 같다', async () => {
  const dir = await project({ 'package.json': '{"dependencies":{"react-router-dom":"6"}}', 'src/router.tsx': ROUTER('\r\n'), 'src/A.tsx': '' });
  assert.equal((await reactRouter.listScreens(dir))[0].evidence, 'src/router.tsx:6');
});

test('컴포넌트를 찾지 못하면 라우터 파일을 files로', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'src/App.tsx': "function Inline() { return null; }\nexport default () => <Routes><Route path=\"/in\" element={<Inline />} /></Routes>;\n",
  });
  assert.deepEqual(await reactRouter.listScreens(dir), [{ route: '/in', files: ['src/App.tsx'], evidence: 'src/App.tsx:2' }]);
});

test('테스트·스토리 파일의 라우트는 화면이 아니다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router-dom":"6"}}',
    'src/router.tsx': "import A from './A';\nexport const r = createBrowserRouter([{ path: '/a', element: <A /> }]);\n",
    'src/A.tsx': '',
    'src/__tests__/Orders.test.tsx': '<MemoryRouter><Routes><Route path="/login" element={<div />} /></Routes></MemoryRouter>',
    'src/Orders.spec.tsx': '<Routes><Route path="/spec" element={<B />} /></Routes>',
    'src/Orders.stories.tsx': '<Routes><Route path="/story" element={<B />} /></Routes>',
  });
  assert.deepEqual((await reactRouter.listScreens(dir)).map((s) => s.route), ['/a']);
});

test('감싸는 요소 안의 화면 파일을 files로', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router-dom":"6"}}',
    'src/router.tsx': "import RequireAuth from './auth/RequireAuth';\nimport Orders from './Orders';\nexport const r = createBrowserRouter([{ path: '/o', element: <RequireAuth><Orders /></RequireAuth> }]);\n",
    'src/auth/RequireAuth.tsx': '',
    'src/Orders.tsx': '',
  });
  assert.deepEqual((await reactRouter.listScreens(dir))[0].files, ['src/Orders.tsx']);
});

test('flatRoutes()가 가리키는 폴더에 라우트 파일이 없으면 경고한다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': "import { flatRoutes } from '@react-router/fs-routes';\nexport default flatRoutes({ rootDirectory: 'pages' }) satisfies RouteConfig;\n",
    'app/routes/_index.tsx': '',
  });
  assert.deepEqual(await reactRouter.listScreens(dir), []);
  assert.ok((await reactRouter.warnings(dir)).some((w) => /flatRoutes.*app\/pages/.test(w)));
  assert.deepEqual(await reactRouter.warnings('fixtures/detectors/react-router-v7'), []);
});

test('감지기 경고는 inventory 경고 목록에 들어간다(제외한 항목과 따로)', async () => {
  const { runInventory } = await import('../../skills/docent/scripts/src/commands/inventory.mjs');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': 'export default flatRoutes();\n',
  });
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'detectors: [react-router]\n');
  const { problems, warnings } = await runInventory(dir);
  assert.ok(warnings.some((p) => /^react-router: .*flatRoutes/.test(p)), warnings.join());
  assert.ok(!problems.some((p) => /flatRoutes/.test(p)), problems.join());
  // route-explorer가 화면을 더한 뒤에는 다시 알리지 않는다
  await mkdir(join(dir, 'app', 'pages'));
  await writeFile(join(dir, 'app', 'pages', 'home.tsx'), 'export default function Home() {}\n');
  await writeFile(join(dir, '.docent', 'inventory.agent.json'), JSON.stringify({ screens: [{ route: '/', kind: 'page', files: ['app/pages/home.tsx'], evidence: 'app/pages/home.tsx:1' }] }));
  const again = await runInventory(dir);
  assert.deepEqual(again.warnings, []);
  assert.deepEqual(again.inventory.screens.map((s) => s.route), ['/']);
});

test('변수 경로·스프레드로 붙인 라우트는 화면을 빠뜨렸을 수 있다고 경고한다(위치와 함께)', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router-dom":"7"}}',
    'src/router.tsx': [
      "import Shell from './Shell';",
      "import Home from './Home';",
      "const menuRoutes = Object.entries(MENU).map(([code, r]) => ({ path: r.path, element: <Page code={code} /> }));",
      'export const router = createBrowserRouter([',
      "  { path: '/', element: <Shell />, children: [",
      '    { index: true, element: <Home /> },',
      '    ...menuRoutes,',
      '  ] },',
      ']);',
      '',
    ].join('\n'),
    'src/Shell.tsx': '',
    'src/Home.tsx': '',
  });
  assert.deepEqual((await reactRouter.listScreens(dir)).map((s) => s.route), ['/']);
  const [w, ...rest] = await reactRouter.warnings(dir, (p) => `web/${p}`);
  assert.deepEqual(rest, []);
  assert.match(w, /web\/src\/router\.tsx:3, web\/src\/router\.tsx:7 .*route-explorer/);
  // 리터럴 경로만 있으면 경고 없음
  assert.deepEqual(await reactRouter.warnings('fixtures/detectors/react-router'), []);
});

test('v7 routes.ts의 route()에 변수 경로가 있으면 경고한다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': "export default [index('routes/home.tsx'), route(PATHS.about, 'routes/about.tsx')] satisfies RouteConfig;\n",
    'app/routes/home.tsx': '',
  });
  assert.ok((await reactRouter.warnings(dir)).some((w) => /app\/routes\.ts:1/.test(w)));
});

test('Remix v2는 routes.ts 없이 app/routes/ 파일 이름으로 화면을 찾는다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"@remix-run/react":"2"}}',
    'app/routes/_index.tsx': 'export default function Index() {}\n',
    'app/routes/posts.$slug.tsx': 'export default function Post() {}\n',
  });
  assert.deepEqual((await reactRouter.listScreens(dir)).map((s) => s.route), ['/', '/posts/[slug]']);
  assert.deepEqual(await reactRouter.warnings(dir), []);
});

test('routes.ts의 route()와 flatRoutes()를 함께 쓰면 둘 다, 같은 경로는 route()가 먼저', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': "export default [route('about', 'pages/about.tsx'), route('login', 'pages/login.tsx'), ...(await flatRoutes())] satisfies RouteConfig;\n",
    'app/pages/about.tsx': 'export default function About() {}\n',
    'app/pages/login.tsx': 'export default function Login() {}\n',
    'app/routes/login.tsx': 'export default function FlatLogin() {}\n',
    'app/routes/faq.tsx': 'export default function Faq() {}\n',
  });
  const screens = await reactRouter.listScreens(dir);
  assert.deepEqual(screens.map((s) => s.route), ['/about', '/faq', '/login']);
  assert.deepEqual(screens.find((s) => s.route === '/login').files, ['app/pages/login.tsx']);
});

test('Remix v2의 vite.config ignoredRouteFiles를 따른다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"@remix-run/react":"2"}}',
    'vite.config.ts': "export default defineConfig({ plugins: [remix({ ignoredRouteFiles: ['**/*.test.*', 'old.*'] })] });\n",
    'app/routes/_index.tsx': 'export default function Index() {}\n',
    'app/routes/old.tsx': 'export default function Old() {}\n',
  });
  assert.deepEqual((await reactRouter.listScreens(dir)).map((s) => s.route), ['/']);
});

test('routes.ts의 prefix로 감싼 flatRoutes()는 경로 앞에 prefix를 붙인다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': "export default [...(await flatRoutes()), ...prefix('admin', await flatRoutes({ rootDirectory: 'admin' }))] satisfies RouteConfig;\n",
    'app/routes/_index.tsx': 'export default function Index() {}\n',
    'app/admin/_index.tsx': 'export default function Admin() {}\n',
    'app/admin/users.tsx': 'export default function Users() {}\n',
  });
  assert.deepEqual((await reactRouter.listScreens(dir)).map((s) => s.route), ['/', '/admin', '/admin/users']);
});
