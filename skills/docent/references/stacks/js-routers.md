# 감지기가 놓치는 JS 라우터

## 판별

- 감지기(`nextjs`, `react-router`, `vue`, `sveltekit`)를 켰는데 `$DOCENT inventory` 결과에 메뉴의 화면이 빠졌거나, Angular·Remix(v1)·Solid·파일 라우팅 플러그인처럼 감지기가 없는 라우터

## 화면(라우트) 찾기

1. 경로를 상수·변수로 만든 라우트(`path: ROUTES.orders`)나 스프레드로 붙인 자식(`...menuRoutes`)은 감지기가 건너뛰고 `inventory`가 그 위치를 경고로 알립니다. 상수 정의를 따라가 실제 경로를 찾아 `inventory.agent.json`에 넣습니다. 메뉴 코드 → 경로 객체(`MENU_ROUTES = { orders: { path: '/orders' } }`)를 `Object.entries(...).map(...)`으로 라우트로 바꾸는 구성이면 객체의 항목 하나가 화면 하나이고, `evidence`는 그 항목의 `path` 줄, 화면 파일은 같은 코드로 고르는 페이지 컴포넌트(`PAGES[code]` 등)입니다. 페이지가 없어 준비 중 안내(placeholder)만 그리는 메뉴는 화면 목록 확인 때 사용자에게 알리고 `screens.exclude`를 제안합니다
2. 파일 라우팅 플러그인: `vite-plugin-pages`·`unplugin-vue-router`(`src/pages/**`). React Router `flatRoutes()`(`rootDirectory`·`ignoredRouteFiles`, `prefix()`로 감싼 호출 포함)·Remix v2(`vite.config`의 `ignoredRouteFiles`)는 감지기가 읽습니다. 옵션을 변수로 넘기면 읽지 못하니 결과를 확인합니다
3. Angular: `Routes` 배열의 `path`·`component`·`loadComponent`·`children`, `loadChildren`으로 이어지는 하위 모듈 라우트
4. 런타임에 더하는 라우트(`router.addRoute`, 권한별 동적 메뉴)는 메뉴 정의·API 응답 형식을 보고 찾되, 근거(`evidence`)가 되는 소스 위치가 없으면 넣지 않습니다
5. 레이아웃(자식 라우트를 감싸는 라우트)은 화면이 아니고, 그 아래 index·자식이 화면입니다

## 화면 파일

- 라우트가 가리키는 컴포넌트 파일 + 그 파일이 직접 import하는 프로젝트 내부 파일

## 메뉴

- 사이드바·헤더 컴포넌트의 메뉴 배열, 권한별 메뉴 설정 파일

## 권한

- 라우트 가드(`beforeEach`, `canActivate`, `loader`의 `redirect`), 메뉴 배열의 `roles`·`permission` 속성

## 메시지

- 토스트·알림 호출(`toast.success('…')`, `ElMessage`, `message.error`), 폼 검증 스키마(zod·yup)의 메시지, i18n 파일의 문구

## 실행

- `references/run-guide.md`의 Node 행. Vite 개발 서버는 5173, Angular는 4200

## 주의

- `.env`·`.env.local`은 읽지 않습니다. API 주소 같은 값이 필요하면 `.env.example`이나 코드의 `import.meta.env.VITE_…` 참조로 이름만 확인합니다
