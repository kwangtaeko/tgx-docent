# docent M1 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 플러그인 레포의 뼈대, 중간 산출물 스키마, 그리고 "좋은 결과"의 기준이 되는 Next.js 픽스처와 수작업 기대 산출물(골든)을 만들고, 골든이 스키마·근거 규칙을 지키는지 자동 검사한다.

**Architecture:** 이후 단계가 공유할 결정적 라이브러리 4개(화면 ID, 소스 해시, 스키마 검증, 근거 검사)를 `skills/docent/scripts/src/lib/`에 만들고, 픽스처 골든 테스트가 이 라이브러리로 골든 파일을 검증한다. 에이전트·렌더러·감지기는 이 계획 범위가 아니다(M2 이후 별도 계획).

**Tech Stack:** Node.js 20+ (ESM), `node:test`, ajv(JSON Schema 2020-12), Next.js 15 App Router(픽스처 전용)

**Spec:** `docs/superpowers/specs/2026-10-13-docent-design.md` — 실행자는 계획과 함께 읽을 것. 이 계획은 스펙 16장의 **M1**만 다룬다. scenario·run 스키마는 쓰는 단계(M3)에서, HTML·README 기대 출력은 렌더러 형식이 정해지는 M2에서 추가한다.

## Global Constraints

- Node.js 20 이상, ESM(`"type": "module"`), 스크립트 파일 확장자 `.mjs`
- 테스트는 `node:test` + `node:assert/strict`만 사용 (테스트 의존성 없음)
- 런타임 의존성은 ajv 하나만 추가 (이후 esbuild로 번들 예정이므로 `dependencies`에 둔다)
- 모든 텍스트 파일 LF (`.gitattributes`로 고정)
- 화면 ID: 라우트에서 결정적 생성, `/order/[id]/edit` → `order-id-edit`, `/` → `home`, 충돌 시 `-2`, `-3`, 하위 화면은 `<부모ID>--<이름>`
- `evidence` 형식: `파일:라인`, `파일:시작-끝`, `파일:함수명` (파일은 프로젝트 루트 기준 상대 경로, `/` 구분자)
- `confidence`: `high` | `medium` | `low`
- `sourceHash`: `sha256:` + 64자리 소문자 hex
- 문자열 그대로 나오는 항목(입력 항목 라벨, 버튼 라벨, 안내 메시지)은 근거 위치 ±5줄 안에 그 텍스트가 실제로 있어야 한다
- 화면 `kind`: `page` | `modal` | `popup`; `page`가 아니면 `parentId` 필수
- 픽스처 화면 6~8개(로그인·목록·등록·상세·권한 분기 포함) — 이 계획은 page 7개 + modal 1개로 고정
- 문서·픽스처 화면 문구는 한국어

## Review Focus

1. **특수 라우트 세그먼트** — route group `(auth)`, 병렬 슬롯 `@modal`, catch-all `[...slug]`, optional catch-all `[[...slug]]`가 들어와도 ID가 결정적으로 나오고 group·slot은 ID에 들어가지 않아야 한다. → Task 2 테스트
2. **ASCII가 아닌 라우트** — `/주문/목록`처럼 한글 폴더명이면 slug가 비어 서로 충돌하지 않고, 같은 입력엔 항상 같은 ID가 나와야 한다. → Task 2 테스트
3. **CRLF 소스** — 대상 프로젝트 파일이 CRLF여도 라인 번호와 텍스트 매칭이 맞고, 같은 내용이면 LF/CRLF와 무관하게 같은 `sourceHash`가 나와야 한다. → Task 3, Task 5 테스트
4. **루트 밖 근거 경로** — `../../etc/passwd`, 절대 경로, 역슬래시 경로는 파일을 읽지 않고 거부해야 한다. → Task 5 테스트
5. **잘못된 라인 범위** — 파일 끝을 넘는 라인, `10-5`처럼 뒤집힌 범위, `0` 라인은 거부해야 한다. → Task 5 테스트

