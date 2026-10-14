# docent M4 형식·프리셋·증분 갱신 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 분석 결과로 용도 프리셋(납품·인수인계·포트폴리오)에 맞춘 HTML·PDF·PPT를 만들고, 코드가 바뀌었을 때 바뀐 화면만 다시 분석·캡처하는 증분 갱신 흐름을 갖춘다.

**Architecture:** `build`에 `--preset`과 `--format`을 더한다. HTML은 프리셋별로 렌더러 옵션만 바꾸고, PDF는 모든 내용을 한 문서로 이은 인쇄용 HTML(`print.html`)을 Playwright로 인쇄한다. PPT는 pptxgenjs(번들)로 만들고, 워크플로우 다이어그램은 Playwright로 로컬 Mermaid를 PNG로 렌더링해 넣는다. 증분 갱신은 결정적인 계획(`docent update`)만 CLI가 만들고, 재분석·재캡처 실행은 SKILL 흐름이 맡는다.

**Tech Stack:** Node.js 20.10+ ESM, `node:test`, pptxgenjs 4.0.1(번들), Playwright 1.56.1(런타임 로드), mermaid(로컬 자산)

**Spec:** `docs/superpowers/specs/2026-10-13-docent-design.md` — 3장(용도 프리셋), 10장(렌더링), 13장(증분 갱신), 16장 **M4**. M2·M3 계획의 렌더러·CLI·media를 확장한다.

## Global Constraints

- 프리셋: `delivery`(납품용) / `handover`(인수인계용, 기본값) / `portfolio`(포트폴리오용)
  - `delivery`: 표지·목차·개정 이력, 근거 주석(`<!-- evidence: … -->`, `<!-- screens: … -->`) 제거, `[확인 필요]`가 남아 있으면 build가 경고(건수)하고 결과에 `warnings`로 돌려준다. `[확인 필요]` 표시 자체는 숨기지 않는다
  - `handover`: 지금(M3)의 출력 + 화면별 페이지에 "소스 파일" 목록(inventory `files`)
  - `portfolio`: 근거 주석 제거, 화면별 상세 페이지를 만들지 않고 화면 목록을 캡처·목적 카드로, 미리보기 GIF 최대 6개(README도 6개)
- 형식: `html`, `readme`, `pdf`, `pptx`. 기본 `config.yaml`의 `output.formats`(기본 `[html, readme]`), CLI `--format html,pdf`가 우선
- 파일 이름: `out/html/`, `out/README.md`, `out/사용자매뉴얼.pdf`, `out/사용자매뉴얼.pptx`(`config.yaml`의 `output.title`이 있으면 그 이름)
- 같은 입력이면 HTML·README는 바이트 동일(기존 규칙). PDF·PPTX는 내용 동일(생성 시각 메타데이터는 `projectDate` 사용)
- PDF·PPTX 다이어그램은 Playwright가 필요하다. Playwright가 없으면 PDF는 건너뛰고(경고), PPTX는 다이어그램 대신 단계 목록 텍스트로 만든다(경고)
- Mermaid 노드 ID는 `s_` 접두어를 붙여 예약어(`end`, `class`, `style` 등)와 충돌하지 않게 한다(M2 deferred minor)
- `config.yaml` 새 항목(기본값): `output: { preset: handover, formats: [html, readme], title: 사용자 매뉴얼, organization: "", revisions: [] }`. `revisions` 항목은 `{ version, date, author, note }`
- 기존 테스트는 계속 통과해야 한다

## Review Focus

1. **화면 수가 많을 때** — 화면 60개짜리 입력으로 PDF·PPTX를 만들어도 시간 안(각 60초)에 끝나고, PPT 슬라이드가 화면마다 1장 이상, 입력 항목이 많은 화면은 다음 장으로 넘어가 글자가 슬라이드 밖으로 나가지 않아야 한다. → Task 6 테스트
2. **캡처가 없는 화면·프로젝트** — 이미지가 없는 화면도 PDF·PPT 슬라이드가 깨지지 않고 "캡처 없음" 자리 표시가 나와야 한다. → Task 4·6 테스트
3. **근거 주석 제거의 범위** — delivery·portfolio에서 근거 주석은 모두 사라지지만, 본문 문구에 `<!--`가 들어간 경우(이스케이프된 텍스트)는 지워지지 않아야 한다. → Task 2 테스트
4. **증분 갱신 중 사라진 화면** — 라우트가 삭제된 화면의 screens·scenarios·media는 자동으로 지우지 않고 "삭제 후보"로 보고해야 하며, build는 inventory에 없는 화면을 산출물에 넣지 않아야 한다. → Task 8 테스트
5. **개정 이력 입력 오류** — `revisions`에 필드가 빠지거나 문자열이 아니면 build가 config 오류로 멈추고 어느 항목인지 알려야 한다. → Task 1 테스트

