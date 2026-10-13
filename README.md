# docent

웹앱 프로젝트의 소스를 분석해 **화면 목록, 화면별 매뉴얼, 프로젝트 소개, 워크플로우(HTML)와 소개 README**를 만드는 에이전트 플러그인입니다. 모든 서술에 소스 근거를 남기고, 소스만으로 확정할 수 없는 내용은 `[확인 필요]`로 표시합니다.

> 개발 중(M2)입니다. 화면 캡처·GIF(M3), PDF·PPT·용도 프리셋(M4)은 아직 없습니다.

## 쓰는 법 (Claude Code)

```
/plugin marketplace add kwangtaeko/tgx-docent
/plugin install docent@tgx-docent
```

대상 프로젝트에서 `/docent`를 실행하면 `.docent/out/`에 결과가 생깁니다.

- `.docent/out/html/index.html` — 소개·화면 목록·화면별 매뉴얼·워크플로우
- `.docent/out/README.md` — 소개 README
- `.docent/review.md` — 확인 필요 항목(답을 적고 `/docent-analyze`를 다시 실행)

다른 에이전트(Codex 등)는 `skills/docent/` 폴더를 복사해 `SKILL.md`를 따르게 하면 됩니다. 이 경우 비밀 파일 차단 훅이 없으므로 `SKILL.md`의 규칙에만 의존합니다.

## 알아 둘 점

- 분석 중에는 대상 소스가 사용 중인 에이전트의 모델 API로 전송됩니다. 플러그인 자체는 외부로 아무것도 보내지 않습니다
- `.env`, `appsettings*.json`, `web.config`, 키 파일 등 비밀 파일은 읽지 않습니다
- 대상 프로젝트의 파일은 고치지 않고 `.docent/`에만 씁니다
- Node.js 20.10 이상이 필요합니다

## 개발

```bash
npm install
npm test        # 전체 테스트
npm run build   # CLI 번들(skills/docent/scripts/dist) 다시 만들기 — 소스를 고쳤으면 꼭 실행해 커밋
```

설계는 `docs/superpowers/specs/2026-10-13-docent-design.md`, 구현 계획은 `docs/superpowers/plans/`에 있습니다.
