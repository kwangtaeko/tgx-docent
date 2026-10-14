<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>상품 목록</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<%@ include file="../common/nav.jsp" %>
<main>
  <h1>상품 목록</h1>
  <c:if test="${not empty message}"><p class="message">${message}</p></c:if>
  <form method="get" action="/products">
    <label for="keyword">검색어</label>
    <input id="keyword" name="keyword" value="${keyword}" placeholder="상품명 또는 거래처">
    <button type="submit">검색</button>
  </form>
  <table>
    <tr><th>상품명</th><th>거래처</th><th>단가</th><th>재고</th></tr>
    <c:forEach var="p" items="${products}">
      <tr>
        <td><a href="/products/${p.id}">${p.name}</a></td>
        <td>${p.partner}</td>
        <td>${p.price}</td>
        <td>${p.stock}</td>
      </tr>
    </c:forEach>
  </table>
  <c:if test="${empty products}"><p>조건에 맞는 상품이 없습니다.</p></c:if>
  <p><a href="/products/new">새 상품 등록</a></p>
</main>
</body>
</html>
