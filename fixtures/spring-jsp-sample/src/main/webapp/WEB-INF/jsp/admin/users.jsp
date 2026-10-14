<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>사용자 관리</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<%@ include file="../common/nav.jsp" %>
<main>
  <h1>사용자 관리</h1>
  <table>
    <tr><th>아이디</th><th>이름</th><th>권한</th></tr>
    <c:forEach var="a" items="${accounts}">
      <tr><td>${a.username}</td><td>${a.name}</td><td>${a.role}</td></tr>
    </c:forEach>
  </table>
</main>
</body>
</html>
