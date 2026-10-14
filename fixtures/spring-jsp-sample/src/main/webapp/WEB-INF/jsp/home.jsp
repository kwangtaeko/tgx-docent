<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>대시보드</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<%@ include file="common/nav.jsp" %>
<main>
  <h1>대시보드</h1>
  <c:if test="${not empty error}"><p class="error">${error}</p></c:if>
  <p>등록된 상품 ${productCount}개</p>
  <h2>재고 부족 상품</h2>
  <ul>
    <c:forEach var="p" items="${lowStock}">
      <li><a href="/products/${p.id}">${p.name}</a> (재고 ${p.stock})</li>
    </c:forEach>
  </ul>
  <p><a href="/products/new">상품 등록하기</a></p>
</main>
</body>
</html>
