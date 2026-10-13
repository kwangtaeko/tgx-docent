# docent M3 앱 실행·캡처·GIF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대상 웹앱을 단계별 방식으로 띄우고(자동 실행 → 실패 시 주소 받기 → 성공한 방법 저장), 화면 목록과 실제 앱을 대조하고, 화면별 캡처와 조작 GIF를 만들어 HTML·README 산출물에 넣는다.

**Architecture:** Playwright는 번들하지 않고 런타임 로더가 사용자 캐시·전역 설치에서 찾는다. 실행(`run`), 로그인 상태(`auth`), 대조(`crawl`), 캡처(`capture`), 녹화(`record`)는 모두 CLI 하위 명령이며 LLM 없이 다시 돌릴 수 있다. 에이전트는 실행 계획(`run.json`)과 시나리오(`scenarios/<id>.json`)만 쓴다. 캡처·GIF는 `out/`이 아니라 `.docent/media/`에 두어 `build`가 지우지 않게 하고, `build`가 `out/html/media/`로 복사한다.

**Tech Stack:** Node.js 20.10+ ESM, `node:test`, Playwright 1.56.1(런타임 로드, 개발 의존성), gifenc, pngjs

**Spec:** `docs/superpowers/specs/2026-10-13-docent-design.md` — 6장 3번(실행 앱 대조), 8장(앱 실행), 9장(캡처·GIF), 16장 **M3**. M2 계획의 CLI·스키마·렌더러를 확장한다.

## Global Constraints

- 동의 없이 설치·실행 명령을 돌리지 않는다. CLI는 `run.json`에 적힌 명령만 실행하고, `run.json`은 사용자에게 보여 주고 동의받은 뒤 에이전트가 쓴다(SKILL.md 규칙)
- 비밀값은 어떤 파일에도 저장하지 않는다. `run.json`·`config.yaml`에는 환경변수 **이름**만. 로그인 세션은 `.docent/auth/`(gitignore)
- `.docent/.gitignore`에 `media/`, `run.log`, `.run-pid`를 추가한다(기존 `auth/`, `out/`, `.session` 유지). `init`은 기존 `.gitignore`에 빠진 줄만 덧붙인다
- Playwright 패키지와 Chromium은 사용자 동의 후 `~/.cache/docent/runtime/`(환경변수 `DOCENT_RUNTIME_DIR`로 바꿀 수 있음)에 `playwright@1.56.1`로 설치. 대상 프로젝트·플러그인 디렉터리에 설치하지 않는다. 이미 설치된 Playwright(전역 포함)가 있으면 재사용
- Playwright가 없으면 run(주소 모드 확인 제외)·crawl·capture·record는 설치 안내를 출력하고 exit 3으로 끝나며, 다른 명령과 build는 영향받지 않는다
- 요소는 셀렉터가 아니라 라벨·role로 찾는다. 시나리오 단계마다 `evidence` 필수
- GIF: 뷰포트 너비 800px, 10fps, 마지막 프레임 1.5초 유지, 2MB 이하(넘으면 5fps로 다시, 그래도 넘으면 실패 처리)
- 캡처 뷰포트 1280×800, 전체 페이지 스크린샷
- 녹화·캡처가 실패한 화면은 GIF·캡처를 만들지 않고 실패 단계와 실패 시점 스크린샷을 남겨 `review.md`에 모은다. 그럴듯한 대체물을 만들지 않는다
- `config.yaml`의 `mask.selectors`에 맞는 요소는 캡처·녹화 전에 블러 처리
- 산출물에 캡처가 하나도 없으면 HTML 소개 페이지와 README에 "화면 캡처 없이 소스만으로 만들었습니다" 표시
- 기존 M1·M2 테스트는 계속 통과해야 한다

## Review Focus

1. **실행 명령이 끝나지 않거나 바로 죽는 경우** — 시작 명령이 즉시 종료되거나 헬스체크 시간 안에 응답이 없으면 `run start`가 로그 마지막 20줄과 함께 실패를 보고하고, 남은 자식 프로세스를 정리해야 한다. → Task 2 테스트
2. **이미 떠 있는 앱 / 포트 충돌** — `run start`를 두 번 부르거나 포트가 이미 응답 중이면 새로 띄우지 않고 기존 것을 쓴다고 알려야 한다. → Task 2 테스트
3. **로그인 만료** — 저장된 세션으로 접속했는데 로그인 화면으로 돌아가면(리다이렉트) 그 화면을 로그인 화면으로 캡처하지 말고 "로그인 필요" 실패로 남겨야 한다. → Task 6 테스트
4. **크롤러 범위 이탈** — 외부 도메인 링크, `mailto:`, 파일 다운로드, 로그아웃 링크(`logout`/`signout` 포함 경로)는 따라가지 않아야 한다. → Task 4 테스트
5. **시나리오의 값에 환경변수** — `${DOCENT_USER}` 같은 값은 실행 시 환경변수로 바꾸고, 없으면 그 단계에서 "환경변수 없음"으로 실패해야 하며 값이 로그·실패 기록에 찍히지 않아야 한다. → Task 5 테스트

