<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<c:set var="editing" value="${product.id != 0}" />
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>${editing ? '상품 수정' : '상품 등록'}</title><link rel="stylesheet" href="/css/app.css"></head>
<body>
<%@ include file="../common/nav.jsp" %>
<main>
  <h1>${editing ? '상품 수정' : '상품 등록'}</h1>
  <c:if test="${not empty error}"><p class="error">${error}</p></c:if>
  <form method="post" action="${editing ? '/products/'.concat(product.id).concat('/edit') : '/products/new'}">
    <label for="name">상품명</label>
    <input id="name" name="name" value="${product.name}" required>
    <label for="partner">거래처</label>
    <input id="partner" name="partner" value="${product.partner}" readonly required>
    <button type="button" onclick="window.open('/popup/partners', 'partners', 'width=480,height=520')">거래처 검색</button>
    <label for="price">단가</label>
    <input id="price" name="price" type="number" min="0" value="${product.price}" required>
    <label for="stock">재고</label>
    <input id="stock" name="stock" type="number" min="0" value="${product.stock}">
    <button type="submit">저장</button>
  </form>
  <p><a href="${editing ? '/products/'.concat(product.id) : '/products'}">취소</a></p>
</main>
</body>
</html>
