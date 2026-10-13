// 산출물에 찍는 날짜. 같은 입력이면 같은 출력이 나오도록 실행 시각을 쓰지 않는다.
import { execFileSync } from 'node:child_process';

export function projectDate(projectDir, config) {
  if (config.date) return String(config.date);
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs'], {
      cwd: projectDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || 'unknown';
  } catch {
    return 'unknown';
  }
}
