// docent run start | stop | status — run.json에 적힌 방법으로 대상 앱을 띄운다. (설계 문서 8장)
// run.json은 사용자 동의를 받은 실행 계획이다. 여기 적힌 명령만 실행한다.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { t } from '../lib/cli-text.mjs';
import { httpCheck } from '../lib/http.mjs';
import { normalizeRel } from '../lib/paths.mjs';
import { validateRun } from '../lib/schema.mjs';
import { docentDir, readJsonIfExists } from '../lib/workspace.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadRun(projectDir) {
  const run = await readJsonIfExists(join(docentDir(projectDir), 'run.json'));
  if (!run) throw new Error(t('.docent/run.json이 없습니다. 실행 방법을 먼저 정하세요'));
  const { valid, errors } = validateRun(run);
  if (!valid) throw new Error(t('.docent/run.json 형식 오류: {0}', errors.join('; ')));
  return run;
}

const healthUrl = (run) => new URL(run.healthcheck?.path ?? '/', run.baseUrl).href;
const pidFile = (projectDir) => join(docentDir(projectDir), '.run-pid');
const logFile = (projectDir) => join(docentDir(projectDir), 'run.log');
const approvalFile = (projectDir) => join(docentDir(projectDir), '.run-approved');

// 이 컴퓨터에서 사용자가 승인한 명령인지: install·start·stop·cwd·env의 해시를 .run-approved(gitignore)에 둔다.
// run.json은 커밋되므로, 레포에 들어 있던 명령을 확인 없이 실행하지 않기 위해서다.
// stop·electron은 있을 때만 해시에 넣어, 그것이 없는 기존 승인이 깨지지 않게 한다.
function commandsHash(run) {
  const { install = [], start = '', cwd = '.', env = {}, stop, electron } = run;
  return createHash('sha256')
    .update(JSON.stringify({ install, start, cwd, env, ...(stop !== undefined ? { stop } : {}), ...(electron !== undefined ? { electron } : {}) }))
    .digest('hex');
}

export function describeCommands(run) {
  return [
    ...(run.install ?? []).map((c) => t('설치: {0}', c)),
    // 승인 화면에는 실행될 수 있는 것을 모두 보인다(모드와 상관없이 적힌 start·electron 모두)
    ...(run.start !== undefined ? [t('실행: {0}', run.start)] : []),
    ...(run.electron ? [t('실행: Electron {0}', [run.electron.main, ...(run.electron.args ?? [])].join(' '))] : []),
    ...(run.stop !== undefined ? [t('정리: {0}', run.stop)] : []),
    t('위치: {0}', run.cwd ?? '.'),
    ...Object.entries(run.env ?? {}).map(([k, v]) => t('환경: {0}={1}', k, v)),
  ].join('\n');
}

export async function runApprove(projectDir) {
  const run = await loadRun(projectDir);
  await writeFile(approvalFile(projectDir), commandsHash(run) + '\n');
  return { commands: describeCommands(run) };
}

export async function approved(projectDir, run) {
  try {
    return (await readFile(approvalFile(projectDir), 'utf8')).trim() === commandsHash(run);
  } catch {
    return false;
  }
}

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

