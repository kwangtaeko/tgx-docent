# docent M2 소스 기반 산출물 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실행 중인 앱 없이 소스만으로 `/docent` 한 번에 화면 목록·화면별 매뉴얼·프로젝트 소개·워크플로우가 담긴 HTML 사이트와 소개 README를 만든다.

**Architecture:** 결정적인 단계(init, inventory, review, validate, build)는 하나의 CLI `docent.mjs`의 하위 명령으로 만들고 esbuild로 번들해 레포에 커밋한다. 해석 단계(라우트 탐색, 화면 분석, 요약·워크플로우 작성)는 에이전트 프롬프트(`agents/*.md`)와 `SKILL.md`가 맡고, 결과는 항상 JSON 파일로 남아 CLI가 검증·렌더링한다.

**Tech Stack:** Node.js 20+ ESM, `node:test`, ajv, yaml, esbuild(개발 의존성), mermaid(로컬 번들 자산)

**Spec:** `docs/superpowers/specs/2026-10-13-docent-design.md` — 이 계획은 16장 **M2**를 다룬다. M1 계획(`2026-10-13-m1-foundation.md`)의 라이브러리를 그대로 쓴다.

## Global Constraints

- Node.js 20.10+(JSON import attributes), ESM `.mjs`, 테스트는 `node:test` + `node:assert/strict`만 — `package.json`의 `engines.node`를 `>=20.10`으로 올린다
- 런타임 의존성은 `ajv`, `yaml`만. 플러그인 사용자는 `npm install`을 하지 않으므로 CLI는 `skills/docent/scripts/dist/docent.mjs` 단일 파일로 번들해 커밋한다
- 작업 디렉터리는 대상 프로젝트 루트의 `.docent/` (`config.yaml`, `inventory.json`, `inventory.agent.json`, `screens/`, `summary.json`, `review.md`, `out/`)
- `.docent/.gitignore` 기본값: `auth/`, `out/`, `.session`
- 화면 ID 규칙·근거 형식·confidence·sourceHash는 M1 라이브러리와 `references/schema.md`를 따른다
- 근거 없는 서술은 빌드를 멈춘다. `confidence: low`는 본문에 `[확인 필요]`, `review.md`에 모은다
- 산출물 HTML은 외부 URL(CDN·폰트·이미지)을 참조하지 않는다. Mermaid는 `out/html/assets/mermaid.min.js`로 복사해 쓴다
- 같은 입력이면 같은 출력(바이트 동일). 날짜는 `config.yaml`의 `date`, 없으면 `git log -1 --format=%cs`, git이 없으면 `"unknown"`
- 대상 레포의 기존 `README.md`는 건드리지 않고 `.docent/out/README.md`에만 쓴다
- 문서 언어 기본 한국어(`language: ko`), `en` 선택 가능 — M2는 한국어 템플릿만 구현하고 `en`이면 "아직 지원하지 않음" 경고 후 한국어로 출력
- 비밀 파일 기본 패턴: `.env`, `.env.*`, `appsettings*.json`, `web.config`, `*.pem`, `*.key`, `*.pfx`, `id_rsa*`

## Review Focus

1. **경로 표기 흔들림** — 에이전트가 `./lib/store.ts`, `lib//store.ts`, `lib/store.ts`를 섞어 써도 같은 파일로 취급되어 해시가 흔들리지 않고, `../` 절대 경로 역슬래시는 스키마 단계에서 거부되어야 한다. → Task 1 테스트
2. **에이전트가 쓴 깨진 JSON** — `screens/*.json`이나 `summary.json`이 JSON 파싱 불가·스키마 위반이면 validate가 파일명과 이유를 보고하고 0이 아닌 코드로 끝나야 하며, 다른 화면 검사는 계속돼야 한다. → Task 4 테스트
3. **HTML 특수문자** — 라벨·메시지·근거에 `<`, `&`, `"`, `-->`가 들어가도 HTML이 깨지지 않고 근거 주석이 조기 종료되지 않아야 한다. → Task 6 테스트
4. **detector가 없는 프로젝트** — `package.json`이 없거나 Next.js가 아니면 init이 실패하지 않고 `detectors: []`로 설정을 만들고, inventory는 에이전트 후보만으로 동작해야 한다. → Task 3 테스트
5. **비밀 파일 차단의 범위** — docent 세션 표시(`.docent/.session`)가 없을 때는 훅이 아무것도 막지 않아야 하고, 있을 때는 `Read`·`Grep`·`Glob`의 경로가 비밀 패턴이면 막아야 한다. → Task 9 테스트

---

## File Structure

