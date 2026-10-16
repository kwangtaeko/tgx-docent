import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as vue from '../../skills/docent/scripts/src/detectors/vue.mjs';
import { project } from '../helpers/project.mjs';

const expected = async (name) => JSON.parse(await readFile(`fixtures/expected/detectors/${name}.json`, 'utf8'));

test('이름과 detect', async () => {
  assert.equal(vue.name, 'vue');
  assert.equal(await vue.detect('fixtures/detectors/vue-router'), true);
  assert.equal(await vue.detect('fixtures/detectors/nuxt'), true);
  assert.equal(await vue.detect(await project({ 'package.json': '{"dependencies":{"vue":"3"}}' })), false);
});

test('Vue Router 픽스처', async () => {
  assert.deepEqual(await vue.listScreens('fixtures/detectors/vue-router'), await expected('vue-router'));
});

test('Nuxt 픽스처(파일 라우팅, catch-all은 빼기)', async () => {
  assert.deepEqual(await vue.listScreens('fixtures/detectors/nuxt'), await expected('nuxt'));
});

test('Nuxt 4의 app/pages', async () => {
  const dir = await project({ 'package.json': '{"devDependencies":{"nuxt":"4"}}', 'app/pages/index.vue': '<template>\n  <h1>홈</h1>\n</template>\n' });
  assert.deepEqual(await vue.listScreens(dir), [{ route: '/', files: ['app/pages/index.vue'], evidence: 'app/pages/index.vue:1' }]);
});

test('Nuxt 동적 세그먼트 표기', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"3"}}',
    'pages/a/[[opt]].vue': '<template><p /></template>\n',
    'pages/b/[...rest].vue': '<template><p /></template>\n',
  });
  assert.deepEqual((await vue.listScreens(dir)).map((s) => s.route), ['/a/[[opt]]', '/b/[...rest]']);
});

test('redirect만 있는 라우트와 Not-found는 뺀다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"vue-router":"4"}}',
    'src/router/index.ts': "import NotFound from '../views/NotFound.vue';\nexport default createRouter({ routes: [\n  { path: '/old', redirect: '/new' },\n  { path: '/:pathMatch(.*)*', component: NotFound },\n] });\n",
    'src/views/NotFound.vue': '',
  });
  assert.deepEqual(await vue.listScreens(dir), []);
});

test('부모 .vue와 index.vue가 함께 있으면 /orders 하나, 두 파일 모두 files에', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"3"}}',
    'pages/orders.vue': '<template><NuxtPage /></template>\n',
    'pages/orders/index.vue': '<template><p>목록</p></template>\n',
  });
  assert.deepEqual(await vue.listScreens(dir), [{ route: '/orders', files: ['pages/orders/index.vue', 'pages/orders.vue'], evidence: 'pages/orders/index.vue:1' }]);
});

test('nuxt.config의 srcDir 아래 pages를 읽고 ~/ 별칭을 srcDir로 푼다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"3"}}',
    'nuxt.config.ts': "export default defineNuxtConfig({\n  srcDir: './src/',\n});\n",
    'src/pages/index.vue': "<script setup>\nimport OrderForm from '~/components/OrderForm.vue';\nimport Shared from '~~/shared/Shared.vue';\n</script>\n<template><OrderForm /></template>\n",
    'src/components/OrderForm.vue': '<template><form /></template>\n',
    'shared/Shared.vue': '<template><p /></template>\n',
    'pages/stale.vue': '<template><p>srcDir 밖이라 화면이 아님</p></template>\n',
  });
  assert.deepEqual(await vue.listScreens(dir), [
    { route: '/', files: ['src/pages/index.vue', 'shared/Shared.vue', 'src/components/OrderForm.vue'], evidence: 'src/pages/index.vue:5' },
  ]);
});

test('nuxt.config의 dir.pages로 바꾼 폴더 이름을 읽는다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"3"}}',
    'nuxt.config.js': "export default {\n  dir: {\n    public: 'static',\n    pages: 'views',\n  },\n};\n",
    'views/login.vue': '<template><p /></template>\n',
  });
  assert.deepEqual((await vue.listScreens(dir)).map((s) => s.route), ['/login']);
});

test('Nuxt 4에서 srcDir 없이 dir.pages만 바꾸면 app/ 아래에서 찾는다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"4"}}',
    'nuxt.config.ts': "export default defineNuxtConfig({ dir: { pages: 'routes' } });\n",
    'app/routes/index.vue': '<template><p /></template>\n',
  });
  assert.deepEqual((await vue.listScreens(dir)).map((s) => s.files[0]), ['app/routes/index.vue']);
});

test('프로젝트 밖을 가리키는 srcDir는 무시한다', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"nuxt":"3"}}',
    'nuxt.config.ts': "export default { srcDir: '../other' };\n",
    'pages/index.vue': '<template><p /></template>\n',
  });
  assert.deepEqual(await vue.nuxtDirs(dir), { srcDir: undefined, pages: undefined });
  assert.deepEqual((await vue.listScreens(dir)).map((s) => s.route), ['/']);
});

test('Vue Router에 변수 경로가 있으면 경고, Nuxt·리터럴 경로면 없음', async () => {
  const dir = await project({
    'package.json': '{"dependencies":{"vue-router":"4"}}',
    'src/router/index.ts': "import A from '../A.vue';\nexport default createRouter({ routes: [{ path: '/a', component: A }, { path: PATHS.b, component: A }] });\n",
    'src/A.vue': '<template><div /></template>\n',
  });
  assert.ok((await vue.warnings(dir)).some((w) => /src\/router\/index\.ts:2/.test(w)));
  assert.deepEqual(await vue.warnings('fixtures/detectors/vue-router'), []);
  assert.deepEqual(await vue.warnings('fixtures/detectors/nuxt'), []);
});
