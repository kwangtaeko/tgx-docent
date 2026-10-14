<%@ Page Title="로그인" Language="C#" AutoEventWireup="true" CodeBehind="Login.aspx.cs" Inherits="WebFormsSample.Account.Login" %>
<!DOCTYPE html>
<html lang="ko">
<head runat="server"><meta charset="utf-8" /><title>로그인</title></head>
<body>
    <form id="loginForm" runat="server">
        <h1>로그인</h1>
        <asp:Label ID="lblError" runat="server" CssClass="error" EnableViewState="false" />
        <asp:Label runat="server" AssociatedControlID="txtUserId" Text="아이디" />
        <asp:TextBox ID="txtUserId" runat="server" />
        <asp:RequiredFieldValidator runat="server" ControlToValidate="txtUserId" ErrorMessage="아이디를 입력하세요." />
        <asp:Label runat="server" AssociatedControlID="txtPassword" Text="비밀번호" />
        <asp:TextBox ID="txtPassword" runat="server" TextMode="Password" />
        <asp:RequiredFieldValidator runat="server" ControlToValidate="txtPassword" ErrorMessage="비밀번호를 입력하세요." />
        <asp:Button ID="btnLogin" runat="server" Text="로그인" OnClick="btnLogin_Click" />
    </form>
</body>
</html>