---

## File Structure

```
skills/docent/scripts/src/
  lib/playwright.mjs        # 런타임 로더
  lib/http.mjs              # 헬스체크 GET(타임아웃)
  lib/steps.mjs             # 시나리오 단계 실행기(라벨·role 로케이터, 환경변수, 마스킹)
  lib/media.mjs             # media 경로·실패 기록(failures.json) 읽기·쓰기
  commands/runtime.mjs      # docent runtime status | install
  commands/run.mjs          # docent run start | stop | status
  commands/auth.mjs         # docent auth login | save
  commands/crawl.mjs        # docent crawl
  commands/capture.mjs      # docent capture [id…]
  commands/record.mjs       # docent record [id…]
  commands/scenarios.mjs    # docent scenarios (작성·재작성 대상)
  renderers/gif.mjs         # PNG 프레임 → GIF (pngjs + gifenc)
skills/docent/schemas/run.schema.json
skills/docent/schemas/scenario.schema.json
skills/docent/agents/scenario-writer.md
skills/docent/references/run-guide.md
commands/docent-run.md, commands/docent-capture.md
tests/helpers/web.mjs       # 테스트용 정적·폼 웹 서버
tests/helpers/browser.mjs   # Playwright 사용 가능 여부(없으면 skip이 아니라 실패 — CI에 설치)
```

`.docent/` 새 항목: `run.json`(커밋), `scenarios/<id>.json`(커밋), `crawl.json`(커밋), `media/img/<id>.png`, `media/gif/<id>.gif`, `media/fail/<id>.png`, `media/failures.json`(media는 gitignore), `run.log`, `.run-pid`.

---

### Task 1: Playwright 런타임 로더와 runtime 명령

**Files:**
- Create: `lib/playwright.mjs`, `commands/runtime.mjs`, `tests/helpers/browser.mjs`
- Modify: `package.json`(devDependencies `playwright@1.56.1`), `scripts/build.mjs`(`external: ['playwright', 'playwright-core']`), `docent.mjs`, `.github/workflows/test.yml`(`npx playwright install --with-deps chromium`)
- Test: `tests/lib/playwright.test.mjs`

**Interfaces:**
- Produces:
  - `runtimeDir(): string` — `process.env.DOCENT_RUNTIME_DIR ?? ~/.cache/docent/runtime`
  - `findPlaywright(): Promise<{ module, from: 'env'|'runtime'|'local'|'global' } | undefined>` — 순서: `DOCENT_PLAYWRIGHT`(모듈 경로) → `runtimeDir()/node_modules/playwright` → `createRequire(import.meta.url)`로 해석되는 것(개발 환경) → `npm root -g` 아래
  - `requirePlaywright(): Promise<module>` — 없으면 `PlaywrightMissing` 오류(메시지: 설치 안내 + `docent runtime install`)
  - `launchBrowser(): Promise<Browser>` — `chromium.launch()`; 브라우저 실행 파일이 없으면 오류 메시지에 `npx playwright install chromium` 안내
  - CLI `runtime status` → 찾은 위치와 버전 출력(exit 0, 없으면 exit 3) / `runtime install` → `npm install --prefix <runtimeDir> playwright@1.56.1` 후 `<runtimeDir>/node_modules/.bin/playwright install chromium` (자식 프로세스 stdio 상속)
  - 모든 CLI 명령에서 `PlaywrightMissing`은 exit 3

- [ ] **Step 1: Write the failing tests** — `DOCENT_PLAYWRIGHT`에 존재하지 않는 경로 → 다음 후보로 넘어감; 임시 디렉터리에 `node_modules/playwright/index.js`(가짜 `export const chromium = 'fake'`… CJS `module.exports = { chromium: 'fake' }`)를 만들고 `DOCENT_RUNTIME_DIR`로 지정 → `from: 'runtime'`, `module.chromium === 'fake'`; `DOCENT_RUNTIME_DIR`·`DOCENT_PLAYWRIGHT` 모두 비우고 개발 의존성으로 설치된 경우 → `from: 'local'`; `launchBrowser()`로 `about:blank`를 열 수 있다
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 번들에서는 `playwright`를 external로 두고 `createRequire`로 동적으로만 불러온다(정적 import 금지)
- [ ] **Step 4: Run** `npm run build && npm test` → PASS; `node skills/docent/scripts/dist/docent.mjs runtime status` → 위치 출력
- [ ] **Step 5: Commit** — `feat: Playwright 런타임 로더와 runtime 명령`

