// 테스트용 웹 서버. 쿠키 로그인 흐름을 기본으로 제공한다.
// pages: { [path]: html 문자열 | (req, res) => void }, protect: 로그인이 필요한 경로 목록
import { createServer } from 'node:http';

const LOGIN_FORM = `<!doctype html><html><body><h1>로그인</h1>
<form method="post" action="/login">
<label>아이디 <input name="username"></label>
<label>비밀번호 <input name="password" type="password"></label>
<button type="submit">로그인</button></form></body></html>`;

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(new URLSearchParams(body)));
  });
}

export function page(title, body = '') {
  return `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`;
}

export async function startTestSite({ pages = {}, protect = [], user = 'u', password = 'p' } = {}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const loggedIn = /(?:^|;\s*)s=1/.test(req.headers.cookie ?? '');
    if (url.pathname === '/login' && req.method === 'POST') {
      const form = await readBody(req);
      if (form.get('username') === user && form.get('password') === password) {
        res.writeHead(302, { 'Set-Cookie': 's=1; Path=/', Location: '/' });
      } else {
        res.writeHead(302, { Location: '/login?error=1' });
      }
      return res.end();
    }
    if (url.pathname === '/login') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(LOGIN_FORM);
    }
    if (url.pathname === '/logout') {
      res.writeHead(302, { 'Set-Cookie': 's=; Path=/; Max-Age=0', Location: '/login' });
      return res.end();
    }
    if (protect.some((p) => url.pathname === p || url.pathname.startsWith(p + '/')) && !loggedIn) {
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }
    const handler = pages[url.pathname];
    if (handler === undefined) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(page('없음'));
    }
    if (typeof handler === 'function') return handler(req, res);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(handler);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((r) => server.close(r)) };
}

// .docent/run.json(주소 모드)과 config.yaml을 가진 임시 프로젝트
export async function siteProject(siteUrl, configYaml = '') {
  const { mkdir, mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'docent-site-'));
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, '.docent', 'run.json'), JSON.stringify({ mode: 'url', baseUrl: siteUrl }));
  await writeFile(join(dir, '.docent', 'config.yaml'), configYaml);
  return dir;
}
