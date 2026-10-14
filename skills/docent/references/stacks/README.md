# 스택별 탐색 힌트

docent 감지기(`nextjs`, `react-router`, `vue`, `sveltekit`)가 없는 스택은 `route-explorer`·`screen-analyzer`가 소스를 읽어 화면을 찾고 분석합니다. 아래 문서는 그때 어디부터 읽을지 알려 주는 힌트입니다. 프로젝트의 스택을 판별한 뒤 맞는 문서를 먼저 읽습니다.

| 문서 | 스택 |
| --- | --- |
| [spring-mvc.md](spring-mvc.md) | Spring MVC·Spring Boot + JSP·Thymeleaf |
| [aspnet-webforms.md](aspnet-webforms.md) | ASP.NET WebForms(`*.aspx`) |
| [python-web.md](python-web.md) | Django·Flask(서버 템플릿) |
| [php.md](php.md) | PHP(파일 단위 페이지, Laravel) |
| [js-routers.md](js-routers.md) | 감지기가 놓치는 JS 라우터(파일 라우팅 플러그인, Angular 등) |

모든 문서는 같은 목차(판별 → 화면(라우트) 찾기 → 화면 파일 → 메뉴 → 권한 → 메시지 → 실행 → 주의)를 따릅니다.