```
skills/docent/scripts/src/
  docent.mjs                 # CLI 진입점: init | inventory | review | validate | build | session
  lib/paths.mjs              # 프로젝트 상대 경로 정규화
  lib/config.mjs             # .docent/config.yaml 읽기·기본값
  lib/workspace.mjs          # .docent/ 파일 읽기·쓰기 헬퍼
  lib/project-date.mjs       # 결정적 날짜
  detectors/nextjs.mjs       # Next.js App·Pages Router 감지기
  commands/init.mjs
  commands/inventory.mjs
  commands/review.mjs
  commands/validate.mjs
  commands/build.mjs
  commands/session.mjs
  renderers/html.mjs         # 정적 사이트
  renderers/readme.mjs       # 소개 README
  renderers/escape.mjs
skills/docent/scripts/dist/docent.mjs   # 번들 결과 (커밋)
skills/docent/assets/mermaid.min.js     # 번들 시 복사 (커밋)
skills/docent/schemas/summary.schema.json
skills/docent/schemas/inventory-agent.schema.json
skills/docent/SKILL.md                  # 전체 흐름
skills/docent/references/writing-style.md
agents/route-explorer.md
agents/screen-analyzer.md
agents/summary-writer.md
commands/docent.md, commands/docent-init.md, commands/docent-inventory.md,
commands/docent-analyze.md, commands/docent-build.md
hooks/hooks.json, hooks/block-secrets.mjs
scripts/build.mjs                       # esbuild 번들 + mermaid 복사
scripts/compare-golden.mjs              # 분석 결과 vs 골든 비교 리포트 (개발용)
fixtures/expected/nextjs-sample/summary.json
tests/... (각 Task 참고)
```

---

### Task 1: 경로 정규화와 설정 로딩

**Files:**
- Create: `skills/docent/scripts/src/lib/paths.mjs`, `lib/config.mjs`, `lib/project-date.mjs`
- Modify: `skills/docent/schemas/inventory.schema.json`, `screen.schema.json` (`files`·`readFiles` 항목 패턴), `lib/source-hash.mjs` (정규화 후 해시), `package.json` (`yaml` 추가)
- Test: `tests/lib/paths.test.mjs`, `tests/lib/config.test.mjs`, `tests/lib/project-date.test.mjs`, `tests/lib/schema.test.mjs`(추가), `tests/lib/source-hash.test.mjs`(추가)

**Interfaces:**
- Produces:
  - `normalizeRel(p: string): string` — `./` 제거, 중복 `/` 축약, `a/./b` 정리. 결과가 `..`로 시작·절대 경로·역슬래시 포함이면 `Error`
  - `REL_PATH_PATTERN: string` — 스키마와 공유하는 정규식 문자열 `^(?!\\.{1,2}/)(?!/)[^\\\\:]+$` 수준(정규화된 상대 경로만 허용; `..` 세그먼트 금지)
  - `loadConfig(projectDir: string): Promise<Config>` — 파일 없으면 기본값. `Config = { language: 'ko'|'en', date?: string, detectors: string[], screens: { include: string[], exclude: string[], idMap: Record<string,string> }, secrets: { paths: string[] }, analyze: { concurrency: number } }`
  - `DEFAULT_CONFIG` (위 기본값: `language:'ko'`, `detectors:[]`, include/exclude 빈 배열, idMap `{}`, secrets.paths = Global Constraints의 패턴, `analyze.concurrency: 4`)
  - `projectDate(projectDir: string, config: Config): string` — `config.date` → git 커밋 날짜 → `'unknown'`
- `hashFiles`는 경로를 `normalizeRel`로 정리하고 중복 제거 후 해시한다(M1 리뷰 deferred minor 해소)

- [ ] **Step 1: Write the failing tests**
  - `normalizeRel('./lib//store.ts') === 'lib/store.ts'`, `normalizeRel('app/./x/../y.ts') === 'app/y.ts'`
  - `normalizeRel('../x')`, `normalizeRel('/etc/x')`, `normalizeRel('a\\b')`, `normalizeRel('a/../../b')` → throws
  - `hashFiles(dir, ['./a.ts']) === hashFiles(dir, ['a.ts'])`, `hashFiles(dir, ['a.ts','a.ts']) === hashFiles(dir, ['a.ts'])`
  - `validateScreen`: `readFiles: ['../x.ts']` invalid, `['./x.ts']` invalid; `validateInventory`: `files: ['/abs.ts']` invalid
  - `loadConfig(빈 dir)` deepEqual `DEFAULT_CONFIG`; `config.yaml`에 `screens: {exclude: ['/admin/*']}`만 있으면 나머지는 기본값과 병합; YAML 문법 오류면 `Error` 메시지에 `config.yaml` 포함
  - `projectDate(dir, {date:'2026-01-02'}) === '2026-01-02'`; git 없는 임시 dir → `'unknown'`
