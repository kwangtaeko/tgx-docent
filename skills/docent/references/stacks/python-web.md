# Python 웹 (Django·Flask)

## 판별

- Django: `manage.py`, `settings.py`, `urls.py` / Flask: `from flask import Flask`, `@app.route`·`@bp.route`

## 화면(라우트) 찾기

1. Django: 루트 `urls.py`의 `urlpatterns`에서 `include()`를 따라 앱별 `urls.py`까지 경로를 이어 붙입니다. `path('orders/<int:pk>/', …)`의 `<int:pk>`는 `[pk]`로 씁니다. `re_path`는 정규식의 이름 그룹을 `[이름]`으로
2. 뷰가 `render(request, '…html')`·`TemplateView`·`ListView`·`CreateView` 등 템플릿을 그리면 화면, `JsonResponse`·DRF `APIView`·`redirect`만 하면 화면이 아닙니다
3. Flask: `@app.route('/orders/<int:id>')` 중 `render_template`을 반환하는 함수가 화면. `methods=['POST']`만 받는 라우트는 버튼 동작입니다
4. `evidence`는 `path(`·`@app.route` 줄

## 화면 파일

- `files`: 뷰 함수(클래스)가 있는 파일 + 템플릿. Django 템플릿은 `templates/` 또는 앱의 `templates/<앱>/`, 클래스 뷰는 `template_name` 또는 기본 이름(`<앱>/<모델>_list.html`)
- `{% extends %}`·`{% include %}` 조각, Django `forms.py`(입력 항목이 폼 클래스에 정의됨)

## 메뉴

- 기반 템플릿(`base.html`)의 내비게이션 링크(`{% url 'orders:list' %}` → 그 이름의 URL 패턴)

## 권한

- `@login_required`, `LoginRequiredMixin`, `@permission_required('…')`, `PermissionRequiredMixin`, `user.is_staff` 검사, Flask-Login `@login_required`

## 메시지

- `messages.success(request, '…')`, 폼 필드의 `error_messages`, `ValidationError('…')`, Flask `flash('…')`

## 실행

- `references/run-guide.md`의 Django·Flask 행. 가상환경이 있으면(`.venv`, `poetry.lock`) 그것을 쓰는 명령으로 계획합니다

## 주의

- `settings.py`의 `SECRET_KEY`·DB 비밀번호, `.env`는 읽거나 옮기지 않습니다. 필요한 비밀은 `envNames`에 이름만
- Django 관리자(`/admin/`)는 프레임워크 기본 화면이라 사용자가 원할 때만 넣습니다
