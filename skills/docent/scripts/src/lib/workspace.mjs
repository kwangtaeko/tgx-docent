// 대상 프로젝트의 .docent/ 작업 디렉터리 읽기·쓰기.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function docentDir(projectDir) {
  return join(projectDir, '.docent');
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
