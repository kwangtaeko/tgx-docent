import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatRoutePath, flatRouteScreens, flatRoutesCalls, globMatcher, splitRouteName } from '../../skills/docent/scripts/src/detectors/flat-routes.mjs';
import { project } from '../helpers/project.mjs';

test('파일 이름 규칙 → 경로', () => {
  const cases = {
    _index: '/',
    login: '/login',
    'orders._index': '/orders',
    'orders.$orderId': '/orders/:orderId',
    'orders_.new': '/orders/new',
    '_auth.signup': '/signup',
    '$': '/*',
    'files.$': '/files/*',
    '($lang).about': '/:lang?/about',
    '(en).docs': '/en?/docs',
    'sitemap[.]xml': '/sitemap.xml',
    '[_]private': '/_private',
  };
  for (const [name, path] of Object.entries(cases)) assert.equal(flatRoutePath(name), path, name);
});

test('이스케이프 안의 점은 나누지 않는다', () => {
  assert.deepEqual(splitRouteName('a.b[.]c.d').map((s) => s.text), ['a', 'b.c', 'd']);
});

test('flatRoutes() 호출의 rootDirectory·ignoredRouteFiles·prefix를 읽는다', () => {
  assert.deepEqual(flatRoutesCalls('export default flatRoutes();'), [{ dir: 'routes', prefix: '', ignored: [] }]);
  assert.deepEqual(flatRoutesCalls("export default flatRoutes({ rootDirectory: './pages/', ignoredRouteFiles: ['**/*.css', \"home.tsx\"] });"), [
    { dir: 'pages', prefix: '', ignored: ['**/*.css', 'home.tsx'] },
  ]);
  assert.deepEqual(flatRoutesCalls("export default [...(await flatRoutes()), ...prefix('docs', await flatRoutes({ rootDirectory: 'docs' }))];"), [
    { dir: 'routes', prefix: '', ignored: [] },
    { dir: 'docs', prefix: 'docs', ignored: [] },
  ]);
  assert.deepEqual(flatRoutesCalls("export default [route('a', 'a.tsx')];"), []);
});

test('ignoredRouteFiles glob', () => {
  const ignored = globMatcher(['**/.*', '**/*.{css,md}', 'home.tsx', 'legacy/**']);
  for (const rel of ['.x.tsx', 'a/.x', 'style.css', 'b/c.md', 'home.tsx', 'legacy/route.tsx']) assert.ok(ignored(rel), rel);
  for (const rel of ['orders.tsx', 'homes.tsx', 'b/home.tsx']) assert.ok(!ignored(rel), rel);
});

test('ignored·prefix를 적용한다', async () => {
  const dir = await project({
    'app/docs/_index.tsx': 'export default function D() {}\n',
    'app/docs/intro.tsx': 'export default function I() {}\n',
    'app/docs/draft.tsx': 'export default function X() {}\n',
  });
  assert.deepEqual((await flatRouteScreens(dir, 'app/docs', { prefix: 'docs', ignored: ['draft.tsx'] })).map((s) => s.route), ['/docs', '/docs/intro']);
});

test('폴더가 없으면 빈 목록', async () => {
  assert.deepEqual(await flatRouteScreens(await project({ 'package.json': '{}' }), 'app/routes'), []);
});

test('조상 레이아웃 파일을 여러 단계 덧붙인다', async () => {
  const dir = await project({
    'app/routes/a.tsx': 'export default function A() {}\n',
    'app/routes/a.b.tsx': 'export default function B() {}\n',
    'app/routes/a.b.c.tsx': 'export default function C() {}\n',
    'app/routes/a.b._index.tsx': 'export default function I() {}\n',
  });
  const screens = await flatRouteScreens(dir, 'app/routes');
  // a는 자식 a.b만 있고 _index가 없으므로 /a 화면, a.b는 _index가 있으므로 화면 아님
  assert.deepEqual(screens.map((s) => s.route), ['/a', '/a/b', '/a/b/c']);
  assert.deepEqual(screens.find((s) => s.route === '/a/b/c').files, ['app/routes/a.b.c.tsx', 'app/routes/a.b.tsx', 'app/routes/a.tsx']);
});

test('export default가 없는 리소스 라우트는 화면이 아니다', async () => {
  const dir = await project({
    'app/routes/_index.tsx': 'export default function Index() {}\n',
    'app/routes/api.webhook.ts': 'export async function action() {}\n',
    'app/routes/logout.tsx': 'export async function action() { return redirect("/"); }\n',
  });
  assert.deepEqual((await flatRouteScreens(dir, 'app/routes')).map((s) => s.route), ['/']);
});

test('프로젝트 밖을 가리키는 rootDirectory는 읽지 않는다', () => {
  assert.deepEqual(flatRoutesCalls("flatRoutes({ rootDirectory: '../../outside' })"), []);
  assert.deepEqual(flatRoutesCalls("flatRoutes({ rootDirectory: '/etc' })"), []);
});
