# ASP.NET WebForms

## 판별

- `*.aspx`·`*.aspx.cs`(code-behind)·`Site.Master`·`Web.sitemap`·`*.csproj`(`<ProjectTypeGuids>`에 WebApplication)

## 화면(라우트) 찾기

1. 각 `*.aspx` 파일이 화면 하나입니다. 경로는 파일 위치 그대로(`Orders/List.aspx` → `/Orders/List.aspx`, ID는 `orders-list`)
2. `evidence`는 `.aspx` 첫 줄의 `<%@ Page … %>` 지시문(`파일:1`)
3. `RouteConfig.cs`·`Global.asax`의 `routes.MapPageRoute("…", "orders/{id}", "~/Orders/Edit.aspx")`가 있으면 그 주소를 씁니다(`{id}` → `[id]`)
4. 쿼리 문자열로 모드가 바뀌는 페이지(`Edit.aspx?id=…`면 수정, 없으면 등록)는 화면 하나로 두고 모드를 `sections`로 적습니다
5. `*.ascx`(사용자 정의 컨트롤)·`*.ashx`(핸들러)·`*.asmx`(웹 서비스)는 화면이 아닙니다. `ajaxToolkit:ModalPopupExtender`처럼 입력 항목이 있는 팝업은 하위 화면(`kind: modal`)입니다

## 화면 파일

- `files`: `.aspx` + `.aspx.cs`(또는 `.aspx.vb`)
- 화면 분석 때는 `MasterPageFile`(Site.Master), 등록된 `.ascx`, `App_Code/` 등 code-behind가 부르는 클래스를 필요한 만큼 읽습니다

## 메뉴

- `Web.sitemap`의 `siteMapNode` 트리가 메뉴입니다(`title`이 메뉴 이름, `url`이 화면). `menuPath.evidence`는 그 노드의 줄
- `Web.sitemap`이 없으면 `Site.Master`의 `asp:Menu`·`asp:HyperLink`

## 권한

- 접근 규칙(`<authorization>`, `<location path>`)은 보통 `web.config`에 있는데, **`web.config`는 비밀 파일이라 읽지 않습니다**. 권한은 code-behind의 `User.IsInRole("…")`, `Web.sitemap`의 `roles` 속성처럼 소스에 보이는 근거만 쓰고, 나머지는 `unknowns`에 "web.config에 있어 확인하지 않음"으로 남깁니다

## 메시지

- 검증 컨트롤의 `ErrorMessage`(`RequiredFieldValidator`, `RangeValidator`, `CompareValidator`, `RegularExpressionValidator`)
- code-behind에서 `lblError.Text = "…"`, `lblMessage.Text = "…"`로 넣는 문구, `ClientScript.RegisterStartupScript`의 `alert('…')`
- `RangeValidator`는 빈 값을 검사하지 않습니다 — 필수가 아니면 `required: false`로 적고, 빈 값 처리가 불분명하면 `unknowns`에 남깁니다

## 실행

- IIS·Windows·.NET Framework가 필요해 docent가 자동 실행하지 않습니다. 처음부터 사용자가 띄운 앱 주소를 받아 `{ "mode": "url", "baseUrl": "http://…" }`로 씁니다
- 주소가 없으면 캡처 없이 소스만으로 산출물을 만듭니다(화면 캡처 없음 안내가 붙음)

## 주의

- `web.config`, `appsettings*.json`, `*.pfx`는 읽지 않습니다(연결 문자열·계정). 데이터가 DB 저장 프로시저에서 오면 검색 조건 등은 소스로 알 수 없으므로 `confidence: low`와 `unknowns`로 남깁니다
- `asp:Label`의 `AssociatedControlID`가 입력 항목의 라벨입니다. `Text="…"`가 그 라벨 글자입니다
