import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatRoutePath, flatRouteScreens, flatRoutesDirectory, splitRouteName } from '../../skills/docent/scripts/src/detectors/flat-routes.mjs';
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

test('rootDirectory 인자를 읽는다', () => {
  assert.equal(flatRoutesDirectory('export default flatRoutes();'), 'routes');
  assert.equal(flatRoutesDirectory("export default flatRoutes({ rootDirectory: './pages/' });"), 'pages');
  assert.equal(flatRoutesDirectory("export default [route('a', 'a.tsx')];"), undefined);
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
