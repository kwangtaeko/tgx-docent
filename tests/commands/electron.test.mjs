import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { runCapture } from '../../skills/docent/scripts/src/commands/capture.mjs';
import { runRecord } from '../../skills/docent/scripts/src/commands/record.mjs';
import { runApprove, runStart, runStatus } from '../../skills/docent/scripts/src/commands/run.mjs';
import { runCrawl } from '../../skills/docent/scripts/src/commands/crawl.mjs';

// 메뉴로 본문을 바꾸는 데스크톱 앱 흉내(주소 없음)
const APP = `<!doctype html><html><body>
<nav><button onclick="show('home')">홈</button><button onclick="show('settings')">설정</button></nav>
<main id="home"><h1>홈</h1></main>
<main id="settings" hidden><h1>설정</h1><label>이름 <input id="name"></label><button onclick="document.getElementById('saved').hidden=false">저장</button><p id="saved" hidden>저장했습니다</p></main>
<script>function show(v){for(const m of document.querySelectorAll('main'))m.hidden=m.id!==v}</script>
</body></html>`;

// Playwright _electron 대신 Chromium 창 하나를 띄우는 가짜 런처(받은 옵션을 기록)
function fakeLauncher(calls) {
  return async (options) => {
    calls.push(options);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: options.size });
    await page.setContent(APP);
    return { page, context: page.context(), close: () => browser.close() };
  };
}

async function project() {
  const dir = await mkdtemp(join(tmpdir(), 'docent-electron-'));
  const docent = join(dir, '.docent');
  await mkdir(join(docent, 'scenarios'), { recursive: true });
  await mkdir(join(dir, 'out', 'main'), { recursive: true });
  await writeFile(join(dir, 'out', 'main', 'index.js'), '');
  await writeFile(join(docent, 'config.yaml'), 'detectors: []\n');
  await writeFile(join(docent, 'run.json'), JSON.stringify({ mode: 'electron', electron: { main: 'out/main/index.js' } }));
  await writeFile(
    join(docent, 'inventory.json'),
    JSON.stringify({
      version: 1,
      screens: [
        { id: 'home', route: '/', kind: 'page', files: ['src/App.tsx'], evidence: 'src/App.tsx:1', source: 'agent' },
        { id: 'home--settings', route: null, kind: 'view', parentId: 'home', files: ['src/Settings.tsx'], evidence: 'src/App.tsx:2', source: 'agent' },
        { id: 'home--about', route: null, kind: 'view', parentId: 'home', files: ['src/About.tsx'], evidence: 'src/App.tsx:3', source: 'agent' },
      ],
    }),
  );
  const ev = 'src/Settings.tsx:1';
  await writeFile(
    join(docent, 'scenarios', 'home--settings.json'),
    JSON.stringify({
      screenId: 'home--settings',
      path: '/',
      setup: [{ do: 'click', role: 'button', label: '설정', evidence: ev }],
      steps: [
        { do: 'fill', label: '이름', value: '홍길동', evidence: ev },
        { do: 'click', role: 'button', label: '저장', evidence: ev },
        { do: 'expectText', text: '저장했습니다', evidence: ev },
      ],
      sourceHash: 'sha256:x',
      locked: true,
    }),
  );
  return dir;
}

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test('electron: 승인 전에는 앱을 띄우지 않는다', async () => {
  const dir = await project();
  const calls = [];
  await assert.rejects(runCapture(dir, ['home'], { electronLauncher: fakeLauncher(calls) }), /승인/);
  assert.equal(calls.length, 0);
});

test('electron: 첫 화면은 그대로, 메뉴 화면은 준비 단계로 열어 캡처하고 GIF도 만든다', async () => {
  const dir = await project();
  await runApprove(dir);
  const calls = [];
  const r = await runCapture(dir, undefined, { electronLauncher: fakeLauncher(calls) });
  assert.deepEqual(r.captured.sort(), ['home', 'home--settings']);
  assert.deepEqual(r.skipped.map((s) => s.id), ['home--about']); // 여는 단계가 없는 메뉴 화면
  assert.equal(calls.length, 2); // 화면마다 앱을 새로
  assert.deepEqual(calls[0].size, { width: 1280, height: 800 });
  assert.equal(calls[0].main, 'out/main/index.js');
  for (const id of r.captured) assert.ok((await readFile(join(dir, '.docent', 'media', 'img', `${id}.png`))).subarray(0, 4).equals(PNG));

  const rec = await runRecord(dir, ['home--settings'], { electronLauncher: fakeLauncher(calls) });
  assert.deepEqual(rec.recorded, ['home--settings'], JSON.stringify(rec));
  assert.equal((await readFile(join(dir, '.docent', 'media', 'gif', 'home--settings.gif'))).subarray(0, 3).toString(), 'GIF');
});

test('electron: run start는 진입점을 확인만 하고, crawl은 하지 않는다', async () => {
  const dir = await project();
  await runApprove(dir);
  assert.deepEqual(await runStart(dir), { electron: true, started: false, reused: false });
  assert.deepEqual(await runStatus(dir), { configured: true, electron: true, up: true });
  await assert.rejects(runCrawl(dir), /crawl/);
  await writeFile(join(dir, '.docent', 'run.json'), JSON.stringify({ mode: 'electron', electron: { main: 'missing.js' } }));
  await runApprove(dir);
  await assert.rejects(runStart(dir), /missing\.js/);
});
