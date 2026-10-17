---
name: docent
description: 웹앱 프로젝트의 소스를 분석하고 앱을 띄워, 화면 목록, 화면별 매뉴얼(캡처·조작 GIF 포함), 프로젝트 소개, 워크플로우(HTML)와 소개 README를 만든다. 사용자가 매뉴얼·화면 목록·사용 설명서·산출물 문서·시스템 소개를 만들어 달라고 할 때 사용한다.
---

# docent

처음 보는 웹앱 프로젝트를 분석해 사람이 검토할 산출물 초안을 만듭니다. **결정적인 일은 CLI 스크립트가, 해석은 에이전트(당신과 서브에이전트)가** 맡습니다. 에이전트가 만든 결과는 항상 `.docent/` 아래 JSON 파일로 남기고, CLI가 검증·렌더링합니다.

## 가장 중요한 규칙

1. **근거 없는 내용은 쓰지 않습니다.** 모든 서술에는 소스 위치(`evidence`)가 있어야 합니다. 모르면 `confidence: low`와 `unknowns`로 남깁니다
2. **비밀 파일은 읽지 않습니다**: `.env`, `.env.*`(단 `.env.example`·`.sample`·`.template`은 가능), `appsettings*.json`, `web.config`, `*.pem`, `*.key`, `*.pfx`, `id_rsa*`, 그리고 `.docent/config.yaml`의 `secrets.paths`. 환경변수는 이름만 예시 파일이나 코드의 `process.env.X` 참조에서 확인합니다. (Claude Code에서는 훅이 막지만, 훅이 없는 에이전트도 이 규칙을 지킵니다)
3. **대상 프로젝트의 파일을 고치지 않습니다.** 쓰는 곳은 `.docent/`뿐입니다. 대상의 `README.md`도 건드리지 않습니다
4. 분석 중에는 소스가 대상 에이전트의 모델 API로 전송됩니다. 처음 실행할 때 사용자에게 한 번 알립니다

## CLI와 경로

- `SKILL_DIR`: 이 `SKILL.md`가 있는 폴더의 **절대 경로**. (Claude Code는 스킬을 불러올 때 이 폴더를 "Base directory"로 알려 줍니다.)
- `DOCENT`: `node <SKILL_DIR>/scripts/dist/docent.mjs` — 모든 명령은 대상 프로젝트 루트에서 실행하거나 `--project <경로>`를 붙입니다. Node.js 20.10 이상이 필요합니다.
- Playwright가 필요한 명령(`run`의 자동 실행 확인 제외, `auth`·`crawl`·`capture`·`record`)은 Playwright가 없으면 exit 3으로 끝납니다. 이때는 사용자에게 설치 동의를 받고 `$DOCENT runtime install`을 실행하거나, 캡처 없이 진행합니다.
- 서브에이전트 지시는 `<SKILL_DIR>/agents/`에 있습니다. 서브에이전트를 부를 때는 **항상 프로젝트 루트, `SKILL_DIR`, `DOCENT`를 절대 경로로 함께 전달**합니다. 서브에이전트는 환경변수나 상대 경로를 알지 못합니다.

