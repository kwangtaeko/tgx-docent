// 명령줄 안내 영어 번역표(lib). 열쇠는 소스의 한국어 문구 그대로, {0}·{1}은 인자 자리
export default {
  // lib/steps.mjs — 시나리오 단계 실패 이유
  '환경변수 없음: {0}': 'Environment variable not set: {0}',
  '{0}을(를) 찾을 수 없습니다': '{0} not found',
  '{0}이(가) {1}개 있습니다. nth로 몇 번째인지 지정하세요': 'Found {1} matches for {0}. Use nth to pick one',
  '{0}의 {1}번째 요소를 찾을 수 없습니다': 'Element #{1} of {0} not found',
  '입력 항목 "{0}"': 'Input field "{0}"',
  '선택 항목 "{0}"': 'Select field "{0}"',
  '체크 항목 "{0}"': 'Checkbox "{0}"',
  '{0} "{1}"을(를) 눌렀지만 새 창이 열리지 않았습니다': 'Clicked {0} "{1}" but no new window opened',
  '문구 "{0}"가 나타나지 않았습니다': 'Text "{0}" did not appear',
  '알 수 없는 단계: {0}': 'Unknown step: {0}',
  '{0} 단계 실행 실패': 'Step {0} failed',

  // lib/evidence.mjs
  '근거 형식 오류: {0}': 'Invalid evidence format: {0}',
  'project root 밖의 경로: {0}': 'Path outside project root: {0}',
  '파일 없음: {0}': 'File not found: {0}',
  '{0}에 {1} 없음': '{1} not found in {0}',
  '{0}의 라인 범위 오류: {1}-{2} (전체 {3}줄)': 'Invalid line range in {0}: {1}-{2} (file has {3} lines)',
  '{0} 근처(±{1}줄)에 "{2}" 없음': '"{2}" not found near {0} (±{1} lines)',

  // lib/config.mjs
  'config.yaml: {0}는 {1}이어야 합니다': 'config.yaml: {0} must be {1}',
  'config.yaml: {0}는 {1}여야 합니다': 'config.yaml: {0} must be {1}',
  '객체': 'an object',
  '목록': 'a list',
  '문자열': 'a string',
  '양의 정수': 'a positive integer',
  'config.yaml: app은 프로젝트 안의 폴더 경로여야 합니다 ({0})': 'config.yaml: app must be a folder path inside the project ({0})',
  'config.yaml: language는 {0} 중 하나여야 합니다 ({1})': 'config.yaml: language must be one of {0} ({1})',
  '.docent/config.yaml 형식 오류: {0}': 'Invalid .docent/config.yaml: {0}',

  // lib/output-options.mjs
  '알 수 없는 프리셋 "{0}" — {1} 중 하나를 쓰세요': 'Unknown preset "{0}" — use one of {1}',
  '알 수 없는 형식 "{0}" — {1} 중에서 고르세요': 'Unknown format "{0}" — choose from {1}',
  '만들 형식이 없습니다 — {0} 중에서 고르세요': 'No formats to build — choose from {0}',
  'config.yaml: output.revisions는 목록이어야 합니다': 'config.yaml: output.revisions must be a list',
  'config.yaml: output.revisions[{0}]의 {1} 값이 없거나 문자열이 아닙니다': 'config.yaml: output.revisions[{0}].{1} is missing or not a string',
  '알 수 없는 테마 "{0}" — {1} 중 하나를 쓰세요': 'Unknown theme "{0}" — use one of {1}',

  // lib/paths.mjs, lib/source-hash.mjs
  '프로젝트 상대 경로가 아닙니다: {0}': 'Not a project-relative path: {0}',
  '소스 해시 계산 실패: {0} ({1})': 'Failed to compute source hash: {0} ({1})',

  // detectors/react-router.mjs
  '{0}의 flatRoutes()가 가리키는 {1}에서 라우트 파일을 찾지 못했습니다 — route-explorer로 화면을 찾으세요(references/stacks/js-routers.md)':
    'No route files found in {1}, which flatRoutes() in {0} points to — use route-explorer to find screens (references/stacks/js-routers.md)',

  // detectors/route-tree.mjs
  '경로를 소스 글자만으로 읽을 수 없는 라우트(변수 경로·스프레드)가 있어 화면이 빠졌을 수 있습니다: {0} — route-explorer로 나머지 화면을 찾으세요(references/stacks/js-routers.md)':
    'Some routes have paths that cannot be read from the source text (variable paths or spreads), so screens may be missing: {0} — use route-explorer to find the rest (references/stacks/js-routers.md)',
};
