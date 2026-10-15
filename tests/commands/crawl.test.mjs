import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { routeMatcher, runCrawl } from '../../skills/docent/scripts/src/commands/crawl.mjs';
import { closeBrowser } from '../helpers/browser.mjs';
import { writeJsonFile } from '../helpers/fixture.mjs';
import { page, siteProject, startTestSite } from '../helpers/web.mjs';

const HOME = page('홈', `
  <a href="/a">A</a> <a href="/items/1">아이템</a> <a href="https://example.com/x">외부</a>
  <a href="mailto:x@y.z">메일</a> <a href="/files/r.pdf">PDF</a> <a href="/logout">로그아웃</a>
  <a href="/hidden?x=1#h">숨은</a> <a href="javascript:void(0)">js</a>`);

const site = await startTestSite({
  pages: { '/': HOME, '/a': page('A', '<a href="/">홈</a>'), '/items/1': page('아이템'), '/hidden': page('숨은 화면'), '/files/r.pdf': 'pdf' },
});
after(async () => {
  await site.close();
  await closeBrowser();
});

async function project() {
  const dir = await siteProject(site.url);
  const entry = (id, route) => ({ id, route, kind: 'page', files: ['x.ts'], evidence: 'x.ts:1', source: 'agent' });
  await writeJsonFile(join(dir, '.docent', 'inventory.json'), {
    version: 1,
    screens: [entry('home', '/'), entry('a', '/a'), entry('items-id', '/items/[id]'), entry('never', '/never')],
  });
  return dir;
}

test('같은 출처 링크만 따라가고 대조 결과를 저장한다', async () => {
  const dir = await project();
  const r = await runCrawl(dir);
  assert.deepEqual([...r.visited].sort(), ['/', '/a', '/hidden', '/items/1']);
  assert.deepEqual(r.unmatched, ['/hidden']);
  assert.deepEqual(r.unreached, ['never']);
  const saved = JSON.parse(await readFile(join(dir, '.docent', 'crawl.json'), 'utf8'));
  assert.deepEqual(saved, { baseUrl: site.url, visited: [...r.visited].sort(), unmatched: ['/hidden'], unreached: ['never'] });
});

test('maxPages', async () => {
  const dir = await project();
  assert.equal((await runCrawl(dir, { maxPages: 2 })).visited.length, 2);
});

test('routeMatcher', () => {
  assert.ok(routeMatcher('/(shop)/items/[...slug]').test('/items/a/b'));
  assert.ok(routeMatcher('/items/[id]').test('/items/1'));
  assert.ok(!routeMatcher('/items/[id]').test('/items/1/edit'));
  assert.ok(routeMatcher('/docs/[[...slug]]').test('/docs'));
  assert.ok(routeMatcher('/').test('/'));
  assert.ok(!routeMatcher('/').test('/a'));
});

test('여러 형태의 로그아웃 링크를 따라가지 않는다', async () => {
  const { followable } = await import('../../skills/docent/scripts/src/commands/crawl.mjs');
  const o = 'http://h';
  for (const href of ['/Logout.aspx', '/logout.php', '/account/logoff', '/users/sign_out', '/x?action=logout', '/auth/signout']) {
    assert.equal(followable(o + href, o), undefined, href);
  }
  assert.equal(followable(o + '/logs', o), '/logs');
  assert.equal(followable(o + '/catalog', o), '/catalog');
});

test('로그인 화면만 방문했으면 세션 만료 경고', async () => {
  const locked = await startTestSite({ pages: { '/': page('홈', '<a href="/a">A</a>'), '/a': page('A') }, protect: ['/', '/a'] });
  try {
    const dir = await siteProject(locked.url, 'auth:\n  loginPath: /login\n  fields:\n    - label: 아이디\n      env: X\n  submit: 로그인\n');
    const entry = (id, route) => ({ id, route, kind: 'page', files: ['x.ts'], evidence: 'x.ts:1', source: 'agent' });
    await writeJsonFile(join(dir, '.docent', 'inventory.json'), { version: 1, screens: [entry('home', '/'), entry('a', '/a')] });
    const r = await runCrawl(dir);
    assert.deepEqual(r.visited, ['/login']);
    assert.ok(r.warnings.some((w) => /로그인 상태가 만료/.test(w)), JSON.stringify(r.warnings));
    const ok = await runCrawl(await project());
    assert.deepEqual(ok.warnings, []);
  } finally {
    await locked.close();
  }
});

test('정적 HTML 파일 링크는 화면 후보가 아니다', async () => {
  const { followable } = await import('../../skills/docent/scripts/src/commands/crawl.mjs');
  assert.equal(followable('http://h/talks/a.html', 'http://h'), undefined);
  assert.equal(followable('http://h/board/list.html', 'http://h', [routeMatcher('/board/list.html')]), '/board/list.html');
  assert.equal(followable('http://h/a', 'http://h'), '/a');
});

test('sitemap.xml에 적힌 주소의 경로도 시작점으로 쓴다(운영 도메인으로 적혀 있어도)', async () => {
  const xml = () => '<?xml version="1.0"?><urlset><url><loc>https://prod.example/hidden-page</loc></url><url><loc>https://prod.example/files/a.pdf</loc></url></urlset>';
  let base = '';
  const mapped = await startTestSite({
    pages: {
      '/': page('홈'),
      '/hidden-page': page('숨은 화면'),
      '/sitemap.xml': (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/xml' });
        res.end(xml(base));
      },
    },
  });
  base = mapped.url;
  try {
    const dir = await siteProject(mapped.url);
    const entry = (id, route) => ({ id, route, kind: 'page', files: ['x.ts'], evidence: 'x.ts:1', source: 'agent' });
    await writeJsonFile(join(dir, '.docent', 'inventory.json'), { version: 1, screens: [entry('home', '/'), entry('hidden', '/hidden-page')] });
    const r = await runCrawl(dir);
    assert.deepEqual([...r.visited].sort(), ['/', '/hidden-page']);
    assert.deepEqual(r.unreached, []);
  } finally {
    await mapped.close();
  }
});
