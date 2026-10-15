import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { authLogin, newContext } from '../../skills/docent/scripts/src/commands/auth.mjs';
import { browser, closeBrowser } from '../helpers/browser.mjs';
import { page, siteProject, startTestSite } from '../helpers/web.mjs';

const AUTH = `auth:
  loginPath: /login
  fields:
    - label: 아이디
      env: DOCENT_T_USER
    - label: 비밀번호
      env: DOCENT_T_PASSWORD
  submit: 로그인
  successPath: /
`;

const site = await startTestSite({ pages: { '/': page('홈'), '/secret': page('비밀') }, protect: ['/secret'] });
after(async () => {
  await site.close();
  await closeBrowser();
});

function withEnv(env, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return fn().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test('로그인 상태를 저장하고 그 상태로 보호 화면에 들어간다', async () => {
  const dir = await siteProject(site.url, AUTH);
  await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: 'p' }, () => authLogin(dir));
  await access(join(dir, '.docent', 'auth', 'state.json'));
  const context = await newContext(await browser(), dir);
  const p = await context.newPage();
  const res = await p.goto(`${site.url}/secret`);
  assert.equal(new URL(p.url()).pathname, '/secret');
  assert.equal(res.status(), 200);
  await context.close();
});

test('비밀번호가 틀리면 실패하고 값은 메시지에 없다', async () => {
  const dir = await siteProject(site.url, AUTH);
  await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: 'wrong-secret-value' }, async () => {
    await assert.rejects(authLogin(dir), (err) => {
      assert.match(err.message, /로그인 실패/);
      assert.doesNotMatch(err.message, /wrong-secret-value/);
      return true;
    });
  });
});

test('환경변수가 없으면 이름을 알려 준다', async () => {
  const dir = await siteProject(site.url, AUTH);
  await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: undefined }, async () => {
    await assert.rejects(authLogin(dir), /DOCENT_T_PASSWORD/);
  });
});

test('auth 설정이 없으면 안내한다', async () => {
  const dir = await siteProject(site.url, '');
  await assert.rejects(authLogin(dir), /auth/);
});

test('클릭 뒤 늦게 이동하는(클라이언트 측) 로그인도 기다린다', async () => {
  const slow = await startTestSite({
    pages: {
      '/slow-login': page(
        '로그인',
        `<label>아이디 <input id="u"></label><label>비밀번호 <input id="p" type="password"></label>
         <button onclick="setTimeout(() => { document.cookie = 's=1; path=/'; location.href = '/'; }, 1500)">로그인</button>`,
      ),
      '/': page('홈'),
    },
  });
  try {
    const dir = await siteProject(slow.url, AUTH.replace('loginPath: /login', 'loginPath: /slow-login'));
    await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: 'p' }, () => authLogin(dir));
    await access(join(dir, '.docent', 'auth', 'state.json'));
  } finally {
    await slow.close();
  }
});

test('기본 successPath에서도 로그인 경로 아래에 머물면 실패', async () => {
  const bad = await startTestSite({
    pages: {
      '/signin': page('로그인', `<label>아이디 <input></label><label>비밀번호 <input type="password"></label>
        <button onclick="location.href='/signin/error'">로그인</button>`),
      '/signin/error': page('로그인 오류'),
    },
  });
  try {
    const config = AUTH.replace('loginPath: /login', 'loginPath: /signin').replace('  successPath: /\n', '');
    const dir = await siteProject(bad.url, config);
    await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: 'p' }, async () => {
      await assert.rejects(authLogin(dir), /로그인 실패/);
    });
  } finally {
    await bad.close();
  }
});

test('로그인 화면이 / 이면 / 를 벗어났을 때 성공', async () => {
  const root = await startTestSite({
    pages: {
      '/': page('로그인', `<label>아이디 <input></label><label>비밀번호 <input type="password"></label>
        <button onclick="location.href='/dashboard'">로그인</button>`),
      '/dashboard': page('대시보드'),
    },
  });
  try {
    const config = AUTH.replace('loginPath: /login', 'loginPath: /').replace('successPath: /', 'successPath: /dashboard');
    const dir = await siteProject(root.url, config);
    await withEnv({ DOCENT_T_USER: 'u', DOCENT_T_PASSWORD: 'p' }, () => authLogin(dir));
  } finally {
    await root.close();
  }
});

test('캡처·녹화 컨텍스트는 클립보드 쓰기를 허용한다', async () => {
  const dir = await siteProject(site.url, '');
  const context = await newContext(await browser(), dir, { baseURL: site.url });
  const p = await context.newPage();
  await p.goto(`${site.url}/`);
  assert.equal(await p.evaluate(() => navigator.clipboard.writeText('x').then(() => 'ok', (e) => String(e))), 'ok');
  await context.close();
});

test('캡처 컨텍스트에는 클립보드 읽기 권한을 주지 않는다', async () => {
  const { CONTEXT_PERMISSIONS } = await import('../../skills/docent/scripts/src/commands/auth.mjs');
  assert.deepEqual(CONTEXT_PERMISSIONS, ['clipboard-write']);
});
