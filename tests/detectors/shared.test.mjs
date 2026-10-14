import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDependency, lineOf, screenFiles, loadAliases, walk } from '../../skills/docent/scripts/src/detectors/shared.mjs';
import { project } from '../helpers/project.mjs';

test('빌드 산출물 폴더는 걷지 않는다', async () => {
  const dir = await project({ 'dist/a.tsx': '', 'build/b.tsx': '', '.svelte-kit/c.js': '', '.nuxt/d.js': '', '.output/e.js': '', 'node_modules/x/f.js': '', 'src/g.tsx': '' });
  assert.deepEqual(await walk(dir, ''), ['src/g.tsx']);
});

test('lineOf는 CR·CRLF도 줄로 센다', () => {
  assert.equal(lineOf('a\r\nb\rexport default x', /export default/), 3);
  assert.equal(lineOf('nothing', /export default/), 1);
});

test('hasDependency', async () => {
  const dir = await project({ 'package.json': '{"devDependencies":{"@sveltejs/kit":"2"}}' });
  assert.equal(await hasDependency(dir, ['@sveltejs/kit']), true);
  assert.equal(await hasDependency(dir, ['next']), false);
  assert.equal(await hasDependency(await project({}), ['next']), false);
});

test('screenFiles는 .vue·.svelte import와 추가 별칭을 푼다', async () => {
  const dir = await project({
    'src/routes/+page.svelte': "<script>\nimport Nav from '$lib/Nav.svelte';\nimport Card from './Card.svelte';\n</script>\n",
    'src/routes/Card.svelte': '',
    'src/lib/Nav.svelte': '',
  });
  const aliases = await loadAliases(dir, [{ prefix: '$lib/', wildcard: true, targets: ['src/lib/*'] }]);
  assert.deepEqual(await screenFiles(dir, 'src/routes/+page.svelte', aliases), ['src/routes/+page.svelte', 'src/lib/Nav.svelte', 'src/routes/Card.svelte']);
});
