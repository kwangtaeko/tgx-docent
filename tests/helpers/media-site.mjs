// 캡처·녹화 테스트용 사이트와 프로젝트
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { writeJsonFile } from './fixture.mjs';
import { page, siteProject, startTestSite } from './web.mjs';

export const HASH = 'sha256:' + 'a'.repeat(64);

const HOME = page('홈', `
  <button onclick="document.getElementById('dlg').hidden=false">열기</button>
  <div id="dlg" role="dialog" hidden><h2>찾기 창</h2><label>검색어 <input name="q"></label></div>
  <form onsubmit="event.preventDefault(); document.getElementById('msg').textContent='저장되었습니다.'">
    <label>이름 <input name="name"></label><button type="submit">저장</button>
  </form><p id="msg"></p>
  <button onclick="window.open('/picker', 'picker')">새 창 찾기</button><p>고른 값: <b id="picked"></b></p>`);

// 새 창으로 뜨는 찾기 화면: 고르면 부모 창에 값을 넣고 스스로 닫힌다
const PICKER = page('거래처 찾기', `<label>거래처명 <input name="q"></label>
  <button onclick="window.opener.document.getElementById('picked').textContent = document.querySelector('input').value; setTimeout(() => window.close(), 300)">선택</button>`);

export async function startMediaSite() {
  return startTestSite({
    pages: {
      '/': HOME,
      '/items/1': page('아이템 1'),
      '/picker': PICKER,
      '/secret': page('비밀'),
      '/bounce': (req, res) => res.writeHead(302, { Location: '/' }).end(),
    },
    protect: ['/secret'],
  });
}

export const AUTH_YAML = `auth:
  loginPath: /login
  fields:
    - label: 아이디
      env: DOCENT_M_USER
    - label: 비밀번호
      env: DOCENT_M_PASSWORD
  submit: 로그인
  successPath: /
`;

const entry = (id, route, extra = {}) => ({ id, route, kind: 'page', files: ['x.ts'], evidence: 'x.ts:1', source: 'agent', ...extra });

// screens/*.json은 캡처·녹화에 필요한 최소 항목만(id, sourceHash, actions)
export async function mediaProject(siteUrl, { scenarios = {}, extraYaml = '' } = {}) {
  const dir = await siteProject(siteUrl, AUTH_YAML + extraYaml);
  const docent = join(dir, '.docent');
  await writeJsonFile(join(docent, 'inventory.json'), {
    version: 1,
    screens: [
      entry('home', '/'),
      entry('home--dialog', null, { kind: 'modal', parentId: 'home' }),
      entry('items-id', '/items/[id]'),
      entry('missing', '/missing'),
      entry('secret', '/secret'),
    ],
  });
  await mkdir(join(docent, 'scenarios'), { recursive: true });
  const all = {
    'items-id': { screenId: 'items-id', path: '/items/1', setup: [], steps: [], sourceHash: HASH },
    'home--dialog': {
      screenId: 'home--dialog',
      path: '/',
      setup: [{ do: 'click', role: 'button', label: '열기', evidence: 'x.ts:1' }],
      steps: [],
      sourceHash: HASH,
    },
    ...scenarios,
  };
  for (const [id, sc] of Object.entries(all)) await writeJsonFile(join(docent, 'scenarios', `${id}.json`), sc);
  return dir;
}

export async function withEnv(env, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}
