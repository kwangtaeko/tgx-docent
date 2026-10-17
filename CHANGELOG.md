# 변경 이력

## 1.0.0 (2026-10-17)

첫 공개 릴리스입니다.

- **화면 목록**: Next.js(App·Pages Router), React Router(v6·v7, `flatRoutes()`)·Remix v2, Vue Router·Nuxt(`srcDir` 포함), SvelteKit 감지기. 모노레포는 `init`이 워크스페이스(설정이 없으면 `frontend/`처럼 루트 바로 아래 폴더)에서 앱을 찾고, 여럿이면 `init --app <폴더>`로 고르거나, 앱마다 `--workspace <이름>`으로 분석해 `combine`으로 한 매뉴얼에 합칩니다. 주소 없이 메뉴로 바뀌는 화면(`view`)과 데스크톱 앱(Electron은 캡처·GIF까지, Tauri는 소스만으로)도 다룹니다. 감지기가 없는 스택(Spring MVC·JSP, ASP.NET WebForms, Django·Flask, PHP 등)은 에이전트 탐색과 스택별 힌트(`skills/docent/references/stacks/`)로 찾습니다. 감지기가 경로를 읽지 못한 라우트(변수 경로·스프레드)는 위치와 함께 경고해 에이전트 탐색으로 메웁니다
- **화면 분석**: 화면마다 제목·목적·역할·입력 항목·버튼·메시지를 소스 근거(`파일:줄`, 버튼 결과는 `effectEvidence`, 메뉴 경로는 `moreEvidence`, 떨어진 선택지는 `optionsEvidence`로 여러 위치)와 함께 기록하고, 근거 위치와 문구(메뉴 이름·선택지 포함)를 스크립트로 검사합니다. 확정할 수 없는 내용은 `[확인 필요]`와 `review.md`로 남깁니다
- **실행·캡처**: 실행 계획을 보여 주고 동의를 받은 뒤 앱을 띄웁니다. 로그인(환경변수 계정), 크롤 대조(사이트맵 포함), 전체 화면 캡처, 조작 GIF 녹화(새 창으로 열리는 화면 포함, 마스킹, 계정 값 노출 방지)를 지원합니다
- **산출물**: HTML(소개·화면 목록·화면별 매뉴얼·워크플로우 — 버튼 연결과 메뉴 이동(점선)을 구분), 소개 README, PDF, PPTX. `delivery`·`handover`·`portfolio` 프리셋, 한국어·영어(`language`, 명령줄 안내도 `DOCENT_LANG` 또는 `language`를 따름), 색 테마 5종(`output.theme`), 라이트·다크 모드. Pretendard 글꼴(SIL OFL)을 함께 넣습니다
- **갱신**: `/docent-update`로 바뀐 화면만 다시 분석·캡처(docent를 올린 뒤 검사 기준에 맞지 않게 된 분석도 다시 분석 대상으로)
- **보안**: 비밀 파일 읽기 차단 훅, 비밀 값 대신 환경변수 이름만 저장, 동의 없는 설치·실행 금지

알려진 한계:

- 모바일 앱은 지원하지 않습니다. Tauri 데스크톱 앱은 화면 캡처·GIF 없이 소스만으로 만듭니다
- 여러 앱을 한 매뉴얼로 묶을 때는 앱마다 따로 분석하고 build에서 합칩니다. 앱을 넘나드는 워크플로우는 그리지 않습니다