---

## File Structure

```
.gitattributes                         # * text=auto eol=lf
package.json                           # 루트: type module, engines, test 스크립트, ajv
.claude-plugin/plugin.json             # name "docent"
.claude-plugin/marketplace.json        # name "tgx-docent", plugins[0].source "./"
skills/docent/SKILL.md                 # 진입점 스텁 (M2에서 채움)
skills/docent/references/schema.md     # 스키마 사람용 설명
skills/docent/schemas/inventory.schema.json
skills/docent/schemas/screen.schema.json
skills/docent/scripts/src/lib/screen-id.mjs
skills/docent/scripts/src/lib/source-hash.mjs
skills/docent/scripts/src/lib/schema.mjs
skills/docent/scripts/src/lib/evidence.mjs
fixtures/nextjs-sample/                # 실행 가능한 Next.js 앱 (M3 캡처 대상)
fixtures/expected/nextjs-sample/inventory.json
fixtures/expected/nextjs-sample/screens/<id>.json   # 8개
tests/plugin-manifest.test.mjs
tests/lib/screen-id.test.mjs
tests/lib/source-hash.test.mjs
tests/lib/schema.test.mjs
tests/lib/evidence.test.mjs
tests/golden-nextjs.test.mjs
.github/workflows/test.yml
AGENTS.md, CLAUDE.md, README.md
```

골든은 앱 폴더 밖(`fixtures/expected/`)에 둔다. 앱 폴더 안에는 docent가 실행 시 `.docent/`를 만들기 때문이다.

---

### Task 1: 레포 뼈대와 플러그인 매니페스트

**Files:**
- Create: `.gitattributes`, `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/docent/SKILL.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `.github/workflows/test.yml`
- Modify: `docs/PLAN.md` (줄바꿈 LF로 정규화만, 내용 변경 없음)
- Test: `tests/plugin-manifest.test.mjs`

**Interfaces:**
- Produces: `npm test` = `node --test tests/`; 플러그인 이름 `docent`, 마켓플레이스 이름 `tgx-docent`, 버전 `0.0.1`

- [ ] **Step 1: Write the failing test** — `tests/plugin-manifest.test.mjs`

```js
test('plugin.json과 marketplace.json의 이름·버전이 일치한다', async () => {
  const plugin = JSON.parse(await readFile('.claude-plugin/plugin.json', 'utf8'));
  const market = JSON.parse(await readFile('.claude-plugin/marketplace.json', 'utf8'));
  assert.equal(plugin.name, 'docent');
  assert.equal(market.name, 'tgx-docent');
  assert.equal(market.plugins[0].name, plugin.name);
  assert.equal(market.plugins[0].version, plugin.version);
  assert.equal(market.plugins[0].source, './');
});
test('SKILL.md 프런트매터에 name: docent가 있다', async () => {
  const md = await readFile('skills/docent/SKILL.md', 'utf8');
  assert.match(md, /^---\nname: docent\ndescription: .+\n---/);
});
```

- [ ] **Step 2: Run it to verify it fails** — `node --test tests/` → FAIL (ENOENT)
- [ ] **Step 3: Create the files**
  - `.gitattributes`: `* text=auto eol=lf`, 그 뒤 `git add --renormalize .`로 기존 `docs/PLAN.md`를 LF로 정규화
  - `package.json`: `"name": "tgx-docent"`, `"private": true`, `"type": "module"`, `"engines": {"node": ">=20"}`, `"scripts": {"test": "node --test tests/"}`, `"dependencies": {"ajv": "^8"}`
  - `plugin.json`: name `docent`, version `0.0.1`, description "소스 코드를 분석해 화면 목록·사용자 매뉴얼·소개 문서를 만드는 플러그인", repository `https://github.com/kwangtaeko/tgx-docent`, license `MIT`
  - `SKILL.md`: 프런트매터(name, description) + "M1: 아직 실행 기능 없음, 설계는 docs/superpowers/specs 참고" 한 단락
  - `AGENTS.md`: 레포 구조, `npm test`, 스펙·계획 문서 위치, "결정적인 일은 스크립트, 해석은 에이전트" 원칙 / `CLAUDE.md`: `@AGENTS.md` 한 줄 / `README.md`: 한 줄 소개 + 개발 중 표시
  - `.github/workflows/test.yml`: push·pull_request, ubuntu-latest, Node 20, `npm ci`, `npm test`
