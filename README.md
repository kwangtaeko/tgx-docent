# docent

[English](README.en.md)

웹앱 프로젝트의 소스를 분석해 **화면 목록, 화면별 사용자 매뉴얼, 프로젝트 소개, 워크플로우**를 만드는 Claude Code 플러그인입니다. 필요하면 앱을 직접 띄워 **화면 캡처와 조작 GIF**까지 넣고, HTML·README·PDF·PPT로 내보냅니다. 모든 서술에 소스 근거(`파일:줄`)를 남기고, 소스만으로 확정할 수 없는 내용은 `[확인 필요]`로 표시합니다.

![산출물 소개 페이지](docs/assets/demo-index.png)

| 화면별 매뉴얼 | 조작 GIF |
| --- | --- |
| ![화면별 매뉴얼](docs/assets/demo-screen.png) | ![주문 등록 조작](docs/assets/demo.gif) |

<sub>예시는 이 레포의 샘플 앱(`fixtures/nextjs-sample`)으로 만들었습니다. `npm run demo`로 다시 만들 수 있습니다.</sub>

## 설치

```
/plugin marketplace add kwangtaeko/tgx-docent
/plugin install docent@tgx-docent
```

대상 프로젝트에서 `/docent`를 실행합니다. docent가 화면 목록을 보여 주고 확인을 받은 뒤 화면을 분석합니다. 앱 실행 계획(설치·실행 명령)을 보여 주고 동의를 받으면 앱을 띄워 캡처합니다. 마지막으로 산출물을 만듭니다.

## 산출물

- `.docent/out/html/index.html` — 소개·화면 목록·화면별 매뉴얼(캡처·조작 GIF)·워크플로우
- `.docent/out/README.md` — 처음 보는 사람을 위한 소개 README
- `.docent/out/사용자매뉴얼.pdf`, `.pptx` — PDF·PPT(요청 시. 파일 이름은 `output.title`에서 공백을 뺀 것, 영어 기본은 `UserManual.pdf`)
- `.docent/review.md` — 확인 필요 항목(답을 적고 `/docent-analyze`를 다시 실행)

용도에 맞춰 프리셋을 고릅니다.

- `delivery`(납품): 표지·목차·개정 이력
- `handover`(인수인계): 근거·소스 파일 유지
- `portfolio`(외부 공개): 소개·GIF 중심

`.docent/config.yaml`에서 언어(`language: ko | en`)와 색 테마(`output.theme: indigo | blue | emerald | rose | slate`)를 고릅니다. 언어는 화면 분석 전에 정합니다(화면 설명도 그 언어로 씁니다). 화면에 보이는 버튼 이름·메시지는 번역하지 않고 화면 그대로 인용합니다.

코드가 바뀌면 `/docent-update`로 바뀐 화면만 다시 처리합니다.

## 지원 스택

| 스택 | 화면 목록 | 캡처·GIF |
| --- | --- | --- |
| Next.js(App·Pages Router), React Router(v6·v7, `flatRoutes()`)·Remix v2, Vue Router·Nuxt, SvelteKit — 모노레포 하위 앱 포함 | 감지기(스크립트) | 자동 실행 또는 주소 받기 |
| Spring MVC(JSP·Thymeleaf), Django·Flask, PHP, 그 밖의 JS 라우터 | 에이전트 탐색 + 스택별 힌트(`skills/docent/references/stacks/`) | 자동 실행 또는 주소 받기 |
| ASP.NET WebForms | 에이전트 탐색 + 힌트 | 주소 받기만(IIS·Windows 필요) |
| 데스크톱 앱(Electron·Tauri, 메뉴로 바뀌는 화면 포함) | 에이전트 탐색 | 지원 안 함(소스만으로) |

npm·pnpm·yarn, docker compose, Maven·Gradle, Django·Flask 실행 계획을 안내합니다(`skills/docent/references/run-guide.md`). 실제 레포(개인 사이트, 데스크톱 앱 모노레포)에 적용한 기록은 `docs/field-tests/`에 있습니다.

## 알아 둘 점

- 분석 중에는 대상 소스가 사용 중인 에이전트의 모델 API로 전송됩니다. 플러그인 자체는 외부로 아무것도 보내지 않습니다
- `.env`, `appsettings*.json`, `web.config`, 키 파일 등 비밀 파일은 읽지 않습니다(분석 중 읽기 차단 훅 포함). 계정 같은 비밀 값은 저장하지 않고 환경변수 이름만 적습니다
- 대상 프로젝트의 파일은 고치지 않고 `.docent/`에만 씁니다
- 설치·실행 명령은 사용자 동의(`docent run approve`) 없이 실행하지 않습니다. 캡처용 Playwright·Chromium도 동의 후 `~/.cache/docent/runtime`에 설치합니다. 녹화는 테스트 계정·테스트 데이터로 하세요
- Node.js 20.10 이상이 필요합니다
- 다른 에이전트(Codex 등)는 `skills/docent/` 폴더를 복사해 `SKILL.md`를 따르게 하면 됩니다. 이 경우 비밀 파일 차단 훅이 없으므로 `SKILL.md`의 규칙에만 의존합니다

## 개발

```bash
npm install
npm test
npm run build
npm run demo
```

- `npm test` — 전체 테스트
- `npm run build` — CLI 번들(`skills/docent/scripts/dist`) 다시 만들기. 소스를 고쳤으면 꼭 실행해 커밋합니다
- `npm run demo` — README 데모 자산(`docs/assets/`) 다시 만들기

설계는 `docs/superpowers/specs/2026-10-13-docent-design.md`, 구현 계획은 `docs/superpowers/plans/`에 있습니다. 라이선스는 MIT입니다.
