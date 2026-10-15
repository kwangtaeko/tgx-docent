// README 데모 자산 만들기: fixtures/nextjs-sample을 임시 폴더에서 docent CLI로 실행·캡처·녹화·빌드하고
// docs/assets/에 산출물 화면 캡처 두 장과 조작 GIF를 둔다. (개인 정보가 없는 픽스처만 쓴다)
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const FIXTURE = join(ROOT, 'fixtures', 'nextjs-sample');
const EXPECTED = join(ROOT, 'fixtures', 'expected', 'nextjs-sample');
const CLI = join(ROOT, 'skills', 'docent', 'scripts', 'dist', 'docent.mjs');
const OUT = join(ROOT, 'docs', 'assets');
const MAX_BYTES = 1024 * 1024;

function freePort() {
  return new Promise((done) => {
    const srv = createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => done(port));
    });
  });
}

function docent(dir, args, env = {}) {
  const r = spawnSync('node', [CLI, ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } });
  process.stdout.write(r.stdout);
  if (r.status !== 0) throw new Error(`docent ${args.join(' ')} 실패 (exit ${r.status})\n${r.stderr}`);
}

const dir = await mkdtemp(join(tmpdir(), 'docent-demo-'));
await cp(FIXTURE, dir, { recursive: true, filter: (src) => !/[\\/](node_modules|\.next)$/.test(src) });
await symlink(join(FIXTURE, 'node_modules'), join(dir, 'node_modules'), 'dir');
const docentDir = join(dir, '.docent');
await mkdir(docentDir, { recursive: true });
for (const name of ['inventory.json', 'summary.json', 'screens', 'scenarios']) await cp(join(EXPECTED, name), join(docentDir, name), { recursive: true });

const port = await freePort();
await writeFile(
  join(docentDir, 'config.yaml'),
  `date: 2026-10-13
detectors: [nextjs]
auth:
  loginPath: /login
  fields:
    - label: 아이디
      env: DOCENT_DEMO_USER
    - label: 비밀번호
      env: DOCENT_DEMO_PASSWORD
  submit: 로그인
  successPath: /
output:
  title: 사용자 매뉴얼
`,
);
await writeFile(
  join(docentDir, 'run.json'),
  JSON.stringify({
    mode: 'auto',
    baseUrl: `http://localhost:${port}`,
    install: [],
    start: `npm run build && npm run start -- -p ${port}`,
    cwd: '.',
    env: { NEXT_TELEMETRY_DISABLED: '1' },
    envNames: [],
    healthcheck: { path: '/login', timeoutSec: 600 },
  }),
);

// 이 레포의 픽스처를 띄우는 것이라 승인은 스크립트가 한다(대상 프로젝트에서는 사용자 동의 후에만)
docent(dir, ['run', 'approve']);
docent(dir, ['run', 'start']);
try {
  // 픽스처 소스에 적힌 데모 계정(lib/auth.ts)
  docent(dir, ['auth', 'login'], { DOCENT_DEMO_USER: 'admin', DOCENT_DEMO_PASSWORD: 'admin1234' });
  docent(dir, ['capture']);
  docent(dir, ['record', 'orders-new']);
  docent(dir, ['build', '--preset', 'handover', '--format', 'html']);
} finally {
  docent(dir, ['run', 'stop']);
}

await mkdir(OUT, { recursive: true });
const { chromium } = await import(pathToFileURL(join(ROOT, 'node_modules', 'playwright', 'index.mjs')).href);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
  const html = join(docentDir, 'out', 'html');
  await page.goto(pathToFileURL(join(html, 'index.html')).href);
  await page.screenshot({ path: join(OUT, 'demo-index.png') });
  // 화면 매뉴얼은 캡처 아래의 입력 항목·버튼 표까지 보이게 길게 찍는다
  await page.setViewportSize({ width: 1280, height: 1500 });
  await page.goto(pathToFileURL(join(html, 'screens', 'orders-new.html')).href);
  // GIF는 README에 따로 보이므로 이 캡처에서는 조작 예시를 빼고 입력 항목·버튼 표를 보인다
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === '조작 예시');
    h?.nextElementSibling?.remove();
    h?.remove();
  });
  await page.screenshot({ path: join(OUT, 'demo-screen.png') });
} finally {
  await browser.close();
}
await cp(join(docentDir, 'media', 'gif', 'orders-new.gif'), join(OUT, 'demo.gif'));

for (const name of await readdir(OUT)) {
  const { size } = await stat(join(OUT, name));
  console.log(`${name}\t${Math.round(size / 1024)}KB`);
  if (size > MAX_BYTES) throw new Error(`${name}이 1MB를 넘습니다`);
}