---

## File Structure

```
skills/docent/scripts/src/
  lib/output-options.mjs     # config.output + CLI 인자 → { preset, formats, title, organization, revisions }
  renderers/html.mjs         # (수정) preset 옵션
  renderers/readme.mjs       # (수정) preset 옵션(미리보기 개수)
  renderers/print.mjs        # 인쇄용 단일 HTML
  renderers/pdf.mjs          # print.html → PDF (Playwright)
  renderers/diagrams.mjs     # Mermaid → PNG (Playwright)
  renderers/pptx.mjs         # pptxgenjs
  commands/build.mjs         # (수정) preset·format·warnings
  commands/update.mjs        # 증분 갱신 계획
commands/docent-update.md
```

---

### Task 1: 출력 옵션(config.output·CLI)

**Files:**
- Create: `lib/output-options.mjs`
- Modify: `lib/config.mjs`(기본값 `output`), `commands/init.mjs`(템플릿 주석에 output 예시), `docent.mjs`(`build --preset … --format …`)
- Test: `tests/lib/output-options.test.mjs`

**Interfaces:**
- Produces: `resolveOutputOptions(config, { preset?, formats? }): { preset, formats: string[], title, organization, revisions }` — CLI 값이 config보다 우선. 잘못된 preset·format이면 `Error`(허용 값 나열). `revisions` 각 항목은 `version`·`date`·`author`·`note`가 문자열이어야 하며, 아니면 `Error`(메시지에 `output.revisions[i]`와 빠진 필드). `formats`는 중복 제거, 순서 `html, readme, pdf, pptx`로 정렬
- `PRESETS = ['delivery', 'handover', 'portfolio']`, `FORMATS = ['html', 'readme', 'pdf', 'pptx']`
- CLI: `build [--preset <p>] [--format <a,b>]`

- [ ] **Step 1: Write the failing tests** — 기본값 `{ preset: 'handover', formats: ['html','readme'], title: '사용자 매뉴얼', organization: '', revisions: [] }`; CLI `{ preset: 'delivery', formats: ['pptx','html','html'] }` → `formats ['html','pptx']`; `preset: 'x'` → throws `/delivery, handover, portfolio/`; `revisions: [{ version: '1.0', date: '2026-10-14', author: '김' }]` → throws `/output\.revisions\[0\].*note/`; `revisions: [{ version: 1, … }]` → throws
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: 출력 옵션(프리셋·형식) 설정`

---

### Task 2: HTML 프리셋

**Files:**
- Modify: `renderers/html.mjs`, `renderers/readme.mjs`
- Test: `tests/renderers/html.test.mjs`, `tests/renderers/readme.test.mjs`(추가)

**Interfaces:**
- Consumes: `resolveOutputOptions` 결과(`options`)를 input에 `options`로 받는다(없으면 handover 기본)
- Produces:
  - `stripEvidence(html): string` — 정확히 `<!-- evidence: … -->`와 `<!-- screens: … -->` 형태의 주석만 제거(이스케이프된 본문 `&lt;!--`는 그대로)
  - `renderSite(input)`:
    - `delivery`: `index.html` 맨 앞에 표지 섹션(`<section class="cover">` 제목·조직·기준일), 목차(`<nav class="toc">` 소개·화면 목록·워크플로우·화면별 링크), 맨 끝에 `<section id="revisions">` 개정 이력 표(없으면 `{ version: '0.1', date: 기준일, author: '', note: '초안' }` 한 줄). 모든 파일에서 근거 주석 제거
    - `handover`: 화면별 페이지에 `<h2>소스 파일</h2>` + inventory `files` 목록(`<code>`)
    - `portfolio`: `screens/` 상세 페이지를 만들지 않음. `screens.html`은 카드(`<article class="card">` 제목·목적·캡처 썸네일·GIF가 있으면 GIF), 미리보기 GIF 최대 6개. 근거 주석 제거. 다른 페이지의 `screens/<id>.html` 링크는 `screens.html#<id>`로
  - `renderReadme(input)`: portfolio면 미리보기 최대 6개, delivery·portfolio면 근거 주석 제거
  - Mermaid 노드 ID `s_` 접두어(예: `s_orders --> s_orders_new`) — 기존 테스트의 기대값도 갱신

