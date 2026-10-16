# 문체 규칙

docent 산출물은 그 시스템을 처음 쓰는 사람이 읽습니다. 화면 JSON의 서술 항목(`purpose`, `actions[].effect`, `messages[].when`, `unknowns`, `summary.json`의 모든 문장)은 아래 규칙을 따릅니다.

## 언어

`.docent/config.yaml`의 `language`(기본 `ko`)로 씁니다.

- 서술 항목(`purpose`, `actions[].effect`, `messages[].when`, `unknowns`, `summary.json`의 문장, 화면에 제목이 없어 지어 붙인 `title`)은 그 언어로 씁니다
- 화면에 보이는 문구를 옮긴 값(`fields[].label`, `actions[].label`, `messages[].text`, `sections[].title`, `menuPath`, 화면 제목을 그대로 쓴 `title`, 역할 이름)은 번역하지 않고 화면 그대로 둡니다. 근거 검사가 소스의 글자와 맞춰 보기 때문입니다
- `ko`: 아래 규칙대로 존댓말 합니다체
- `en`: 쉬운 현재형 평서문으로, 주어는 생략하고 동사로 시작합니다. "Registers a new order for the selected customer." 화면에 보이는 문구는 따옴표로 감싸 그대로 씁니다: 'Click "신규 등록" to open the order form.' 아래 관점·용어 규칙은 같습니다

## 관점

- 사용자가 화면에서 보고 하는 일로 씁니다. "주문을 저장합니다" (O) / "createOrder 서버 액션을 호출합니다" (X)
- 기술 용어를 쓰지 않습니다: 컴포넌트, API, 상태(state), 서버 액션, 쿼리, 리다이렉트, 쿠키, 미들웨어 등
- 내부 이름(함수·변수·파일 이름)은 서술에 넣지 않습니다. 근거(`evidence`)에만 남습니다. 단, `unknowns`는 검토자를 위한 메모이므로 함수 이름을 함께 적어도 됩니다

## 문장

- (`ko`) 존댓말 합니다체로 씁니다: "거래처를 골라 신규 주문을 등록합니다"
- 한 항목은 한두 문장으로 씁니다. 조건이 있으면 둘째 문장으로 나눕니다: "…이동합니다. 여신 확인을 통과하지 못하면 저장하지 않습니다"
- 추측하는 표현(아마, ~일 수 있습니다, ~로 보입니다)을 쓰지 않습니다. 확실하지 않으면 `confidence`를 낮추고 `unknowns`에 적습니다

## 용어

- 화면에 보이는 문구를 그대로 씁니다. 버튼이 "신규 등록"이면 "신규 등록 버튼"이지 "추가 버튼"이 아닙니다
- 화면 이름은 그 화면의 `title`을 씁니다
- 같은 대상을 한 문서 안에서 다른 말로 부르지 않습니다(거래처/고객/업체를 섞지 않음)
