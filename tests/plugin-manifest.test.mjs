import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('plugin.json과 marketplace.json의 이름·버전이 일치한다', async () => {
  const plugin = JSON.parse(await readFile('.claude-plugin/plugin.json', 'utf8'));
  const market = JSON.parse(await readFile('.claude-plugin/marketplace.json', 'utf8'));
  assert.equal(plugin.name, 'docent');
  assert.equal(market.name, 'tgx-docent');
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].version, plugin.version);
  assert.equal(market.plugins[0].source, './');
});

test('SKILL.md 프런트매터에 name: docent가 있다', async () => {
  const md = await readFile('skills/docent/SKILL.md', 'utf8');
  assert.match(md, /^---\nname: docent\ndescription: .+\n---/);
});

const STACKS = 'skills/docent/references/stacks';
const STACK_HEADINGS = ['## 판별', '## 화면(라우트) 찾기', '## 화면 파일', '## 메뉴', '## 권한', '## 메시지', '## 실행', '## 주의'];

test('stacks 힌트 문서가 모두 같은 목차를 가진다', async () => {
  const { readdir } = await import('node:fs/promises');
  const files = (await readdir(STACKS)).filter((f) => f.endsWith('.md') && f !== 'README.md');
  assert.ok(files.length >= 5, files.join());
  for (const f of files) {
    const text = await readFile(`${STACKS}/${f}`, 'utf8');
    for (const h of STACK_HEADINGS) assert.ok(text.includes(h), `${f}: ${h}`);
  }
  const index = await readFile(`${STACKS}/README.md`, 'utf8');
  for (const f of files) assert.ok(index.includes(f), `README.md에 ${f} 없음`);
});

test('route-explorer와 SKILL이 stacks 힌트를 가리킨다', async () => {
  for (const f of ['skills/docent/SKILL.md', 'skills/docent/agents/route-explorer.md']) {
    assert.ok((await readFile(f, 'utf8')).includes('references/stacks/'), f);
  }
});

test('SKILL·에이전트 문서가 가리키는 references 파일이 모두 있다', async () => {
  const { access, readdir } = await import('node:fs/promises');
  const docs = ['skills/docent/SKILL.md', ...(await readdir('skills/docent/agents')).map((f) => `skills/docent/agents/${f}`)];
  for (const doc of docs) {
    const text = await readFile(doc, 'utf8');
    for (const [ref] of text.matchAll(/references\/[\w./-]+\.md/g)) await access(`skills/docent/${ref}`).catch(() => assert.fail(`${doc}: ${ref} 없음`));
  }
});

test('SKILL은 감지기 네 가지를 안내한다', async () => {
  const md = await readFile('skills/docent/SKILL.md', 'utf8');
  for (const name of ['nextjs', 'react-router', 'vue', 'sveltekit']) assert.ok(md.includes(name), name);
});

test('screen-analyzer가 실전에서 걸린 경우를 안내한다', async () => {
  const md = await readFile('skills/docent/agents/screen-analyzer.md', 'utf8');
  for (const phrase of ['공통 레이아웃', 'aria-label', '데이터 파일', '$DOCENT validate <화면ID>', '기능 플래그', '참고로만', '읽기 전용 상세', '끼워 넣은']) assert.ok(md.includes(phrase), phrase);
});

test('SKILL은 화면 목록 확인 때 출력·인쇄 전용 화면 제외를 제안한다', async () => {
  assert.ok((await readFile('skills/docent/SKILL.md', 'utf8')).includes('인쇄·PDF 생성 전용'));
});
