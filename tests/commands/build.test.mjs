import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { runBuild } from '../../skills/docent/scripts/src/commands/build.mjs';
import { copyFixture, copyGoldenWorkspace, readJsonFile, writeJsonFile } from '../helpers/fixture.mjs';

async function fakeAssets() {
  const dir = await mkdtemp(join(tmpdir(), 'docent-assets-'));
  await writeFile(join(dir, 'mermaid.min.js'), '/* mermaid */');
  await writeFile(join(dir, 'zoom.min.js'), '/* zoom */');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(join(dir, 'fonts'));
  await writeFile(join(dir, 'fonts', 'PretendardVariable.woff2'), 'font');
  await writeFile(join(dir, 'fonts', 'Pretendard-OFL.txt'), 'OFL');
  return dir;
}

async function prepared() {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\ndetectors: [nextjs]\n');
  return { dir, docent };
}

async function snapshot(root) {
  const out = {};
  async function walk(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out[relative(root, p)] = await readFile(p, 'utf8');
    }
  }
  await walk(root);
  return out;
}

test('build는 HTML·README를 만들고 대상 README는 건드리지 않는다', async () => {
  const { dir, docent } = await prepared();
  const before = await readFile(join(dir, 'README.md'), 'utf8');
  const { files } = await runBuild(dir, { assetsDir: await fakeAssets() });
  for (const f of ['html/index.html', 'html/assets/mermaid.min.js', 'html/screens/orders-new.html', 'README.md']) {
    assert.ok(files.includes(f), f);
  }
  assert.equal(await readFile(join(docent, 'out', 'html', 'assets', 'mermaid.min.js'), 'utf8'), '/* mermaid */');
  assert.ok((await readFile(join(docent, 'out', 'html', 'index.html'), 'utf8')).includes('기준일 2026-10-13'));
  assert.equal(await readFile(join(dir, 'README.md'), 'utf8'), before);
});

test('두 번 빌드해도 결과가 같고, 이전 산출물은 지워진다', async () => {
  const { dir, docent } = await prepared();
  const assets = await fakeAssets();
  await runBuild(dir, { assetsDir: assets });
  await writeFile(join(docent, 'out', 'stale.txt'), 'x');
  const first = await snapshot(join(docent, 'out'));
  await runBuild(dir, { assetsDir: assets });
  const second = await snapshot(join(docent, 'out'));
  delete first['stale.txt'];
  assert.deepEqual(second, first);
});

test('검증에 실패하면 빌드를 멈춘다', async () => {
  const { dir, docent } = await prepared();
  const path = join(docent, 'screens', 'orders.json');
  const screen = await readJsonFile(path);
  screen.fields[0].evidence = 'app/orders/page.tsx:999';
  await writeJsonFile(path, screen);
  await assert.rejects(runBuild(dir, { assetsDir: await fakeAssets() }), /orders/);
});

test('media의 캡처·GIF를 산출물로 복사하고 실패 이미지는 뺀다', async () => {
  const { mkdir } = await import('node:fs/promises');
  const { dir, docent } = await prepared();
  for (const sub of ['img', 'gif', 'fail']) await mkdir(join(docent, 'media', sub), { recursive: true });
  await writeFile(join(docent, 'media', 'img', 'orders.png'), 'png');
  await writeFile(join(docent, 'media', 'gif', 'orders.gif'), 'gif');
  await writeFile(join(docent, 'media', 'fail', 'login.png'), 'fail');
  const { files } = await runBuild(dir, { assetsDir: await fakeAssets() });
  assert.ok(files.includes('html/media/img/orders.png'));
  assert.ok(files.includes('html/media/gif/orders.gif'));
  assert.ok(!files.some((f) => f.includes('fail')));
  assert.ok((await readFile(join(docent, 'out', 'html', 'screens', 'orders.html'), 'utf8')).includes('../media/img/orders.png'));
  assert.ok((await readFile(join(docent, 'out', 'README.md'), 'utf8')).includes('html/media/gif/orders.gif'));
});

const REAL_ASSETS = 'skills/docent/assets';

