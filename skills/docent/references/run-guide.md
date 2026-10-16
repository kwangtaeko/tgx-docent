# 앱 실행 가이드

docent가 화면을 캡처하려면 대상 앱이 실행 중이어야 합니다. 아래 순서로 **실행 계획**을 만들고, 사용자에게 보여 주고 동의를 받은 뒤 `.docent/run.json`에 적습니다. 동의 없이 설치·실행 명령을 돌리지 않습니다.

## run.json

```json
{
  "mode": "auto",
  "baseUrl": "http://localhost:3000",
  "install": ["npm ci"],
  "start": "npm run build && npm run start",
  "cwd": ".",
  "env": { "PORT": "3000" },
  "envNames": ["DATABASE_URL"],
  "healthcheck": { "path": "/", "timeoutSec": 300 }
}
```

- Maven·Gradle(Spring) 첫 실행은 의존성 내려받기로 오래 걸리므로 `"healthcheck": { "path": "/login", "timeoutSec": 600 }`처럼 씁니다
- 이 명령들은 사용자에게 보여 주고 동의를 받은 뒤 `docent run approve`로 승인해야 실행됩니다. 레포에 이미 있던 `run.json`도 마찬가지입니다
- `env`: 비밀이 아닌 고정값만(포트, `NODE_ENV` 등)
- `stop`(선택): `docent run stop`이 앱을 멈춘 뒤 실행하는 정리 명령(예: `docker compose down`). 승인 대상에 들어갑니다
- `envNames`: 실행에 꼭 필요한 비밀 환경변수의 **이름**. 값은 사용자가 셸에 설정하며 어떤 파일에도 쓰지 않습니다
- `healthcheck.path`: 로그인 없이 응답하는 경로(로그인 화면 등). 리다이렉트(3xx)도 응답으로 봅니다
- 사용자가 직접 띄운 앱을 쓸 때는 `{ "mode": "url", "baseUrl": "http://…" }`만 적습니다

## 스택별 계획

| 스택 | 판별 | install | start | 포트 |
| --- | --- | --- | --- | --- |
| Node(npm) | `package-lock.json` | `npm ci` | `npm run build && npm run start`(빌드가 안 되면 `npm run dev`) | `dev` 스크립트의 `-p`/`--port`, 기본 Next 3000·Vite 5173 |
| Node(pnpm/yarn) | `pnpm-lock.yaml`/`yarn.lock`, `package.json`의 `packageManager` | `pnpm install --frozen-lockfile`/`yarn install --immutable`(Yarn 1은 `--frozen-lockfile`) | `pnpm build && pnpm start`/`yarn build && yarn start`(빌드가 안 되면 `pnpm dev`/`yarn dev`) | 위와 같음. `pnpm start -p 3217`처럼 포트를 명령에 줄 수 있음 |
| docker compose | `docker-compose.yml`·`compose.yaml` | — | `docker compose up` (+ `"stop": "docker compose down"`) | `ports:`의 호스트 쪽 |
| Django | `manage.py` | `pip install -r requirements.txt` | `python manage.py runserver 0.0.0.0:8000` | 8000 |
| Flask | `app.py`·`flask` 의존성 | `pip install -r requirements.txt` | `flask run --port 5000` | 5000 |
| Spring Boot(Maven) | `pom.xml` + `spring-boot` | — | `./mvnw spring-boot:run`(없으면 `mvn spring-boot:run`; JSP war 패키징도 내장 톰캣으로 뜸) | `server.port`, 기본 8080 |
| Spring Boot(Gradle) | `build.gradle` + `org.springframework.boot` | — | `./gradlew bootRun` | 위와 같음 |
| ASP.NET WebForms | `*.aspx`, `Web.config` | 자동 실행하지 않음 — IIS·Windows 필요. 처음부터 주소 받기(아래) | | |