- [ ] **Step 4: Run tests** — `npm install && npm test` → PASS; `claude plugin validate .` → 오류 없음
- [ ] **Step 5: Commit** — `chore: 플러그인 레포 뼈대와 매니페스트 추가`

---

### Task 2: 화면 ID 생성

**Files:**
- Create: `skills/docent/scripts/src/lib/screen-id.mjs`
- Test: `tests/lib/screen-id.test.mjs`

**Interfaces:**
- Produces:
  - `routeToId(route: string): string` — 단일 라우트의 기본 ID (충돌 처리 없음)
  - `childId(parentId: string, name: string): string` — `${parentId}--${slug(name)}`
  - `assignIds(routes: string[]): Map<string, string>` — 라우트 → 최종 ID. 라우트를 사전순 정렬한 순서대로 처음 것은 기본 ID, 이후 충돌은 `-2`, `-3`

- [ ] **Step 1: Write the failing tests**

```js
test('기본 규칙', () => {
  assert.equal(routeToId('/'), 'home');
  assert.equal(routeToId('/order/[id]/edit'), 'order-id-edit');
  assert.equal(routeToId('/Orders/New'), 'orders-new');
  assert.equal(routeToId('/order/new.aspx'), 'order-new-aspx');
});
test('route group과 병렬 슬롯은 ID에서 빠진다', () => {
  assert.equal(routeToId('/(auth)/login'), 'login');
  assert.equal(routeToId('/@modal/(.)photo/[id]'), 'photo-id');
});
test('catch-all', () => {
  assert.equal(routeToId('/docs/[...slug]'), 'docs-slug');
  assert.equal(routeToId('/shop/[[...slug]]'), 'shop-slug');
});
test('ASCII가 아닌 세그먼트는 해시 기반으로 결정적이고 서로 다르다', () => {
  const a = routeToId('/주문/목록'), b = routeToId('/주문/등록');
  assert.notEqual(a, b);
  assert.equal(a, routeToId('/주문/목록'));
  assert.match(a, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});
test('충돌은 사전순으로 -2, -3', () => {
  const ids = assignIds(['/order-new', '/order/new']);
  assert.equal(ids.get('/order-new'), 'order-new');
  assert.equal(ids.get('/order/new'), 'order-new-2');
});
test('하위 화면', () => {
  assert.equal(childId('orders-new', 'Customer Search'), 'orders-new--customer-search');
});
```

