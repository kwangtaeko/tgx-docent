// 명령줄 안내 영어 번역표(main). 열쇠는 소스의 한국어 문구 그대로, {0}·{1}은 인자 자리
export default {
  // 사용법
  '사용법: docent <명령> [--project <디렉터리>]': 'Usage: docent <command> [--project <dir>]',
  '명령:': 'Commands:',
  '  init [--app <폴더>]': '  init [--app <dir>]',
  '                 프로젝트를 파악해 .docent/config.yaml을 만듭니다(모노레포는 문서로 만들 앱 폴더)':
    '                 Detect the project and create .docent/config.yaml (in a monorepo, the app folder to document)',
  '  inventory      화면 목록(.docent/inventory.json)을 만듭니다': '  inventory      Build the screen list (.docent/inventory.json)',
  '  update         코드가 바뀐 뒤 다시 할 일(새 화면·삭제 후보·재분석·시나리오·재캡처)':
    '  update         Show follow-up work after code changes (new screens, removal candidates, re-analysis, scenarios, re-capture)',
  '  pending        다시 분석할 화면(결과 없음·소스 변경·검사 문제·확인 항목 답변)을 보여 줍니다':
    '  pending        List screens to re-analyze (no result, source changed, check problems, review item answered)',
  '  validate [ID…] 분석 결과의 스키마·근거·연결을 검사합니다(화면 ID를 주면 그 화면만)':
    '  validate [ID…] Check analysis results for schema, evidence and links (only the given screen IDs, if any)',
  '  review         확인 필요 항목(.docent/review.md)을 모읍니다': '  review         Collect review items (.docent/review.md)',
  '                 .docent/out/에 산출물을 만듭니다': '                 Build outputs into .docent/out/',
  '  hash <파일…>   화면 JSON의 sourceHash 값을 계산합니다': '  hash <file…>   Compute the sourceHash value for a screen JSON',
  '  run approve    사용자가 동의한 run.json 명령을 이 컴퓨터에서 승인(.docent/.run-approved)':
    '  run approve    Approve the run.json commands the user agreed to, on this computer (.docent/.run-approved)',
  '  run start [--install] | stop | status  .docent/run.json대로 대상 앱 실행·중지·확인':
    '  run start [--install] | stop | status  Start, stop or check the target app as set in .docent/run.json',
  '  crawl          실행 중인 앱을 링크로 돌며 화면 목록과 대조(.docent/crawl.json)':
    '  crawl          Follow links in the running app and compare with the screen list (.docent/crawl.json)',
  '  scenarios      시나리오를 (다시) 써야 하는 화면(캡처 경로 필요·GIF 대상·낡음)':
    '  scenarios      List screens that need a scenario written or rewritten (capture path needed, GIF target, outdated)',
  '  capture [id…]  화면 캡처(.docent/media/img)': '  capture [id…]  Capture screens (.docent/media/img)',
  '  record [id…]   조작 GIF 녹화(.docent/media/gif)': '  record [id…]   Record interaction GIFs (.docent/media/gif)',
  '  auth login | save  로그인 상태 저장(login: config.yaml의 auth와 환경변수, save: 브라우저에서 직접 로그인)':
    '  auth login | save  Save the login state (login: auth in config.yaml and environment variables, save: log in yourself in a browser)',
  '  runtime status|install  화면 캡처용 Playwright 확인·설치(사용자 동의 후)':
    '  runtime status|install  Check or install Playwright for capture (after the user agrees)',
  '  session start  분석 세션 시작(비밀 파일 읽기 차단)': '  session start  Start an analysis session (blocks reading secret files)',
  '  session end    분석 세션 종료': '  session end    End the analysis session',

  // init
  '모노레포에서 앱을 여러 개 찾았습니다. 문서로 만들 앱을 골라 다시 실행하세요: docent init --app <폴더>':
    'Found several apps in this monorepo. Pick the app to document and run again: docent init --app <dir>',
  '화면 앱(감지기 없음)': 'screen app (no detector)',
  '.docent/config.yaml을 만들었습니다.': 'Created .docent/config.yaml.',
  '.docent/config.yaml이 이미 있어 그대로 둡니다.': '.docent/config.yaml already exists; left unchanged.',
  '--app은 쓰지 않았습니다. 앱 폴더를 바꾸려면 .docent/config.yaml의 app을 고치세요.':
    '--app was ignored. To change the app folder, edit app in .docent/config.yaml.',
  '앱 폴더: {0}': 'App folder: {0}',
  '감지된 프레임워크: {0}': 'Detected frameworks: {0}',
  '없음 (에이전트 탐색으로 화면을 찾습니다)': 'none (the agent will search for screens)',
  '데스크톱 앱({0})입니다: 화면 분석·산출물은 소스만으로 만들고, 화면 캡처·GIF는 지원하지 않습니다(실행·캡처 단계는 건너뜁니다)':
    'This is a desktop app ({0}): screen analysis and outputs come from source only; capture and GIF recording are not supported (run and capture steps are skipped)',

  // inventory · update
  '화면 {0}개 (page {1}, 하위 화면 {2})': '{0} screens (page {1}, sub-screens {2})',
  '({0}의 하위 화면)': '(sub-screen of {0})',
  '제외한 항목:': 'Excluded:',
  '없음': 'none',
  '새 화면': 'New screens',
  '삭제 후보(자동으로 지우지 않음)': 'Removal candidates (not deleted automatically)',
  '다시 분석': 'Re-analyze',
  '시나리오 작성': 'Write scenario',
  '다시 캡처': 'Re-capture',

  // pending · validate · review · build
  '다시 분석할 화면이 없습니다.': 'No screens to re-analyze.',
  '검증 통과: {0}': 'Validation passed: {0}',
  '검증 통과': 'Validation passed',
  '문제 {0}건:': '{0} problems:',
  '확인 필요 항목 {0}건 → .docent/review.md': '{0} review items → .docent/review.md',
  '산출물 {0}개 → .docent/out/': '{0} outputs → .docent/out/',
  '경고: {0}': 'Warning: {0}',
  '건너뜀({0}): {1}': 'Skipped ({0}): {1}',

  // run
  '다음 명령을 승인했습니다:': 'Approved these commands:',
  '이미 응답 중인 앱을 씁니다: {0}': 'Using the app that is already responding: {0}',
  '앱을 띄웠습니다: {0}': 'Started the app: {0}',
  '앱을 멈췄습니다.': 'Stopped the app.',
  'docent가 띄운 앱이 없습니다.': 'No app started by docent.',
  '응답 중': 'responding',
  '응답 없음': 'not responding',
  '.docent/run.json 없음': 'No .docent/run.json',

  // crawl · scenarios · capture · record
  '방문 {0}개, 목록에 없는 경로 {1}개, 도달하지 못한 화면 {2}개 → .docent/crawl.json':
    'Visited {0}, paths not in the list {1}, unreached screens {2} → .docent/crawl.json',
  '- 목록에 없음: {0}': '- Not in the list: {0}',
  '- 도달 못 함: {0}': '- Unreached: {0}',
  '시나리오를 쓸 화면이 없습니다.': 'No screens need a scenario.',
  '캡처 {0}개, 실패 {1}개, 건너뜀 {2}개 → .docent/media/img': 'Captured {0}, failed {1}, skipped {2} → .docent/media/img',
  '- 실패 {0}: {1}': '- Failed {0}: {1}',
  '- 건너뜀 {0}: {1}': '- Skipped {0}: {1}',
  'GIF {0}개, 실패 {1}개, 건너뜀 {2}개 → .docent/media/gif': 'Recorded {0} GIFs, failed {1}, skipped {2} → .docent/media/gif',

  // auth · runtime
  '로그인 상태를 저장했습니다: {0}': 'Saved the login state: {0}',
  'Playwright 없음 — 설치 위치: {0} (docent runtime install)': 'Playwright not found — install location: {0} (docent runtime install)',
};