test('PDF·PPTX까지 만든다', async () => {
  const { dir, docent } = await prepared();
  const r = await runBuild(dir, { assetsDir: REAL_ASSETS, formats: ['html', 'readme', 'pdf', 'pptx'] });
  for (const f of ['사용자매뉴얼.pdf', '사용자매뉴얼.pptx', 'html/print.html', 'README.md']) assert.ok(r.files.includes(f), f);
  assert.equal((await readFile(join(docent, 'out', '사용자매뉴얼.pdf'))).subarray(0, 5).toString('latin1'), '%PDF-');
  assert.deepEqual(r.skipped, []);
});

test('delivery는 확인 필요 항목 수를 경고한다', async () => {
  const { dir } = await prepared();
  const r = await runBuild(dir, { assetsDir: REAL_ASSETS, preset: 'delivery', formats: ['html'] });
  assert.ok(r.warnings.some((w) => w.includes('2건')), r.warnings.join('\n'));
});

test('Playwright가 없으면 PDF는 건너뛰고 PPTX는 다이어그램 없이 만든다', async () => {
  const { PlaywrightMissing } = await import('../../skills/docent/scripts/src/lib/playwright.mjs');
  const { dir } = await prepared();
  const r = await runBuild(dir, {
    assetsDir: REAL_ASSETS,
    formats: ['pdf', 'pptx'],
    browserFactory: async () => {
      throw new PlaywrightMissing('없음');
    },
  });
  assert.deepEqual(r.skipped.map((s) => s.format), ['pdf']);
  assert.ok(r.files.includes('사용자매뉴얼.pptx'));
  assert.ok(r.warnings.some((w) => w.includes('다이어그램')), r.warnings.join('\n'));
});

test('config의 output.title이 파일 이름이 된다', async () => {
  const { dir, docent } = await prepared();
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\ndetectors: [nextjs]\noutput:\n  title: "운영/관리 매뉴얼"\n');
  const r = await runBuild(dir, { assetsDir: REAL_ASSETS, formats: ['pptx'] });
  assert.ok(r.files.includes('운영_관리매뉴얼.pptx'), r.files.join(','));
});

test('산출물에 글꼴·라이선스·확대 스크립트를 함께 넣는다', async () => {
  const { dir, docent } = await prepared();
  const { files } = await runBuild(dir, { assetsDir: await fakeAssets() });
  for (const f of ['html/assets/zoom.min.js', 'html/assets/fonts/PretendardVariable.woff2', 'html/assets/fonts/Pretendard-OFL.txt']) assert.ok(files.includes(f), f);
  assert.equal(await readFile(join(docent, 'out', 'html', 'assets', 'fonts', 'Pretendard-OFL.txt'), 'utf8'), 'OFL');
});

test('실제 자산 폴더에 글꼴·라이선스·확대 스크립트가 있다', async () => {
  const { stat } = await import('node:fs/promises');
  for (const f of ['zoom.min.js', 'fonts/PretendardVariable.woff2', 'fonts/Pretendard-OFL.txt']) assert.ok((await stat(join('skills/docent/assets', f))).size > 0, f);
});

