# 중간 산출물 스키마

docent는 소스에서 바로 문서를 쓰지 않고, 화면 목록(`inventory.json`)과 화면별 분석 결과(`screens/<id>.json`)를 먼저 만든 뒤 렌더링합니다. 두 파일의 정식 정의는 `schemas/inventory.schema.json`, `schemas/screen.schema.json`(JSON Schema 2020-12)이며, 이 문서는 사람이 읽기 위한 설명입니다.

## 공통 규칙

| 항목 | 규칙 |
| --- | --- |
| 화면 ID | 라우트에서 결정적으로 만든다. `/order/[id]/edit` → `order-id-edit`, `/` → `home`. route group `(…)`·병렬 슬롯 `@…`은 빠지고, 가로챔 접두어 `(.)`는 떼어 낸다. 충돌하면 라우트 사전순으로 `-2`, `-3`. ASCII가 아닌 세그먼트는 `s` + 원문 sha1 앞 8자리. 하위 화면(모달·팝업)은 `<부모ID>--<이름>`. `config.yaml`의 `screens.idMap`으로 `ORD1010` 같은 코드로 바꿀 수 있다. |
| evidence | `파일:라인`, `파일:시작-끝`, `파일:함수명`. 파일은 프로젝트 루트 기준 상대 경로이고 구분자는 `/`. |
| confidence | `high`·`medium`·`low`. 해석이 들어간 항목에만 붙인다. `low`는 본문에 `[확인 필요]`로 표시된다. |
| sourceHash | `sha256:` + 64자리 hex. `readFiles`를 경로순으로 정렬해 `경로\0내용\0`을 이어 붙인 해시. 줄바꿈은 LF로 맞춘 뒤 계산한다. |
| kind | `page`(라우트가 있는 화면), `modal`, `popup`(자체 입력·버튼이 있는 하위 화면). `page`가 아니면 `parentId` 필수, `page`는 `route` 필수. |

## inventory.json

```json
{
  "version": 1,
  "screens": [
    {
      "id": "orders-new",
      "route": "/orders/new",
      "kind": "page",
      "files": ["app/orders/new/page.tsx", "lib/store.ts"],
      "menuPath": ["주문관리", "주문 등록"],
      "evidence": "app/orders/new/page.tsx:1",
      "source": "detector:nextjs"
    }
  ]
}
```

- `files`: 페이지 파일과 그 파일이 직접 import하는 프로젝트 내부 파일(1단계). 분석의 시작점이다.
- `evidence`: 화면이 존재한다는 근거(라우트 정의 위치, 하위 화면은 여는 지점).
- `source`: `detector:<이름>`(프레임워크 감지기), `agent`(에이전트 탐색), `crawl`(실행 중인 앱에서 발견).

## screens/&lt;id&gt;.json

| 필드 | 내용 |
| --- | --- |
| `title` | 화면 이름 `{value, evidence}` |
| `menuPath` | 메뉴 위치 `{value: [...], evidence}` (알 수 있을 때만) |
| `purpose` | 화면 목적 `{value, evidence, confidence}` |
| `roles` | 접근 가능한 역할 `[{value, evidence, confidence}]` |
| `sections` | 탭·단계 입력 같은 화면 내 구획 `[{title, evidence}]` |
| `fields` | 입력 항목 `[{label, type, required, section?, evidence, confidence}]`. `type`은 `text textarea number date select checkbox radio file password email other` |
| `actions` | 버튼 동작 `[{label, effect, navigatesTo?, opens?, evidence, confidence}]`. `navigatesTo`는 이동하는 화면 ID(워크플로우 재료), `opens`는 여는 하위 화면 ID |
| `messages` | 안내 메시지 `[{text, when, evidence}]` |
| `unknowns` | 소스만으로 확정할 수 없는 것. `review.md`로 모인다 |
| `readFiles` | 분석 중 실제로 읽은 파일. `sourceHash` 계산 대상 |

문자열이 소스에 그대로 나오는 항목(`fields[].label`, `actions[].label`, `messages[].text`)은 근거 위치 ±5줄 안에 그 문구가 실제로 있어야 합니다.
