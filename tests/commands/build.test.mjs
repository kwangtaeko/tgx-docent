import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { runBuild } from '../../skills/docent/scripts/src/commands/build.mjs';
import { copyFixture, copyGoldenWorkspace, readJsonFile, writeJsonFile } from '../helpers/fixture.mjs';

async function fakeAssets() {
  const dir = await mkdtemp(join(tmpdir(), 'docent-assets-'));
  await writeFile(join(dir, 'mermaid.min.js'), '/* mermaid */');
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
