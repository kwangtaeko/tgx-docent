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
