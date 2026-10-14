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
