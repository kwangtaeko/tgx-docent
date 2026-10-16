// 명령줄 안내 영어 번역표(commands-b). 열쇠는 소스의 한국어 문구 그대로, {0}·{1}은 인자 자리
export default {
  // commands/auth.mjs
  'config.yaml에 auth(loginPath, fields, submit) 설정이 없습니다': 'config.yaml has no auth settings (loginPath, fields, submit)',
  '로그인에 필요한 환경변수가 없습니다: {0}': 'Missing environment variables for login: {0}',
  '로그인 실패: 로그인 후 {0}가 아니라 {1}에 머물렀습니다. 계정 환경변수({2})를 확인하세요':
    'Login failed: after login the browser stayed on {1} instead of {0}. Check the account environment variables ({2})',
  '브라우저에서 로그인을 마친 뒤 여기서 Enter를 누르세요… ': 'Log in in the browser, then press Enter here… ',

  // commands/capture.mjs
  '열 수 없습니다: {0}': 'Cannot open: {0}',
  '로그인 필요 — docent auth login으로 로그인 상태를 저장하세요': 'Login required — save the login state with docent auth login',
  '다른 화면({0})으로 이동했습니다 — 권한이 없거나 조건이 맞지 않습니다':
    'Redirected to another screen ({0}) — no permission or conditions not met',
  '준비 단계 {0}번째 실패: {1}': 'Setup step {0} failed: {1}',
  '시나리오에 실제 경로가 필요합니다': 'The scenario needs a concrete path',
  '준비 단계에 환경변수 값(계정 등)이 있어 캡처하지 않습니다':
    'Not captured: setup steps use environment variable values (accounts, etc.)',

  // commands/crawl.mjs
  '로그인 화면만 방문했습니다. 로그인 상태가 만료된 것 같습니다 — docent auth login으로 다시 로그인하세요':
    'Only the login screen was visited. The login state seems to have expired — log in again with docent auth login',

  // commands/record.mjs
  '시나리오가 없습니다': 'No scenario',
  '보여 줄 조작 단계가 없습니다': 'No steps to show',
  '환경변수 값(계정 등)을 입력하는 단계가 있어 GIF로 만들지 않습니다':
    'No GIF made: some steps enter environment variable values (accounts, etc.)',
  '시나리오가 낡았습니다': 'The scenario is stale',
  '{0}번째 단계 — {1}': 'Step {0} — {1}',
  'GIF가 2MB를 넘습니다. 시나리오 단계를 줄이세요': 'The GIF is over 2MB. Reduce the scenario steps',

  // commands/run.mjs
  '.docent/run.json이 없습니다. 실행 방법을 먼저 정하세요': '.docent/run.json not found. Set up the run plan first',
  '.docent/run.json 형식 오류: {0}': '.docent/run.json format error: {0}',
  '설치: {0}': 'Install: {0}',
  '실행: {0}': 'Start: {0}',
  '정리: {0}': 'Stop: {0}',
  '위치: {0}': 'Directory: {0}',
  '환경: {0}={1}': 'Env: {0}={1}',
  '{0}가 응답하지 않습니다. 앱을 띄운 뒤 다시 시도하세요': '{0} is not responding. Start the app and try again',
  '실행에 필요한 환경변수가 없습니다: {0}': 'Missing environment variables for the run: {0}',
  '이미 시작 중인 앱이 있습니다(pid {0}). 끝날 때까지 기다리거나 docent run stop을 실행하세요':
    'An app is already starting (pid {0}). Wait for it to finish or run docent run stop',
  '.docent/run.json의 명령이 이 컴퓨터에서 아직 승인되지 않았습니다. 아래 명령을 사용자에게 보여 주고 동의를 받은 뒤 `docent run approve`를 실행하세요:':
    'The commands in .docent/run.json are not yet approved on this computer. Show the commands below to the user, get their consent, then run `docent run approve`:',
  '설치 명령 실패: {0} (exit {1})': 'Install command failed: {0} (exit {1})',
  '앱이 시작 중에 종료되었습니다': 'The app exited while starting',
  '헬스체크 시간 초과({0}초)': 'Health check timed out ({0}s)',
  '{0}. .docent/run.log 마지막 부분:': '{0}. Last lines of .docent/run.log:',

  // commands/runtime.mjs
  '{0} 실패 (exit {1})': '{0} failed (exit {1})',

  // lib/media.mjs
  '{0} 잠금을 얻지 못했습니다': 'Could not acquire the lock on {0}',

  // lib/playwright.mjs
  '화면 캡처·녹화에 필요한 Playwright가 없습니다. 사용자 동의를 받은 뒤 `docent runtime install`로 설치하세요 ({0}에 playwright@{1}와 Chromium을 받습니다).':
    'Playwright, needed for capture and recording, is not installed. With the user\'s consent, install it with `docent runtime install` (downloads playwright@{1} and Chromium into {0}).',
  'Chromium을 찾을 수 없습니다. `docent runtime install`(또는 npx playwright install chromium)로 설치하세요.':
    'Chromium not found. Install it with `docent runtime install` (or npx playwright install chromium).',
};
