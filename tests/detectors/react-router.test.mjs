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
  assert.equal(await reactRouter.detect(await project({ 'package.json': '{"dependencies":{"next":"15"}}' })), false);
});

test('픽스처 결과가 기대값과 같다', async () => {
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router'), await expected('react-router'));
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router-v7'), await expected('react-router-v7'));
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

test('flatRoutes()만 쓰는 v7 프로젝트는 경고한다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': "import { flatRoutes } from '@react-router/fs-routes';\nexport default flatRoutes() satisfies RouteConfig;\n",
    'app/routes/_index.tsx': '',
  });
  assert.deepEqual(await reactRouter.listScreens(dir), []);
  assert.ok((await reactRouter.warnings(dir)).some((w) => /flatRoutes/.test(w)));
  assert.deepEqual(await reactRouter.warnings('fixtures/detectors/react-router-v7'), []);
});

test('감지기 경고는 inventory 문제 목록에 들어간다', async () => {
  const { runInventory } = await import('../../skills/docent/scripts/src/commands/inventory.mjs');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = await project({
    'package.json': '{"dependencies":{"react-router":"7"}}',
    'app/routes.ts': 'export default flatRoutes();\n',
  });
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'detectors: [react-router]\n');
  const { problems } = await runInventory(dir);
  assert.ok(problems.some((p) => /^react-router: .*flatRoutes/.test(p)), problems.join());
});
