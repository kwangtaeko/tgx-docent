# PHP (파일 단위 페이지, Laravel)

## 판별

- 파일 단위: 웹 루트의 `*.php`(예: `board/list.php`) / Laravel: `artisan`, `routes/web.php`, `resources/views/**/*.blade.php`

## 화면(라우트) 찾기

1. 파일 단위: HTML을 출력하는 `*.php`가 화면 하나(`/board/list.php`, ID `board-list`). `include`만 되는 조각(`header.php`, `inc/*.php`)과 처리만 하고 `header('Location: …')`로 넘기는 파일은 화면이 아닙니다
2. Laravel: `routes/web.php`의 `Route::get('/orders/{id}', …)`(`{id}` → `[id]`) 중 `view('…')`를 반환하는 것. `Route::resource`는 `index`·`create`·`show`·`edit` 네 화면
3. `evidence`는 `Route::get` 줄, 파일 단위는 그 파일의 첫 HTML 출력 줄

## 화면 파일

- 파일 단위: 그 `.php` + `include`·`require`하는 내부 파일
- Laravel: 컨트롤러 + Blade 뷰(`@extends`·`@include`·컴포넌트)

## 메뉴

- 공통 헤더(`header.php`, `layouts/app.blade.php`)의 링크

## 권한

- 세션 검사(`if (!isset($_SESSION['user']))`), 등급 비교, Laravel `middleware('auth')`·`can:`·Gate·Policy

## 메시지

- `alert('…')` 출력, `$_SESSION['flash']`, Laravel `->with('status', '…')`, `$request->validate()`의 규칙과 `lang/*/validation.php`

## 실행

- Laravel: `composer install` → `php artisan serve --port 8000`. 파일 단위 PHP: `php -S 0.0.0.0:8000 -t <웹 루트>`(DB가 필요하면 docker compose)

## 주의

- `config.php`·`db.php`·`.env`처럼 접속 정보가 있는 파일은 내용을 옮기지 않습니다. 필요한 비밀은 `envNames`에 이름만
