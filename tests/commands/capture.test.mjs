import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { authLogin } from '../../skills/docent/scripts/src/commands/auth.mjs';
import { runCapture } from '../../skills/docent/scripts/src/commands/capture.mjs';
import { runReview } from '../../skills/docent/scripts/src/commands/review.mjs';
import { readFailures } from '../../skills/docent/scripts/src/lib/media.mjs';
import { writeJsonFile } from '../helpers/fixture.mjs';
import { mediaProject, startMediaSite, withEnv } from '../helpers/media-site.mjs';

const site = await startMediaSite();
after(() => site.close());

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const isPng = async (p) => (await readFile(p)).subarray(0, 4).equals(PNG);

async function loggedIn() {
  const dir = await mediaProject(site.url);
  await withEnv({ DOCENT_M_USER: 'u', DOCENT_M_PASSWORD: 'p' }, () => authLogin(dir));
  return dir;
}

test('화면을 캡처하고 동적 경로는 시나리오가 필요하다', async () => {
  const dir = await loggedIn();
  await rm(join(dir, '.docent', 'scenarios', 'items-id.json'));
  const r = await runCapture(dir, ['home', 'home--dialog', 'items-id', 'secret']);
  assert.deepEqual(r.captured.sort(), ['home', 'home--dialog', 'secret']);
  assert.deepEqual(r.skipped, [{ id: 'items-id', reason: '시나리오에 실제 경로가 필요합니다' }]);
  for (const id of r.captured) assert.ok(await isPng(join(dir, '.docent', 'media', 'img', `${id}.png`)), id);
  assert.deepEqual(await readFailures(dir), []);
});

test('시나리오 경로로 동적 화면을 캡처한다', async () => {
  const dir = await loggedIn();
  const r = await runCapture(dir, ['items-id']);
  assert.deepEqual(r.captured, ['items-id']);
});

test('setup이 실패하면 캡처하지 않는다', async () => {
  const dir = await loggedIn();
  const path = join(dir, '.docent', 'scenarios', 'home--dialog.json');
  const sc = JSON.parse(await readFile(path, 'utf8'));
  sc.setup[0].label = '없는버튼';
  await writeJsonFile(path, sc);
  const r = await runCapture(dir, ['home--dialog']);
  assert.equal(r.failed.length, 1);
  await assert.rejects(access(join(dir, '.docent', 'media', 'img', 'home--dialog.png')));
});

test('로그인 만료와 404는 실패로 남고, 다시 성공하면 기록이 지워진다', async () => {
  const dir = await mediaProject(site.url);
  const r = await runCapture(dir, ['secret', 'missing']);
  assert.deepEqual(r.captured, []);
  const reasons = Object.fromEntries(r.failed.map((f) => [f.id, f.reason]));
  assert.match(reasons.secret, /로그인 필요/);
  assert.match(reasons.missing, /404/);
  await assert.rejects(access(join(dir, '.docent', 'media', 'img', 'secret.png')));
  assert.ok(await isPng(join(dir, '.docent', 'media', 'fail', 'secret.png')));
  assert.deepEqual((await readFailures(dir)).map((f) => f.id), ['missing', 'secret']);

  await withEnv({ DOCENT_M_USER: 'u', DOCENT_M_PASSWORD: 'p' }, () => authLogin(dir));
  await runCapture(dir, ['secret']);
  assert.deepEqual((await readFailures(dir)).map((f) => f.id), ['missing']);
});

test('실패는 review.md에 모인다', async () => {
  const dir = await mediaProject(site.url);
  await runCapture(dir, ['missing']);
  await runReview(dir).catch(() => {});
  const text = await readFile(join(dir, '.docent', 'review.md'), 'utf8');
  assert.match(text, /## 캡처·녹화 실패/);
  assert.match(text, /^- \[ \] missing 캡처 실패: .*404.* \(media\/fail\/missing\.png\) <!-- key: media\|capture\|missing -->$/m);
});
