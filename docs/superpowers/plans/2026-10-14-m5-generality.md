# M5 범용성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React Router·Vue(Vue Router·Nuxt)·SvelteKit 화면 감지기를 더하고, 감지기 없이 에이전트 탐색만으로 도는 Spring MVC(JSP)·ASP.NET WebForms 픽스처로 범용 구조를 검증하며, M1~M4에서 미룬 사소한 문제를 정리한다.

**Architecture:** 감지기는 지금처럼 `{ name, detect, listScreens }` 모듈이며, Next.js 감지기 안의 파일 탐색·import 해석을 `detectors/shared.mjs`로 꺼내 함께 쓴다. 코드로 선언된 라우트(React Router·Vue Router)는 `detectors/route-tree.mjs`의 작은 토크나이저로 중첩 구조를 읽는다. 레거시 스택은 전용 감지기 없이 `references/stacks/` 힌트 + `route-explorer` 에이전트로 다루며, 그 결과(`inventory.agent.json`)를 골든으로 고정해 inventory 명령까지 통과하는지 테스트한다.

**Tech Stack:** Node.js 20.10+ ESM, `node:test`, esbuild 번들(기존), 픽스처용 Spring Boot 3.3.5 + JSP(Java 17, Maven), ASP.NET WebForms 소스(실행하지 않음)

**Spec:** `docs/superpowers/specs/2026-10-13-docent-design.md` (6장 화면 목록, 8장 실행, 12장 보안, 16장 M5, 17장 검증 기준·SI 레거시 방침)

## Global Constraints

- Node.js 20+, ESM(`.mjs`), 테스트 의존성 없음 — `npm test`(= `node --test`)
- 같은 입력이면 같은 결과가 나와야 하는 일은 스크립트, 해석은 에이전트
- 모든 서술은 소스 근거(`evidence`)를 가진다. 라벨·문구는 근거 위치 ±5줄 안에 있어야 한다
- 감지기 인터페이스: `{ name, detect(projectDir) → boolean, listScreens(projectDir) → [{ route, files, evidence }] }`, route 순 정렬, 동적 부분은 `[id]` 표기
- inventory `files` = 화면 파일과 그 파일이 직접 import하는 프로젝트 내부 파일(1단계까지)
- 비밀 파일(`.env`, `.env.*`(예시 제외), `appsettings*.json`, `web.config`, `*.pem`, `*.key`, `*.pfx`, `id_rsa*`)은 읽지 않는다. 비밀 값은 어디에도 저장하지 않고 환경변수 이름만 저장한다
- 사용자 동의(`run approve`) 없이 설치·실행 명령을 돌리지 않는다
- ASP.NET WebForms는 자동 실행 대상이 아니다(주소 받기만)
- `scripts/src/`나 `schemas/`를 고치면 `npm run build`로 `dist/`를 다시 만들어 함께 커밋한다
- 서술 문체는 합니다체, 커밋 메시지는 한국어

## Review Focus

1. **경로가 문자열 리터럴이 아닌 라우트**(`path: ROUTES.orders`, 템플릿 문자열) — 감지기가 죽지 않고 그 라우트만 건너뛴다(에이전트 탐색이 메운다). Task 4 테스트 "리터럴이 아닌 path는 건너뛴다".
2. **CRLF 줄바꿈의 라우터 파일** — evidence 줄 번호가 LF 파일과 같다. Task 4 테스트 "CRLF 파일도 줄 번호가 같다".
3. **빌드 산출물 폴더**(`dist`, `build`, `.svelte-kit`, `.nuxt`, `.output`) 안의 복사본 — 화면으로 잡히지 않는다. Task 4 테스트 "빌드 산출물 폴더는 걷지 않는다".
4. **Not-found용 catch-all**(`path: '*'`, `/:pathMatch(.*)*`) — 화면 목록에 넣지 않는다. Task 4·5 테스트.
5. **첫 실행이 느린 Maven 앱**(의존성 내려받기로 2분 넘게 걸림) — run-guide 예시가 `timeoutSec` 600을 쓰고, 실전 점검(Task 10)에서 실제로 확인한다.

---

### Task 1: 소스 분석 쪽 미룬 문제 정리

M1·M2에서 미룬 것: 혼합 문자 세그먼트, 심볼릭 링크, 단독 `\r`, config 형식 검사, 훅의 `./` 경로, README 이스케이프, 메뉴 순서. 그리고 레거시 확장자 경로의 ID.

**Files:**
- Modify: `skills/docent/scripts/src/lib/screen-id.mjs`, `lib/evidence.mjs`, `lib/source-hash.mjs`, `lib/config.mjs`, `lib/output-options.mjs`
- Create: `skills/docent/scripts/src/renderers/menu.mjs`
- Modify: `renderers/html.mjs`(menuTree), `renderers/readme.mjs`, `renderers/pptx.mjs`(메뉴 슬라이드), `hooks/block-secrets.mjs`
- Test: `tests/lib/screen-id.test.mjs`, `tests/lib/evidence.test.mjs`, `tests/lib/source-hash.test.mjs`, `tests/lib/config.test.mjs`, `tests/lib/output-options.test.mjs`, `tests/renderers/readme.test.mjs`, `tests/renderers/html.test.mjs`, `tests/hooks/block-secrets.test.mjs`