- [ ] **Step 1: Write the failing tests**
  - delivery: index에 `class="cover"`, `class="toc"`, `id="revisions"`, `초안`; 모든 파일에 `<!-- evidence:`·`<!-- screens:` 없음; 라벨에 `<!--x-->`가 든 화면은 출력에 `&lt;!--x--&gt;` 유지
  - `revisions` 지정 시 그 행들이 표에 나옴
  - handover: `screens/orders-new.html`에 `<h2>소스 파일</h2>`와 `<code>app/orders/new/page.tsx</code>`
  - portfolio: `screens/` 키 없음, `screens.html`에 카드 8개, 미리보기 GIF 6개 제한(7개 입력), 링크 `screens.html#orders-new`
  - 예약어: 화면 ID `end`인 workflow 단계 → `s_end`
  - README portfolio 미리보기 6개, delivery 근거 주석 없음
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS (기존 결정성 테스트 포함)
- [ ] **Step 5: Commit** — `feat: HTML 용도 프리셋`

---

### Task 3: 인쇄용 단일 HTML

**Files:**
- Create: `renderers/print.mjs`
- Test: `tests/renderers/print.test.mjs`

**Interfaces:**
- Consumes: Task 2의 input·options, `renderSite`의 부분 렌더 함수(필요하면 html.mjs에서 `renderScreenBody(input, entry)`, `renderIntroBody(input)`, `renderListBody(input)`, `renderWorkflowsBody(input)`를 export해 재사용)
- Produces: `renderPrint(input): string` — 하나의 HTML 문서(`print.html`, `out/html/`에 함께 저장). 순서: (delivery) 표지 → 목차 → 소개 → 화면 목록 → 워크플로우 → 화면별 상세(portfolio는 화면 카드) → (delivery) 개정 이력. 각 화면은 `<section class="screen" style="break-before: page">`. 이미지 경로는 `media/…`(html 폴더 기준). 캡처 없는 화면은 `<p class="no-shot">캡처 없음</p>`. Mermaid 스크립트 포함(`assets/mermaid.min.js`), 렌더 완료 시 `document.body.dataset.ready = '1'`

- [ ] **Step 1: Write the failing tests** — 골든 입력: `<section class="screen"` 8개, delivery면 `class="cover"`가 첫 섹션, 화면 순서 = inventory 순서, 캡처 없는 화면에 `캡처 없음`, `dataset.ready` 설정 스크립트 포함, 외부 URL 없음
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 인쇄용 단일 HTML`

---

### Task 4: PDF

**Files:**
- Create: `renderers/pdf.mjs`
- Test: `tests/renderers/pdf.test.mjs`

**Interfaces:**
- Consumes: `launchBrowser` (M3), `print.html`
- Produces: `renderPdf(printHtmlPath, outPath, { title, date }): Promise<void>` — `file://`로 열고 `body[data-ready="1"]`을 최대 20초 기다린 뒤 `page.pdf({ format: 'A4', printBackground: true, margin: 15mm, displayHeaderFooter: true, footerTemplate: 쪽 번호 "n / N", headerTemplate: 제목 })`

- [ ] **Step 1: Write the failing tests** — 골든 입력으로 print.html을 만들어 PDF 생성: `%PDF-`로 시작, `pdftoppm`이 없는 환경도 고려해 페이지 수는 PDF 안의 `/Type /Page` 개수로 확인(≥ 화면 수 + 3); 캡처 없는 입력에서도 성공; 화면 60개 합성 입력(골든 화면을 ID만 바꿔 복제)으로 60초 안에 성공
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: PDF 산출물`

---

### Task 5: 워크플로우 다이어그램 PNG

**Files:**
- Create: `renderers/diagrams.mjs`
- Modify: `renderers/html.mjs`(Mermaid 정의 생성 함수 `workflowMermaid(input, wf)`를 export해 공유)
- Test: `tests/renderers/diagrams.test.mjs`

**Interfaces:**
- Produces: `renderDiagrams(browser, input, { assetsDir }): Promise<Buffer[]>` — summary.workflows 순서대로 PNG. 빈 페이지에 mermaid 자산을 `addScriptTag({ path })`로 넣고 `mermaid.render`로 SVG를 만든 뒤 요소 스크린샷(배경 흰색, deviceScaleFactor 2)

- [ ] **Step 1: Write the failing tests** — 골든 입력(workflow 3개) → PNG 3개(시그니처 확인), 너비 > 200px(pngjs로 읽기); 화면 ID `end`가 들어간 workflow도 렌더 성공
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 워크플로우 다이어그램 PNG`