| 명령 | 하는 일 |
| --- | --- |
| `$DOCENT init [--app <폴더>]` | `.docent/config.yaml`, `.docent/.gitignore` 생성(있으면 유지), 프레임워크 감지. `--app`은 모노레포에서 문서로 만들 앱 폴더 |
| `$DOCENT inventory` | 감지기 결과 + `.docent/inventory.agent.json`을 합쳐 `.docent/inventory.json` 작성 |
| `$DOCENT update` | 코드가 바뀐 뒤 계획: 새 화면, 삭제 후보, 다시 분석·시나리오·캡처할 화면 |
| `$DOCENT pending` | 다시 분석할 화면 목록(분석 결과 없음·소스 변경·사용자가 답한 확인 항목) |
| `$DOCENT hash <파일…>` | 화면 JSON의 `sourceHash` 값 계산 |
| `$DOCENT validate [화면ID…]` | 스키마·근거·연결·해시 검사 (문제 있으면 exit 1). 화면 ID를 주면 그 화면 문제만 |
| `$DOCENT review` | 확인 필요 항목을 `.docent/review.md`로 정리(사용자 답 보존) |
| `$DOCENT build [--preset delivery\|handover\|portfolio] [--format html,readme,pdf,pptx]` | `.docent/out/html/`(소개·화면 목록·화면별 매뉴얼·워크플로우)와 `.docent/out/README.md` 생성 |
| `$DOCENT session start` / `end` | 분석 세션 표시(비밀 파일 차단 훅이 이때만 동작) |
| `$DOCENT runtime status` / `install` | 캡처용 Playwright·Chromium 확인 / 설치(**사용자 동의 후**, `~/.cache/docent/runtime`) |
| `$DOCENT run approve` | 사용자가 동의한 `run.json` 명령을 이 컴퓨터에서 승인(승인 전에는 실행하지 않음) |
| `$DOCENT run start [--install]` / `stop` / `status` | `.docent/run.json`대로 대상 앱 실행·중지·확인 |
| `$DOCENT auth login` / `save` | 로그인 상태 저장(login: `config.yaml`의 `auth` + 계정 환경변수, save: 사용자가 브라우저에서 직접 로그인) |
| `$DOCENT crawl` | 실행 중인 앱을 링크로 돌며 화면 목록과 대조(`.docent/crawl.json`, review.md에 반영) |
| `$DOCENT scenarios` | 시나리오를 (다시) 써야 하는 화면(캡처 경로 필요·GIF 대상·낡음) |
| `$DOCENT capture [id…]` / `record [id…]` | 화면 캡처(`.docent/media/img`) / 조작 GIF(`.docent/media/gif`) |

## 전체 실행 (`/docent`)

### 0. 시작

`$DOCENT session start`. 끝나거나 중단할 때 반드시 `$DOCENT session end`.

### 1. 준비

`$DOCENT init`. 감지기는 `nextjs`(App·Pages Router), `react-router`(v6 코드 라우터·v7 `app/routes.ts`와 `flatRoutes()`·Remix v2 파일 이름 라우팅), `vue`(Vue Router·Nuxt, `srcDir`·`dir.pages` 포함), `sveltekit`입니다. 산출물 언어는 `config.yaml`의 `language`(`ko` 기본, `en` 영어)입니다. 사용자가 영어 문서를 원하면 `language: en`으로 바꿉니다(분석 전에 정해야 서술 항목도 그 언어로 씁니다). `$DOCENT`의 안내 문구도 이 언어를 따르며, 환경변수 `DOCENT_LANG`가 있으면 그것이 우선합니다. 모노레포라 루트에서 감지되지 않으면 `init`이 워크스페이스(`package.json` workspaces, `pnpm-workspace.yaml`, 설정이 없으면 `apps/*`·`packages/*`와 `frontend/`처럼 루트 바로 아래 폴더)에서 앱을 찾습니다. 하나면 `config.yaml`의 `app`으로 정하고, 여럿이면 후보 목록을 보여 주므로 어느 앱을 문서로 만들지 사용자에게 물어 `$DOCENT init --app <폴더>`로 다시 실행합니다(앱을 바꾸려면 `app`을 고칩니다). 여러 앱을 한 매뉴얼로 묶기를 원하면 아래 "여러 앱을 한 매뉴얼로"를 따릅니다. 감지기가 맞는 앱이 없으면 React·Vue 등을 쓰는 화면 앱 폴더를 후보로 고릅니다. `init`이 데스크톱 앱이라고 알리면: Electron은 6단계에서 `run.json`을 `mode: "electron"`으로 써 캡처·GIF를 만듭니다(`references/run-guide.md`의 Electron). Tauri는 화면 분석·산출물을 소스만으로 만들고 6단계를 건너뜁니다. 감지된 프레임워크가 없으면 "감지기가 없는 스택이라 에이전트가 화면을 찾는다"고 알립니다(Spring·WebForms·Django·PHP 등은 `<SKILL_DIR>/references/stacks/`의 힌트로 찾습니다).

### 여러 앱을 한 매뉴얼로

사용자 웹과 관리자 웹처럼 앱 여러 개를 매뉴얼 하나로 묶을 때:

1. 앱마다 짧은 작업 이름(소문자·숫자·`-`, 예: `web`, `admin`)을 정하고 `$DOCENT init --app <폴더> --workspace <이름>`을 실행합니다. 그 앱의 작업은 `.docent/apps/<이름>/`에 따로 생깁니다
2. 앱마다 2~6단계를 그대로 진행합니다. 이때 `DOCENT`는 `node <SKILL_DIR>/scripts/dist/docent.mjs --workspace <이름>`이고, 서브에이전트에 작업 폴더(`.docent/apps/<이름>/`)를 함께 전달합니다. 실행·캡처도 앱마다 따로 합니다(`run.json`도 앱마다)
3. 루트 `.docent/config.yaml`에 합칠 순서대로 적습니다. 산출물 언어·프리셋·테마·제목·`projectName`은 이 루트 설정을 따릅니다

   ```yaml
   language: ko
   combine:
     - workspace: web
       title: 사용자 웹   # 없으면 그 앱의 제품 이름
     - workspace: admin
       title: 관리자 웹
   ```

4. `$DOCENT build`(`--workspace` 없이)를 실행하면 앱마다 검증한 뒤 `.docent/out/`에 하나로 합칩니다. 화면 ID 앞에 작업 이름이 붙고(`web.orders`), 화면 목록은 앱별로 나뉘며, 메뉴 구조·기능·워크플로우 이름 앞에 앱 제목이 붙습니다. 앱을 넘나드는 워크플로우는 그리지 않습니다(앱마다 따로 검증)

### 2. 화면 목록

1. `$DOCENT inventory`를 실행합니다
2. 감지기가 없거나, `inventory`가 경로를 읽지 못한 라우트가 있다고 경고하거나(변수 경로·스프레드로 붙인 라우트 — 경고에 위치가 나옵니다), 메뉴·링크를 보니 빠진 화면이 의심되면 `route-explorer` 에이전트(서브에이전트가 없으면 `<SKILL_DIR>/agents/route-explorer.md`의 지시를 직접 수행)에 프로젝트 루트·`SKILL_DIR`·`DOCENT`(그리고 `config.yaml`에 `app`이 있으면 그 앱 폴더 — 그 안에서 찾되 경로는 프로젝트 루트 기준)를 전달해 `.docent/inventory.agent.json`을 쓰게 하고(스택별 힌트는 `<SKILL_DIR>/references/stacks/`) `$DOCENT inventory`를 다시 실행합니다
3. 화면 목록(ID·경로)을 사용자에게 보여 주고 확인받습니다. 빼거나 더할 화면은 `config.yaml`의 `screens.exclude`/`include`, 화면 코드 체계가 있으면 `screens.idMap`으로 반영하고 다시 실행합니다. 메뉴·링크 어디에서도 들어가지 않는 인쇄·PDF 생성 전용 화면(`/export/*`, `/print/*` 등), 관리용 숨은 화면은 매뉴얼 대상인지 물어보고 아니면 `screens.exclude`를 제안합니다. 감지기는 라우트에 연결된 컴포넌트를 모두 화면으로 세므로, 다른 화면으로 보내기만 하는 경로(`/` → 권한별 첫 메뉴로 이동하는 컴포넌트)와 준비 중 안내만 그리는 경로도 목록에 나옵니다. 라우트 파일에서 그런 컴포넌트가 보이면 빼자고 제안하고, 화면 분석 중 에이전트가 "이동만 하는 화면"이라고 보고해도 `screens.exclude`로 뺍니다
4. 화면이 50개를 넘으면 화면 수와 대략의 시간(화면당 1~2분)을 알리고 진행 여부를 확인받습니다. 일부만 하려면 `screens.include`로 좁힙니다

### 3. 화면 분석

