import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runApprove, runStart, runStatus, runStop } from '../../skills/docent/scripts/src/commands/run.mjs';
import { httpCheck } from '../../skills/docent/scripts/src/lib/http.mjs';
import { validateRun } from '../../skills/docent/scripts/src/lib/schema.mjs';

const SERVER = `import { createServer } from 'node:http';
setTimeout(() => {
  createServer((req, res) => res.end('ok')).listen(Number(process.env.PORT));
  console.log('listening ' + process.env.PORT);
}, Number(process.env.DELAY_MS || 0));
`;

async function freePort() {
  return new Promise((resolve) => {
    const srv = createServer().listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function project(run) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-run-'));
  await mkdir(join(dir, '.docent'));
  await writeFile(join(dir, 'server.mjs'), SERVER);
  await writeFile(join(dir, '.docent', 'run.json'), JSON.stringify(run));
  if (run.mode === 'auto') await runApprove(dir);
  return dir;
}

async function autoRun(extra = {}) {
  const port = await freePort();
  return {
    port,
    run: {
      mode: 'auto',
      baseUrl: `http://127.0.0.1:${port}`,
      start: 'node server.mjs',
      cwd: '.',
      env: { PORT: String(port) },
      envNames: [],
      healthcheck: { path: '/', timeoutSec: 10 },
      ...extra,
    },
  };
}

test('앱을 띄우고 멈춘다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  const started = await runStart(dir);
  assert.deepEqual(started, { baseUrl: run.baseUrl, started: true, reused: false });
  assert.equal((await httpCheck(run.baseUrl, 2000)).ok, true);
  assert.equal((await runStatus(dir)).up, true);
  assert.deepEqual(await runStop(dir), { stopped: true });
  assert.equal((await httpCheck(run.baseUrl, 1000)).ok, false);
  assert.match(await readFile(join(dir, '.docent', 'run.log'), 'utf8'), /listening/);
});

test('이미 떠 있으면 다시 띄우지 않는다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  await runStart(dir);
  const pid = await readFile(join(dir, '.docent', '.run-pid'), 'utf8');
  assert.deepEqual(await runStart(dir), { baseUrl: run.baseUrl, started: false, reused: true });
  assert.equal(await readFile(join(dir, '.docent', '.run-pid'), 'utf8'), pid);
  await runStop(dir);
});

test('바로 죽는 명령은 로그와 함께 실패하고 pid를 남기지 않는다', async () => {
  const { run } = await autoRun({ start: "node -e \"console.log('boom'); process.exit(1)\"" });
  const dir = await project(run);
  await assert.rejects(runStart(dir), /boom/);
  await assert.rejects(readFile(join(dir, '.docent', '.run-pid')));
});

test('헬스체크 시간 초과면 프로세스를 정리한다', async () => {
  const { run } = await autoRun({ healthcheck: { path: '/', timeoutSec: 2 } });
  run.env.DELAY_MS = '6000';
  const dir = await project(run);
  await assert.rejects(runStart(dir), /시간 초과/);
  await new Promise((r) => setTimeout(r, 5000));
  assert.equal((await httpCheck(run.baseUrl, 1000)).ok, false);
});

test('필요한 환경변수가 없으면 실행하지 않는다', async () => {
  const { run } = await autoRun({ envNames: ['DOCENT_TEST_MISSING'] });
  const dir = await project(run);
  await assert.rejects(runStart(dir), /DOCENT_TEST_MISSING/);
});

test('주소 모드', async () => {
  const { run } = await autoRun();
  const helper = await project(run);
  await runStart(helper);
  const dir = await project({ mode: 'url', baseUrl: run.baseUrl });
  assert.deepEqual(await runStart(dir), { baseUrl: run.baseUrl, started: false, reused: true });
  await runStop(helper);
  await assert.rejects(runStart(dir), /응답/);
});

