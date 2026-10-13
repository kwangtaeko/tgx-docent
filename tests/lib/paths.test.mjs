import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRel, REL_PATH_PATTERN } from '../../skills/docent/scripts/src/lib/paths.mjs';

test('정규화', () => {
  assert.equal(normalizeRel('./lib//store.ts'), 'lib/store.ts');
  assert.equal(normalizeRel('app/./x/../y.ts'), 'app/y.ts');
  assert.equal(normalizeRel('app/[id]/page.tsx'), 'app/[id]/page.tsx');
});

test('루트 밖·절대·역슬래시 경로는 거부', () => {
  for (const p of ['../x', '/etc/x', 'a\\b', 'a/../../b', '', '.']) {
    assert.throws(() => normalizeRel(p), undefined, p);
  }
});

test('REL_PATH_PATTERN은 정규화된 경로만 허용', () => {
  const re = new RegExp(REL_PATH_PATTERN);
  for (const ok of ['lib/store.ts', 'app/[id]/page.tsx', '.env.example', 'a/.hidden/b']) assert.ok(re.test(ok), ok);
  for (const bad of ['./x', '../x', 'a/../b', 'a/./b', '/x', 'a//b', 'a\\b', 'C:/x']) assert.ok(!re.test(bad), bad);
});

test('스키마의 relPath 패턴은 REL_PATH_PATTERN과 같다', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const name of ['inventory', 'screen']) {
    const schema = JSON.parse(await readFile(`skills/docent/schemas/${name}.schema.json`, 'utf8'));
    assert.equal(schema.$defs.relPath.pattern, REL_PATH_PATTERN, name);
  }
});
