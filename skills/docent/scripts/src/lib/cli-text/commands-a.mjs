// 명령줄 안내 영어 번역표(commands-a). 열쇠는 소스의 한국어 문구 그대로, {0}·{1}은 인자 자리
export default {
  // commands/validate.mjs
  '파일 없음': 'File not found',
  'JSON 형식 오류 ({0})': 'Invalid JSON ({0})',
  '없는 부모 화면 {0}': 'Parent screen does not exist: {0}',
  '"{0}"의 {1}가 없는 화면 {2}': '{1} of "{0}" points to a screen that does not exist: {2}',
  '소스가 바뀌었습니다. 다시 분석하세요': 'Source has changed. Analyze it again',
  '한 줄 소개': 'One-liner',
  '"{0}"의 없는 화면 {1}': '"{0}" refers to a screen that does not exist: {1}',
  '"{0}"를 뒷받침하는 화면이 모두 확신도 low입니다': 'All screens backing "{0}" have low confidence',
  '워크플로우 "{0}"의 없는 화면 {1}': 'Workflow "{0}" refers to screens that do not exist: {1}',
  '워크플로우 "{0}"는 화면 2개 이상을 오가야 합니다': 'Workflow "{0}" must move between at least 2 screens',
  '워크플로우 "{0}"의 {1} → {2} 연결이 화면 동작에도 메뉴에도 없습니다':
    'Workflow "{0}": neither a screen action nor the menu links {1} → {2}',
  '파일 이름과 screenId({0})가 다릅니다': 'File name does not match screenId ({0})',
  '없는 화면 {0}': 'Screen does not exist: {0}',
  '디렉터리 없음': 'Directory not found',
  '파일 이름과 id({0})가 다릅니다': 'File name does not match id ({0})',
  'inventory에는 있지만 분석 결과(screens/{0}.json)가 없습니다':
    'In inventory but has no analysis result (screens/{0}.json)',
  '분석 결과는 있지만 inventory에 없습니다': 'Has an analysis result but is not in inventory',
  'inventory와 분석 결과 어디에도 없는 화면 ID입니다': 'Screen ID not found in inventory or analysis results',

  // commands/review.mjs (review.md)
  '# 확인 필요 항목': '# Review items',
  '> docent가 소스만으로 확정하지 못한 내용입니다. 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영됩니다.':
    '> Things docent could not confirm from the source alone. Write an answer, check the box, and run `/docent-analyze` again to apply it.',
  ' 답:': ' Answer:',
  '목적 — 확신도 낮음: {0} ({1})': 'Purpose — low confidence: {0} ({1})',
  '역할 {0} — 확신도 낮음 ({1})': 'Role {0} — low confidence ({1})',
  '{0} — 확신도 낮음: 입력 항목 ({1})': '{0} — low confidence: input field ({1})',
  '{0} — 확신도 낮음: {1} ({2})': '{0} — low confidence: {1} ({2})',
  '화면 목록에 없는 경로: {0}': 'Path not in the screen list: {0}',
  '앱에서 링크로 도달하지 못한 화면: {0} ({1})': 'Screen not reachable by links in the app: {0} ({1})',
  '경로 없음': 'no path',
  '{0} 캡처 실패: {1} (media/fail/{0}.png)': '{0} capture failed: {1} (media/fail/{0}.png)',
  '{0} 녹화 실패: {1}{2} (media/fail/{0}.png)': '{0} recording failed: {1}{2} (media/fail/{0}.png)',
  '{0}번째 단계 — ': 'step {0} — ',
  '## 캡처·녹화 실패': '## Capture and recording failures',
  '## 실행 중인 앱 대조': '## Running app check',
  '확인할 항목이 없습니다.': 'No review items.',

  // commands/pending.mjs
  '분석 결과 없음': 'No analysis result',
  '분석 결과를 읽을 수 없음': 'Analysis result is unreadable',
  '소스 변경': 'Source changed',
  '검사 문제 {0}건': '{0} check problem(s)',
  '확인 항목 답변 {0}건': '{0} review item(s) answered',

  // commands/update.mjs
  '삭제된 화면 참조': 'Refers to a removed screen',

  // commands/scenarios.mjs
  '캡처 경로 필요': 'Capture path needed',
  'GIF 대상': 'GIF target',
  '낡음': 'Outdated',

  // commands/inventory.mjs
  '파일 없음 {0}': 'File not found: {0}',
  'app 폴더 {0}이 없습니다': 'app folder not found: {0}',
  '알 수 없는 감지기 {0}': 'Unknown detector: {0}',
  'idMap의 {0} → {1}는 {2} 화면의 ID와 겹쳐 적용하지 않았습니다':
    'idMap {0} → {1} not applied: the ID is already used by screen {2}',
  '부모 화면 {0} 없음': 'Parent screen not found: {0}',
  'inventory.json 스키마 오류: {0}': 'inventory.json schema error: {0}',

  // commands/init.mjs (.gitignore, config.yaml)
  '# docent: 로그인 세션·산출물·캡처(실데이터가 찍힐 수 있음)는 커밋하지 않습니다':
    '# docent: do not commit login sessions, outputs or captures (they may show real data)',
  '--app은 프로젝트 안의 폴더여야 합니다: {0}': '--app must be a folder inside the project: {0}',
  '--app 폴더가 없습니다: {0}': '--app folder not found: {0}',
  '# docent 설정 — 각 항목 설명은 아래 주석과 docent 스킬의 references/run-guide.md를 참고하세요':
    '# docent settings — see the comments below and references/run-guide.md in the docent skill for each field',
  'language: {0}  # 산출물 언어: ko 한국어 | en 영어 (화면 분석 전에 정합니다)':
    'language: {0}  # output language: ko Korean | en English (set before screen analysis)',
  '# 모노레포에서 문서로 만들 앱 폴더(프로젝트 루트 기준)': '# app folder to document in a monorepo (relative to the project root)',
  '# date: 2026-01-01  # 산출물에 찍을 날짜 (없으면 마지막 커밋 날짜)':
    '# date: 2026-01-01  # date shown on outputs (default: last commit date)',
  '# 로그인이 필요한 앱(값은 적지 말고 환경변수 이름만):':
    '# apps that need login (write environment variable names only, never values):',
  '#     - label: 아이디': '#     - label: Username',
  '#     - label: 비밀번호': '#     - label: Password',
  '#   submit: 로그인': '#   submit: Log in',
  '# 캡처·녹화 전에 흐리게 처리할 요소(CSS 선택자):': '# elements to blur before capture and recording (CSS selectors):',
  '# 산출물(preset: delivery 납품 | handover 인수인계 | portfolio 포트폴리오, formats: html readme pdf pptx):':
    '# outputs (preset: delivery | handover | portfolio, formats: html readme pdf pptx):',
  '#   theme: indigo  # 색 테마: indigo | blue | emerald | rose | slate':
    '#   theme: indigo  # color theme: indigo | blue | emerald | rose | slate',
  '#   title: 사용자 매뉴얼': '#   title: User Manual',
  '#   projectName: ""  # 산출물에 보일 이름(비우면 제품 이름·package.json name)':
    '#   projectName: ""  # name shown on outputs (empty: product name or package.json name)',
  '#     - { version: "1.0", date: "2026-10-14", author: "", note: "최초 작성" }':
    '#     - { version: "1.0", date: "2026-10-14", author: "", note: "Initial version" }',
  '# GIF를 만들 화면(기본: 버튼 동작이 있는 화면):': '# screens to make GIFs for (default: screens with button actions):',

  // commands/build.mjs
  '검증에 실패해 빌드를 멈췄습니다:': 'Build stopped because validation failed:',
  '앱 작업 {0}의 language({1})가 루트 config.yaml({2})와 다릅니다. 화면 설명이 섞인 언어로 나옵니다':
    'App workspace {0} has language {1} but the root config.yaml has {2}. Screen descriptions will be in mixed languages',
  '확인 필요 항목 {0}건이 남아 있습니다(.docent/review.md). 납품 전에 확인하세요':
    '{0} review item(s) remain (.docent/review.md). Check them before delivery',
  'Playwright가 없어 PDF를 만들지 못했습니다(docent runtime install)':
    'PDF not built: Playwright is not installed (docent runtime install)',
  'PDF의 워크플로우 다이어그램이 준비되지 않아 Mermaid 원문이 들어갔을 수 있습니다':
    'Workflow diagrams in the PDF were not ready; the PDF may contain raw Mermaid text',
  '워크플로우 다이어그램 {0}개를 그리지 못해 단계 목록만 넣었습니다':
    'Could not draw {0} workflow diagram(s); added step lists instead',
  'Playwright가 없어 PPT의 워크플로우 다이어그램 대신 단계 목록을 넣었습니다':
    'Playwright is not installed; added step lists instead of workflow diagrams in the PPT',
  // validate.mjs — effectEvidence
  '"{0}"의 effectEvidence 파일 {1}이 readFiles에 없습니다': 'effectEvidence file {1} of "{0}" is not in readFiles',
  '메뉴 경로의 "{0}"이 근거({1}) 근처에 없습니다': 'Menu path name "{0}" is not near its evidence ({1})',
  '근거 파일 {0}이 readFiles에 없습니다': 'Evidence file {0} is not in readFiles',
  '"{0}"의 section "{1}"이 sections에 없습니다': 'Section "{1}" of "{0}" is not in sections',
};