- [ ] **Step 2: Run** `node --test tests/lib/` → 새 테스트 FAIL
- [ ] **Step 3: Implement** — `yaml` 패키지 `parse`, `node:path`의 `posix.normalize`. git은 `execFileSync('git', ['log','-1','--format=%cs'], {cwd})`를 try/catch
- [ ] **Step 4: Run** `npm test` → PASS (골든 해시는 경로가 이미 정규형이므로 그대로 통과해야 함)
- [ ] **Step 5: Commit** — `feat: 경로 정규화와 설정 로딩`

---

### Task 2: Next.js 감지기

**Files:**
- Create: `skills/docent/scripts/src/detectors/nextjs.mjs`
- Test: `tests/detectors/nextjs.test.mjs`

**Interfaces:**
- Consumes: `normalizeRel` (Task 1)
- Produces: `export const name = 'nextjs'`; `detect(projectDir): Promise<boolean>`; `listScreens(projectDir): Promise<DetectedScreen[]>` where `DetectedScreen = { route: string, files: string[], evidence: string }`
- 이후 감지기(M5)도 같은 모양의 모듈이며 `detectors/index.mjs`의 `DETECTORS` 배열에 등록한다

규칙:
- `detect`: `package.json`의 `dependencies`/`devDependencies`에 `next`가 있으면 true
- App Router: `app/` 또는 `src/app/` 아래 `page.{tsx,jsx,ts,js}`. 라우트는 디렉터리 경로 그대로(`(group)`, `[id]` 유지 — ID 변환은 `screen-id.mjs` 몫), 루트는 `/`
- Pages Router: `pages/` 또는 `src/pages/` 아래 `*.{tsx,jsx,ts,js}`, 단 `_app`, `_document`, `_error`, `api/**` 제외. `index`는 상위 경로
- `files`: 페이지 파일 + 그 파일의 import 중 프로젝트 내부 파일(1단계). 내부 판정: `./`·`../` 상대 경로, 그리고 `tsconfig.json`/`jsconfig.json`의 `compilerOptions.paths`(`@/*` 등) 별칭. 확장자 해석 순서 `.tsx .ts .jsx .js /index.tsx /index.ts`. 정렬: 페이지 파일 먼저, 나머지는 사전순, 중복 제거
- `evidence`: 페이지 파일에서 `export default`가 처음 나오는 줄, 없으면 `:1`
- 결과는 라우트 사전순

- [ ] **Step 1: Write the failing tests**
  - 픽스처 기준: `listScreens('fixtures/nextjs-sample')`의 `{route, files, evidence}`가 `fixtures/expected/nextjs-sample/inventory.json`의 `kind: 'page'` 항목 7개와 `{route, files, evidence}`가 정확히 일치
  - `detect('fixtures/nextjs-sample') === true`, `detect(빈 임시 dir) === false`
  - 임시 프로젝트(Pages Router): `pages/index.tsx`, `pages/orders/[id].tsx`, `pages/_app.tsx`, `pages/api/x.ts` → 라우트 `['/', '/orders/[id]']`
  - 임시 프로젝트(`src/app/(shop)/cart/page.jsx`, `jsconfig.json` 별칭 `~/*` → `src/*`, `import x from '~/lib/cart'`) → route `/(shop)/cart`, files에 `src/lib/cart.js` 포함