---

### Task 2: run.json과 run 명령

**Files:**
- Create: `skills/docent/schemas/run.schema.json`, `lib/http.mjs`, `commands/run.mjs`
- Modify: `lib/schema.mjs`(`validateRun`), `commands/init.mjs`(gitignore 줄 추가·병합), `docent.mjs`
- Test: `tests/commands/run.test.mjs`, `tests/commands/init.test.mjs`(gitignore 병합)

**Interfaces:**
- Produces:
  - `run.json` 형식:

```json
{
  "mode": "auto",
  "baseUrl": "http://localhost:3000",
  "install": ["npm ci"],
  "start": "npm run dev",
  "cwd": ".",
  "env": { "PORT": "3000" },
  "envNames": ["DATABASE_URL"],
  "healthcheck": { "path": "/", "timeoutSec": 120 }
}
```

  `mode: "url"`이면 `baseUrl`만 필수(사용자가 띄운 앱). `env`는 비밀이 아닌 고정값만, 비밀은 `envNames`(실행 시 현재 환경에 있어야 함). `cwd`는 프로젝트 상대 경로
  - `httpCheck(url, timeoutMs): Promise<{ ok: boolean, status?: number }>` — 응답 상태 < 500이면 ok(리다이렉트는 따라가지 않음)
  - `runStart(projectDir, { install = false }): Promise<{ baseUrl, started: boolean, reused: boolean }>` — 순서: run.json 검증 → `envNames` 중 없는 것이 있으면 오류(이름 나열) → `healthcheck` URL이 이미 응답하면 `reused:true`로 끝 → `mode: url`인데 응답 없음이면 오류 → `install`이 true면 install 명령 순서대로 실행(실패 시 오류) → `start`를 `shell: true, detached: true`로 실행, stdout·stderr를 `.docent/run.log`에 기록, pid를 `.docent/.run-pid`에 → 1초 간격으로 헬스체크, `timeoutSec` 안에 응답하면 `started:true` → 프로세스가 먼저 죽거나 시간 초과면 프로세스 그룹 종료 후 오류(메시지에 `run.log` 마지막 20줄)
  - `runStop(projectDir): Promise<{ stopped: boolean }>` — `.run-pid`의 프로세스 그룹에 SIGTERM, 5초 뒤 남아 있으면 SIGKILL, 파일 삭제
  - `runStatus(projectDir): Promise<{ configured: boolean, baseUrl?, up: boolean, pid?: number }>`
  - CLI: `run start [--install]`, `run stop`, `run status`

- [ ] **Step 1: Write the failing tests** — 테스트용 서버 스크립트(임시 파일 `server.mjs`: `PORT` 환경변수로 `node:http` 서버, 시작 전 `DELAY_MS` 대기)를 `start`로 쓰는 run.json으로
  - 정상: `runStart` → `started:true`, `httpCheck(baseUrl)` ok, `runStop` → 프로세스가 사라지고 포트가 응답하지 않음
  - 두 번째 `runStart`(이미 떠 있음) → `reused:true`, 새 pid 없음
  - `start: "node -e 'process.exit(1)'"` → reject, 메시지에 `run.log`; 남은 pid 없음
  - `DELAY_MS`가 `timeoutSec`보다 김 → reject(“시간 초과”), 프로세스 그룹 종료됨
  - `envNames: ['DOCENT_TEST_MISSING']` → reject, 메시지에 그 이름
  - `mode: url` + 응답 없는 주소 → reject; 응답하는 주소 → `reused:true`
  - 스키마: `env` 값이 문자열이 아니면 invalid
  - init: 예전 `.gitignore`(auth/, out/, .session만)가 있으면 `media/`, `run.log`, `.run-pid`가 덧붙고 기존 줄은 그대로
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 프로세스 그룹 종료는 `process.kill(-pid, signal)`(Windows는 `taskkill /T /F /PID` — 분기만 두고 Linux·macOS에서 테스트)
- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: run.json과 앱 실행 명령`

---

### Task 3: 로그인 상태(auth)

**Files:**
- Create: `commands/auth.mjs`, `tests/helpers/web.mjs`
- Modify: `lib/config.mjs`(`auth` 기본값 `undefined`, `mask.selectors: []`, `gif.screens: { include: [], exclude: [] }`), `docent.mjs`
- Test: `tests/commands/auth.test.mjs`

**Interfaces:**
- Consumes: `requirePlaywright`, `launchBrowser` (Task 1), `run.json`의 `baseUrl` (Task 2)
- Produces:
  - `config.yaml`의 `auth`:

```yaml
auth:
  loginPath: /login
  fields:
    - label: 아이디
      env: DOCENT_USER
    - label: 비밀번호
      env: DOCENT_PASSWORD
  submit: 로그인
  successPath: /        # 로그인 후 도착해야 하는 경로 접두어