---

### Task 6: PPTX

**Files:**
- Create: `renderers/pptx.mjs`
- Modify: `package.json`(dependencies `pptxgenjs@4.0.1`)
- Test: `tests/renderers/pptx.test.mjs`

**Interfaces:**
- Consumes: input(options 포함), Task 5의 다이어그램 PNG(없으면 `undefined`), media 경로
- Produces: `renderPptx(input, { diagrams?: Buffer[], mediaDir }): Promise<Buffer>` — 16:9. 슬라이드: 표지(제목·프로젝트·조직·기준일) → 소개(한 줄 소개, 주요 기능) → 메뉴 구조(목록) → 워크플로우마다 1장(다이어그램 이미지, 없으면 단계 목록 텍스트 + 설명) → 화면마다 1장(제목·목적, 왼쪽 캡처 또는 "캡처 없음" 상자, 오른쪽 입력 항목·버튼 표 최대 8행; 넘치면 같은 제목 "(계속)" 슬라이드) → (delivery) 개정 이력 1장. portfolio는 화면 슬라이드를 GIF가 있는 화면만(GIF 이미지 그대로). 문서 속성: title, company(organization), 날짜는 `projectDate`

- [ ] **Step 1: Write the failing tests** — 결과를 JSZip(pptxgenjs 의존성)으로 열어 `ppt/slides/slideN.xml` 개수와 텍스트 확인:
  - 골든 handover(캡처 없음): 1+1+1+3+8 = 14장, 슬라이드 텍스트에 `주문 등록`, `캡처 없음`
  - delivery: 15장(개정 이력 포함)
  - 입력 항목 12개인 화면 → 그 화면 슬라이드 2장, 두 번째 제목에 `(계속)`
  - diagrams 없음 → 워크플로우 슬라이드 텍스트에 단계 화면 이름
  - 화면 60개 합성 입력 → 60초 안에 성공, 슬라이드 ≥ 63
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: PPTX 산출물`

---

### Task 7: build 통합

**Files:**
- Modify: `commands/build.mjs`, `docent.mjs`
- Test: `tests/commands/build.test.mjs`(추가), `tests/cli.test.mjs`(추가)

**Interfaces:**
- Produces: `runBuild(projectDir, { assetsDir, preset?, formats? }): Promise<{ files, warnings: string[], skipped: { format, reason }[] }>`
  - `resolveOutputOptions`로 옵션 결정, 선택한 형식만 생성
  - `pdf`·`pptx`: Playwright 브라우저를 한 번 띄워 다이어그램·PDF에 같이 쓴다. Playwright가 없으면 pdf는 skipped("Playwright 없음"), pptx는 다이어그램 없이 생성하고 warnings에 추가
  - delivery: `[확인 필요]` 건수(confidence low 항목 + unknowns)가 있으면 warnings `확인 필요 항목 N건이 남아 있습니다(.docent/review.md)`
  - 파일: `out/<title>.pdf`, `out/<title>.pptx`(title의 `/`·`\` 등 파일명 불가 문자는 `_`)
  - CLI: warnings·skipped를 출력하고 exit 0

- [ ] **Step 1: Write the failing tests** — 골든 사본: `formats: ['html','readme','pdf','pptx']` → `out/사용자매뉴얼.pdf`·`.pptx` 존재; delivery → warnings에 `2건`(골든의 low 1 + unknowns 1); `DOCENT_PLAYWRIGHT`·`DOCENT_RUNTIME_DIR`를 없는 경로로 + 로더가 local을 못 찾게 하는 대신 `runBuild`에 테스트용 `browserFactory`를 주입해 Playwright 없음 상황 재현 → pdf skipped, pptx 생성·warnings; CLI `build --preset portfolio --format html` → `out/html/screens/` 없음
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement** — `runBuild`의 옵션 인자에 `browserFactory`(기본 `launchBrowser`)를 받아 테스트에서 `PlaywrightMissing`을 던지게 한다
- [ ] **Step 4: Run** `npm run build && npm test` → PASS, 번들 결정성
- [ ] **Step 5: Commit** — `feat: build에 프리셋·PDF·PPTX 통합`

---

### Task 8: 증분 갱신(update)

**Files:**
- Create: `commands/update.mjs`, `commands/docent-update.md`(루트 `commands/`)
- Modify: `docent.mjs`, `skills/docent/SKILL.md`(갱신 흐름)
- Test: `tests/commands/update.test.mjs`

**Interfaces:**
- Consumes: `runInventory`, `runPending`(M2), `runScenarios`(M3), media
- Produces: `runUpdate(projectDir): Promise<{ added: string[], removed: string[], reanalyze: { id, reason }[], rescenario: { id, reason }[], recapture: string[] }>`
  - inventory를 다시 만들기 전 ID 집합과 비교해 `added`·`removed`
  - `removed`: inventory에서 빠졌는데 `screens/<id>.json`·`scenarios/<id>.json`·media가 남은 ID(자동 삭제하지 않음)
  - `reanalyze` = `runPending`, `rescenario` = `runScenarios`, `recapture` = reanalyze 중 `media/img/<id>.png`가 있는 ID
  - build·review는 inventory에 없는 화면을 이미 넣지 않는다(확인 테스트)
  - CLI `update`: 위 내용을 사람이 읽게 출력
  - SKILL.md "갱신(`/docent-update`)" 절: `update` → reanalyze 화면 screen-analyzer → validate → `scenarios`(낡음) scenario-writer → 앱이 떠 있으면 `capture <recapture…>`·`record` → review → build. removed는 사용자에게 보여 주고 지울지 묻는다

- [ ] **Step 1: Write the failing tests** — 골든 사본에서: 변화 없으면 모두 빈 배열; `lib/store.ts` 수정 → reanalyze에 store를 읽은 화면들, 그중 `media/img/orders.png`를 만들어 둔 `orders`만 recapture; `app/admin/users/page.tsx` 삭제 → removed `['admin-users']`, 그 screens 파일은 남아 있음, build 결과에 `admin-users` 페이지 없음; 새 페이지 `app/reports/page.tsx` 추가 → added `['reports']`, reanalyze에 `reports`(분석 결과 없음)
- [ ] **Step 2: Run** → FAIL
- [ ] **Step 3: Implement**
- [ ] **Step 4: Run** → PASS
- [ ] **Step 5: Commit** — `feat: 증분 갱신 계획(update)`

---

### Task 9: 문서와 실전 점검

**Files:**
- Modify: `skills/docent/SKILL.md`(7단계 산출물: 용도·형식을 사용자에게 묻고 build), `commands/docent-build.md`(인자 `[preset] [format…]`), `README.md`, `AGENTS.md`, `skills/docent/references/run-guide.md`(output 설정 예시 위치 안내)

- [ ] **Step 1: Write docs** — SKILL 7단계: 사용자에게 받는 사람(고객사 납품·팀 인수인계·외부 공개)과 형식(HTML·PDF·PPT)을 묻고 `build --preset … --format …`, delivery 경고가 있으면 review.md 안내
- [ ] **Step 2: 실전 점검(수동)** — M3 실전 점검 사본(분석·캡처·GIF 완료)에서 세 프리셋 × `html,readme,pdf,pptx` build. 확인: PDF를 `pdftoppm`으로 1·2·마지막 쪽 PNG로 바꿔 눈으로 확인(표지·목차·화면 캡처), PPTX를 `soffice --headless --convert-to pdf` 후 같은 방식으로 확인(다이어그램·캡처·표가 슬라이드 안에 있는지), portfolio HTML 카드 화면 스크린샷 확인. 그다음 픽스처 사본의 `lib/store.ts`를 고쳐 `update` 결과가 기대대로 나오는지 확인
- [ ] **Step 3: Commit** — `docs: 산출물 프리셋·형식과 갱신 흐름 안내`

---

## 이 계획 다음

M5(범용성: React Router·Vue·SvelteKit 감지기, Spring(JSP)·WebForms 픽스처, 스택별 탐색 힌트)는 별도 계획으로 쓴다. M2·M3에서 미룬 사소한 문제 중 남은 것은 M5 계획 첫 작업으로 정리한다.
