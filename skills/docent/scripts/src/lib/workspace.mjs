// 대상 프로젝트의 .docent/ 작업 디렉터리 읽기·쓰기.
// 앱 여러 개를 한 매뉴얼로 묶을 때는 앱마다 .docent/apps/<이름>/에 따로 작업하고(--workspace <이름>),
// 루트 .docent/config.yaml의 combine 목록으로 build가 합친다.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// 작업 이름: 소문자·숫자와 사이의 '-'(합친 매뉴얼에서 화면 ID 앞에 붙는다)
export const WORKSPACE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

let current = '';

// 이 실행에서 쓸 앱 작업(빈 값이면 루트 .docent)
export function setWorkspace(name = '') {
  if (name && !WORKSPACE_NAME.test(name)) throw new Error(`invalid workspace: ${name}`);
  current = name;
}

export const workspaceName = () => current;

// 잠깐 다른 앱 작업으로 바꿔 fn을 실행한다(합친 build가 앱마다 검증·읽기를 할 때)
export async function withWorkspace(name, fn) {
  const before = current;
  setWorkspace(name);
  try {
    return await fn();
  } finally {
    current = before;
  }
}

export function rootDocentDir(projectDir) {
  return join(projectDir, '.docent');
}

export function docentDir(projectDir, name = current) {
  return name ? join(projectDir, '.docent', 'apps', name) : rootDocentDir(projectDir);
}

// .docent/apps/ 아래의 앱 작업 이름(이름순)
export async function listWorkspaces(projectDir) {
  try {
    const entries = await readdir(join(rootDocentDir(projectDir), 'apps'), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && WORKSPACE_NAME.test(e.name)).map((e) => e.name).sort();
  } catch {
    return [];
  }
}

export async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// 없으면 undefined, 깨졌으면 예외
export async function readJsonIfExists(path) {
  try {
    return await readJson(path);
  } catch (err) {
    if (err.code === 'ENOENT') return undefined;
    throw err;
  }
}

export async function writeJson(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + '\n');
}
