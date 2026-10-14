<%@ page contentType="text/html; charset=UTF-8" pageEncoding="UTF-8" %>
<%@ taglib prefix="c" uri="jakarta.tags.core" %>
<nav class="menu">
  <a href="/">대시보드</a>
  <span>상품관리</span>
  <a href="/products">상품 목록</a>
  <a href="/products/new">상품 등록</a>
  <c:if test="${me.admin}">
    <span>관리자</span>
    <a href="/admin/users">사용자 관리</a>
  </c:if>
  <a href="/logout">로그아웃</a>
</nav>