```

  - `authLogin(projectDir): Promise<{ statePath }>` — baseUrl+loginPath로 이동, `getByLabel(label).fill(process.env[env])`(없으면 오류: 환경변수 이름), `getByRole('button', { name: submit }).click()`, 도착 URL이 `successPath`로 시작하면 `context.storageState({ path: .docent/auth/state.json })`; 아니면 오류("로그인 실패", 값은 출력하지 않음)
  - `authSave(projectDir)` — 브라우저를 화면 있게(`headless: false`) 열고 사용자가 직접 로그인한 뒤 터미널에서 Enter를 누르면 상태 저장(대화형, 수동 점검만)
  - `newContext(browser, projectDir, options)` — `.docent/auth/state.json`이 있으면 `storageState`로 사용하는 컨텍스트 생성. 이후 crawl·capture·record가 모두 이것을 쓴다
  - `web.mjs`(테스트 도우미): `startTestSite(pages: Record<path, html | (req,res)=>void>): Promise<{ url, close }>` — 쿠키 로그인 흐름(`/login` POST → `Set-Cookie: s=1` → `/` 리다이렉트, 쿠키 없으면 보호 경로에서 `/login`으로 302)을 기본 제공

- [ ] **Step 1: Write the failing tests** — 테스트 사이트 + `DOCENT_USER=u DOCENT_PASSWORD=p`(서버는 u/p만 허용)
  - `authLogin` → `state.json` 생기고, 그 상태로 만든 컨텍스트로 보호 경로 접속 시 200
  - 비밀번호 틀림 → reject("로그인 실패"), 출력·오류 메시지에 비밀번호 값 없음
  - `DOCENT_PASSWORD` 미설정 → reject, 메시지에 `DOCENT_PASSWORD`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 로그인 상태 저장(auth)`

---

### Task 4: 실행 앱 대조(crawl)

**Files:**
- Create: `commands/crawl.mjs`
- Modify: `commands/review.mjs`(크롤 결과 섹션), `docent.mjs`
- Test: `tests/commands/crawl.test.mjs`, `tests/commands/review.test.mjs`(추가)

**Interfaces:**
- Consumes: `newContext` (Task 3), `run.json` baseUrl, inventory
- Produces:
  - `routeMatcher(route): RegExp` — `[id]`·`[...x]`·`[[...x]]`를 경로 조각 정규식으로, `(group)`·`@slot` 세그먼트는 빼고 비교
  - `runCrawl(projectDir, { maxPages = 200, maxDepth = 3 }): Promise<{ visited: string[], unmatched: string[], unreached: string[] }>` — baseUrl부터 같은 출처 `a[href]`를 BFS. 따라가지 않는 것: 다른 출처, `mailto:`·`tel:`·`javascript:`, 확장자가 있는 파일(`.pdf .zip .png .jpg .csv .xlsx` 등), 경로에 `logout`·`signout`·`sign-out`·`log-out`이 포함된 링크. 쿼리스트링·해시는 버리고 경로만. 결과를 `.docent/crawl.json`에 `{ baseUrl, visited, unmatched, unreached }`로 저장. `unmatched` = 방문했지만 어느 inventory page 라우트에도 맞지 않는 경로, `unreached` = 방문한 경로가 하나도 맞지 않은 page ID
  - review.md: `crawl.json`이 있으면 맨 끝에 `## 실행 중인 앱 대조` 섹션 — `- [ ] 화면 목록에 없는 경로: <path> <!-- key: crawl|unmatched|<path> -->`, `- [ ] 앱에서 링크로 도달하지 못한 화면: <id> (<route>) <!-- key: crawl|unreached|<id> -->`. 체크·답 보존 규칙은 기존과 같음