- 패키지 관리자는 `package.json`의 `packageManager` 필드(예: `pnpm@10.x`)가 있으면 그것을 따릅니다. pnpm·yarn이 설치돼 있지 않으면 사용자 동의를 받아 `corepack enable`로 켜는 것을 계획의 `install` 앞에 넣습니다
- 캡처용으로는 **프로덕션 실행**을 권장합니다. 개발 서버는 화면 구석에 개발 도구 표시(예: Next.js의 "N" 배지, Vite 오류 오버레이)가 찍힙니다. Next.js라면 `start`를 `npm run build && npm run start`로 쓰고 `timeoutSec`을 늘립니다. 빌드가 실패하면 개발 서버로 되돌리고 `config.yaml`의 `mask.selectors`에 `nextjs-portal`을 넣어 가립니다
- `docker compose up`은 `-d` 없이 씁니다(docent가 프로세스를 멈출 수 있어야 함). 컨테이너는 클라이언트를 멈춰도 남을 수 있으므로 `stop`에 `docker compose down`을 적습니다
- 시작이 오래 걸리는 스택은 `timeoutSec`을 늘립니다. docker는 300, Maven·Gradle 첫 실행(의존성 내려받기)은 600
- Spring의 `healthcheck.path`는 로그인 없이 열리는 경로(`/login`)로 둡니다. `/`는 로그인 화면으로 리다이렉트(3xx)돼도 응답으로 봅니다
- **ASP.NET WebForms·외부 톰캣 배포 war**: 사용자에게 "IIS(또는 운영 톰캣)에서 앱을 띄운 주소"를 묻고 `{ "mode": "url", "baseUrl": "http://…" }`만 씁니다. 주소를 받지 못하면 6단계(캡처)를 건너뛰고 소스만으로 산출물을 만든다고 알립니다

## 환경변수와 외부 의존성

- 필요한 환경변수 이름은 `.env.example`·`.env.sample`, 코드의 `process.env.X`·`os.environ["X"]`·`@Value("${x}")`·`application.yml`의 `${X}`에서 **이름만** 찾습니다. `.env`는 읽지 않습니다
- DB·Redis 같은 외부 서비스가 필요한데 `docker-compose.yml`에 없으면 자동 실행이 어렵습니다. 무엇이 필요한지 알리고 주소 받기로 넘어갑니다
- 로그인이 필요한 앱은 테스트 계정을 쓰도록 안내하고, `config.yaml`의 `auth`에 로그인 화면의 라벨과 계정 환경변수 이름을 적습니다(값은 환경변수로만)

## config.yaml 항목 (캡처 관련)

```yaml
auth:                      # 로그인이 필요한 앱
  loginPath: /login        # 로그인 화면 경로
  fields:                  # 로그인 화면의 입력 라벨(화면 문구 그대로)과 값을 담은 환경변수 이름
    - label: 아이디
      env: DOCENT_USER
    - label: 비밀번호
      env: DOCENT_PASSWORD
  submit: 로그인           # 로그인 버튼 문구
  successPath: /           # 로그인 후 도착 경로 접두어
mask:
  selectors: [".phone", "td.ssn"]   # 캡처·녹화 전에 흐리게 처리할 요소(CSS 선택자)
gif:
  screens:
    include: []            # 비우면 버튼 동작이 있는 화면 전부
    exclude: [admin-users] # GIF에서 뺄 화면 ID
```

산출물 설정(`output`: preset, formats, theme(indigo·blue·emerald·rose·slate), title, projectName, organization, revisions)과 최상위 `language`(ko·en)·`date`·`app`은 `.docent/config.yaml` 템플릿 주석을 참고하세요.

계정 값은 어디에도 적지 않습니다. 사용자가 셸에서 `export DOCENT_USER=…`로 설정합니다. 로그인 화면은 로그인하지 않은 상태로 캡처합니다.

## 실패했을 때

`docent run start`가 실패하면 출력된 `run.log` 마지막 부분을 보고 원인을 사용자에게 구체적으로 알립니다(빠진 환경변수, DB 연결 실패, 포트 사용 중 등). 해결이 안 되면 "앱을 직접 띄우고 주소를 알려 주세요"라고 요청해 `mode: url`로 바꿉니다. 그것도 안 되면 캡처 없이 진행합니다.
