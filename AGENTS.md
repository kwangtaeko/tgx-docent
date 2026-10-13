# AGENTS.md

docent는 웹앱 프로젝트의 소스를 분석해 화면 목록·매뉴얼·소개 문서 등 산출물을 만드는 에이전트 플러그인입니다.

## 문서

- 설계: `docs/superpowers/specs/2026-10-13-docent-design.md` (`docs/PLAN.md`를 대체)
- 구현 계획: `docs/superpowers/plans/`

## 구조

- `.claude-plugin/` — 플러그인·마켓플레이스 매니페스트
- `skills/docent/` — 스킬 진입점(`SKILL.md`), 스키마(`schemas/`), CLI 소스(`scripts/src/`)와 번들(`scripts/dist/`, 생성물), 자산(`assets/`, 생성물), 참고 문서(`references/`)
- `agents/` — 서브에이전트 지시(screen-analyzer, route-explorer, summary-writer)
- `commands/` — `/docent` 등 슬래시 명령
- `hooks/` — 분석 중 비밀 파일 읽기 차단 훅
- `scripts/` — 번들(`build.mjs`), 골든 비교(`compare-golden.mjs`) 개발 도구
- `fixtures/` — 테스트용 샘플 앱과 기대 산출물(`fixtures/expected/`)
- `tests/` — `node:test` 테스트

## 원칙

- 같은 입력이면 같은 결과가 나와야 하는 일은 스크립트, 해석은 에이전트
- 모든 서술은 소스 근거(`evidence`)를 가진다. 근거 없는 내용은 쓰지 않는다
- Node.js 20+, ESM(`.mjs`), 테스트 의존성 없음

## 명령

- `npm test` — 전체 테스트
- `npm run build` — CLI 번들 다시 만들기. `scripts/src/`나 `schemas/`를 고쳤으면 반드시 실행해 `dist/`도 함께 커밋 (CI가 확인)