1. 대상은 `$DOCENT pending`이 보여 주는 화면입니다: 분석 결과가 없거나, 소스가 바뀌었거나, docent를 올린 뒤 검사가 엄격해져 예전 분석이 맞지 않거나, 사용자가 `review.md`에 답을 달고 체크한 화면. (최신인 화면은 건너뛰므로 중단 후 다시 실행하면 이어서 진행됩니다.) `/docent-analyze <화면ID>`처럼 지정하면 그 화면, `all`이면 전체를 다시 분석합니다
2. 화면마다 `screen-analyzer` 서브에이전트를 호출합니다. 동시에 `config.yaml`의 `analyze.concurrency`개(기본 4)까지. 서브에이전트가 없는 에이전트는 `<SKILL_DIR>/agents/screen-analyzer.md`의 지시를 화면 하나씩 직접 수행합니다. 전달할 것: 프로젝트 루트, `SKILL_DIR`, `DOCENT`, 화면 ID와 inventory 항목, `review.md`에서 그 화면 key(`<화면ID>|…`)의 줄 중 사용자가 체크하고 답한 항목
3. 분석 중 하위 화면(자체 입력·버튼이 있는 모달·팝업) 후보가 보고되면 `.docent/inventory.agent.json`에 `{ "route": null, "kind": "modal", "parentRoute": "<부모 route>", "name": "<영문 이름>", "files": [...], "evidence": "<여는 지점>" }`로 추가하고 `$DOCENT inventory` 후 그 화면도 분석합니다
4. 분석이 끝난 화면의 `menuPath.value`는 `inventory.json`에도 반영됩니다(다음 `inventory` 실행 때 유지)

### 4. 소개·워크플로우

`summary-writer` 에이전트(또는 `<SKILL_DIR>/agents/summary-writer.md` 직접 수행)로 `.docent/summary.json`을 씁니다. 프로젝트 루트, `SKILL_DIR`, `DOCENT`를 전달합니다.

### 5. 검증과 확인 필요 정리

1. `$DOCENT validate`. 문제가 있는 화면만 다시 분석합니다(최대 2회). 그래도 남으면 문제 목록을 사용자에게 보여 줍니다
2. `$DOCENT review` → 확인 필요 항목 수를 알리고, 사용자가 `.docent/review.md`에 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영된다고 안내합니다

### 6. 실행·캡처 (선택 — 안 되면 건너뜀)

캡처·GIF는 앱이 실제로 떠야 만들 수 있습니다. 어느 단계든 끝내 안 되면 건너뛰고 7단계로 갑니다(산출물에 "캡처 없이 소스만으로 만들었습니다"가 표시됩니다).

1. **준비**: `$DOCENT runtime status`. 없으면 "화면 캡처를 위해 Playwright와 Chromium(약 150MB)을 `~/.cache/docent/runtime`에 설치해도 될까요?"라고 묻고, 동의하면 `$DOCENT runtime install`
2. **실행 계획**: `.docent/run.json`이 없으면 `<SKILL_DIR>/references/run-guide.md`대로 실행 계획을 만들어 씁니다. 이미 있으면(레포에 커밋돼 있던 것 포함) 그 내용을 씁니다. 어느 쪽이든 `install`·`start`·`cwd`·`env`를 **사용자에게 그대로 보여 주고 동의를 받은 뒤** `$DOCENT run approve` → `$DOCENT run start --install`. 승인되지 않은 명령은 CLI가 실행하지 않습니다(명령이 바뀌면 다시 승인 필요). 동의하지 않으면 사용자가 띄운 앱 주소를 받아 `{ "mode": "url", "baseUrl": … }`로 씁니다(주소 모드는 승인 불필요)
3. **실패하면**: 출력된 `run.log` 내용으로 무엇이 부족한지(환경변수 이름, DB, 포트) 구체적으로 알리고, 앱을 직접 띄운 주소를 받아 `mode: url`로 바꿔 다시 `$DOCENT run start`
4. **로그인**: 로그인이 필요한 앱이면 `config.yaml`의 `auth`(형식은 `run-guide.md`의 "config.yaml 항목")에 로그인 화면 라벨·버튼과 계정 환경변수 이름을 적고(값은 사용자가 셸에 설정), `$DOCENT auth login`. 화면이 있는 환경이면 `$DOCENT auth save`로 사용자가 직접 로그인해도 됩니다. 테스트 계정을 쓰도록 안내합니다
5. **대조**: `$DOCENT crawl` — 화면 목록에 없는 경로·도달하지 못한 화면을 사용자에게 알립니다(review.md에도 들어감). 빠진 화면이 진짜 화면이면 2단계(화면 목록)로 돌아가 추가합니다
6. **시나리오**: `$DOCENT scenarios`가 보여 주는 화면마다 `scenario-writer` 서브에이전트(또는 `<SKILL_DIR>/agents/scenario-writer.md` 직접 수행)에 프로젝트 루트·`SKILL_DIR`·`DOCENT`·화면 ID·이유·실행 중인 앱 주소(`$DOCENT run status`의 주소)를 전달해 시나리오를 쓰게 합니다
7. **캡처·녹화**: `$DOCENT capture` → `$DOCENT record`. 실패 항목은 review.md에 모입니다. 실패한 화면을 그럴듯하게 대신 만들지 않습니다
8. **정리**: docent가 띄운 앱이면 `$DOCENT run stop`

