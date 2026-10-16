# 감지기 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1.0 "알려진 한계" 중 감지기가 읽지 못하던 세 경우 — React Router `flatRoutes()`(와 같은 규칙의 Remix v2), Nuxt `srcDir`·`dir.pages`, 모노레포 하위 앱 — 에서도 화면 목록을 스크립트가 결정적으로 뽑게 한다.

**Architecture:** 감지기 인터페이스(`{ name, detect, listScreens, warnings? }`)와 반환 형식(`{ route, files, evidence }`, 경로는 감지기에 넘긴 폴더 기준)은 그대로 둔다. 모노레포는 감지기가 아니라 `inventory`가 `config.app` 폴더로 감지기를 돌리고 결과 경로에 그 폴더를 붙인다. `init`은 루트에서 감지되는 프레임워크가 없을 때 워크스페이스 설정으로 앱 후보를 찾는다.

**Tech Stack:** 기존과 같음(Node.js 20+ ESM, `node:test`, esbuild 번들, `yaml` 패키지).

**결정(사용자가 판단을 맡김):**
- 버전은 올리지 않는다. CHANGELOG에는 `미배포` 절로 적는다
- 앱은 docent 작업 하나에 하나(`app` 하나). 앱마다 화면 경로 `/`가 겹치므로 여러 앱을 한 산출물에 섞지 않는다
- 앱 후보가 여럿이면 `init`은 config.yaml을 만들지 않고 후보만 알린다. 에이전트가 사용자에게 물어 `init --app <폴더>`로 다시 실행한다
- flat routes에서 자식이 있는 레이아웃 파일은 화면이 아니라 자식 화면의 파일로 넣는다. 단 주소가 있고 `_index` 자식이 없는 레이아웃은 그 주소에서 자기 내용을 그리므로 화면으로 둔다
- `flatRoutes({ ignoredRouteFiles })`의 glob은 해석하지 않는다(테스트 파일 규칙으로 대부분 걸러짐)

## Global Constraints

- Node.js 20+, ESM(`.mjs`), 테스트 의존성 없음 — `npm test`
- 같은 입력이면 같은 결과. 모든 화면 항목은 `파일:줄` 근거를 가진다
- `scripts/src/`나 `schemas/`를 고치면 `npm run build`로 `dist/`를 함께 커밋한다
- 문서 문체: 한국어 합니다체

---

### Task 1: React Router flat routes (+ Remix v2)

**Files:** Create `skills/docent/scripts/src/detectors/flat-routes.mjs`; Modify `detectors/react-router.mjs`; Test `tests/detectors/flat-routes.test.mjs`, `tests/detectors/react-router.test.mjs`; Fixture `fixtures/detectors/react-router-flat/`, `fixtures/expected/detectors/react-router-flat.json`

- [ ] `flatRouteScreens(projectDir, appDir, routesDir)` — `appDir/routesDir` 바로 아래 파일(`.tsx|.ts|.jsx|.js`)과 폴더의 `route.*`를 라우트 모듈로 읽는다. 이름은 이스케이프(`[...]`) 밖의 `.`으로 나눈다
- [ ] 세그먼트 규칙: `_index` 인덱스, `_x` 경로 없는 레이아웃, `x_` 끝 밑줄 제거(부모 밖으로), `$` 스플랫, `$id` → `:id`, `($lang)` → `:lang?`, `(en)` → `en?`, `[.]` 글자 그대로
- [ ] 부모: 이름이 `부모.`로 시작하는 가장 긴 다른 라우트. 자식이 있는 레이아웃은 화면에서 빼고 조상 파일을 자식 화면의 `files`에 덧붙인다(위 결정의 예외 포함)
- [ ] 루트 스플랫(`$.tsx`)은 `toDocentPath`가 버린다. 근거는 `export default` 줄
- [ ] `react-router.mjs`: `app/routes.ts`에 `flatRoutes(`가 있으면 config 항목에 flat 결과를 더한다(`rootDirectory` 문자열 인자 지원). `routes.ts`가 없고 `@remix-run/react`가 있으면 `app/routes`를 flat으로 읽는다. `detect`에 `@remix-run/react` 추가. 기존 `flatRoutes()` 경고는 flat 결과가 0개일 때만
- [ ] 테스트: 세그먼트 규칙 단위 테스트, 픽스처 기대값, Remix 프로젝트, routes.ts 혼합

### Task 2: Nuxt srcDir·dir.pages

**Files:** Modify `detectors/vue.mjs`; Test `tests/detectors/vue.test.mjs`

- [ ] `nuxt.config.(ts|js|mjs|mts)`에서 `srcDir: '...'`, `dir: { pages: '...' }` 문자열 리터럴을 읽는다(`./`·끝 `/` 정리, 프로젝트 밖·절대 경로는 무시)
- [ ] 페이지 폴더 = `srcDir/(dir.pages ?? 'pages')`. `srcDir`가 없으면 지금처럼 `app/pages` → `pages`
- [ ] 별칭 `~/`·`@/`는 srcDir 기준, `~~/`·`@@/`는 루트
- [ ] 테스트: srcDir `src/`, `dir.pages: 'views'`, 별칭 해석

### Task 3: 모노레포 하위 앱

**Files:** Create `skills/docent/scripts/src/lib/workspaces.mjs`; Modify `lib/config.mjs`(`app`), `commands/inventory.mjs`, `commands/init.mjs`, `docent.mjs`(`init --app`); Test `tests/lib/workspaces.test.mjs`, `tests/commands/init.test.mjs`, `tests/commands/inventory.test.mjs`, `tests/lib/config.test.mjs`

- [ ] config: `app`(문자열, 기본 `''`), `normalizeRel`로 검사
- [ ] inventory: `app`이 있으면 `join(projectDir, app)`으로 감지기(`warnings`·`listScreens`)를 돌리고 `files`·`evidence` 앞에 `app/`을 붙인다. 폴더가 없으면 문제로 보고
- [ ] `findWorkspaceApps(projectDir)`: `package.json`의 `workspaces`(배열 또는 `{ packages }`), `pnpm-workspace.yaml`의 `packages`, 없으면 `apps/*`·`packages/*`. 패턴은 리터럴 경로와 끝의 `*`·`**`(한 단계)만, `!` 제외 패턴은 뺀다. `package.json`이 있고 감지기가 하나라도 맞는 폴더만 `{ dir, detectors }`로 정렬해 돌려준다
- [ ] init: 루트 감지 결과가 없으면 후보를 찾는다. 하나면 `app:`과 그 감지기로 config를 쓰고, 여럿이면 config를 쓰지 않고 `{ created: false, apps }`. `init --app <폴더>`는 그 폴더로 감지해 쓴다(폴더 없으면 오류)
- [ ] CLI 출력: 후보가 여럿이면 목록과 `init --app` 안내
- [ ] 테스트: npm·pnpm 워크스페이스, 후보 하나·여럿, `--app`, inventory 경로 접두

### Task 4: 문서·마무리

- [ ] SKILL.md init 단계(앱 후보가 여럿이면 사용자에게 묻고 `init --app`), 감지기 목록에 Remix·flatRoutes·srcDir
- [ ] `references/stacks/js-routers.md`의 flatRoutes 항목 정리
- [ ] README(한/영) 지원 스택, CHANGELOG `미배포` 절과 알려진 한계 갱신
- [ ] `npm run build`, `npm test`, 커밋·푸시