- [ ] **Step 2: Run** `node --test tests/detectors/` → FAIL
- [ ] **Step 3: Implement** — import 수집은 정규식 `/^\s*import\s[^'"]*?['"]([^'"]+)['"]/gm` 과 `/^\s*import\s*['"]([^'"]+)['"]/gm`(부수효과 import), `export ... from '...'`도 포함. AST 파서는 쓰지 않는다
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: Next.js 화면 감지기`

---

### Task 3: init과 inventory 명령

**Files:**
- Create: `skills/docent/scripts/src/commands/init.mjs`, `commands/inventory.mjs`, `lib/workspace.mjs`, `detectors/index.mjs`, `skills/docent/schemas/inventory-agent.schema.json`
- Test: `tests/commands/init.test.mjs`, `tests/commands/inventory.test.mjs`

**Interfaces:**
- Consumes: `loadConfig`, `DEFAULT_CONFIG`, `normalizeRel` (Task 1), `DETECTORS` (Task 2), `assignIds`, `childId` (M1), `checkEvidence`, `validateInventory` (M1)
- Produces:
  - `runInit(projectDir): Promise<{ created: boolean, detectors: string[] }>` — `.docent/config.yaml`(감지된 detector 이름 기록, 이미 있으면 덮어쓰지 않고 `created:false`), `.docent/.gitignore`
  - `runInventory(projectDir): Promise<{ inventory: Inventory, problems: string[] }>` — `.docent/inventory.json` 작성
  - `workspace.mjs`: `docentDir(projectDir)`, `readJson(path)`, `writeJson(path, data)`(2칸 들여쓰기 + 개행, 키 순서 보존)
  - `inventory.agent.json` 형식(에이전트가 씀): `{ "screens": [ { "route": string|null, "kind": "page"|"modal"|"popup", "parentRoute"?: string, "name"?: string, "files": string[], "evidence": string } ] }` — page는 `route` 필수, 하위 화면은 `parentRoute`(부모 page의 route)와 `name`(ID용 이름) 필수

inventory 합치기 규칙:
1. 설정의 detector 결과(`source: detector:<name>`) + `inventory.agent.json`의 항목(`source: agent`). 같은 route가 둘 다 있으면 detector 우선, agent 항목은 버리고 problems에 기록하지 않음
2. `screens.include`가 비어 있지 않으면 매칭되는 page만, `screens.exclude`에 매칭되는 page 제외(glob: `*`는 세그먼트 하나, `**`는 여러 세그먼트). 제외된 page의 하위 화면도 제외
3. page ID: 기존 `.docent/inventory.json`이 있으면 그 route→id 맵을 `assignIds(routes, previous)`의 previous로 넘긴다. 그 다음 `screens.idMap[route]`가 있으면 그 값으로 덮어쓴다
4. 하위 화면 ID: `childId(부모ID, name)`; 부모 route가 inventory에 없으면 problems에 `"<name>: 부모 화면 <parentRoute> 없음"`, 항목 제외
5. 모든 `files`는 `normalizeRel`, 모든 `evidence`는 `checkEvidence`로 확인. 실패한 항목은 제외하고 problems에 이유 기록
6. 결과를 `validateInventory`로 검증 후 저장. 저장 순서: page는 route 사전순, 각 page 바로 뒤에 그 하위 화면(ID 사전순)
7. 이전 inventory의 `menuPath`는 같은 ID에 유지(분석 결과로 채워진 값 보존)

- [ ] **Step 1: Write the failing tests** (픽스처를 임시 디렉터리로 복사해서 실행 — `fs.cp(..., {recursive:true, filter: 경로에 node_modules/.next 없음})`)
  - `runInit(픽스처 사본)` → `created:true`, `detectors:['nextjs']`, `.docent/.gitignore` 내용에 `auth/`, `out/`, `.session` 줄; 두 번째 호출 → `created:false`, config 파일 내용 불변
  - `runInit(package.json 없는 dir)` → 실패하지 않고 `detectors: []`
  - 사본에 골든의 modal 항목을 `inventory.agent.json`으로 넣고 `runInventory` → 결과에서 `menuPath`를 뺀 항목들이 골든 inventory에서 `menuPath`를 뺀 것과 deepEqual, problems `[]`
  - 기존 inventory에 `/orders/new → custom-x`가 있으면 결과 ID 유지
  - `idMap: {'/orders': 'ORD1000'}` → 그 화면 ID `ORD1000`
  - `exclude: ['/admin/**']` → `admin-users` 없음
  - agent 항목의 evidence 라인이 틀리면 그 항목만 빠지고 problems 1개
  - detector 없는 사본(`detectors: []`) + agent 항목 page 2개 → 두 화면 inventory 생성
- [ ] **Step 2: Run** `node --test tests/commands/` → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: init과 inventory 명령`

---

### Task 4: summary 스키마와 validate 명령

**Files:**
- Create: `skills/docent/schemas/summary.schema.json`, `skills/docent/scripts/src/commands/validate.mjs`, `fixtures/expected/nextjs-sample/summary.json`
- Modify: `lib/schema.mjs` (`validateSummary` 추가)
- Test: `tests/commands/validate.test.mjs`, `tests/golden-nextjs.test.mjs`(summary 검사 추가)

**Interfaces:**
- Consumes: `validateInventory`, `validateScreen`, `checkEvidence`, `hashFiles` (M1), `workspace.mjs` (Task 3)
- Produces:
  - `validateSummary(data)` — `{ valid, errors }`
  - `runValidate(projectDir): Promise<{ ok: boolean, problems: string[] }>` — 문제가 있으면 `ok:false`. CLI는 `ok:false`면 exit 1
  - summary 형식(에이전트가 씀, `.docent/summary.json`):

```json
{
  "oneLiner": { "value": "거래처 주문을 등록·조회·수정하는 주문 관리 시스템", "screens": ["orders", "orders-new", "orders-id"] },
  "features": [
    { "menu": "주문관리", "value": "주문을 검색하고 신규 주문을 등록·수정·삭제한다", "screens": ["orders", "orders-new", "orders-id-edit"] }
  ],
  "workflows": [
    { "name": "주문 등록", "description": "목록에서 신규 등록으로 들어가 저장하면 목록으로 돌아온다", "steps": ["orders", "orders-new", "orders"] }
  ]
}
```

