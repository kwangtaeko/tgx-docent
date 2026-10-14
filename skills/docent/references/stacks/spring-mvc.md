# Spring MVC (JSP·Thymeleaf)

## 판별

- `pom.xml`·`build.gradle`에 `spring-boot-starter-web` 또는 `spring-webmvc`
- 뷰: `src/main/webapp/WEB-INF/**/*.jsp`(JSP), `src/main/resources/templates/**/*.html`(Thymeleaf)

## 화면(라우트) 찾기

1. `@Controller` 클래스를 찾습니다(`@RestController`는 API라 화면이 아님)
2. 클래스의 `@RequestMapping("/products")`와 메서드의 `@GetMapping("/new")`를 이어 붙인 경로가 화면 주소입니다. 경로 변수 `{id}`는 `[id]`로 씁니다(`/products/{id}` → `/products/[id]`)
3. **GET 매핑 중 뷰 이름을 반환하는 메서드만** 화면입니다. `redirect:`만 반환하거나 `@ResponseBody`인 메서드, POST 처리 메서드는 화면이 아닙니다(POST 결과는 그 화면의 버튼 동작으로 적음)
4. 같은 뷰를 두 경로가 쓰면(등록·수정 공용 `form.jsp`) 경로마다 화면 하나입니다
5. `evidence`는 `@GetMapping`이 있는 줄입니다
6. `window.open('/popup/…')`으로 여는 새 창은 부모 화면의 하위 화면(`kind: popup`, `parentRoute`)입니다

## 화면 파일

- `files`: 컨트롤러 + 반환 뷰 이름이 가리키는 템플릿. 뷰 위치는 `application.properties`의 `spring.mvc.view.prefix`·`suffix`(기본 JSP는 `/WEB-INF/jsp/` + `.jsp`)로 찾습니다
- JSP의 `<%@ include file="…" %>`·`<jsp:include page="…">`, Thymeleaf의 `th:replace`·`th:insert` 조각도 넣습니다
- 화면 분석(`readFiles`) 때는 컨트롤러가 쓰는 서비스·저장소 클래스까지 필요한 만큼 읽습니다

## 메뉴

- 공통 메뉴 조각(`common/nav.jsp`, `fragments/header.html`, `layout.jsp`)의 링크 순서가 메뉴 순서입니다
- 메뉴 그룹 이름이 링크가 아닌 텍스트(`<span>상품관리</span>`)로만 있을 수 있습니다

## 권한

- Spring Security: `SecurityFilterChain`의 `requestMatchers("/admin/**").hasRole("ADMIN")`, 메서드의 `@PreAuthorize`·`@Secured`
- 직접 만든 `HandlerInterceptor`의 `preHandle`(세션 검사, 역할 비교)과 `WebMvcConfigurer.addInterceptors`의 `excludePathPatterns`(로그인 없이 열리는 화면)
- JSP의 `<c:if test="${…admin}">`, `<sec:authorize>` — 메뉴를 숨기는 것과 접근을 막는 것은 다릅니다. 막는 근거는 인터셉터·보안 설정입니다

## 메시지

- 컨트롤러의 `model.addAttribute("error", "…")`, `RedirectAttributes.addFlashAttribute("message", "…")` — 리다이렉트된 화면에 표시되므로 표시되는 화면의 `messages`에 적습니다
- Bean Validation(`@NotBlank(message = "…")`), `messages.properties`의 문구
- JSP의 `confirm('…')` 확인창

## 실행

- Maven: `./mvnw spring-boot:run`(없으면 `mvn spring-boot:run`), Gradle: `./gradlew bootRun`. 포트는 `server.port`, 기본 8080
- 첫 실행은 의존성 내려받기로 몇 분 걸리므로 `healthcheck.timeoutSec`을 600으로 둡니다. `healthcheck.path`는 로그인 없이 열리는 `/login`
- war 패키징(JSP)도 `spring-boot:run`으로 내장 톰캣에서 뜹니다. 외부 톰캣에만 배포되는 레거시 war는 주소 받기(`mode: url`)로 안내합니다

## 주의

- `application.properties`·`application-*.yml`에 DB 비밀번호가 있을 수 있습니다. 화면 분석에 필요한 것(`spring.mvc.view.*`, `server.port`)만 보고 비밀 값은 어디에도 옮기지 않습니다. 실행에 필요한 비밀은 `envNames`에 이름만 적습니다
- JSP 표현식 `${p.name}`처럼 데이터로 채워지는 글자는 라벨이 아닙니다. 버튼·입력 항목 라벨은 소스에 글자 그대로 있는 것만 씁니다