- [ ] **Step 1: Write the failing tests** — 테스트 사이트: `/`(링크: `/a`, `/items/1`, `https://example.com`, `mailto:x@y`, `/files/r.pdf`, `/logout`, `/hidden?x=1#h`), `/a`, `/items/1`, `/hidden`, `/logout`(방문하면 쿠키 지우는 페이지). inventory page 라우트: `/`, `/a`, `/items/[id]`, `/never`
  - `visited`에 `/`, `/a`, `/items/1`, `/hidden`이 있고 외부·mailto·pdf·logout은 없음
  - `unmatched` = `['/hidden']`, `unreached` = `['never']`
  - `maxPages: 2` → visited 2개
  - `routeMatcher('/(shop)/items/[...slug]')`가 `/items/a/b`에 맞음
  - review: crawl.json이 있으면 두 key 줄이 생기고, 체크한 답이 재생성 후 보존
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 실행 중인 앱과 화면 목록 대조`

---

### Task 5: 시나리오 스키마와 단계 실행기

**Files:**
- Create: `skills/docent/schemas/scenario.schema.json`, `lib/steps.mjs`
- Modify: `lib/schema.mjs`(`validateScenario`)
- Test: `tests/lib/steps.test.mjs`, `tests/lib/schema.test.mjs`(추가)

**Interfaces:**
- Produces:
  - `scenarios/<id>.json`(에이전트가 씀):

```json
{
  "screenId": "orders-new",
  "path": "/orders/new",
  "setup": [],
  "steps": [
    { "do": "click", "role": "button", "label": "거래처 찾기", "evidence": "app/orders/new/order-form.tsx:18" },
    { "do": "click", "role": "button", "label": "선택", "nth": 0, "evidence": "app/orders/new/customer-search.tsx:27" },
    { "do": "fill", "label": "납기일", "value": "2026-11-01", "evidence": "app/orders/new/order-form.tsx:20" },
    { "do": "fill", "label": "수량", "value": "3", "evidence": "app/orders/new/order-form.tsx:24" },
    { "do": "click", "role": "button", "label": "저장", "evidence": "app/orders/new/order-form.tsx:32" },
    { "do": "expectText", "text": "저장되었습니다.", "evidence": "app/orders/page.tsx:15" }
  ],
  "sourceHash": "sha256:…",
  "locked": false
}
```

  - `path`: 실제로 열 경로(동적 세그먼트는 실제 값, 하위 화면은 부모 경로). `setup`: 캡처·녹화 전에 그 상태로 만드는 단계(하위 화면이면 여는 버튼 클릭). `steps`: GIF에서 보여 줄 조작(없으면 GIF 대상 아님). `sourceHash`: 작성 시점의 화면 `sourceHash`
  - 단계 `do`: `fill`(label, value), `select`(label, value=보이는 옵션 문구), `check`(label), `click`(label, role: `button`|`link`|`tab`|`menuitem`|`checkbox`, nth?), `expectText`(text), `wait`(ms ≤ 3000), `goto`(path). 모든 단계에 `evidence` 필수
  - `runSteps(page, steps, { env = process.env, timeoutMs = 5000, onStep }): Promise<{ ok: true } | { ok: false, index: number, reason: string }>` — 로케이터: fill·select·check → `page.getByLabel(label, { exact: true })`, click → `page.getByRole(role, { name: label, exact: true })`(nth 있으면 `.nth(n)`, 없으면 `.first()`가 아니라 개수가 1이 아닐 때 실패: "같은 이름의 요소가 N개"), expectText → `page.getByText(text, { exact: false })`가 보일 때까지. 값의 `${NAME}`은 env에서 치환, 없으면 실패 `"환경변수 없음: NAME"`. 실패 reason에는 치환된 값을 넣지 않는다. 각 단계 후 `onStep(index)` 호출(녹화용)
  - `applyMask(page, selectors)` — 선택자에 맞는 요소에 `filter: blur(6px)` 스타일 주입

- [ ] **Step 1: Write the failing tests** — 테스트 사이트 폼 페이지(라벨 있는 입력 2개, select, 버튼 "저장" → 문구 "저장되었습니다." 표시, 같은 이름 링크 2개)
  - 정상 시나리오 → `{ ok: true }`, onStep이 단계 수만큼
  - 없는 라벨 → `{ ok:false, index, reason }` reason에 라벨
  - 같은 이름 링크 2개 nth 없이 click → 실패 "2개"; `nth: 1` → 성공
  - `value: '${DOCENT_SECRET_X}'` 미설정 → 실패 "환경변수 없음: DOCENT_SECRET_X"; 설정 시 입력값이 그 값, 실패 reason 어디에도 값 없음(다른 단계 실패를 유도해 확인)
  - `applyMask(page, ['.ssn'])` 후 `.ssn` 요소의 computed filter에 `blur`
  - 스키마: evidence 없는 단계 invalid, `do: 'hover'` invalid, `wait` 5000 invalid
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 시나리오 스키마와 단계 실행기`

---

### Task 6: 화면 캡처(capture)

**Files:**
- Create: `lib/media.mjs`, `commands/capture.mjs`
- Modify: `docent.mjs`, `commands/review.mjs`(실패 섹션)
- Test: `tests/commands/capture.test.mjs`

