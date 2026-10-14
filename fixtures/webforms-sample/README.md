# webforms-sample

docent 픽스처. 전용 감지기 없이 에이전트 탐색과 `references/stacks/aspnet-webforms.md` 힌트로 **소스만** 분석하는 ASP.NET WebForms 주문 관리 앱입니다. IIS·Windows가 필요해 docent가 자동 실행하지 않습니다(주소 받기).

- `web.config`에는 가짜 연결 문자열이 있습니다. docent는 이 파일을 읽지 않아야 합니다(비밀 파일 차단 검증용)
- 기대 산출물: `fixtures/expected/webforms-sample/`
