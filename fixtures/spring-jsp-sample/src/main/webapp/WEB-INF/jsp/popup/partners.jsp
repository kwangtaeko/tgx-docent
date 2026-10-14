<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>거래처 검색</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<main>
  <h1>거래처 검색</h1>
  <form method="get" action="/popup/partners">
    <label for="keyword">거래처명</label>
    <input id="keyword" name="keyword" value="${keyword}">
    <button type="submit">검색</button>
  </form>
  <ul>
    <c:forEach var="name" items="${partners}">
      <li>${name} <button type="button" onclick="pick('${name}')">선택</button></li>
    </c:forEach>
  </ul>
  <c:if test="${empty partners}"><p>검색 결과가 없습니다.</p></c:if>
</main>
<script>
  // 고른 거래처를 상품 등록·수정 화면의 거래처 칸에 넣고 창을 닫는다
  function pick(name) {
    window.opener.document.getElementById('partner').value = name;
    window.close();
  }
</script>
</body>
</html>
