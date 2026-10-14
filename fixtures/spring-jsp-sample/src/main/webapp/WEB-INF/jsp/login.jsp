<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>로그인</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<main>
  <h1>로그인</h1>
  <c:if test="${not empty error}"><p class="error">${error}</p></c:if>
  <form method="post" action="/login">
    <label for="username">아이디</label>
    <input id="username" name="username" required>
    <label for="password">비밀번호</label>
    <input id="password" name="password" type="password" required>
    <button type="submit">로그인</button>
  </form>
</main>
</body>
</html>