- [ ] **Step 2: Run** — `node --test tests/lib/screen-id.test.mjs` → FAIL (module not found)
- [ ] **Step 3: Implement** — 세그먼트 처리 순서: 세그먼트 전체가 `(…)`인 route group과 `@`로 시작하는 슬롯은 제거, 가로챔 접두어 `(.)`·`(..)`·`(...)`(반복 포함)는 떼고 나머지 이름만 남김 → `[[...x]]`/`[...x]`/`[x]` → `x` → 소문자화 → `[^a-z0-9]+`를 `-`로 바꾸고 앞뒤 `-` 제거. 결과가 빈 세그먼트는 `s` + 원래 세그먼트 UTF-8의 sha1 앞 8자리(`node:crypto`). 세그먼트를 `-`로 연결, 결과가 비면 `home`.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 라우트 기반 화면 ID 생성`

---

### Task 3: 소스 해시

**Files:**
- Create: `skills/docent/scripts/src/lib/source-hash.mjs`
- Test: `tests/lib/source-hash.test.mjs`

**Interfaces:**
- Produces: `hashFiles(rootDir: string, relPaths: string[]): Promise<string>` → `'sha256:<64 hex>'`. 파일이 없으면 `Error`(메시지에 상대 경로 포함)

- [ ] **Step 1: Write the failing tests** (임시 디렉터리는 `fs.mkdtemp(os.tmpdir())`)
  - `순서와 무관하다`: `hashFiles(dir, ['a.ts','b.ts']) === hashFiles(dir, ['b.ts','a.ts'])`
  - `CRLF와 LF는 같은 해시`: 내용 `"x\r\ny\r\n"`와 `"x\ny\n"`인 같은 이름 파일을 다른 디렉터리에 두고 비교 → equal
  - `내용이 바뀌면 해시가 바뀐다`
  - `경로도 해시에 들어간다`: 같은 내용, 다른 파일명 → notEqual
  - `형식`: `assert.match(h, /^sha256:[0-9a-f]{64}$/)`
  - `없는 파일은 경로를 담은 에러`: `assert.rejects(..., /missing\.ts/)`
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 경로 정렬 후 각 파일마다 `상대경로 + "\0" + (CRLF→LF 정규화한 내용) + "\0"`을 하나의 sha256에 순서대로 넣는다.
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 화면 소스 해시 계산`

---

### Task 4: inventory·screen 스키마와 검증기

**Files:**
- Create: `skills/docent/schemas/inventory.schema.json`, `skills/docent/schemas/screen.schema.json`, `skills/docent/scripts/src/lib/schema.mjs`, `skills/docent/references/schema.md`
- Test: `tests/lib/schema.test.mjs`

**Interfaces:**
- Produces:
  - `validateInventory(data: unknown): { valid: boolean, errors: string[] }`
  - `validateScreen(data: unknown): { valid: boolean, errors: string[] }`
  - errors 항목은 `"<instancePath> <message>"` 형식 (ajv `allErrors: true`)

**스키마 내용** (JSON Schema 2020-12, `ajv/dist/2020`; 공통 정의는 각 스키마의 `$defs`):
- `$defs.evidence`: string, pattern `^[^:\\\\]+:(\d+(-\d+)?|[A-Za-z_$][\w$.]*)$`
- `$defs.confidence`: enum `high|medium|low`
- `$defs.id`: string, pattern `^[A-Za-z0-9]+(-[A-Za-z0-9]+)*(--[a-z0-9]+(-[a-z0-9]+)*)?$`
- inventory: `{ version: 1 (const), screens: [ { id, route: string|null, kind: page|modal|popup, parentId?, files: string[] (minItems 1), menuPath?: string[], evidence, source: pattern ^(detector:[a-z0-9-]+|agent|crawl)$ } ] }`, 화면 객체 `additionalProperties: false`, `kind != page`이면 `parentId` 필수, `kind == page`이면 `route`가 string
- screen: 스펙 7장 예시 구조 그대로. `id`, `kind`, `parentId?`, `route: string|null`, `title {value, evidence}`, `menuPath? {value: string[], evidence}`, `purpose {value, evidence, confidence}`, `roles[] {value, evidence, confidence}`, `sections[] {title, evidence}`, `fields[] {label, type, required: boolean, section?, evidence, confidence}`, `actions[] {label, effect, navigatesTo?: id, opens?: id, evidence, confidence}`, `messages[] {text, when, evidence}`, `unknowns: string[]`, `readFiles: string[] (minItems 1)`, `sourceHash`. `fields[].type` enum: `text textarea number date select checkbox radio file password email other`. 모든 객체 `additionalProperties: false`. `kind`/`parentId` 규칙은 inventory와 동일