### 7. 산출물

1. 사용자에게 **받는 사람**과 **형식**을 묻습니다(처음 한 번, 이후 `config.yaml`의 `output`에 저장)
   - 받는 사람 → 프리셋: 고객사·발주처 납품 = `delivery`(표지·목차·개정 이력, 근거 주석 제거), 팀 내부 인수인계 = `handover`(근거 주석·소스 파일 목록 유지), 외부 공개·포트폴리오 = `portfolio`(소개·GIF 중심, 화면은 카드)
   - 형식: `html`, `readme`, `pdf`, `pptx` 중 여럿
   - 납품용이면 `output.title`·`output.organization`·`output.revisions`(버전·날짜·작성자·내용)도 묻습니다
   - 색 테마(`output.theme`: indigo·blue·emerald·rose·slate, 기본 indigo)와 산출물에 보일 이름(`output.projectName`, 비우면 앱의 제품 이름·package.json name)을 원하면 `config.yaml`에 적습니다. 모노레포에서 루트 패키지 이름이 내부 이름이면 `projectName`을 권합니다
2. `$DOCENT build --preset <프리셋> --format <형식,…>`
3. 경고가 나오면 그대로 전합니다. 특히 납품용에서 "확인 필요 항목 N건"이 나오면 `.docent/review.md`를 먼저 처리하도록 권합니다. PDF가 건너뛰어졌으면(Playwright 없음) 설치 동의를 받아 `$DOCENT runtime install` 후 다시 build
4. 결과 위치(`.docent/out/html/index.html`, `.docent/out/README.md`, `.docent/out/<output.title에서 공백을 뺀 이름>.pdf`·`.pptx`, 기본 `사용자매뉴얼`, 영어면 `UserManual`)를 알리고 `$DOCENT session end`

## 갱신 (`/docent-update`)

코드가 바뀐 뒤 바뀐 화면만 다시 처리합니다.

1. `$DOCENT session start` → `$DOCENT update`로 계획을 봅니다
2. **삭제 후보**(라우트가 사라진 화면)가 남아 있으면 `validate`·`build`가 실패합니다("분석 결과는 있지만 inventory에 없습니다"). 사용자에게 보여 주고, 지워도 된다고 하면 `.docent/screens/<id>.json`, `.docent/scenarios/<id>.json`, `.docent/media/*/<id>.*`를 지우고 `summary.json`에서 그 화면을 뺍니다(summary-writer로 다시 써도 됨)
3. **다시 분석** 화면마다 screen-analyzer(3단계와 같음) → `$DOCENT validate`. 이유가 "삭제된 화면 참조"인 화면은 사라진 화면으로 가는 버튼·연결을 실제 소스대로 고칩니다
4. 화면이 바뀌었으면 summary-writer로 소개·워크플로우를 다시 씁니다
5. **시나리오 작성** 화면마다 scenario-writer → 앱이 떠 있으면(6단계) `$DOCENT capture <다시 캡처 화면…>`·`$DOCENT record`
6. `$DOCENT review` → `$DOCENT build`(지난번과 같은 프리셋·형식) → `$DOCENT session end`

## 참고 문서

- `references/schema.md` — 중간 산출물 형식
- `references/writing-style.md` — 문체 규칙
- `references/run-guide.md` — 앱 실행 계획 만드는 법
- `references/stacks/` — 감지기가 없는 스택(Spring MVC, ASP.NET WebForms, Django·Flask, PHP, 그 밖의 JS 라우터)에서 화면을 찾고 읽는 힌트
- `agents/` — 서브에이전트 지시(`screen-analyzer`, `route-explorer`, `summary-writer`, `scenario-writer`). Claude Code 플러그인에서는 같은 이름의 서브에이전트로 등록됩니다