validate 규칙 (하나라도 어기면 problems에 `"<파일>: <이유>"`):
- inventory 스키마, 각 `screens/<id>.json` 파싱·스키마, 파일명 = id, inventory ID 집합 = screens ID 집합
- 모든 evidence `checkEvidence`; `fields[].label`, `actions[].label`, `messages[].text`는 `expectText`
- `navigatesTo`·`opens`·`parentId`가 존재하는 ID
- `sourceHash === hashFiles(readFiles)` (다르면 `"<id>: 소스가 바뀌었습니다. 다시 분석하세요"`)
- summary: 스키마; 모든 `screens`·`steps` ID 존재; 각 feature와 oneLiner의 `screens` 중 하나 이상은 그 화면의 `purpose.confidence`가 `low`가 아님; workflow의 연속한 두 step `a→b`는 `a`의 action 중 `navigatesTo === b` 또는 `opens === b`가 있어야 함
- 한 파일이 깨져도 나머지 검사는 계속한다

- [ ] **Step 1: Write the failing tests** (골든을 `.docent/`로 복사한 픽스처 사본에서)
  - 골든 그대로 → `ok:true`, problems `[]`
  - `screens/login.json`을 `{` 로 덮어씀 → `ok:false`, problems에 `login.json` 포함, 그리고 다른 화면 문제는 없음(정확히 1개)
  - workflow steps에 `['orders','orders-id-edit']` → 간선 없음 문제
  - feature의 screens를 모두 low purpose 화면으로(테스트에서 해당 screen purpose를 low로 바꿈) → 문제
  - 사본의 `lib/store.ts` 수정 → `orders` 등 해당 화면 "다시 분석" 문제
  - `golden-nextjs.test.mjs`: `summary.json`이 `validateSummary` 통과, 모든 workflow 간선이 실제 action 간선
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: 골든 문체를 스펙(10장: 존댓말)에 맞춘다** — 기존 골든 screens의 `purpose.value`·`actions[].effect`를 합니다체로 고친다(예: "신규 주문을 등록한다" → "신규 주문을 등록합니다"). 파일 내용이 아니므로 `sourceHash`는 그대로다. 그리고 **Write `summary.json` golden**(합니다체) (위 예시를 포함해 oneLiner 1, features 3(대시보드·주문관리·관리자), workflows 3(로그인→대시보드, 주문 등록, 주문 수정: `orders→orders-id→orders-id-edit→orders-id`)) and implement `validateSummary`, `runValidate`
- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: summary 스키마와 validate 명령`

---

### Task 5: review.md 생성

**Files:**
- Create: `skills/docent/scripts/src/commands/review.mjs`
- Test: `tests/commands/review.test.mjs`

**Interfaces:**
- Consumes: `workspace.mjs`, 화면 JSON
- Produces: `renderReview(screens: Screen[], answered: Set<string>): string`, `runReview(projectDir): Promise<{ items: number }>` — `.docent/review.md` 작성
- 항목 키: `<화면ID>|<경로>` (예: `orders-new|actions[1]`, `orders-new|unknowns[0]`) — 사용자가 체크(`- [x]`)한 항목의 키는 다시 생성할 때 유지되어 체크 상태가 보존된다

형식 (정확히):

```markdown
# 확인 필요 항목

> docent가 소스만으로 확정하지 못한 내용입니다. 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영됩니다.

## orders-new · 주문 등록

- [ ] 저장 — 확신도 낮음: 입력값을 검증하고 … (app/orders/new/order-form.tsx:32) <!-- key: orders-new|actions[1] -->
- [ ] 여신 확인(checkCredit)의 승인 기준은 … <!-- key: orders-new|unknowns[0] -->
```

- 대상: `confidence: 'low'`인 purpose·roles·fields·actions(라벨: purpose는 `목적`, roles는 역할 값, fields·actions는 label), 그리고 모든 `unknowns`
- 화면 순서는 inventory 순서, 항목이 없는 화면은 섹션 생략, 항목이 하나도 없으면 본문 `확인할 항목이 없습니다.`
- 기존 `review.md`에서 `- [x]`인 줄의 key는 `answered`로 읽어 같은 key 항목을 `- [x]`로 출력하고, 그 줄의 `—` 뒤 사용자가 덧붙인 `답:` 이후 텍스트도 보존한다

- [ ] **Step 1: Write the failing tests** — 골든 화면으로 `renderReview` 결과가 위 형식과 정확히 같은 문자열(골든에서 나오는 항목은 orders-new 두 개); `answered`에 `orders-new|unknowns[0]`가 있고 기존 줄에 ` 답: 한도 1억` 이 붙어 있으면 출력 줄이 `- [x] … 답: 한도 1억 <!-- key: … -->`; 항목 0개 → `확인할 항목이 없습니다.`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: review.md 생성`

---

### Task 6: HTML 렌더러