- [ ] **Step 1: Write the failing tests** — 유효 샘플 각 1개(테스트 파일 안에 최소 객체로 정의) + 실패 사례:
  - `validateScreen(유효샘플).valid === true`
  - `fields[0].evidence` 삭제 → invalid, errors에 `evidence` 포함
  - `confidence: 'unknown'` → invalid
  - `kind: 'modal'`인데 `parentId` 없음 → invalid
  - `sourceHash: 'abc'` → invalid
  - `evidence: 'C:\\src\\a.ts:3'` → invalid
  - 알 수 없는 필드 `foo` 추가 → invalid
  - `validateInventory`: `source: 'guess'` → invalid, `files: []` → invalid
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — 스키마 두 파일 작성, `schema.mjs`는 스키마를 `import.meta.url` 기준으로 읽어 ajv로 한 번만 컴파일. `references/schema.md`에 항목별 설명과 위 ID·근거 규칙을 사람용으로 정리
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: inventory·screen JSON 스키마와 검증기`

---

### Task 5: 근거 검사

**Files:**
- Create: `skills/docent/scripts/src/lib/evidence.mjs`
- Test: `tests/lib/evidence.test.mjs`

**Interfaces:**
- Produces:
  - `parseEvidence(s: string): { file: string, startLine: number, endLine: number } | { file: string, symbol: string }` — 형식 오류면 `Error`
  - `checkEvidence(rootDir: string, evidence: string, opts?: { expectText?: string }): Promise<{ ok: true } | { ok: false, reason: string }>`
  - 상수 `TEXT_WINDOW = 5`
- M2의 `validate.mjs`가 그대로 재사용한다.

규칙: 파일은 `rootDir` 안이어야 함(절대 경로·`..`로 벗어남·역슬래시 → 읽지 않고 `ok:false`), 파일 존재, `1 <= startLine <= endLine <= 줄 수`, symbol 형식이면 파일에 그 식별자가 단어 경계로 존재. `expectText`가 있으면 `[startLine-5, endLine+5]` 범위(symbol이면 파일 전체)에 그 텍스트가 부분 문자열로 존재. 줄은 `/\r?\n/`로 나눈다.

- [ ] **Step 1: Write the failing tests** (임시 디렉터리에 `page.tsx` 10줄, 7번째 줄 `<button>저장</button>`, 다른 파일은 CRLF로 같은 내용)
  - `parseEvidence('a/b.tsx:3')` → `{file:'a/b.tsx', startLine:3, endLine:3}`; `'a.ts:3-7'` → 3,7; `'a.ts:btnSave_Click'` → `{symbol:'btnSave_Click'}`
  - `checkEvidence(dir, 'page.tsx:7', {expectText:'저장'})` → ok
  - `'page.tsx:2'`, expectText `'저장'` → ok (±5 이내); `'page.tsx:1'` → `ok:false`
  - CRLF 파일 같은 검사 → ok
  - `'page.tsx:11'`, `'page.tsx:0'`, `'page.tsx:5-3'` → ok:false
  - `'../outside.ts:1'`, `'/etc/passwd:1'` → ok:false, reason에 `root` 포함, 그리고 해당 파일을 실제로 읽지 않음(루트 밖에 만든 파일이 있어도 ok:false)
  - `'missing.tsx:1'` → ok:false, reason에 `missing.tsx`
  - symbol: 파일에 `function handleSave` 있을 때 `'page.tsx:handleSave'` ok, `'page.tsx:handleSav'` ok:false
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — `path.resolve(rootDir, file)`가 `path.resolve(rootDir) + path.sep`로 시작하는지로 루트 검사
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 근거 위치·문구 검사`

---

### Task 6: Next.js 픽스처 앱

**Files:**
- Create: `fixtures/nextjs-sample/` (Next.js 15 App Router, TypeScript, 의존성은 `next`, `react`, `react-dom`, `zod`만), `fixtures/nextjs-sample/package-lock.json`
- Modify: `.github/workflows/test.yml` (픽스처 빌드 job 추가)

