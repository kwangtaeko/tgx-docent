# 앱 실행 가이드

docent가 화면을 캡처하려면 대상 앱이 실행 중이어야 합니다. 아래 순서로 **실행 계획**을 만들고, 사용자에게 보여 주고 동의를 받은 뒤 `.docent/run.json`에 적습니다. 동의 없이 설치·실행 명령을 돌리지 않습니다.

## run.json

```json
{
  "mode": "auto",
  "baseUrl": "http://localhost:3000",
  "install": ["npm ci"],
  "start": "npm run dev",
  "cwd": ".",
  "env": { "PORT": "3000" },
  "envNames": ["DATABASE_URL"],
  "healthcheck": { "path": "/", "timeoutSec": 120 }
}
```

- `env`: 비밀이 아닌 고정값만(포트, `NODE_ENV` 등)
- `envNames`: 실행에 꼭 필요한 비밀 환경변수의 **이름**. 값은 사용자가 셸에 설정하며 어떤 파일에도 쓰지 않습니다
- `healthcheck.path`: 로그인 없이 응답하는 경로(로그인 화면 등). 리다이렉트(3xx)도 응답으로 봅니다
- 사용자가 직접 띄운 앱을 쓸 때는 `{ "mode": "url", "baseUrl": "http://…" }`만 적습니다

## 스택별 계획

| 스택 | 판별 | install | start | 포트 |
| --- | --- | --- | --- | --- |
| Node(npm) | `package-lock.json` | `npm ci` | `npm run dev`(없으면 `npm start`) | `dev` 스크립트의 `-p`/`--port`, 기본 Next 3000·Vite 5173 |
| Node(pnpm/yarn) | `pnpm-lock.yaml`/`yarn.lock` | `pnpm install --frozen-lockfile`/`yarn install --frozen-lockfile` | `pnpm dev`/`yarn dev` | 위와 같음 |
| docker compose | `docker-compose.yml`·`compose.yaml` | — | `docker compose up` | `ports:`의 호스트 쪽 |
| Django | `manage.py` | `pip install -r requirements.txt` | `python manage.py runserver 0.0.0.0:8000` | 8000 |
| Flask | `app.py`·`flask` 의존성 | `pip install -r requirements.txt` | `flask run --port 5000` | 5000 |
| Spring Boot(Maven) | `pom.xml` + `spring-boot` | — | `./mvnw spring-boot:run` | `server.port`, 기본 8080 |
| Spring Boot(Gradle) | `build.gradle` + `org.springframework.boot` | — | `./gradlew bootRun` | 위와 같음 |
| ASP.NET WebForms | `*.aspx`, `Web.config` | 자동 실행하지 않음 — IIS·Windows 필요. 처음부터 주소 받기 | | |

- 캡처용으로는 **프로덕션 실행**을 권장합니다. 개발 서버는 화면 구석에 개발 도구 표시(예: Next.js의 "N" 배지, Vite 오류 오버레이)가 찍힙니다. Next.js라면 `start`를 `npm run build && npm run start`로 쓰고 `timeoutSec`을 늘립니다. 빌드가 실패하면 개발 서버로 되돌리고 `config.yaml`의 `mask.selectors`에 `nextjs-portal`을 넣어 가립니다
- `docker compose up`은 `-d` 없이 씁니다(docent가 프로세스를 멈출 수 있어야 함)
- 시작이 오래 걸리는 스택(Spring, docker)은 `timeoutSec`을 300 정도로 늘립니다

## 환경변수와 외부 의존성

- 필요한 환경변수 이름은 `.env.example`·`.env.sample`, 코드의 `process.env.X`·`os.environ["X"]`·`@Value("${x}")`·`application.yml`의 `${X}`에서 **이름만** 찾습니다. `.env`는 읽지 않습니다
- DB·Redis 같은 외부 서비스가 필요한데 `docker-compose.yml`에 없으면 자동 실행이 어렵습니다. 무엇이 필요한지 알리고 주소 받기로 넘어갑니다
- 로그인이 필요한 앱은 테스트 계정을 쓰도록 안내하고, `config.yaml`의 `auth`에 로그인 화면의 라벨과 계정 환경변수 이름을 적습니다(값은 환경변수로만)

## 실패했을 때

`docent run start`가 실패하면 출력된 `run.log` 마지막 부분을 보고 원인을 사용자에게 구체적으로 알립니다(빠진 환경변수, DB 연결 실패, 포트 사용 중 등). 해결이 안 되면 "앱을 직접 띄우고 주소를 알려 주세요"라고 요청해 `mode: url`로 바꿉니다. 그것도 안 되면 캡처 없이 진행합니다.
