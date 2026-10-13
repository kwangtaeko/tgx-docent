import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import * as nextjs from '../../skills/docent/scripts/src/detectors/nextjs.mjs';

const FIXTURE = 'fixtures/nextjs-sample';

async function project(files) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-next-'));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, name)), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return dir;
}

test('이름', () => {
  assert.equal(nextjs.name, 'nextjs');
});

test('detect', async () => {
  assert.equal(await nextjs.detect(FIXTURE), true);
  assert.equal(await nextjs.detect(await project({})), false);
  assert.equal(await nextjs.detect(await project({ 'package.json': '{"dependencies":{"react":"19"}}' })), false);
});

test('픽스처 결과가 골든 inventory의 page 항목과 일치한다', async () => {
  const golden = JSON.parse(await readFile('fixtures/expected/nextjs-sample/inventory.json', 'utf8'));
  const expected = golden.screens
    .filter((s) => s.kind === 'page')
    .map(({ route, files, evidence }) => ({ route, files, evidence }))
    .sort((a, b) => (a.route < b.route ? -1 : 1));
  assert.deepEqual(await nextjs.listScreens(FIXTURE), expected);
});

test('Pages Router', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"next":"14"}}',
    'pages/index.tsx': 'export default function Home() {}\n',
    'pages/orders/[id].tsx': 'export default function Order() {}\n',
    'pages/_app.tsx': 'export default function App() {}\n',
    'pages/api/x.ts': 'export default function handler() {}\n',
  });
  assert.deepEqual((await nextjs.listScreens(dir)).map((s) => s.route), ['/', '/orders/[id]']);
});

test('src/app, route group, jsconfig 별칭', async () => {
  const dir = await project({
    'package.json': '{"devDependencies":{"next":"15"}}',
    'jsconfig.json': '{"compilerOptions":{"paths":{"~/*":["./src/*"]}}}',
    'src/app/(shop)/cart/page.jsx': "import cart from '~/lib/cart';\nimport x from 'react';\n\nexport default function Cart() {}\n",
    'src/lib/cart.js': 'export default {};\n',
  });
  assert.deepEqual(await nextjs.listScreens(dir), [
    { route: '/(shop)/cart', files: ['src/app/(shop)/cart/page.jsx', 'src/lib/cart.js'], evidence: 'src/app/(shop)/cart/page.jsx:4' },
  ]);
});

test('index 파일과 re-export, 부수효과 import', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"next":"15"}}',
    'app/page.tsx': "import './styles';\nexport { helper } from '../lib/helper';\nimport W from './widgets';\nexport default function P() {}\n",
    'app/styles.ts': '',
    'lib/helper.ts': '',
    'app/widgets/index.tsx': '',
  });
  const [screen] = await nextjs.listScreens(dir);
  assert.deepEqual(screen.files, ['app/page.tsx', 'app/styles.ts', 'app/widgets/index.tsx', 'lib/helper.ts']);
});

test('tsconfig 주석·끝 쉼표와 문자열 안의 /*', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"next":"15"}}',
    'tsconfig.json': '{\n  // 별칭\n  "compilerOptions": { /* paths */ "paths": { "@/*": ["./*"], }, },\n}\n',
    'app/page.tsx': "import s from '@/lib/s';\nexport default function P() {}\n",
    'lib/s.ts': '',
  });
  assert.deepEqual((await nextjs.listScreens(dir))[0].files, ['app/page.tsx', 'lib/s.ts']);
});