test('language: en이면 영어 산출물과 영어 파일 이름, 경고 없음', async () => {
  const { dir, docent } = await prepared();
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\nlanguage: en\ndetectors: [nextjs]\n');
  const r = await runBuild(dir, { assetsDir: REAL_ASSETS, formats: ['html', 'readme', 'pptx'] });
  assert.ok(r.files.includes('UserManual.pptx'), r.files.join(','));
  assert.ok(!r.warnings.some((w) => w.includes('language')), r.warnings.join('\n'));
  assert.match(await readFile(join(docent, 'out', 'README.md'), 'utf8'), /^## Key features$/m);
  assert.match(await readFile(join(docent, 'out', 'html', 'index.html'), 'utf8'), /<html lang="en">/);
});

test('산출물 이름: output.projectName > 앱의 제품 이름 > package.json name', async () => {
  const { dir, docent } = await prepared();
  await mkdir(join(dir, 'apps', 'desktop'), { recursive: true });
  await writeFile(join(dir, 'apps', 'desktop', 'electron-builder.yml'), 'appId: x.y\nproductName: TG Forge\n');
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\napp: apps/desktop\ndetectors: [nextjs]\n');
  await runBuild(dir, { assetsDir: REAL_ASSETS, formats: ['readme'] });
  assert.match(await readFile(join(docent, 'out', 'README.md'), 'utf8'), /^# TG Forge$/m);
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\napp: apps/desktop\ndetectors: [nextjs]\noutput:\n  projectName: 사내 생성기\n');
  await runBuild(dir, { assetsDir: REAL_ASSETS, formats: ['readme'] });
  assert.match(await readFile(join(docent, 'out', 'README.md'), 'utf8'), /^# 사내 생성기$/m);
});

test('combine: 앱 작업 여러 개를 한 매뉴얼로 합친다(ID에 앱 이름, 앱별 목록, 캡처 모으기)', async () => {
  const { cp, rename } = await import('node:fs/promises');
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  await writeFile(join(docent, 'config.yaml'), 'date: 2026-10-13\ndetectors: [nextjs]\n');
  await mkdir(join(docent, 'media', 'img'), { recursive: true });
  await writeFile(join(docent, 'media', 'img', 'orders.png'), 'png');
  // 같은 분석 결과를 두 앱 작업으로(ID가 겹쳐도 합친 매뉴얼에서는 앱 이름으로 구분된다)
  const apps = join(dir, '.docent-apps');
  await mkdir(apps);
  await rename(docent, join(apps, 'web'));
  await cp(join(apps, 'web'), join(apps, 'admin'), { recursive: true });
  await mkdir(join(dir, '.docent'));
  await rename(apps, join(dir, '.docent', 'apps'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'date: 2026-10-14\ncombine:\n  - workspace: web\n    title: 사용자 웹\n  - admin\n');

  const r = await runBuild(dir, { assetsDir: await fakeAssets() });
  const out = join(dir, '.docent', 'out');
  assert.ok(r.files.includes('html/screens/web.orders.html') && r.files.includes('html/screens/admin.orders.html'), r.files.join('\n'));
  assert.ok(r.files.includes('html/media/img/web.orders.png') && r.files.includes('html/media/img/admin.orders.png'));
  const list = await readFile(join(out, 'html', 'screens.html'), 'utf8');
  assert.ok(list.includes('<tr class="app-row"><th colspan="6">사용자 웹</th></tr>'));
  // 제목을 적지 않은 앱은 그 앱의 제품 이름(package.json name)
  assert.ok(/<tr class="app-row"><th colspan="6">[^<]+<\/th><\/tr>/.test(list.split('사용자 웹')[1]));
  const screen = await readFile(join(out, 'html', 'screens', 'web.orders-new.html'), 'utf8');
  assert.ok(screen.includes('href="web.orders-new--customer-search.html"'), '연결도 앱 이름이 붙은 ID로');
  const wf = await readFile(join(out, 'html', 'workflows.html'), 'utf8');
  assert.ok(wf.includes('사용자 웹 · ') && wf.includes('s_web_orders'));
  assert.ok(r.files.includes('README.md'));
  assert.ok((await readFile(join(out, 'README.md'), 'utf8')).includes('2026-10-14'));
});

test('combine: 앱 작업 하나가 검증에 실패하면 그 앱 이름과 함께 멈춘다', async () => {
  const { rename } = await import('node:fs/promises');
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  await writeFile(join(docent, 'config.yaml'), 'detectors: [nextjs]\n');
  const { rm } = await import('node:fs/promises');
  await rm(join(docent, 'summary.json'));
  const apps = join(dir, '.docent-apps');
  await mkdir(apps);
  await rename(docent, join(apps, 'web'));
  await mkdir(join(dir, '.docent'));
  await rename(apps, join(dir, '.docent', 'apps'));
  await writeFile(join(dir, '.docent', 'config.yaml'), 'combine: [web]\n');
  await assert.rejects(runBuild(dir, { assetsDir: await fakeAssets() }), /\(web\)/);
});