**Files:**
- Create: `skills/docent/scripts/src/renderers/escape.mjs`, `renderers/html.mjs`
- Test: `tests/renderers/html.test.mjs`

**Interfaces:**
- Consumes: 화면 JSON, inventory, summary, `projectDate`
- Produces:
  - `escapeHtml(s)`, `escapeComment(s)` (주석 안 `--`를 `- -`로)
  - `renderSite({ inventory, screens: Map<id, Screen>, summary, date, projectName }): Map<relPath, string>` — 파일 경로 → 내용. 경로: `index.html`(소개: oneLiner, features, 사용자 역할 합집합, 메뉴 구조), `screens.html`(화면 목록 표: ID·이름·경로·메뉴·역할·목적), `screens/<id>.html`(화면별 매뉴얼), `workflows.html`(워크플로우별 Mermaid `flowchart LR` + 단계 설명), `assets/style.css`
- 매뉴얼 페이지 구성: 제목, 메뉴 위치, 목적, 접근 역할, 입력 항목 표(라벨·형식·필수), 버튼 표(라벨·동작·이동 화면 링크), 안내 메시지 표, 하위 화면은 부모 페이지 안에 섹션으로도 링크. 각 서술 뒤에 `<!-- evidence: 파일:라인 -->`
- `confidence: low` 항목은 텍스트 앞에 `<mark>[확인 필요]</mark>`
- 모든 페이지 `<script src="assets/mermaid.min.js">`는 `workflows.html`에만; 그 외 외부 참조 없음
- Mermaid 노드 ID는 화면 ID의 `-`를 `_`로 바꾼 값, 라벨은 화면 title (따옴표 이스케이프)