**Interfaces:**
- Consumes: `newContext` (Task 3), `runSteps`, `applyMask` (Task 5), inventory, scenarios
- Produces:
  - `media.mjs`: `mediaPaths(projectDir)` → `{ img(id), gif(id), fail(id), failures }`; `readFailures()`/`recordFailure(projectDir, { id, kind: 'capture'|'record', step?: number, reason })`/`clearFailure(projectDir, id, kind)`. `failures.json` = `[{ id, kind, step, reason }]`(id·kind 순 정렬)
  - `runCapture(projectDir, ids?): Promise<{ captured: string[], failed: { id, reason }[], skipped: { id, reason }[] }>`
    - 대상: 인자로 준 ID 또는 inventory 전체
    - 경로 결정: 시나리오 `path` → 없으면 page의 `route`(동적 세그먼트·route group 없는 경우만, group은 빼고) → 둘 다 없으면 skipped("시나리오에 실제 경로가 필요합니다")
    - 열고 → 시나리오 `setup` 실행 → 네트워크 유휴 대기(최대 5초) → `applyMask` → 전체 페이지 PNG를 `media/img/<id>.png`
    - 로그인 만료 감지: 도착 URL 경로가 `config.auth.loginPath`(없으면 `/login`)이고 대상 경로가 그것이 아니면 실패("로그인 필요 — docent auth login"), 캡처하지 않음
    - HTTP 상태 ≥ 400이면 실패(상태 코드)
    - 실패 시 `media/fail/<id>.png`(그 시점 화면)와 failures에 기록, 성공하면 그 ID의 capture 실패 기록 삭제
  - review.md: failures가 있으면 `## 캡처·녹화 실패` 섹션 `- [ ] <id> 캡처 실패: <reason> (media/fail/<id>.png) <!-- key: media|capture|<id> -->`(record는 `녹화 실패: <n>번째 단계 — <reason>`)

- [ ] **Step 1: Write the failing tests** — 테스트 사이트(로그인 흐름 포함)와 inventory(page `/`, `/items/[id]`, `/secret`(보호), modal 하나), scenarios(`items-id`에 `path: /items/1`, modal에 `path: /`·`setup: 버튼 클릭`)
  - 저장된 로그인 상태로 `runCapture` → `home`, `items-id`, `secret`, modal PNG 생성(PNG 시그니처 확인), failures 없음
  - modal의 setup 단계가 실패하도록(없는 버튼 라벨) 바꾸면 modal은 실패로 기록되고 PNG가 생기지 않음 — setup이 캡처 전에 실제로 실행된다는 확인
  - 시나리오 없는 동적 화면 → skipped
  - 로그인 상태 파일 삭제 후 `secret` → 실패 "로그인 필요", `media/img/secret.png` 없음, `media/fail/secret.png` 있음
  - 404 경로 → 실패 "404"
  - 다시 성공하면 failures에서 제거
  - review.md에 실패 섹션
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 화면 캡처`

---

### Task 7: GIF 녹화(record)

**Files:**
- Create: `renderers/gif.mjs`, `commands/record.mjs`
- Modify: `package.json`(dependencies `gifenc@1.0.3`, `pngjs@7.0.0`), `docent.mjs`
- Test: `tests/renderers/gif.test.mjs`, `tests/commands/record.test.mjs`

**Interfaces:**
- Consumes: `newContext`, `runSteps`, `applyMask`, `media.mjs`
- Produces:
  - `encodeGif(frames: Buffer[] /* PNG */, { fps, holdLastMs }): Buffer` — pngjs로 RGBA 디코드, 첫 프레임에서 `quantize(256)` 팔레트를 만들어 전 프레임에 `applyPalette`, 프레임 지연 `1000/fps`, 마지막 프레임 지연 `holdLastMs`, 무한 반복
  - `recordScenario(page, scenario, { fps = 10 }): Promise<{ ok, frames, failure? }>` — 경로 이동·setup 실행 후 녹화 시작. 프레임은 `page.screenshot({ type: 'png' })`를 `1000/fps` 간격 루프로 모으고, 단계는 `runSteps`로 실행(각 단계 뒤 300ms 머묾), 끝나면 1초 더 찍고 멈춤
  - `runRecord(projectDir, ids?): Promise<{ recorded: string[], failed: { id, reason }[], skipped: { id, reason }[] }>` — 대상: 인자 ID 또는 `steps`가 비어 있지 않은 시나리오 중 GIF 대상(Task 8의 `gifTargets`) 화면. 뷰포트 800×600. 결과 > 2MB면 프레임을 하나 건너 다시 인코딩(5fps), 그래도 크면 실패("GIF가 2MB를 넘습니다"). 단계 실패 → GIF 없음, `media/fail/<id>.png` + failures(kind `record`, step 번호). 성공하면 그 ID의 record 실패 기록 삭제
  - 낡은 시나리오(시나리오 `sourceHash` ≠ 화면 `sourceHash`)는 녹화하지 않고 skipped("시나리오가 낡았습니다") — `locked: true`면 낡아도 녹화

- [ ] **Step 1: Write the failing tests**
  - `encodeGif`: 단색 PNG 3장(pngjs로 생성) → 결과가 `GIF89a`로 시작, 프레임 수 3(Graphic Control Extension `0x21 0xF9` 개수), 마지막 프레임 지연 150(1/100초 단위)
  - `runRecord`(테스트 사이트 폼 + 시나리오) → `media/gif/<id>.gif` 생성, 크기 < 2MB, 프레임 5개 이상
  - 단계 실패 시나리오 → GIF 없음, failures에 `{kind:'record', step: n}`
  - 낡은 시나리오 → skipped; 같은 시나리오 `locked: true` → recorded
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 화면 조작 GIF 녹화`

