import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const ko = await readFile('README.md', 'utf8');
const en = await readFile('README.en.md', 'utf8').catch(() => '');

test('README가 가리키는 docs/assets 파일이 모두 있고 1MB 이하', async () => {
  const refs = new Set([...`${ko}\n${en}`.matchAll(/docs\/assets\/[\w.-]+\.(?:png|gif|jpe?g|svg)/g)].map((m) => m[0]));
  assert.ok(refs.size >= 3, [...refs].join());
  for (const ref of refs) assert.ok((await stat(ref)).size <= 1024 * 1024, ref);
});

test('한/영 README의 명령 블록이 같다', () => {
  const commands = (md) => new Set([...md.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split('\n')).filter((l) => /^(\/plugin|npm|node)\b/.test(l.trim())).map((l) => l.trim()));
  assert.ok(commands(ko).size >= 2);
  assert.deepEqual(commands(en), commands(ko));
});

test('한/영 README가 서로를 링크한다', () => {
  assert.ok(ko.includes('README.en.md'));
  assert.ok(en.includes('(README.md)'));
});

test('README의 지원 스택 표에 감지기 4종과 레거시 스택이 있다', () => {
  for (const md of [ko, en]) {
    for (const s of ['Next.js', 'React Router', 'Vue', 'SvelteKit', 'Spring', 'WebForms', 'Django']) assert.ok(md.includes(s), s);
  }
});