test('스키마', () => {
  assert.equal(validateRun({ mode: 'url', baseUrl: 'http://x' }).valid, true);
  assert.equal(validateRun({ mode: 'auto', baseUrl: 'http://x', start: 'a', env: { A: 1 } }).valid, false);
  assert.equal(validateRun({ mode: 'auto', baseUrl: 'http://x' }).valid, false);
});

test('승인되지 않은(예: 레포에 이미 있던) run.json 명령은 실행하지 않는다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  await writeFile(join(dir, '.docent', 'run.json'), JSON.stringify({ ...run, start: 'node server.mjs # changed' }));
  await assert.rejects(runStart(dir), (err) => {
    assert.match(err.message, /승인/);
    assert.match(err.message, /node server\.mjs # changed/);
    return true;
  });
  await runApprove(dir);
  assert.equal((await runStart(dir)).started, true);
  await runStop(dir);
});

test('앱이 이미 떠 있으면 envNames가 없어도 재사용한다', async () => {
  const { run } = await autoRun();
  const helper = await project(run);
  await runStart(helper);
  try {
    const dir = await project({ ...run, envNames: ['DOCENT_TEST_NOPE_X'] });
    assert.deepEqual(await runStart(dir), { baseUrl: run.baseUrl, started: false, reused: true });
  } finally {
    await runStop(helper);
  }
});

test('시작 중인 앱이 있으면 두 번째 start를 거부한다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  // 이 테스트 프로세스를 '시작 중인 앱'으로 둔다(살아 있고, /proc가 없으면 명령 비교 없이)
  await writeFile(join(dir, '.docent', '.run-pid'), JSON.stringify({ pid: process.pid, start: process.argv0 }));
  await assert.rejects(runStart(dir), /이미 시작 중/);
});

test('죽은 pid 파일은 지우고 신호를 보내지 않는다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  await writeFile(join(dir, '.docent', '.run-pid'), JSON.stringify({ pid: 999999, start: run.start }));
  assert.deepEqual(await runStop(dir), { stopped: false });
  await assert.rejects(readFile(join(dir, '.docent', '.run-pid')));
});

test('다른 프로그램이 쓰는 pid(재사용된 pid)는 우리 앱으로 보지 않는다', { skip: process.platform !== 'linux' }, async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  await writeFile(join(dir, '.docent', '.run-pid'), JSON.stringify({ pid: process.pid, start: 'node server.mjs --not-this' }));
  assert.deepEqual(await runStop(dir), { stopped: false });
});

test('stop 명령이 있으면 멈춘 뒤 실행한다', async () => {
  const { run } = await autoRun({ stop: 'node -e "require(\'fs\').writeFileSync(\'stopped\', \'1\')"' });
  const dir = await project(run);
  await runStart(dir);
  assert.deepEqual(await runStop(dir), { stopped: true });
  assert.equal(await readFile(join(dir, 'stopped'), 'utf8'), '1');
});

test('stop 명령이 바뀌면 다시 승인해야 한다', async () => {
  const { run } = await autoRun();
  const dir = await project(run);
  await writeFile(join(dir, '.docent', 'run.json'), JSON.stringify({ ...run, stop: 'echo bye' }));
  await assert.rejects(runStart(dir), (err) => {
    assert.match(err.message, /승인/);
    assert.match(err.message, /정리: echo bye/);
    return true;
  });
});

test('실패 로그의 비밀 값은 가린다', async () => {
  process.env.DOCENT_T_SECRET = 's3cr3t-value';
  try {
    const { run } = await autoRun({
      envNames: ['DOCENT_T_SECRET'],
      start: 'node -e "console.log(process.env.DOCENT_T_SECRET, \'postgres://u:pw@h/db\'); process.exit(1)"',
    });
    const dir = await project(run);
    await assert.rejects(runStart(dir), (err) => {
      assert.doesNotMatch(err.message, /s3cr3t-value/);
      assert.doesNotMatch(err.message, /u:pw@/);
      assert.match(err.message, /\*\*\*/);
      return true;
    });
  } finally {
    delete process.env.DOCENT_T_SECRET;
  }
});