**Interfaces:**
- Produces: `orderedMenuEntries(inventory, screens) → [{ id, menu: string[] }]` (`renderers/menu.mjs`) — html·readme·pptx가 메뉴 트리를 이 순서로 만든다
- Produces: `loadConfig`가 형식이 틀린 값에 `config.yaml: <키 경로>는 <목록|객체|문자열|양의 정수>여야 합니다` 오류를 던진다

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// screen-id
test('ASCII와 한글이 섞인 세그먼트는 한글 부분을 해시로 남긴다', () => {
  assert.notEqual(routeToId('/주문a'), routeToId('/a'));
  assert.match(routeToId('/주문a'), /^a-s[0-9a-f]{8}$/);
  assert.equal(routeToId('/주문'), routeToId('/주문')); // 결정적
});
test('레거시 페이지 확장자는 ID에서 뺀다', () => {
  assert.equal(routeToId('/Orders/List.aspx'), 'orders-list');
  assert.equal(routeToId('/board/view.jsp'), 'board-view');
  assert.equal(routeToId('/member/login.do'), 'member-login');
  assert.equal(routeToId('/index.php'), 'index');
  assert.equal(routeToId('/docs/intro.html'), 'docs-intro');
});
// evidence
test('루트 안의 심볼릭 링크가 루트 밖을 가리키면 거부한다', async () => { /* symlink(outsideFile, root/'link.ts') */
  assert.equal((await checkEvidence(root, 'link.ts:1')).ok, false);
});
test('단독 \\r 줄바꿈도 줄로 센다', async () => { /* 'a\rb\rc' */
  assert.deepEqual(await checkEvidence(root, 'mac.txt:3', { expectText: 'c' }), { ok: true });
});
// source-hash
test('CR·CRLF·LF 줄바꿈의 해시가 같다', async () => { /* 'a\nb', 'a\r\nb', 'a\rb' 세 파일을 같은 이름으로 각각 다른 루트에 */ });
// config
test('값을 비운 키는 기본값을 쓴다', async () => { /* 'detectors:\nscreens:\n' → detectors [], screens.include [] */ });
test('형식이 틀린 값은 키 경로를 담은 오류', async () => {
  /* 'detectors: nextjs' */ await assert.rejects(loadConfig(dir), /config\.yaml: detectors는 목록이어야 합니다/);
  /* 'analyze:\n  concurrency: 0' */ await assert.rejects(loadConfig(dir), /analyze\.concurrency는 양의 정수여야 합니다/);
  /* 'screens:\n  idMap: [a]' */ await assert.rejects(loadConfig(dir), /screens\.idMap는 객체여야 합니다/);
});
test('output.formats는 문자열 하나도 받는다', async () => { /* 'output:\n  formats: pdf' */ assert.deepEqual((await loadConfig(dir)).output.formats, ['pdf']); });
// output-options
test('형식이 비면 오류', () => {
  assert.throws(() => resolveOutputOptions(DEFAULT_CONFIG, { formats: [] }), /만들 형식이 없습니다/);
});
test('개정 이력 오류 문구', () => {
  assert.throws(() => resolveOutputOptions({ output: { revisions: [{ date: 'x', author: 'y', note: 'z' }] } }), /revisions\[0\]의 version 값이 없거나/);
});
// readme
test('요약 값의 <!--·<태그>는 GitHub에서 숨지 않게 이스케이프한다', () => {
  /* summary.oneLiner.value = '앞 <!-- 뒤' */ assert.match(md, /앞 &lt;!-- 뒤/);
});
// html·readme 메뉴 순서
test('메뉴 트리는 메뉴 근거(파일·줄) 순서를 따른다', () => {
  /* 화면 a(route /a, menuPath.evidence nav.tsx:30), b(route /b, nav.tsx:10) → b가 먼저 */
});
// hook
test('./로 시작하는 경로도 디렉터리 패턴과 맞춘다', () => { /* secrets.paths: ['config/secret.yml'], Read file_path './config/secret.yml' → exit 2 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/lib tests/renderers tests/hooks` / Expected: 위 테스트들 FAIL

- [ ] **Step 3: 구현**
  - `screen-id.mjs`: `slug(text)`는 ASCII slug `s`와 원문에 ASCII 밖 글자·숫자(`/[^\x00-\x7F]/` 중 `\p{L}|\p{N}`)가 있는지 본다. 있으면 `h = 's' + sha1(text)[0..8]`을 `s ? \`${s}-${h}\` : h`로 붙인다. `segmentName`은 끝의 `\.(aspx|jsp|do|php|html?)$`(대소문자 무시)를 뗀다
  - `evidence.mjs`: 경로 문자열 검사 뒤 `realpath(target)`과 `realpath(rootPath)`를 비교해 루트 밖이면 `project root 밖의 경로`. 줄 나누기는 `/\r\n|\r|\n/`
  - `source-hash.mjs`: `content.replace(/\r\n?/g, '\n')`
  - `config.mjs`: `merge`는 override 값이 `null`이면 기본값을 둔다. 병합 뒤 `checkConfig(config)`가 기본값이 배열인 키(`detectors`, `screens.include|exclude`, `secrets.paths`, `mask.selectors`, `gif.screens.include|exclude`, `output.formats`, `output.revisions`)는 배열, 객체인 키(`screens`, `screens.idMap`, `secrets`, `analyze`, `mask`, `gif`, `gif.screens`, `output`)는 객체, `language`·`output.preset|title|organization`은 문자열, `analyze.concurrency`는 양의 정수인지 본다. `output.formats`가 문자열이면 `[문자열]`로 바꾼 뒤 검사한다. 키 경로는 점 표기
  - `output-options.mjs`: 거르고 난 `formats`가 비면 `만들 형식이 없습니다 — html, readme, pdf, pptx 중에서 고르세요`. 개정 이력 문구는 `의 ${field} 값이 없거나 문자열이 아닙니다`
  - `renderers/menu.mjs`: 메뉴가 있는 inventory 항목을 모아, 화면 JSON의 `menuPath.evidence`를 `parseEvidence`로 읽어 (파일, 시작 줄) 순으로 정렬한다. 근거가 줄 형식이 아니거나 메뉴가 inventory에서만 온 항목은 근거 있는 항목 뒤에 inventory 순서로 둔다. 정렬은 안정 정렬. `html.mjs`의 `menuTree`, `readme.mjs`의 `menuLines`, `pptx.mjs`의 메뉴 줄 생성이 이 결과를 쓴다
  - `readme.mjs`: `md(text)` = `&`→`&amp;`, `<`→`&lt;`. 요약 값·기능 이름·메뉴 이름·역할·화면 제목에 쓴다
  - `block-secrets.mjs`: 상대 경로를 `posix.normalize` 한 뒤 맨 앞 `./`를 뗀다. Glob·Grep 패턴도 같은 정규화를 거친다

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS(골든 해시는 LF 파일이라 그대로)

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "fix: 소스 분석 쪽 미룬 문제 정리 — 혼합 문자 ID, 레거시 확장자, 심볼릭 링크, CR 줄바꿈, 설정 형식 검사, README 이스케이프, 메뉴 순서"
```

### Task 2: 실행·캡처 쪽 미룬 문제 정리

M3에서 미룬 것 10개.

**Files:**
- Modify: `commands/run.mjs`, `schemas/run.schema.json`, `commands/crawl.mjs`, `commands/auth.mjs`, `lib/media.mjs`, `lib/steps.mjs`, `schemas/scenario.schema.json`, `skills/docent/SKILL.md`(6.6), `skills/docent/references/run-guide.md`, `skills/docent/references/schema.md`, `skills/docent/agents/scenario-writer.md`, `docent.mjs`(crawl 경고 출력)
- Test: `tests/commands/run.test.mjs`, `tests/commands/crawl.test.mjs`, `tests/commands/auth.test.mjs`, `tests/lib/steps.test.mjs`, `tests/commands/record.test.mjs`(실패 기록 동시성)

**Interfaces:**
- Produces: run.json 선택 항목 `stop: string` — `run stop`이 프로세스를 멈춘 뒤 같은 `cwd`·`env`로 실행한다. 승인 해시에 들어간다(값이 있을 때만 해시 입력에 포함해 기존 승인을 깨지 않음)
- Produces: `.run-pid`는 JSON `{ "pid": n, "start": "<run.start>" }`. 숫자만 있는 옛 형식도 읽는다
- Produces: `runCrawl` 결과에 `warnings: string[]`
- Produces: 시나리오 `fill`·`select`·`check` 단계에 선택 항목 `nth`(0부터)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// run
test('앱이 이미 떠 있으면 envNames가 없어도 재사용한다', async () => { /* envNames: ['NOPE_X'], 서버 응답 중 → { reused: true } */ });
test('시작 중인 앱이 있으면 두 번째 start를 거부한다', async () => {
  /* .run-pid에 살아 있는 pid(자기 자신 process.pid)와 run.start를 적고 헬스체크는 실패 → /이미 시작 중/ */
});
test('죽은 pid 파일은 지우고 신호를 보내지 않는다', async () => { /* .run-pid {pid: 999999} → runStop → { stopped: false }, 파일 없음 */ });
test('stop 명령이 있으면 멈춘 뒤 실행한다', async () => { /* stop: "node -e \"require('fs').writeFileSync('stopped','1')\"" → 승인 후 start·stop → cwd/stopped 존재 */ });
test('stop 명령이 바뀌면 다시 승인해야 한다', async () => { /* 승인 후 run.json에 stop 추가 → start 거부 */ });
test('실패 로그의 비밀 값은 가린다', async () => {
  /* envNames: ['DOCENT_T_SECRET'], process.env.DOCENT_T_SECRET='s3cr3t-value', start가 그 값과 'postgres://u:pw@h/db'를 출력하고 종료 */
  /* 오류 메시지에 's3cr3t-value'·'u:pw@' 없음, '***' 있음 */
});
// crawl
test('로그인 화면만 방문했으면 세션 만료 경고', async () => { /* auth.loginPath '/login', 모든 링크가 /login으로 리다이렉트 → warnings에 /로그인 상태가 만료/ */ });
// auth
test('기본 successPath에서도 로그인 경로 아래에 머물면 실패', async () => { /* 로그인 후 /login/error로 이동하는 서버 → /로그인 실패/ */ });
// steps
test('fill·select는 nth로 몇 번째 항목인지 고른다', async () => { /* 같은 라벨 입력 2개 → { do:'fill', label:'수량', value:'3', nth: 1 } → 두 번째만 3 */ });
// media
test('동시에 실패를 기록해도 잃지 않는다', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => recordFailure(dir, { id: `s${i}`, kind: 'gif', reason: 'x' })));
  assert.equal((await readFailures(dir)).length, 20);
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/commands tests/lib` / Expected: 위 테스트 FAIL

- [ ] **Step 3: 구현**
  - `runStart`: 헬스체크 재사용 → url 모드 → **envNames 검사** → `readPid`가 살아 있는 pid를 주면 `이미 시작 중인 앱이 있습니다(pid N). 끝날 때까지 기다리거나 docent run stop을 실행하세요` → 승인 검사 순
  - `readPid`: JSON이면 `pid`·`start`, 숫자면 pid만. 죽은 pid거나, `/proc/<pid>/cmdline`이 있고 그 안에 `start` 문자열이 없으면 파일을 지우고 `undefined`
  - `runStop`: 그룹 종료 뒤 `run.stop`이 있으면 `spawnSync(stop, { cwd, shell: true, env })`. pid가 없어도 `stop`은 실행하지 않는다(승인된 앱을 우리가 띄웠을 때만)
  - `redact(text, run)`: `run.envNames`의 현재 환경변수 값(4자 이상)과 URL의 `//사용자:비밀번호@`를 `***`로. `logTail` 결과에 적용
  - `run.schema.json`에 `stop`(문자열), `commandsHash`·`describeCommands`에 `stop` 반영(`정리: …`)
  - `runCrawl`: `config.auth?.loginPath`가 있고 방문한 경로가 모두 로그인 경로면 `로그인 상태가 만료된 것 같습니다 — docent auth login으로 다시 로그인하세요` 경고. CLI는 `경고:`로 출력
  - `authLogin`: 실패 조건 = 경로가 `loginPath`와 같거나 `loginPath + '/'`로 시작함, 또는 `successPath`가 있고 경로가 그것과 같지도 `successPath(끝 / 정규화) + '/'`로 시작하지도 않음
  - `media.mjs`: `withLock(path, fn)` — `${path}.lock` 디렉터리를 `mkdir`로 잡고(EEXIST면 50ms 간격, 10초까지 재시도, 30초 넘은 잠금은 낡은 것으로 지움) `fn` 뒤 지운다. `recordFailure`·`clearFailure`가 쓴다
  - `steps.mjs`: `fill`·`select`·`check`에 `nth`가 있으면 `locator.nth(nth)`를 기다려 쓴다(click과 같은 오류 문구). 스키마 세 단계에 `nth: { type: integer, minimum: 0 }`
  - SKILL.md 6.6과 `scenario-writer.md` 입력에 "실행 중인 앱 주소(`run status`의 baseUrl)"를 넘긴다고 적는다. run-guide의 docker compose 행에 `stop: "docker compose down"`을 적는다. schema.md에 `nth`·`stop`

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "fix: 실행·캡처 쪽 미룬 문제 정리 — 시작 중복·낡은 pid, stop 명령, 로그 비밀 가림, 세션 만료 경고, 로그인 판정, 실패 기록 잠금, 입력 단계 nth"
```

### Task 3: 산출물 쪽 미룬 문제 정리

M4에서 미룬 것.

**Files:**
- Modify: `commands/update.mjs`, `docent.mjs`(update 출력, `--format` 빈 값), `renderers/diagrams.mjs`, `renderers/pdf.mjs`, `commands/build.mjs`, `renderers/html.mjs`(`stripEvidence` 삭제, 인쇄용 미리보기), `renderers/pptx.mjs`(긴 캡처 자르기), `README.md`
- Test: `tests/commands/update.test.mjs`, `tests/renderers/diagrams.test.mjs`, `tests/renderers/pdf.test.mjs`, `tests/renderers/print.test.mjs`, `tests/renderers/pptx.test.mjs`, `tests/cli.test.mjs`

**Interfaces:**
- Produces: `runUpdate` 결과에 `problems: string[]`(runInventory의 제외 항목)
- Produces: `renderDiagrams` → `Array<Buffer|null>`(실패한 워크플로우는 null), 두 번째 반환값 없이 build가 null 개수로 경고
- Produces: `renderPdf` → `{ diagramsReady: boolean }`
- Produces: `cropForSlide(pngBuffer, boxW, boxH) → Buffer` (`renderers/pptx.mjs` 내부, 테스트용 export)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('update는 inventory 제외 항목을 함께 돌려준다', async () => { /* inventory.agent.json에 없는 파일 항목 → problems에 '파일 없음' */ });
test('--format 값이 비면 실패 코드', async () => { /* cli build --format , → exit 1, stderr /만들 형식이 없습니다/ */ });
test('다이어그램 하나가 실패해도 나머지를 만든다', async () => { /* 워크플로우 2개 중 하나의 단계 id를 Mermaid 문법을 깨는 값으로 바꾼 입력이 아니라, page.evaluate가 던지도록 mermaid 대신 가짜 스크립트를 쓰는 assetsDir → [null, Buffer] */ });
test('Mermaid가 준비되지 않으면 diagramsReady false', async () => { /* data-ready를 세우지 않는 HTML → { diagramsReady: false } (타임아웃은 옵션 waitMs 500) */ });
test('인쇄용 소개의 미리보기는 GIF 대신 캡처 PNG', () => { /* media.gifs·images에 a → print HTML에 media/img/a.png 있고 .gif 없음 */ });
test('세로로 긴 캡처는 위쪽만 잘라 넣는다', () => {
  /* 100×1000 PNG, box 6.0×5.6 → 결과 높이 = round(100 * 5.6/6.0 * 1.5) = 140 */
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/commands/update.test.mjs tests/renderers tests/cli.test.mjs` / Expected: FAIL