**Interfaces:**
- Produces: 아래 화면을 가진 실행 가능한 앱. Task 7의 골든이 이 앱의 파일:라인을 근거로 쓴다. M3에서 `npm run dev`로 띄워 캡처한다.

외부 DB·네트워크 없이 동작해야 한다: 데이터는 `lib/store.ts`의 메모리 배열(주문 3건·거래처 5곳·사용자 2명 시드). 로그인은 고정 계정 두 개(`user`/`user1234` → 역할 `영업담당`, `admin`/`admin1234` → `관리자`)이고 `role` 쿠키를 설정한다. `middleware.ts`가 미로그인 시 `/login`으로, `/admin/*`은 `관리자`가 아니면 `/`로 보낸다. 메뉴는 `components/nav.tsx` 한 곳: 대시보드 / 주문관리 › 주문 목록, 주문 등록 / 관리자 › 사용자 관리. 폼은 HTML form + 서버 액션 + zod.

| 라우트 | 화면 | 반드시 있어야 하는 요소 (문구 그대로) |
| --- | --- | --- |
| `/login` | 로그인 | 입력 `아이디`(text, 필수), `비밀번호`(password, 필수) / 버튼 `로그인` → `/` / 실패 메시지 `아이디 또는 비밀번호가 올바르지 않습니다.` |
| `/` | 대시보드 | 오늘 주문 수 카드, `주문 목록`·`주문 등록` 링크 |
| `/orders` | 주문 목록 | 입력 `거래처명`(text), `상태`(select: 접수·출고·완료) / 버튼 `검색`, `신규 등록` → `/orders/new` / 행 클릭 → `/orders/[id]` |
| `/orders/new` | 주문 등록 | 입력 `거래처`(text, 읽기 전용, 필수), `납기일`(date, 필수), `수량`(number, 필수, 1 이상), `비고`(textarea) / 버튼 `거래처 찾기`(모달 열기), `저장` → 저장 후 `/orders?saved=1` / 메시지 `저장되었습니다.`(목록에서 표시), `납기일을 입력하세요.`, `수량은 1 이상이어야 합니다.` / 저장 액션은 `lib/credit.ts`의 `checkCredit()`을 호출하는데, 이 함수는 외부 여신 API를 흉내 낸 스텁이라 판정 규칙이 코드에 드러나지 않는다(골든에서 `unknowns` + low confidence가 되어야 함) |
| 모달 (주문 등록 내부) | 거래처 찾기 | 입력 `거래처명 검색`(text) / 버튼 `선택` → 부모 폼의 `거래처`에 값 채움 |
| `/orders/[id]` | 주문 상세 | 주문 정보 표시 / 버튼 `수정` → `/orders/[id]/edit`, `삭제` → 확인창 `삭제하시겠습니까?` 후 삭제하고 `/orders` |
| `/orders/[id]/edit` | 주문 수정 | 주문 등록과 같은 입력 항목(거래처 찾기 제외, 거래처는 표시만) / 버튼 `저장` → `/orders/[id]` / 메시지 `수정되었습니다.` |
| `/admin/users` | 사용자 관리 | 사용자 표, 행마다 `권한`(select: 영업담당·관리자) / 버튼 `저장` / 메시지 `권한이 변경되었습니다.` / 관리자만 접근 |

- [ ] **Step 1: Write the app** — 위 표와 제약대로
- [ ] **Step 2: Verify build** — `cd fixtures/nextjs-sample && npm install && npm run build` → 빌드 성공, 경고 외 오류 없음
- [ ] **Step 3: Verify behaviour by hand** — `npm run start` 후 `curl -s -o /dev/null -w '%{http_code}' localhost:3000/orders` → `307`(로그인으로 리다이렉트); `curl -s localhost:3000/login | grep -c '아이디'` → 1 이상
- [ ] **Step 4: Add CI job** — `fixture-build`: `working-directory: fixtures/nextjs-sample`, `npm ci && npm run build`
- [ ] **Step 5: Commit** — `test: Next.js 픽스처 앱 추가` (`node_modules`·`.next`는 픽스처 `.gitignore`로 제외)