- [ ] **Step 1: Write the failing tests** (골든 inventory·screens·summary 입력)
  - 결과 키 집합 = `index.html, screens.html, workflows.html, assets/style.css` + 화면 8개의 `screens/<id>.html`
  - `screens/orders-new.html`에 `거래처`·`납기일` 라벨, `<mark>[확인 필요]</mark>`, `<!-- evidence: app/orders/new/order-form.tsx:32 -->` 포함, `href="orders.html"`(저장 후 이동) 포함, `orders-new--customer-search.html` 링크 포함
  - `workflows.html`에 간선 `orders --> orders_new`("주문 등록" workflow) 포함, `assets/mermaid.min.js` 참조
  - 전체 HTML에서 `/https?:\/\//` 매치 0개
  - 같은 입력 두 번 → 모든 파일 문자열 동일
  - 특수문자: 라벨 `<b>&"`와 evidence 메시지에 `-->`를 넣은 화면 → 출력에 `&lt;b&gt;&amp;&quot;`, 주석 안에 `-->` 없음
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 템플릿은 JS 템플릿 리터럴 함수, CSS는 인쇄용 `@media print` 포함 단일 파일(M4 PDF 대비)
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: HTML 산출물 렌더러`

---

### Task 7: README 렌더러와 build 명령

**Files:**
- Create: `skills/docent/scripts/src/renderers/readme.mjs`, `commands/build.mjs`
- Test: `tests/renderers/readme.test.mjs`, `tests/commands/build.test.mjs`

**Interfaces:**
- Consumes: `renderSite` (Task 6), `runValidate` (Task 4), `loadConfig`, `projectDate` (Task 1)
- Produces:
  - `renderReadme({ inventory, screens, summary, date, projectName }): string`
  - `runBuild(projectDir, { assetsDir }): Promise<{ files: string[] }>` — `runValidate`가 실패하면 `Error`(메시지에 problems 포함)로 중단. 성공 시 `.docent/out/html/**`(+ `assets/mermaid.min.js`를 `assetsDir`에서 복사), `.docent/out/README.md` 작성. `out/`의 이전 내용은 지우고 다시 쓴다
  - `projectName`: 대상 `package.json`의 `name`, 없으면 디렉터리 이름

README 구성(스펙 4·10장): `# <projectName>` → oneLiner → `## 주요 기능`(features, 각 줄 끝에 `<!-- screens: a, b -->`) → `## 메뉴 구조`(menuPath 트리 목록) → `## 사용자 역할` → `## 더 보기`(`html/index.html`, `html/screens.html` 상대 링크). GIF 섹션은 M3에서 추가. 개발자용 설치 안내를 쓰지 않는다.

- [ ] **Step 1: Write the failing tests**
  - `renderReadme(골든)`가 `# nextjs-sample`로 시작, `## 주요 기능` 아래 3줄, `<!-- screens: orders, orders-new, orders-id-edit -->` 포함, `npm install` 문자열 없음
  - `runBuild(골든을 넣은 픽스처 사본, {assetsDir: 임시 dir에 가짜 mermaid.min.js})` → `out/html/index.html`, `out/html/assets/mermaid.min.js`, `out/README.md` 존재; 사본의 원래 `README.md` 내용 불변
  - 두 번 build → `out/` 전체 파일 내용 동일(config에 `date` 지정)
  - 골든 화면 하나의 evidence를 깨뜨리면 `runBuild` reject, 메시지에 화면 ID
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 소개 README 렌더러와 build 명령`

---

### Task 8: CLI 진입점과 번들

**Files:**
- Create: `skills/docent/scripts/src/docent.mjs`, `commands/session.mjs`, `scripts/build.mjs`, `skills/docent/scripts/dist/docent.mjs`(생성물), `skills/docent/assets/mermaid.min.js`(생성물)
- Modify: `package.json` (`devDependencies`: `esbuild`, `mermaid`; `scripts.build`: `node scripts/build.mjs`), `.github/workflows/test.yml` (`npm run build && git diff --exit-code skills/docent/scripts/dist skills/docent/assets`)
- Test: `tests/cli.test.mjs`

**Interfaces:**
- Consumes: `runInit`, `runInventory`, `runReview`, `runValidate`, `runBuild`
- Produces: `node dist/docent.mjs <command> [--project <dir>]` (기본 project = cwd)
  - `init` / `inventory` / `review` / `validate` / `build` — 결과 요약을 stdout에 한국어로, 실패 시 stderr + exit 1
  - `session start` → `.docent/.session`에 ISO 시각 기록; `session end` → 삭제 (Task 9 훅이 읽음)
  - `build`의 `assetsDir`는 번들 파일 기준 `../../assets`
  - 알 수 없는 명령 → 사용법 출력, exit 2

- [ ] **Step 1: Write the failing test** — `tests/cli.test.mjs`: 번들(`dist/docent.mjs`)을 `execFileSync('node', [...])`로 실행해 픽스처 사본에서 `init` → `inventory`(agent 모달 항목 포함) → 골든 screens·summary 복사 → `validate`(exit 0) → `build`(exit 0, `out/html/assets/mermaid.min.js` 크기 > 100KB); `node dist/docent.mjs nope` → exit 2
- [ ] **Step 2: Run** → FAIL (dist 없음)
- [ ] **Step 3: Implement** — `scripts/build.mjs`: esbuild `bundle:true, platform:'node', format:'esm', target:'node20'`, 진입점 `src/docent.mjs` → `dist/docent.mjs`, 상단 배너 `// 생성 파일: npm run build로 다시 만드세요`; `lib/schema.mjs`는 스키마를 파일 읽기 대신 `import schema from '../../../schemas/x.schema.json' with { type: 'json' }`로 불러와 번들에 포함되게 바꾼다(src·dist 경로 차이 제거); `node_modules/mermaid/dist/mermaid.min.js`를 `skills/docent/assets/`로 복사
- [ ] **Step 4: Run** `npm run build && npm test` → PASS; 다시 `npm run build` 후 `git status --short skills/docent/scripts/dist` 변화 없음(번들 결정성)
- [ ] **Step 5: Commit** — `build: CLI 진입점과 번들`

---

### Task 9: 비밀 파일 읽기 차단 훅

**Files:**
- Create: `hooks/hooks.json`, `hooks/block-secrets.mjs`
- Test: `tests/hooks/block-secrets.test.mjs`

**Interfaces:**
- Consumes: `.docent/.session`(Task 8), `config.yaml`의 `secrets.paths`(있으면 기본 패턴에 추가), 기본 패턴(Global Constraints)
- Produces: Claude Code `PreToolUse` 훅. `hooks.json`: matcher `Read|Grep|Glob`, command `node ${CLAUDE_PLUGIN_ROOT}/hooks/block-secrets.mjs`. 표준 입력 JSON의 `cwd`, `tool_name`, `tool_input.file_path`/`tool_input.path`/`tool_input.pattern`을 본다
  - `<cwd>/.docent/.session`이 없거나 12시간보다 오래됐으면 exit 0(아무것도 안 함)
  - 대상 경로(또는 Glob 패턴)의 파일 이름이 비밀 패턴에 맞으면 stderr에 `docent: 비밀 파일(<경로>)은 분석하지 않습니다. 환경변수 이름은 .env.example이나 코드의 process.env 참조에서 확인하세요.` 출력, exit 2
  - 훅은 번들하지 않는 단일 파일이며 Node 표준 라이브러리만 쓴다(yaml이 필요하면 `secrets.paths` 목록만 단순 줄 파싱 — `- ` 항목)

- [ ] **Step 1: Write the failing tests** — 훅을 `spawnSync('node', [hook], {input: JSON})`로 실행
  - 세션 없음 + `.env` Read → exit 0
  - 세션 있음 + `Read .env` → exit 2, stderr에 `.env`; `Read config/appsettings.Production.json` → 2; `Read lib/store.ts` → 0; `Glob **/.env*` → 2; `Grep` path `web.config` → 2
  - 13시간 전 세션 → exit 0
  - config의 `secrets.paths: ['secrets/*.json']` + `Read secrets/a.json` → 2
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 패턴 매칭은 파일 이름 기준 단순 glob(`*` → `[^/]*`), 경로에 `/`가 있는 패턴은 전체 상대 경로와 비교
- [ ] **Step 4: Run** → PASS; `claude plugin validate .` → 통과
- [ ] **Step 5: Commit** — `feat: 분석 중 비밀 파일 읽기 차단 훅`

---

### Task 10: 에이전트 프롬프트·SKILL.md·명령과 실전 점검

**Files:**
- Create: `agents/route-explorer.md`, `agents/screen-analyzer.md`, `agents/summary-writer.md`, `skills/docent/references/writing-style.md`, `commands/docent.md`, `commands/docent-init.md`, `commands/docent-inventory.md`, `commands/docent-analyze.md`, `commands/docent-build.md`, `scripts/compare-golden.mjs`
- Modify: `skills/docent/SKILL.md`, `README.md`, `AGENTS.md`
- Test: `tests/compare-golden.test.mjs`, 그리고 수동 실전 점검(Step 4)

**Interfaces:**
- Consumes: CLI(Task 8), 모든 스키마, `references/schema.md`
- Produces:
  - `SKILL.md` 흐름: `session start` → `init` → `inventory` → (detector 결과를 사용자에게 보여 주고, 빠진 화면이 의심되면 `route-explorer`로 `inventory.agent.json` 작성 → `inventory` 재실행) → 화면별 `screen-analyzer`(서브에이전트 병렬, 동시 `analyze.concurrency`개; 서브에이전트가 없으면 같은 프롬프트로 순차) → 발견된 하위 화면을 `inventory.agent.json`에 추가하고 `inventory` 재실행 후 그 화면 분석 → `summary-writer` → `validate`(실패 항목만 다시 분석, 최대 2회) → `review` → `build` → `session end`. 이미 `screens/<id>.json`이 있고 `sourceHash`가 같으면 건너뛴다(이어서 하기). 화면이 50개를 넘으면 시작 전에 수와 예상 시간을 알리고 확인받는다. 비밀 파일 패턴은 읽지 않는다(훅이 없는 에이전트용 규칙으로도 명시)
  - `screen-analyzer.md`: 입력(화면 ID, inventory 항목, 사용자가 답한 review 항목), 출력(`screens/<id>.json` 한 파일), 규칙(스펙 11장 1~3, schema.md 형식, 라벨은 소스 문구 그대로, `readFiles`는 실제로 읽은 파일 전부, 하위 화면 기준(스펙 6장), 금지 사례 목록: 소스에 없는 버튼·추정 업무 규칙·근거 줄 추측 금지), 마지막에 `node … validate`로 자기 화면 문제 없는지 확인
  - `route-explorer.md`: 감지기가 없거나 불완전할 때 라우트 정의를 찾아 `inventory.agent.json` 작성, 각 항목 evidence 필수
  - `summary-writer.md`: `summary.json` 작성 규칙(스펙 10·11장 5번, workflow는 실제 navigatesTo/opens 간선만)
  - `writing-style.md`: 사용자 관점, 존댓말(합니다체: "주문을 등록합니다"), 용어는 화면 문구 그대로, 기술 용어(컴포넌트·API·state) 금지
  - `scripts/compare-golden.mjs <docentDir> <expectedDir>`: 화면 집합 차이, 화면별 fields(label·type·required)·actions(label·navigatesTo·opens)·messages(text) 차이를 표로 출력, 일치율(%) 출력. exit 0
- [ ] **Step 1: Write the failing test** — `compare-golden`을 골든 대 골든으로 실행하면 `일치율 100%`; 골든 사본에서 field 하나 삭제하면 그 화면·라벨이 출력에 나오고 100% 미만
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Write the prompts, commands, SKILL.md, compare script**
- [ ] **Step 4: 실전 점검 (수동)** — 픽스처 사본에서 이 세션의 에이전트가 `SKILL.md` 절차대로 `/docent` 전체를 실행. 확인: `validate` 통과, `build` 산출물 생성, `compare-golden` 일치율 기록(목표: 화면 집합 100%, fields·actions 90% 이상). 결과와 어긋난 항목을 ledger에 기록하고, 프롬프트 문제로 보이는 것은 프롬프트를 고쳐 한 번 더 실행
- [ ] **Step 5: Commit** — `feat: 분석 에이전트 프롬프트와 /docent 명령`

---

## 이 계획 다음

M3(앱 실행·캡처·GIF)는 별도 계획으로 쓴다. M3는 이 계획의 `session`·`build`에 캡처 경로 삽입을, README에 GIF 섹션을 추가한다.
