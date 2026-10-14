// 파일 맵으로 임시 프로젝트를 만든다(감지기 테스트용)
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export async function project(files) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-det-'));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, name)), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return dir;
}
