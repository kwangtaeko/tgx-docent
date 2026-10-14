<%@ Page Title="홈" Language="C#" MasterPageFile="~/Site.Master" AutoEventWireup="true" CodeBehind="Default.aspx.cs" Inherits="WebFormsSample._Default" %>
<asp:Content ID="TitleBody" ContentPlaceHolderID="TitleContent" runat="server">홈</asp:Content>
<asp:Content ID="MainBody" ContentPlaceHolderID="MainContent" runat="server">
    <h1>홈</h1>
    <p>오늘 접수된 주문 <asp:Label ID="lblTodayCount" runat="server" />건</p>
    <asp:HyperLink ID="lnkOrders" runat="server" NavigateUrl="~/Orders/List.aspx" Text="주문 목록 보기" />
    <asp:HyperLink ID="lnkNewOrder" runat="server" NavigateUrl="~/Orders/Edit.aspx" Text="주문 등록하기" />
</asp:Content>
