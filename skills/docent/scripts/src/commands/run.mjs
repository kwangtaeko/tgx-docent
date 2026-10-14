// docent run start | stop | status — run.json에 적힌 방법으로 대상 앱을 띄운다. (설계 문서 8장)
// run.json은 사용자 동의를 받은 실행 계획이다. 여기 적힌 명령만 실행한다.
import { spawn, spawnSync } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { httpCheck } from '../lib/http.mjs';
import { normalizeRel } from '../lib/paths.mjs';
import { validateRun } from '../lib/schema.mjs';
import { docentDir, readJsonIfExists } from '../lib/workspace.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadRun(projectDir) {
  const run = await readJsonIfExists(join(docentDir(projectDir), 'run.json'));
  if (!run) throw new Error('.docent/run.json이 없습니다. 실행 방법을 먼저 정하세요');
  const { valid, errors } = validateRun(run);
  if (!valid) throw new Error(`.docent/run.json 형식 오류: ${errors.join('; ')}`);
  return run;
}

const healthUrl = (run) => new URL(run.healthcheck?.path ?? '/', run.baseUrl).href;
const pidFile = (projectDir) => join(docentDir(projectDir), '.run-pid');
const logFile = (projectDir) => join(docentDir(projectDir), 'run.log');

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killGroup(pid, signal) {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)]);
    else process.kill(-pid, signal);
  } catch {
    // 이미 끝남
  }
}

async function readPid(projectDir) {
  try {
    const pid = Number((await readFile(pidFile(projectDir), 'utf8')).trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

async function logTail(projectDir, lines = 20) {
  try {
    return (await readFile(logFile(projectDir), 'utf8')).trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
}

function childEnv(run) {
  return { ...process.env, ...(run.env ?? {}) };
}

export async function runStart(projectDir, { install = false } = {}) {
  const run = await loadRun(projectDir);
  const missing = (run.envNames ?? []).filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`실행에 필요한 환경변수가 없습니다: ${missing.join(', ')}`);

  if ((await httpCheck(healthUrl(run), 2000)).ok) return { baseUrl: run.baseUrl, started: false, reused: true };
  if (run.mode === 'url') throw new Error(`${run.baseUrl}가 응답하지 않습니다. 앱을 띄운 뒤 다시 시도하세요`);

  const cwd = resolve(projectDir, run.cwd && run.cwd !== '.' ? normalizeRel(run.cwd) : '.');
  if (install) {
    for (const command of run.install ?? []) {
      const r = spawnSync(command, { cwd, shell: true, stdio: 'inherit', env: childEnv(run) });
      if (r.status !== 0) throw new Error(`설치 명령 실패: ${command} (exit ${r.status})`);
    }
  }

  const fd = openSync(logFile(projectDir), 'w');
  const child = spawn(run.start, { cwd, shell: true, detached: true, stdio: ['ignore', fd, fd], env: childEnv(run) });
  closeSync(fd);
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  child.unref();
  await writeFile(pidFile(projectDir), `${child.pid}\n`);

  const deadline = Date.now() + (run.healthcheck?.timeoutSec ?? 120) * 1000;
  while (Date.now() < deadline) {
    if ((await httpCheck(healthUrl(run), 2000)).ok) return { baseUrl: run.baseUrl, started: true, reused: false };
    if (exited) break;
    await sleep(1000);
  }
  // 종료 이벤트는 아래 kill 뒤에도 오므로 이유는 kill 전에 정한다
  const reason = exited ? '앱이 시작 중에 종료되었습니다' : `헬스체크 시간 초과(${run.healthcheck?.timeoutSec ?? 120}초)`;
  killGroup(child.pid, 'SIGKILL');
  await rm(pidFile(projectDir), { force: true });
  throw new Error(`${reason}. .docent/run.log 마지막 부분:\n${await logTail(projectDir)}`);
}

export async function runStop(projectDir) {
  const pid = await readPid(projectDir);
  if (!pid) return { stopped: false };
  killGroup(pid, 'SIGTERM');
  for (let i = 0; i < 50 && alive(pid); i++) await sleep(100);
  if (alive(pid)) killGroup(pid, 'SIGKILL');
  await rm(pidFile(projectDir), { force: true });
  return { stopped: true };
}

export async function runStatus(projectDir) {
  let run;
  try {
    run = await loadRun(projectDir);
  } catch {
    return { configured: false, up: false };
  }
  const pid = await readPid(projectDir);
  const up = (await httpCheck(healthUrl(run), 2000)).ok;
  return { configured: true, baseUrl: run.baseUrl, up, ...(pid && alive(pid) ? { pid } : {}) };
}
