// /docent-init: 프로젝트를 파악해 .docent/config.yaml과 .docent/.gitignore를 만든다.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DETECTORS } from '../detectors/index.mjs';
import { loadConfig } from '../lib/config.mjs';
import { docentDir } from '../lib/workspace.mjs';

const IGNORE_LINES = ['auth/', 'out/', 'media/', '.session', 'run.log', '.run-pid'];
const GITIGNORE_HEADER = '# docent: 로그인 세션·산출물·캡처(실데이터가 찍힐 수 있음)는 커밋하지 않습니다';

function configYaml(detectors) {
  const list = detectors.length ? detectors.map((d) => `  - ${d}`).join('\n') : '  []';
  return `# docent 설정 — 항목 설명은 docent 설계 문서를 참고하세요
language: ko
# date: 2026-01-01  # 산출물에 찍을 날짜 (없으면 마지막 커밋 날짜)
detectors:
${list}
screens:
  include: []
  exclude: []
  idMap: {}
analyze:
  concurrency: 4
`.replace('detectors:\n  []', 'detectors: []');
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function runInit(projectDir) {
  const dir = docentDir(projectDir);
  await mkdir(dir, { recursive: true });
  const ignorePath = join(dir, '.gitignore');
  if (!(await exists(ignorePath))) {
    await writeFile(ignorePath, [GITIGNORE_HEADER, ...IGNORE_LINES, ''].join('\n'));
  } else {
    // 예전 버전이 만든 .gitignore에는 빠진 줄만 덧붙인다
    const current = await readFile(ignorePath, 'utf8');
    const have = new Set(current.split(/\r?\n/));
    const missing = IGNORE_LINES.filter((l) => !have.has(l));
    if (missing.length) await writeFile(ignorePath, current.replace(/\n?$/, '\n') + missing.join('\n') + '\n');
  }

  const configPath = join(dir, 'config.yaml');
  if (await exists(configPath)) {
    return { created: false, detectors: (await loadConfig(projectDir)).detectors };
  }
  const detectors = [];
  for (const detector of DETECTORS) {
    if (await detector.detect(projectDir)) detectors.push(detector.name);
  }
  await writeFile(configPath, configYaml(detectors));
  return { created: true, detectors };
}