---

### Task 8: 시나리오 작성 대상과 GIF 대상

**Files:**
- Create: `commands/scenarios.mjs`
- Modify: `commands/validate.mjs`(시나리오 검증), `docent.mjs`
- Test: `tests/commands/scenarios.test.mjs`, `tests/commands/validate.test.mjs`(추가)

**Interfaces:**
- Consumes: inventory, screens, scenarios, config `gif.screens`
- Produces:
  - `gifTargets(screens, config): string[]` — `actions`가 하나 이상인 화면(설계 문서 9장 기본값), `gif.screens.include`가 있으면 그것만, `exclude` 제외(화면 ID 목록)
  - `runScenarios(projectDir): Promise<{ id, reason }[]>` — 시나리오를 (다시) 써야 하는 화면: 시나리오 없음인데 캡처에 경로가 필요한 화면(동적 라우트·하위 화면) 또는 GIF 대상; 시나리오가 낡음(`locked` 아님). reason: `캡처 경로 필요`·`GIF 대상`·`낡음`
  - validate 추가 규칙: `scenarios/*.json`마다 스키마, 파일명 = `screenId`, `screenId`가 inventory에 있음, 모든 단계 `evidence`가 `checkEvidence` 통과하고 `label`·`text`가 근거 ±5줄에 있음(`expectText`). 낡은 시나리오는 문제가 아니라 `scenarios` 명령이 알림
  - CLI: `scenarios` → 목록 출력

- [ ] **Step 1: Write the failing tests** — 골든 화면 기준 `gifTargets` = actions 있는 화면 전부(골든 8개 중 actions 없는 화면이 없으면 exclude로 확인); `include: ['orders-new']` → `['orders-new']`; 시나리오 없는 상태에서 `runScenarios`에 `orders-id`(동적·`캡처 경로 필요`)와 modal(`캡처 경로 필요`) 포함; 화면 sourceHash와 다른 시나리오 → `낡음`, locked면 제외; validate: 근거 문구가 맞지 않는 시나리오 단계 → 문제(`scenarios/<id>.json`)
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Write golden scenarios** `fixtures/expected/nextjs-sample/scenarios/`(orders-new: 위 예시, orders-id: `path: /orders/1`, orders-id-edit: `path: /orders/1/edit` + 수량 수정·저장·"수정되었습니다.", orders-new--customer-search: `path: /orders/new`, setup 거래처 찾기 클릭, login: 아이디·비밀번호 `${DOCENT_USER}`·`${DOCENT_PASSWORD}` 입력 후 로그인) and implement
- [ ] **Step 4: Run** → PASS (골든 테스트에 시나리오 검증 추가)
- [ ] **Step 5: Commit** — `feat: 시나리오 작성 대상과 GIF 대상`

---

### Task 9: 산출물에 캡처·GIF 넣기와 번들

**Files:**
- Modify: `renderers/html.mjs`, `renderers/readme.mjs`, `commands/build.mjs`, `scripts/build.mjs`, `.github/workflows/test.yml`
- Test: `tests/renderers/html.test.mjs`, `tests/renderers/readme.test.mjs`, `tests/commands/build.test.mjs`(추가)

**Interfaces:**
- Consumes: `media/img`, `media/gif`
- Produces:
  - `renderSite(input)`·`renderReadme(input)`의 input에 `media: { images: Set<id>, gifs: Set<id> }` 추가(기본 빈 Set)
  - 화면 페이지: 제목 아래 `<figure><img src="../media/img/<id>.png" alt="<title> 화면"></figure>`, GIF가 있으면 `## 조작 예시` 섹션 `<img src="../media/gif/<id>.gif" alt="<title> 조작 예시">`
  - 소개 페이지: `## 화면 미리보기` — GIF가 있는 화면(최대 3개, inventory 순) 이미지와 화면 링크. 캡처가 하나도 없으면 소개 상단에 `<p class="notice">화면 캡처 없이 소스만으로 만들었습니다.</p>`
  - README: `## 화면 미리보기` — GIF 최대 3개 `![<title>](html/media/gif/<id>.gif)`, 없으면 섹션 대신 `> 화면 캡처 없이 소스만으로 만들었습니다.` 한 줄
  - build: `media/img`, `media/gif`를 `out/html/media/`로 복사(실패 이미지 `media/fail`은 복사하지 않음)
  - 번들: `playwright`·`playwright-core` external, `gifenc`·`pngjs` 포함. CI: 테스트 job에서 `npx playwright install --with-deps chromium` 후 `npm test`

