---
name: docent
description: 웹앱 프로젝트의 소스를 분석해 화면 목록, 화면별 매뉴얼, 프로젝트 소개, 워크플로우(HTML)와 소개 README를 만든다. 사용자가 매뉴얼·화면 목록·사용 설명서·산출물 문서·시스템 소개를 만들어 달라고 할 때 사용한다.
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
- 서브에이전트 지시는 `<SKILL_DIR>/agents/`에 있습니다. 서브에이전트를 부를 때는 **항상 프로젝트 루트, `SKILL_DIR`, `DOCENT`를 절대 경로로 함께 전달**합니다. 서브에이전트는 환경변수나 상대 경로를 알지 못합니다.

| 명령 | 하는 일 |
| --- | --- |
| `$DOCENT init` | `.docent/config.yaml`, `.docent/.gitignore` 생성(있으면 유지), 프레임워크 감지 |
| `$DOCENT inventory` | 감지기 결과 + `.docent/inventory.agent.json`을 합쳐 `.docent/inventory.json` 작성 |
| `$DOCENT pending` | 다시 분석할 화면 목록(분석 결과 없음·소스 변경·사용자가 답한 확인 항목) |
| `$DOCENT hash <파일…>` | 화면 JSON의 `sourceHash` 값 계산 |
| `$DOCENT validate` | 스키마·근거·연결·해시 검사 (문제 있으면 exit 1) |
| `$DOCENT review` | 확인 필요 항목을 `.docent/review.md`로 정리(사용자 답 보존) |
| `$DOCENT build` | `.docent/out/html/`(소개·화면 목록·화면별 매뉴얼·워크플로우)와 `.docent/out/README.md` 생성 |
| `$DOCENT session start` / `end` | 분석 세션 표시(비밀 파일 차단 훅이 이때만 동작) |

## 전체 실행 (`/docent`)

### 0. 시작

`$DOCENT session start`. 끝나거나 중단할 때 반드시 `$DOCENT session end`.

### 1. 준비

`$DOCENT init`. 감지된 프레임워크가 없으면 "감지기가 없는 스택이라 에이전트가 화면을 찾는다"고 알립니다.

### 2. 화면 목록

1. `$DOCENT inventory`를 실행합니다
2. 감지기가 없거나, 메뉴·링크를 보니 빠진 화면이 의심되면 `route-explorer` 에이전트(서브에이전트가 없으면 `<SKILL_DIR>/agents/route-explorer.md`의 지시를 직접 수행)에 프로젝트 루트와 `DOCENT`를 전달해 `.docent/inventory.agent.json`을 쓰게 하고 `$DOCENT inventory`를 다시 실행합니다
3. 화면 목록(ID·경로)을 사용자에게 보여 주고 확인받습니다. 빼거나 더할 화면은 `config.yaml`의 `screens.exclude`/`include`, 화면 코드 체계가 있으면 `screens.idMap`으로 반영하고 다시 실행합니다
4. 화면이 50개를 넘으면 화면 수와 대략의 시간(화면당 1~2분)을 알리고 진행 여부를 확인받습니다. 일부만 하려면 `screens.include`로 좁힙니다

### 3. 화면 분석

1. 대상은 `$DOCENT pending`이 보여 주는 화면입니다: 분석 결과가 없거나, 소스가 바뀌었거나, 사용자가 `review.md`에 답을 달고 체크한 화면. (최신인 화면은 건너뛰므로 중단 후 다시 실행하면 이어서 진행됩니다.) `/docent-analyze <화면ID>`처럼 지정하면 그 화면, `all`이면 전체를 다시 분석합니다
2. 화면마다 `screen-analyzer` 서브에이전트를 호출합니다. 동시에 `config.yaml`의 `analyze.concurrency`개(기본 4)까지. 서브에이전트가 없는 에이전트는 `<SKILL_DIR>/agents/screen-analyzer.md`의 지시를 화면 하나씩 직접 수행합니다. 전달할 것: 프로젝트 루트, `SKILL_DIR`, `DOCENT`, 화면 ID와 inventory 항목, `review.md`에서 그 화면 key(`<화면ID>|…`)의 줄 중 사용자가 체크하고 답한 항목
3. 분석 중 하위 화면(자체 입력·버튼이 있는 모달·팝업) 후보가 보고되면 `.docent/inventory.agent.json`에 `{ "route": null, "kind": "modal", "parentRoute": "<부모 route>", "name": "<영문 이름>", "files": [...], "evidence": "<여는 지점>" }`로 추가하고 `$DOCENT inventory` 후 그 화면도 분석합니다
4. 분석이 끝난 화면의 `menuPath.value`는 `inventory.json`에도 반영됩니다(다음 `inventory` 실행 때 유지)

### 4. 소개·워크플로우

`summary-writer` 에이전트(또는 `<SKILL_DIR>/agents/summary-writer.md` 직접 수행)로 `.docent/summary.json`을 씁니다. 프로젝트 루트, `SKILL_DIR`, `DOCENT`를 전달합니다.

### 5. 검증과 확인 필요 정리

1. `$DOCENT validate`. 문제가 있는 화면만 다시 분석합니다(최대 2회). 그래도 남으면 문제 목록을 사용자에게 보여 줍니다
2. `$DOCENT review` → 확인 필요 항목 수를 알리고, 사용자가 `.docent/review.md`에 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영된다고 안내합니다

### 6. 산출물

`$DOCENT build` → `.docent/out/html/index.html`과 `.docent/out/README.md` 위치를 알립니다. 마지막으로 `$DOCENT session end`.

## 참고 문서

- `references/schema.md` — 중간 산출물 형식
- `references/writing-style.md` — 문체 규칙
- `agents/` — 서브에이전트 지시(`screen-analyzer`, `route-explorer`, `summary-writer`). Claude Code 플러그인에서는 같은 이름의 서브에이전트로 등록됩니다
