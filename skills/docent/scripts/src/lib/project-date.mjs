// 산출물에 찍는 날짜. 같은 입력이면 같은 출력이 나오도록 실행 시각을 쓰지 않는다.
// config.date > 마지막 커밋 날짜 > (git이 없으면) 화면 파일 중 가장 최근 수정일 > unknown
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

function newestMtime(projectDir, files) {
  let newest = 0;
  for (const file of files) {
    try {
      newest = Math.max(newest, statSync(join(projectDir, file)).mtimeMs);
    } catch {
      // 없는 파일은 건너뛴다
    }
  }
  return newest ? new Date(newest).toISOString().slice(0, 10) : undefined;
}

export function projectDate(projectDir, config, files = []) {
  if (config.date) return String(config.date);
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs'], {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (out) return out;
  } catch {
    // git 저장소가 아님(압축 파일로 받은 소스 등)
  }
  return newestMtime(projectDir, files) ?? 'unknown';
}