- [ ] **Step 1: Write the failing tests** — media 빈 경우 notice 문구(HTML·README), media 있는 경우 img·gif 태그와 경로, README에 GIF 3개 제한, build가 media를 out으로 복사하고 fail 이미지는 제외, 기존 결정성 테스트 유지
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm run build && npm test` → PASS, 번들 결정성(두 번 build 후 git diff 없음)
- [ ] **Step 5: Commit** — `feat: 산출물에 화면 캡처와 GIF 넣기`

---

### Task 10: 실행 가이드·시나리오 에이전트·SKILL 흐름과 실전 점검

**Files:**
- Create: `skills/docent/references/run-guide.md`, `skills/docent/agents/scenario-writer.md`, `commands/docent-run.md`, `commands/docent-capture.md`
- Modify: `skills/docent/SKILL.md`, `.claude-plugin/plugin.json`(agents에 scenario-writer), `README.md`, `AGENTS.md`

**Interfaces:**
- Produces:
  - `run-guide.md`: 스택별 실행 계획 만드는 법 — npm/pnpm/yarn(락파일로 판별, `dev` 스크립트와 포트), docker compose(`docker compose up -d`, 포트 매핑), Python(Django `manage.py runserver`, Flask), Maven·Gradle(Spring Boot `spring-boot:run`·`bootRun`, JSP 포함), WebForms는 자동 실행 제외·주소 받기. 공통: 필요한 환경변수 이름은 `.env.example`·`process.env`·`os.environ`·`@Value`에서 이름만, DB가 필요하면 docker compose에 있는지 확인, 없으면 주소 받기로 안내
  - `scenario-writer.md`: 입력(프로젝트 루트, SKILL_DIR, DOCENT, 화면 ID, 이유 `캡처 경로 필요`/`GIF 대상`/`낡음`), 출력 `scenarios/<id>.json`, 규칙: 화면 JSON의 fields·actions·messages에 근거가 있는 동작만, 라벨은 화면 JSON 문구 그대로, 동적 경로 값은 실행 중인 앱의 목록 화면에서 실제 링크를 확인해 고름(크롤 결과 `crawl.json` 활용), 로그인 값은 `${환경변수}`로만, 실제 데이터 삭제 같은 되돌릴 수 없는 동작(삭제·결제·발송)은 GIF 단계에 넣지 않음, `sourceHash`는 화면 JSON 값 복사, 다 쓰면 `$DOCENT validate`
  - SKILL.md에 단계 추가(5와 6 사이): **실행·캡처(선택)** — `runtime status`(없으면 설치 동의 받고 `runtime install`) → 앱 실행 단계별 방식(run-guide로 계획 작성 → 사용자에게 보여 주고 동의 → `run.json` 작성 → `run start --install` / 실패 시 부족한 것 안내하고 주소 받아 `mode: url`) → 로그인 필요 시 `auth login`(환경변수 안내) → `crawl` → `scenarios` 목록대로 `scenario-writer` → `capture` → `record` → `run stop`. 어느 단계든 끝내 안 되면 건너뛰고 build(캡처 없음 표시)
  - 명령: `/docent-run`(실행 단계만), `/docent-capture [id…]`(시나리오 작성 대상 처리 후 capture·record)

- [ ] **Step 1: Write the docs, agent, commands, SKILL changes**; `claude plugin validate .` 통과
- [ ] **Step 2: 실전 점검(수동)** — 픽스처 사본에서 이 세션의 에이전트가 SKILL 절차대로: run-guide로 run.json 작성 → `run start --install` → `DOCENT_USER=user DOCENT_PASSWORD=user1234`로 `auth login` → `crawl`(unmatched·unreached 확인) → scenario-writer 서브에이전트로 시나리오 → `capture` → `record` → `build` → `run stop`. 확인: 화면 8개 캡처, GIF 대상 화면 GIF 생성(삭제 동작 없음), 실패 0 또는 실패가 review.md에 정확히 기록, 산출물 HTML에서 캡처·GIF 표시(스크린샷으로 확인)
- [ ] **Step 3: Commit** — `feat: 앱 실행·캡처 흐름과 시나리오 에이전트`

---

## 이 계획 다음

M4(PDF·PPT·용도 프리셋·증분 update)는 별도 계획으로 쓴다. M4의 PDF와 Mermaid→PNG는 Task 1의 런타임 로더를 쓴다.