- [ ] **Step 3: 구현**
  - `runUpdate`: `runInventory`의 `problems`를 그대로 넘기고, CLI는 `listProblems('제외한 항목:', problems)`
  - CLI `build`: `--format`이 주어졌는데 비면 오류(resolveOutputOptions의 문구), exit 1
  - `renderDiagrams`: 워크플로우마다 try/catch, 실패면 `null`. build는 null이 있으면 `워크플로우 다이어그램 N개를 그리지 못해 단계 목록만 넣었습니다` 경고(PPT는 이미 단계 목록을 함께 넣음)
  - `renderPdf(…, { waitMs = 20000 })`: 대기 실패를 `diagramsReady: false`로 돌려주고 build는 `PDF의 워크플로우 다이어그램이 준비되지 않아 Mermaid 원문이 들어갔을 수 있습니다` 경고
  - `html.mjs`: 쓰이지 않는 `stripEvidence` 삭제. 소개 미리보기는 `input.printAnchors`이면 GIF 대신 `media/img/<id>.png`(캡처가 있는 화면만)
  - `pptx.mjs`: `cropForSlide` — 높이/너비가 `boxH/boxW × 1.5`를 넘으면 pngjs로 위쪽만 남긴다. 화면 슬라이드 캡처에 적용
  - `README.md`: 프리셋 문단을 출력 목록 뒤로 옮겨 `.docent/review.md` 항목을 목록 안으로 되돌린다

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "fix: 산출물 쪽 미룬 문제 정리 — update 제외 항목, 빈 형식, 다이어그램 실패 허용, PDF 준비 경고, 인쇄 미리보기, 긴 캡처 자르기"
```

### Task 4: 감지기 공용 모듈과 React Router 감지기

**Files:**
- Create: `skills/docent/scripts/src/detectors/shared.mjs`, `detectors/route-tree.mjs`, `detectors/react-router.mjs`
- Modify: `detectors/nextjs.mjs`(공용 모듈 사용, 동작 그대로), `detectors/index.mjs`
- Create: `fixtures/detectors/react-router/`(데이터 라우터 앱: `package.json`, `tsconfig.json`, `src/main.tsx`, `src/router.tsx`, 페이지 5~6개, 공용 컴포넌트 1개), `fixtures/detectors/react-router-v7/`(`package.json`, `app/routes.ts`, `app/routes/*.tsx` 4개), `fixtures/expected/detectors/react-router.json`, `fixtures/expected/detectors/react-router-v7.json`
- Test: `tests/detectors/shared.test.mjs`, `tests/detectors/route-tree.test.mjs`, `tests/detectors/react-router.test.mjs`, 기존 `tests/detectors/nextjs.test.mjs`(변경 없이 통과)

**Interfaces:**
- Produces (`shared.mjs`):
  - `SKIP_DIRS: Set` — `node_modules .git .docent .next .nuxt .output .svelte-kit dist build coverage`
  - `readJsonc(path) → Promise<object|undefined>`, `isFile(path)`, `isDir(path)`
  - `walk(projectDir, rel) → Promise<string[]>` (상대 경로, `/` 구분)
  - `loadAliases(projectDir, extra = []) → Promise<Alias[]>` (`Alias = { prefix, wildcard, targets }`, tsconfig·jsconfig `paths` + extra)
  - `resolveImport(projectDir, fromFile, spec, aliases) → Promise<string|undefined>` (접미사에 `.vue`·`.svelte` 추가)
  - `screenFiles(projectDir, file, aliases) → Promise<string[]>` = `[file, ...정렬된 직접 import]`
  - `lineOf(source, regex) → number` (1부터, 없으면 1, `/\r\n|\r|\n/`로 나눔)
  - `hasDependency(projectDir, names: string[]) → Promise<boolean>`
  - `byRoute(a, b)` 정렬 비교 함수
- Produces (`route-tree.mjs`):
  - `RouteNode = { path?: string, index: boolean, component?: { name?: string, importPath?: string }, line: number, children: RouteNode[] }`
  - `parseRouteObjects(source) → RouteNode[]` — `path:`·`index: true`·`element: <X`·`Component: X`·`component: X`·`lazy: () => import('…')`·`component: () => import('…')`·`children: [ … ]`
  - `parseJsxRoutes(source) → RouteNode[]` — `<Route path= index element={<X …/>} Component={X}>` 중첩·자기 닫힘
  - `findImport(source, name) → string|undefined` — 기본·이름·별칭 import, `lazy(() => import())`, `defineAsyncComponent(() => import())`
  - `flattenRoutes(nodes) → [{ path, node }]` — 부모 경로와 결합(자식이 `/`로 시작하면 절대), index는 부모 경로, 컴포넌트가 없는 노드는 결과에서 빼되 자식은 따라간다
  - `toDocentPath(path) → string|undefined` — `:id`→`[id]`, `:id(\\d+)`→`[id]`, `:id?`→`[[...id]]`, `*`·`:x(.*)*`→`[...x]`(`*`는 `[...splat]`), 정적 `seg?`→`seg`. 경로 전체가 catch-all 하나뿐이면 `undefined`(Not-found)
- Produces (`react-router.mjs`): `name = 'react-router'`, `detect`(`react-router`·`react-router-dom` 의존성), `listScreens`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
// shared
test('빌드 산출물 폴더는 걷지 않는다', async () => { /* dist/a.tsx, build/b.tsx, .svelte-kit/c.js, src/d.tsx → ['src/d.tsx'] */ });
test('lineOf는 CR·CRLF도 줄로 센다', () => assert.equal(lineOf('a\r\nb\rexport default x', /export default/), 3));
// route-tree
test('객체 라우트의 중첩·index·lazy', () => {
  const src = `const r = createBrowserRouter([\n{ path: '/', element: <Layout />, children: [\n  { index: true, element: <Home /> },\n  { path: 'orders', children: [\n    { index: true, element: <Orders /> },\n    { path: ':id', lazy: () => import('./pages/OrderDetail') },\n  ] },\n] },\n]);`;
  assert.deepEqual(flattenRoutes(parseRouteObjects(src)).map((r) => [r.path, r.node.line]), [['/', 3], ['/orders', 5], ['/orders/:id', 6]]);
});
test('JSX 라우트 중첩과 자기 닫힘', () => {
  const src = `<Routes>\n<Route path="/" element={<Layout />}>\n<Route index element={<Home />} />\n<Route path="users/:id" element={<User a={1} />} />\n</Route>\n<Route path="*" element={<NotFound />} />\n</Routes>`;
  assert.deepEqual(flattenRoutes(parseJsxRoutes(src)).map((r) => r.path), ['/', '/users/:id', '/*']);
});
test('toDocentPath', () => {
  assert.equal(toDocentPath('/orders/:id'), '/orders/[id]');
  assert.equal(toDocentPath('/p/:id(\\d+)'), '/p/[id]');
  assert.equal(toDocentPath('/docs/:page?'), '/docs/[[...page]]');
  assert.equal(toDocentPath('/files/*'), '/files/[...splat]');
  assert.equal(toDocentPath('/*'), undefined);
  assert.equal(toDocentPath('/:pathMatch(.*)*'), undefined);
});
test('findImport', () => {
  assert.equal(findImport("import Orders from './pages/Orders';", 'Orders'), './pages/Orders');
  assert.equal(findImport("import { A as Orders } from '@/x';", 'Orders'), '@/x');
  assert.equal(findImport("const Orders = lazy(() => import('./o'));", 'Orders'), './o');
});
// react-router
test('detect', async () => { /* fixtures/detectors/react-router → true, next만 있는 package.json → false */ });
test('픽스처 결과가 기대값과 같다', async () => {
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router'), expected('react-router'));
  assert.deepEqual(await reactRouter.listScreens('fixtures/detectors/react-router-v7'), expected('react-router-v7'));
});
test('리터럴이 아닌 path는 건너뛴다', async () => { /* { path: ROUTES.a, element: <A/> }, { path: `/${x}`, … }, { path: '/b', element: <B/> } → ['/b'] */ });
test('CRLF 파일도 줄 번호가 같다', async () => { /* 같은 라우터를 \r\n으로 → evidence 동일 */ });
test('컴포넌트를 찾지 못하면 라우터 파일을 files로', async () => { /* 같은 파일에 정의된 컴포넌트 → files = ['src/router.tsx'] */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/detectors` / Expected: 새 테스트 FAIL(모듈 없음), nextjs 테스트 PASS

- [ ] **Step 3: 구현**
  - `shared.mjs`에 Next.js 감지기의 JSONC·walk·alias·import 해석을 옮기고 `nextjs.mjs`가 쓰게 한다
  - `route-tree.mjs`: 문자열·주석·템플릿 문자열을 건너뛰는 문자 단위 스캐너. 객체 파서는 `{`마다 노드 후보를 쌓고, `children:` 배열 안의 객체만 자식으로 붙인다. `path`는 따옴표 리터럴일 때만 읽는다(아니면 그 노드는 path 없음 + `dynamicPath` 표시 → `flattenRoutes`가 노드와 자손을 버림). 각 노드의 `line`은 `path:`(없으면 `index:`)가 있는 줄
  - `react-router.mjs`:
    - 모드 1 (v7 프레임워크): `app/routes.ts`(또는 `.js`)가 있으면 `route('경로', '파일', [자식])`·`index('파일')`·`layout('파일', [자식])`·`prefix('경로', [자식])`를 읽는다. 파일은 `app/` 기준. 화면 파일 = 그 파일, evidence = `routes.ts`의 해당 줄
    - 모드 2: `src/`(없으면 루트)의 `.jsx|.tsx|.js|.ts` 중 `createBrowserRouter|createHashRouter|createMemoryRouter|useRoutes|<Route\b|RouteObject`가 있는 파일을 객체·JSX 파서로 읽는다
    - 컴포넌트 이름 → `findImport` → `resolveImport` → `screenFiles`. 같은 route가 여러 번 나오면 먼저 나온 것. route 순 정렬
  - `index.mjs`: `DETECTORS = [nextjs, reactRouter]`
  - 픽스처는 의존성 설치·빌드 없이 소스만 둔다(`package.json`에 의존성 이름만). 기대 JSON은 직접 확인한 결과를 적는다

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "feat: React Router 화면 감지기와 감지기 공용 모듈"
```

### Task 5: Vue Router·Nuxt 감지기

**Files:**
- Create: `skills/docent/scripts/src/detectors/vue.mjs`, `fixtures/detectors/vue-router/`(`package.json`, `src/router/index.ts`, `src/views/*.vue` 5개), `fixtures/detectors/nuxt/`(`package.json`, `pages/` 아래 index·`orders/index.vue`·`orders/[id].vue`·`orders/[id]/edit.vue`·`[...slug].vue`), `fixtures/expected/detectors/vue-router.json`, `fixtures/expected/detectors/nuxt.json`
- Modify: `detectors/index.mjs`
- Test: `tests/detectors/vue.test.mjs`

**Interfaces:**
- Consumes: `shared.mjs`, `route-tree.mjs`(Task 4)
- Produces: `name = 'vue'`, `detect`(`vue-router` 또는 `nuxt` 의존성), `listScreens`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('Vue Router 픽스처', async () => assert.deepEqual(await vue.listScreens('fixtures/detectors/vue-router'), expected('vue-router')));
test('Nuxt 픽스처(파일 라우팅, catch-all은 빼기)', async () => assert.deepEqual(await vue.listScreens('fixtures/detectors/nuxt'), expected('nuxt')));
test('Nuxt 4의 app/pages', async () => { /* nuxt 4 + app/pages/index.vue → ['/'] */ });
test('Nuxt 동적 세그먼트 표기', async () => {
  /* pages/a/[[opt]].vue, pages/b/[...rest].vue → '/a/[[opt]]', '/b/[...rest]' */
});
test('redirect만 있는 라우트와 Not-found는 뺀다', async () => {
  /* { path: '/old', redirect: '/new' }, { path: '/:pathMatch(.*)*', component: NotFound } → [] */
});
test('부모 .vue와 index.vue가 함께 있으면 /orders 하나, 두 파일 모두 files에', async () => { /* pages/orders.vue + pages/orders/index.vue */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/detectors/vue.test.mjs` / Expected: FAIL

- [ ] **Step 3: 구현**
  - Nuxt(의존성 `nuxt`): `app/pages`(있으면) 또는 `pages`의 `.vue` 파일 → 경로(`index` 제거, `[...x]`·`[[x]]` 그대로, 경로 전체가 catch-all이면 제외). 부모 `x.vue`와 `x/index.vue`가 같은 경로면 files = [index 파일, 부모 파일, …imports]. evidence = `<template` 줄
  - Vue Router: `src/router/**` 또는 `createRouter(`가 있는 파일을 `parseRouteObjects`로 읽는다. `component: X` → `findImport`, `component: () => import('…')` → 직접. 경로 변환은 `toDocentPath`
  - `DETECTORS = [nextjs, reactRouter, vue]`

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "feat: Vue Router·Nuxt 화면 감지기"
```

### Task 6: SvelteKit 감지기

**Files:**
- Create: `skills/docent/scripts/src/detectors/sveltekit.mjs`, `fixtures/detectors/sveltekit/`(`package.json`, `svelte.config.js`, `src/routes/` 아래 `+page.svelte`·`(app)/orders/+page.svelte`·`orders/[id=integer]/+page.svelte`+`+page.ts`·`login/+page.svelte`+`+page.server.ts`·`api/x/+server.ts`, `src/lib/Nav.svelte`), `fixtures/expected/detectors/sveltekit.json`
- Modify: `detectors/index.mjs`
- Test: `tests/detectors/sveltekit.test.mjs`

**Interfaces:**
- Produces: `name = 'sveltekit'`, `detect`(`@sveltejs/kit` 의존성), `listScreens`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('SvelteKit 픽스처', async () => assert.deepEqual(await sveltekit.listScreens('fixtures/detectors/sveltekit'), expected('sveltekit')));
test('matcher는 떼고, +server.ts만 있는 경로는 화면이 아니다', async () => { /* '/orders/[id=integer]' → '/orders/[id]', api/x 없음 */ });
test('+page.ts·+page.server.ts와 $lib import가 files에 들어간다', async () => {
  /* login: files = ['src/lib/Nav.svelte', 'src/routes/login/+page.server.ts', 'src/routes/login/+page.svelte'] 의 정해진 순서: [page, ...정렬된 나머지] */
});
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/detectors/sveltekit.test.mjs` / Expected: FAIL

- [ ] **Step 3: 구현**
  - `src/routes/**/+page.svelte`만 화면. 경로 = 디렉터리 경로(route group `(x)`은 Next.js처럼 그대로 두어 ID·crawl에서 무시), `[x=matcher]` → `[x]`
  - files = [`+page.svelte`, 정렬된(같은 폴더의 `+page.ts|.js|.server.ts|.server.js` + `+page.svelte`의 직접 import)]. `$lib` 별칭은 `loadAliases(projectDir, [{ prefix: '$lib/', wildcard: true, targets: ['src/lib/*'] }, { prefix: '$lib', wildcard: false, targets: ['src/lib'] }])`
  - evidence = `<script` 줄(없으면 1)
  - `DETECTORS = [nextjs, reactRouter, vue, sveltekit]`

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 번들·커밋**

```bash
npm run build && git add -A && git commit -m "feat: SvelteKit 화면 감지기"
```

### Task 7: Spring MVC(JSP) 픽스처와 골든

**Files:**
- Create: `fixtures/spring-jsp-sample/` — `pom.xml`(spring-boot-starter-parent 3.3.5, war, `spring-boot-starter-web`, `tomcat-embed-jasper`, `jakarta.servlet.jsp.jstl-api`·`org.glassfish.web:jakarta.servlet.jsp.jstl`, Java 17), `src/main/java/sample/` (`SampleApplication`, `AuthInterceptor`(세션 로그인·ADMIN 권한 검사), `WebConfig`, `LoginController`, `HomeController`, `ProductController`(목록·등록·상세·수정, 재고가 0이면 삭제 불가 메시지), `PartnerController`(거래처 검색 팝업 `/popup/partners`), `AdminUserController`(`/admin/users`), `ProductStore`·`Accounts`(데모 계정 `user/user1234`·`admin/admin1234`, 메모리 저장)), `src/main/webapp/WEB-INF/jsp/` (`common/nav.jsp`, `login.jsp`, `home.jsp`, `products/list.jsp`, `products/form.jsp`(등록·수정 공용, 거래처 팝업을 `window.open`), `products/detail.jsp`, `popup/partners.jsp`, `admin/users.jsp`), `src/main/resources/application.properties`(`server.port=8080`, view prefix·suffix), `README.md`
- Create: `fixtures/expected/spring-jsp-sample/` — `inventory.agent.json`(route-explorer 결과), `inventory.json`, `screens/*.json`(합니다체), `summary.json`, `scenarios/*.json`
- Create: `tests/helpers/golden-suite.mjs`; Modify: `tests/golden-nextjs.test.mjs`(공용 검사를 suite로)
- Create: `tests/golden-spring.test.mjs`
- Modify: `.github/workflows/test.yml`(spring fixture-build job: `actions/setup-java@v4` temurin 17, `mvn -B -q package -DskipTests`), `.gitignore`(`fixtures/spring-jsp-sample/target/`)

**Interfaces:**
- Produces: `goldenSuite({ root, expected, pages, children, edges })` — 스키마·ID·연결·근거(±5줄)·sourceHash·summary 워크플로우·합니다체·시나리오 검사를 `test()`로 등록한다. `pages`·`children`은 기대 개수, `edges`는 반드시 있어야 할 `a->b` 간선
- Produces: `inventoryFromAgent(root, expectedDir) → inventory` — 픽스처를 임시 폴더로 복사하고 `inventory.agent.json`을 `.docent/`에 둔 뒤 `runInventory` 결과를 돌려준다(골든 inventory.json과 같아야 함)

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/golden-spring.test.mjs`

```js
goldenSuite({ root: 'fixtures/spring-jsp-sample', expected: 'fixtures/expected/spring-jsp-sample', pages: 7, children: 1,
  edges: ['login->home', 'products->products-new', 'products-new->products', 'products->products-id', 'products-id->products-id-edit'] });
test('에이전트 탐색 결과가 inventory 명령을 그대로 통과한다', async () => {
  const { inventory, problems } = await inventoryFromAgent('fixtures/spring-jsp-sample', 'fixtures/expected/spring-jsp-sample');
  assert.deepEqual(problems, []);
  assert.deepEqual(inventory, golden.inventory);
});
test('모든 화면의 source는 agent', () => { /* inventory.screens.every(s => s.source === 'agent') */ });
test('거래처 검색은 popup 하위 화면', () => { /* products-new--partner-search: kind 'popup', parentId 'products-new' */ });
test('관리자 권한 근거는 인터셉터', () => { /* admin-users.roles[0].evidence가 AuthInterceptor.java */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/golden-spring.test.mjs` / Expected: FAIL(파일 없음)

- [ ] **Step 3: 구현**
  - 픽스처 앱을 쓰고 `mvn -q package -DskipTests`로 빌드가 되는지 확인한다(`target/`는 커밋하지 않음)
  - route-explorer 지시(`skills/docent/agents/route-explorer.md`)대로 `inventory.agent.json`을 직접 쓴다: route는 `@GetMapping` 경로(`{id}` → `[id]`), files = 컨트롤러 + JSP(+ 그 JSP가 include하는 `nav.jsp`), evidence = 매핑 줄. 하위 화면 팝업은 `parentRoute: '/products/new'`
  - screen-analyzer 지시대로 화면 JSON 8개, summary, 시나리오(로그인은 `steps: []`)를 쓴다. `sourceHash`는 `node skills/docent/scripts/dist/docent.mjs hash …`로 계산
  - `goldenSuite`로 nextjs 골든 테스트의 공용 부분을 옮기고 nextjs 고유 테스트(여신 확인, middleware)는 그대로 둔다
  - `.github/workflows/test.yml`에 `fixture-build-spring` job

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS, nextjs 골든 테스트 개수 줄지 않음

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "test: Spring MVC(JSP) 픽스처와 에이전트 탐색 골든"
```

### Task 8: ASP.NET WebForms 픽스처와 골든(소스 분석만)

**Files:**
- Create: `fixtures/webforms-sample/` — `Site.Master`(+`.cs`, 메뉴), `Web.sitemap`, `Default.aspx`(+`.cs`), `Account/Login.aspx`(+`.cs`), `Orders/List.aspx`(+`.cs`, GridView·검색), `Orders/Edit.aspx`(+`.cs`, `?id=` 쿼리, RequiredFieldValidator), `Admin/Users.aspx`(+`.cs`), `web.config`(가짜 연결 문자열 `Password=docent-fixture-not-secret` — 읽지 않아야 하는 파일), `README.md`
- Create: `fixtures/expected/webforms-sample/` — `inventory.agent.json`, `inventory.json`, `screens/*.json`, `summary.json`(시나리오 없음: 실행하지 않음)
- Create: `tests/golden-webforms.test.mjs`

**Interfaces:**
- Consumes: `goldenSuite`, `inventoryFromAgent`(Task 7) — 시나리오 폴더가 없으면 시나리오 검사를 건너뛴다
- Produces: WebForms 화면 ID 예: `/Orders/List.aspx` → `orders-list`(Task 1의 확장자 규칙)

- [ ] **Step 1: 실패하는 테스트 작성**

```js
goldenSuite({ root: 'fixtures/webforms-sample', expected: 'fixtures/expected/webforms-sample', pages: 5, children: 0,
  edges: ['account-login->default', 'orders-list->orders-edit', 'orders-edit->orders-list'] });
test('에이전트 탐색 결과가 inventory 명령을 통과한다', async () => { /* Task 7과 같음 */ });
test('메뉴 근거는 Web.sitemap', () => { /* 메뉴가 있는 화면의 menuPath.evidence가 Web.sitemap: */ });
test('어떤 골든의 readFiles·files에도 web.config가 없다', () => { /* inventory files + screens readFiles */ });
test('훅이 web.config 읽기를 막는다', () => { /* block-secrets.mjs에 Read fixtures/webforms-sample/web.config, 세션 활성 → exit 2 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/golden-webforms.test.mjs` / Expected: FAIL

- [ ] **Step 3: 구현** — 픽스처 소스와 골든을 쓴다. 홈 화면 route는 `/Default.aspx`(ID `default`), 로그인은 `/Account/Login.aspx`. `Orders/Edit.aspx`의 신규·수정 구분(`id` 쿼리 유무)은 sections로, DB 의존(연결 문자열을 못 읽어 데이터 원천 불명)은 `unknowns`와 low confidence로 남긴다

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "test: ASP.NET WebForms 픽스처와 소스 분석 골든"
```

### Task 9: 스택별 탐색 힌트와 안내 문서

**Files:**
- Create: `skills/docent/references/stacks/README.md`(목록), `stacks/spring-mvc.md`(JSP·Thymeleaf), `stacks/aspnet-webforms.md`, `stacks/python-web.md`(Django·Flask), `stacks/php.md`, `stacks/js-routers.md`(감지기가 놓치는 경우: React Router fs-routes, Vue 동적 `addRoute`, Angular `Routes`)
- Modify: `skills/docent/agents/route-explorer.md`(스택 판별 후 해당 힌트를 먼저 읽기, `SKILL_DIR` 절대 경로), `skills/docent/agents/screen-analyzer.md`(서버 렌더링 화면: 컨트롤러+뷰 함께 읽기, 메시지는 properties·검증 애너테이션 근거), `skills/docent/SKILL.md`(2단계에서 감지기 이름 4개와 감지기가 없을 때의 힌트 경로), `skills/docent/references/run-guide.md`(Spring JSP: war 패키징·`mvn spring-boot:run`·`timeoutSec` 600·`stop` 없음, WebForms 주소 받기 절차), `README.md`(지원 스택 표)
- Test: `tests/plugin-manifest.test.mjs`(문서 링크 검사 추가)

**Interfaces:**
- Produces: 각 힌트 문서는 같은 목차 — `판별`, `화면(라우트) 찾기`, `화면 파일(files)`, `메뉴`, `권한`, `메시지`, `실행`, `주의(비밀 파일)`

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('stacks 힌트 문서가 모두 같은 목차를 가진다', async () => {
  for (const f of await readdir('skills/docent/references/stacks')) {
    if (f === 'README.md') continue;
    const text = await readFile(join('skills/docent/references/stacks', f), 'utf8');
    for (const h of ['## 판별', '## 화면(라우트) 찾기', '## 화면 파일', '## 메뉴', '## 권한', '## 메시지', '## 실행', '## 주의']) assert.ok(text.includes(h), `${f}: ${h}`);
  }
});
test('route-explorer와 SKILL이 stacks 힌트를 가리킨다', async () => { /* 두 파일에 'references/stacks/' 포함 */ });
test('문서가 가리키는 references 파일이 모두 존재한다', async () => { /* SKILL.md·agents/*.md의 references/… 경로 */ });
```

- [ ] **Step 2: 실패 확인** — Run: `node --test tests/plugin-manifest.test.mjs` / Expected: FAIL

- [ ] **Step 3: 문서 작성** — Task 7·8에서 픽스처를 분석하며 실제로 쓴 탐색 순서를 힌트로 옮긴다(예: Spring은 `@Controller` → 매핑 → 반환 뷰 이름 → `spring.mvc.view.prefix` → JSP → `<%@ include`/`<jsp:include`; WebForms는 `*.aspx` + `Web.sitemap` + `Site.Master` + code-behind의 `Response.Redirect`·`Validator`)

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 전부 PASS

- [ ] **Step 5: 커밋**

```bash
git add -A && git commit -m "docs: 스택별 탐색 힌트와 레거시 스택 실행 안내"
```

### Task 10: 실전 점검

스크래치패드에 픽스처를 복사해 실제 흐름을 돌린다(테스트 코드 없음, 결과를 ledger에 기록).

- [ ] **Step 1: 감지기** — React Router·Vue Router·Nuxt·SvelteKit 픽스처 복사본에서 `docent init` → 감지기 이름이 config에 들어가는지, `docent inventory` 결과가 기대 JSON과 같은지 확인
- [ ] **Step 2: Spring 전체 흐름** — 복사본에서 `init`(감지기 없음) → 골든 `inventory.agent.json`으로 `inventory` → run.json(`mvn -q spring-boot:run`, `timeoutSec` 600, `healthcheck.path` `/login`) 작성 → `run approve` → `run start` → `auth login`(환경변수 계정) → `crawl`(unreached 0) → 골든 화면·시나리오 복사 → `capture` → `record` → `build --preset delivery --format html,readme,pdf,pptx` → `run stop`. PDF·PPT는 `pdftoppm`·`soffice`로 이미지로 바꿔 넘침·빈 캡처가 없는지 본다
- [ ] **Step 3: WebForms 흐름** — 복사본에서 `init` → `session start` → 골든으로 `inventory` → `validate` → `build --format html,readme,pdf` (캡처 없음 안내가 나오는지), 훅으로 `web.config` Read가 막히는지
- [ ] **Step 4: 발견한 문제 수정** — 고친 것마다 테스트를 먼저 추가(RED→GREEN), `npm run build`, 커밋

```bash
git add -A && git commit -m "fix: M5 실전 점검에서 찾은 문제 수정"
```

---

M5가 끝나면 1.0(실전 적용, README 한/영·데모 GIF, 마켓플레이스 등록)은 별도 계획으로 쓴다.