// Linux에서 프로세스 시작 시각(/proc/<pid>/stat 22번째 값). 셸이 명령을 exec해 명령줄이 바뀌어도 같다
export function procStartTime(pid) {
  const path = `/proc/${pid}/stat`;
  if (!existsSync(path)) return undefined;
  try {
    const stat = readFileSync(path, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  } catch {
    return undefined;
  }
}

// pid가 다른 프로그램에 재사용됐는지: 기록한 시작 시각과 비교(기록이 없거나 /proc가 없으면 살아 있는지만 본다)
function sameProcess(pid, startTime) {
  if (!startTime) return true;
  const now = procStartTime(pid);
  return now === undefined || now === startTime;
}

// .run-pid: { pid, start, startTime } (옛 형식은 숫자만). 죽었거나 다른 프로그램의 pid면 파일을 지우고 undefined
async function readPid(projectDir) {
  let text;
  try {
    text = (await readFile(pidFile(projectDir), 'utf8')).trim();
  } catch {
    return undefined;
  }
  let pid;
  let startTime;
  try {
    const data = JSON.parse(text);
    if (typeof data === 'number') pid = data;
    else ({ pid, startTime } = data ?? {});
  } catch {
    // 깨진 파일
  }
  if (Number.isInteger(pid) && pid > 0 && alive(pid) && sameProcess(pid, startTime)) return pid;
  await rm(pidFile(projectDir), { force: true });
  return undefined;
}

// 실행 로그에 섞인 비밀 값(envNames의 현재 값, URL의 계정)을 가린다
function redact(text, run) {
  let out = text.replace(/\/\/[^\s/@:]+:[^\s/@]+@/g, '//***@');
  for (const name of run.envNames ?? []) {
    const value = process.env[name];
    if (value && value.length >= 4) out = out.split(value).join('***');
  }
  return out;
}

async function logTail(projectDir, run, lines = 20) {
  try {
    return redact((await readFile(logFile(projectDir), 'utf8')).trimEnd().split('\n').slice(-lines).join('\n'), run);
  } catch {
    return '';
  }
}

export const runCwd = (projectDir, run) => resolve(projectDir, run.cwd && run.cwd !== '.' ? normalizeRel(run.cwd) : '.');

export function childEnv(run) {
  return { ...process.env, ...(run.env ?? {}) };
}

// 승인 확인 → (--install이면) 설치 명령. 웹 앱 실행과 Electron 준비가 함께 쓴다
async function prepare(projectDir, run, install) {
  const missing = (run.envNames ?? []).filter((name) => !process.env[name]);
  if (missing.length) throw new Error(t('실행에 필요한 환경변수가 없습니다: {0}', missing.join(', ')));
  if (!(await approved(projectDir, run))) {
    throw new Error(
      t('.docent/run.json의 명령이 이 컴퓨터에서 아직 승인되지 않았습니다. 아래 명령을 사용자에게 보여 주고 동의를 받은 뒤 `docent run approve`를 실행하세요:') +
        `\n${describeCommands(run)}`,
    );
  }
  const cwd = runCwd(projectDir, run);
  if (install) {
    for (const command of run.install ?? []) {
      const r = spawnSync(command, { cwd, shell: true, stdio: 'inherit', env: childEnv(run) });
      if (r.status !== 0) throw new Error(t('설치 명령 실패: {0} (exit {1})', command, r.status));
    }
  }
  return cwd;
}

// 데스크톱 앱: 띄워 둘 서버가 없다. 승인·설치만 하고, 캡처·녹화가 화면마다 앱을 띄운다
async function startElectron(projectDir, run, install) {
  const cwd = await prepare(projectDir, run, install);
  if (!existsSync(join(cwd, run.electron.main))) throw new Error(t('Electron 진입점이 없습니다: {0} — 앱을 빌드했는지 확인하세요(빌드 명령은 install에)', run.electron.main));
  return { electron: true, started: false, reused: false };
}

export async function runStart(projectDir, { install = false } = {}) {
  const run = await loadRun(projectDir);
  if (run.mode === 'electron') return startElectron(projectDir, run, install);
  // 사용자가 직접 띄운 앱이면 이 셸에 환경변수가 없어도 그대로 쓴다
  if ((await httpCheck(healthUrl(run), 2000)).ok) return { baseUrl: run.baseUrl, started: false, reused: true };
  if (run.mode === 'url') throw new Error(t('{0}가 응답하지 않습니다. 앱을 띄운 뒤 다시 시도하세요', run.baseUrl));
  const booting = await readPid(projectDir);
  if (booting) throw new Error(t('이미 시작 중인 앱이 있습니다(pid {0}). 끝날 때까지 기다리거나 docent run stop을 실행하세요', booting));
  const cwd = await prepare(projectDir, run, install);

  const fd = openSync(logFile(projectDir), 'w');
  const child = spawn(run.start, { cwd, shell: true, detached: true, stdio: ['ignore', fd, fd], env: childEnv(run) });
  closeSync(fd);
  let exited = false;
  child.on('exit', () => {
    exited = true;
  });
  child.unref();
  await writeFile(pidFile(projectDir), JSON.stringify({ pid: child.pid, start: run.start, startTime: procStartTime(child.pid) }) + '\n');

  const deadline = Date.now() + (run.healthcheck?.timeoutSec ?? 120) * 1000;
  while (Date.now() < deadline) {
    if ((await httpCheck(healthUrl(run), 2000)).ok) return { baseUrl: run.baseUrl, started: true, reused: false };
    if (exited) break;
    await sleep(1000);
  }
  // 종료 이벤트는 아래 kill 뒤에도 오므로 이유는 kill 전에 정한다
  const reason = exited ? t('앱이 시작 중에 종료되었습니다') : t('헬스체크 시간 초과({0}초)', run.healthcheck?.timeoutSec ?? 120);
  killGroup(child.pid, 'SIGKILL');
  await rm(pidFile(projectDir), { force: true });
  throw new Error(t('{0}. .docent/run.log 마지막 부분:', reason) + `\n${await logTail(projectDir, run)}`);
}

export async function runStop(projectDir) {
  const pid = await readPid(projectDir);
  if (!pid) return { stopped: false };
  killGroup(pid, 'SIGTERM');
  for (let i = 0; i < 50 && alive(pid); i++) await sleep(100);
  if (alive(pid)) killGroup(pid, 'SIGKILL');
  await rm(pidFile(projectDir), { force: true });
  // docker compose처럼 프로세스를 멈춰도 남는 것은 승인된 stop 명령으로 정리한다(우리가 띄운 앱일 때만)
  let run;
  try {
    run = await loadRun(projectDir);
  } catch {
    return { stopped: true };
  }
  if (run.stop && (await approved(projectDir, run))) {
    const cwd = runCwd(projectDir, run);
    spawnSync(run.stop, { cwd, shell: true, stdio: 'ignore', env: childEnv(run) });
  }
  return { stopped: true };
}

export async function runStatus(projectDir) {
  let run;
  try {
    run = await loadRun(projectDir);
  } catch {
    return { configured: false, up: false };
  }
  if (run.mode === 'electron') {
    return { configured: true, electron: true, up: existsSync(join(runCwd(projectDir, run), run.electron.main)) };
  }
  const pid = await readPid(projectDir);
  const up = (await httpCheck(healthUrl(run), 2000)).ok;
  return { configured: true, baseUrl: run.baseUrl, up, ...(pid && alive(pid) ? { pid } : {}) };
}