---

### Task 7: 골든 기대 산출물과 골든 테스트

**Files:**
- Create: `fixtures/expected/nextjs-sample/inventory.json`, `fixtures/expected/nextjs-sample/screens/{login,home,orders,orders-new,orders-new--customer-search,orders-id,orders-id-edit,admin-users}.json`
- Test: `tests/golden-nextjs.test.mjs`

**Interfaces:**
- Consumes: `assignIds`, `childId` (Task 2), `hashFiles` (Task 3), `validateInventory`, `validateScreen` (Task 4), `checkEvidence` (Task 5)
- Produces: M2 분석 결과와 비교할 기준 파일. 이후 픽스처를 고치면 이 골든도 함께 고쳐야 하며 테스트가 그걸 강제한다.

골든 작성 규칙: 픽스처 소스를 직접 읽고 사람이 쓴다. inventory의 `files`는 페이지 파일 + 그 파일이 직접 import하는 픽스처 내부 파일(1단계). screen의 `readFiles`는 그 화면을 설명하는 데 실제로 필요한 파일 전부(`middleware.ts`, `components/nav.tsx`, `lib/credit.ts` 등 포함). `evidence`는 정확한 줄. `source`는 page는 `detector:nextjs`, 모달은 `agent`.

- [ ] **Step 1: Write the failing test** — `tests/golden-nextjs.test.mjs` (`ROOT = 'fixtures/nextjs-sample'`, `EXP = 'fixtures/expected/nextjs-sample'`)
  - `inventory가 스키마를 통과한다`
  - `모든 screen 파일이 스키마를 통과하고, 파일명 = id`
  - `inventory의 id 집합 = screens 폴더의 id 집합`, 그리고 총 8개(page 7, modal 1)
  - `page의 id = assignIds(전체 page route)의 결과`, `modal의 id = childId(parentId, …)` 형식이며 parentId가 존재
  - `navigatesTo·opens가 가리키는 id가 모두 존재`
  - `모든 evidence가 checkEvidence를 통과` — `fields[].label`, `actions[].label`, `messages[].text`는 `expectText`로 함께 검사
  - `sourceHash = hashFiles(ROOT, readFiles)`
  - `orders-new에 low confidence 항목이 하나 이상 있고 unknowns에 여신 관련 항목이 있다` (`/여신/`)
  - `admin-users.roles[0].evidence가 middleware.ts를 가리킨다`
  - `워크플로우 연결`: navigatesTo 간선에 `orders→orders-new`, `orders-new→orders`, `orders→orders-id`, `orders-id→orders-id-edit`, `orders-id-edit→orders-id`, `login→home`이 모두 있다
- [ ] **Step 2: Run** — `node --test tests/golden-nextjs.test.mjs` → FAIL (골든 없음)
- [ ] **Step 3: Write the golden files** — 위 규칙대로 8개 + inventory. `sourceHash`는 `node -e`로 `hashFiles`를 호출해 채운다
- [ ] **Step 4: Run** — `npm test` → 전체 PASS
- [ ] **Step 5: Commit** — `test: Next.js 픽스처 골든 산출물과 골든 테스트`

---

## 이 계획 다음

M2(소스 기반 산출물: init·inventory·analyze·review·validate·HTML/README 렌더링)는 이 계획이 끝난 뒤 별도 계획으로 쓴다. M2의 `validate.mjs`는 Task 4·5의 라이브러리를, inventory 감지기는 Task 2의 ID 규칙을, 결과 비교는 Task 7의 골든을 그대로 쓴다.
