import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as sveltekit from '../../skills/docent/scripts/src/detectors/sveltekit.mjs';
import { project } from '../helpers/project.mjs';

const FIXTURE = 'fixtures/detectors/sveltekit';

test('이름과 detect', async () => {
  assert.equal(sveltekit.name, 'sveltekit');
  assert.equal(await sveltekit.detect(FIXTURE), true);
  assert.equal(await sveltekit.detect(await project({ 'package.json': '{"dependencies":{"svelte":"5"}}' })), false);
});

test('SvelteKit 픽스처', async () => {
  const expected = JSON.parse(await readFile('fixtures/expected/detectors/sveltekit.json', 'utf8'));
  assert.deepEqual(await sveltekit.listScreens(FIXTURE), expected);
});

test('matcher는 떼고, +server.ts만 있는 경로는 화면이 아니다', async () => {
  const routes = (await sveltekit.listScreens(FIXTURE)).map((s) => s.route);
  assert.ok(routes.includes('/(app)/orders/[id]'), routes.join()); // route group은 Next.js처럼 남기고 ID·crawl에서 무시
  assert.ok(!routes.some((r) => r.startsWith('/api')), routes.join());
});

test('+page.ts·+page.server.ts와 $lib import가 files에 들어간다', async () => {
  const dir = await project({
    'package.json': '{"devDependencies":{"@sveltejs/kit":"2"}}',
    'src/routes/login/+page.svelte': "<script>\n  import Nav from '$lib/Nav.svelte';\n</script>\n\n<h1>로그인</h1>\n",
    'src/routes/login/+page.server.ts': 'export const actions = {};\n',
    'src/lib/Nav.svelte': '<nav />\n',
  });
  assert.deepEqual(await sveltekit.listScreens(dir), [
    { route: '/login', files: ['src/routes/login/+page.svelte', 'src/lib/Nav.svelte', 'src/routes/login/+page.server.ts'], evidence: 'src/routes/login/+page.svelte:1' },
  ]);
});
