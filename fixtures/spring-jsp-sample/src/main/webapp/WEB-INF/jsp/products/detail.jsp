<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>상품 상세</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<%@ include file="../common/nav.jsp" %>
<main>
  <h1>상품 상세</h1>
  <c:if test="${not empty message}"><p class="message">${message}</p></c:if>
  <c:if test="${not empty error}"><p class="error">${error}</p></c:if>
  <dl>
    <dt>상품명</dt><dd>${product.name}</dd>
    <dt>거래처</dt><dd>${product.partner}</dd>
    <dt>단가</dt><dd>${product.price}</dd>
    <dt>재고</dt><dd>${product.stock}</dd>
  </dl>
  <p><a href="/products/${product.id}/edit">수정</a> <a href="/products">목록</a></p>
  <form method="post" action="/products/${product.id}/delete" onsubmit="return confirm('삭제하시겠습니까?')">
    <button type="submit">삭제</button>
  </form>
</main>
</body>
</html>
