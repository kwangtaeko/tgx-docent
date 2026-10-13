// docent 실행 중 표시. 비밀 파일 차단 훅(hooks/block-secrets.mjs)이 이 파일이 있을 때만 동작한다.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docentDir } from '../lib/workspace.mjs';

export async function startSession(projectDir) {
  await mkdir(docentDir(projectDir), { recursive: true });
  await writeFile(join(docentDir(projectDir), '.session'), new Date().toISOString() + '\n');
}

export async function endSession(projectDir) {
  await rm(join(docentDir(projectDir), '.session'), { force: true });
}
