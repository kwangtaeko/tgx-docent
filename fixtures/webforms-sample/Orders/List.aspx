<%@ Page Title="주문 목록" Language="C#" MasterPageFile="~/Site.Master" AutoEventWireup="true" CodeBehind="List.aspx.cs" Inherits="WebFormsSample.Orders.List" %>
<asp:Content ID="TitleBody" ContentPlaceHolderID="TitleContent" runat="server">주문 목록</asp:Content>
<asp:Content ID="MainBody" ContentPlaceHolderID="MainContent" runat="server">
    <h1>주문 목록</h1>
    <asp:Label ID="lblMessage" runat="server" CssClass="message" EnableViewState="false" />
    <asp:Label runat="server" AssociatedControlID="txtCustomer" Text="거래처명" />
    <asp:TextBox ID="txtCustomer" runat="server" />
    <asp:Label runat="server" AssociatedControlID="ddlStatus" Text="상태" />
    <asp:DropDownList ID="ddlStatus" runat="server">
        <asp:ListItem Value="" Text="전체" />
        <asp:ListItem Text="접수" />
        <asp:ListItem Text="출고" />
    </asp:DropDownList>
    <asp:Button ID="btnSearch" runat="server" Text="검색" OnClick="btnSearch_Click" />
    <asp:GridView ID="gvOrders" runat="server" AutoGenerateColumns="false" EmptyDataText="조건에 맞는 주문이 없습니다.">
        <Columns>
            <asp:HyperLinkField HeaderText="주문번호" DataTextField="Id" DataNavigateUrlFields="Id" DataNavigateUrlFormatString="~/Orders/Edit.aspx?id={0}" />
            <asp:BoundField HeaderText="거래처" DataField="Customer" />
            <asp:BoundField HeaderText="납기일" DataField="DueDate" DataFormatString="{0:yyyy-MM-dd}" />
            <asp:BoundField HeaderText="상태" DataField="Status" />
        </Columns>
    </asp:GridView>
    <asp:HyperLink ID="lnkNew" runat="server" NavigateUrl="~/Orders/Edit.aspx" Text="신규 등록" />
</asp:Content>
