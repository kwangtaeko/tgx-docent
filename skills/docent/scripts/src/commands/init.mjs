// /docent-init: 프로젝트를 파악해 .docent/config.yaml과 .docent/.gitignore를 만든다.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DETECTORS } from '../detectors/index.mjs';
import { loadConfig } from '../lib/config.mjs';
import { docentDir } from '../lib/workspace.mjs';

const IGNORE_LINES = ['auth/', 'out/', 'media/', '.session', 'run.log', '.run-pid', '.run-approved'];
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
# 로그인이 필요한 앱(값은 적지 말고 환경변수 이름만):
# auth:
#   loginPath: /login
#   fields:
#     - label: 아이디
#       env: DOCENT_USER
#     - label: 비밀번호
#       env: DOCENT_PASSWORD
#   submit: 로그인
#   successPath: /
# 캡처·녹화 전에 흐리게 처리할 요소(CSS 선택자):
# mask:
#   selectors: [".phone", "td.ssn"]
# 산출물(preset: delivery 납품 | handover 인수인계 | portfolio 포트폴리오, formats: html readme pdf pptx):
# output:
#   preset: handover
#   formats: [html, readme]
#   title: 사용자 매뉴얼
#   organization: ""
#   revisions:
#     - { version: "1.0", date: "2026-10-14", author: "", note: "최초 작성" }
# GIF를 만들 화면(기본: 버튼 동작이 있는 화면):
# gif:
#   screens:
#     include: []
#     exclude: []
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
