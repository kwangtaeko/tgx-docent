// /docent-init: 프로젝트를 파악해 .docent/config.yaml과 .docent/.gitignore를 만든다.
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DETECTORS } from '../detectors/index.mjs';
import { isDir } from '../detectors/shared.mjs';
import { loadConfig } from '../lib/config.mjs';
import { normalizeRel } from '../lib/paths.mjs';
import { findWorkspaceApps } from '../lib/workspaces.mjs';
import { docentDir } from '../lib/workspace.mjs';

const IGNORE_LINES = ['auth/', 'out/', 'media/', '.session', 'run.log', '.run-pid', '.run-approved'];
const GITIGNORE_HEADER = '# docent: 로그인 세션·산출물·캡처(실데이터가 찍힐 수 있음)는 커밋하지 않습니다';

function configYaml(detectors, app) {
  const list = detectors.length ? detectors.map((d) => `  - ${d}`).join('\n') : '  []';
  return `# docent 설정 — 항목 설명은 docent 설계 문서를 참고하세요
language: ko  # 산출물 언어: ko 한국어 | en 영어 (화면 분석 전에 정합니다)
${app ? `# 모노레포에서 문서로 만들 앱 폴더(프로젝트 루트 기준)\napp: ${app}\n` : ''}# date: 2026-01-01  # 산출물에 찍을 날짜 (없으면 마지막 커밋 날짜)
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

// app: 모노레포에서 문서로 만들 앱 폴더(init --app)
export async function runInit(projectDir, { app } = {}) {
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
    const config = await loadConfig(projectDir);
    return { created: false, detectors: config.detectors, ...(config.app ? { app: config.app } : {}) };
  }
  if (app !== undefined) {
    let rel;
    try {
      rel = normalizeRel(app);
    } catch {
      throw new Error(`--app은 프로젝트 안의 폴더여야 합니다: ${app}`);
    }
    if (!(await isDir(join(projectDir, rel)))) throw new Error(`--app 폴더가 없습니다: ${rel}`);
    const detectors = await detect(join(projectDir, rel));
    await writeFile(configPath, configYaml(detectors, rel));
    return { created: true, detectors, app: rel };
  }
  const detectors = await detect(projectDir);
  if (!detectors.length) {
    // 루트에서 감지되지 않으면 모노레포의 하위 앱을 찾는다: 하나면 그 앱으로, 여럿이면 고르게 한다
    const apps = await findWorkspaceApps(projectDir);
    if (apps.length === 1) {
      await writeFile(configPath, configYaml(apps[0].detectors, apps[0].dir));
      return { created: true, detectors: apps[0].detectors, app: apps[0].dir };
    }
    if (apps.length > 1) return { created: false, detectors: [], apps };
  }
  await writeFile(configPath, configYaml(detectors));
  return { created: true, detectors };
}

async function detect(dir) {
  const names = [];
  for (const detector of DETECTORS) if (await detector.detect(dir)) names.push(detector.name);
  return names;
}
