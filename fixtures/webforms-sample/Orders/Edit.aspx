<%@ Page Title="주문 등록" Language="C#" MasterPageFile="~/Site.Master" AutoEventWireup="true" CodeBehind="Edit.aspx.cs" Inherits="WebFormsSample.Orders.Edit" %>
<asp:Content ID="TitleBody" ContentPlaceHolderID="TitleContent" runat="server">주문 등록</asp:Content>
<asp:Content ID="MainBody" ContentPlaceHolderID="MainContent" runat="server">
    <h1><asp:Literal ID="litHeading" runat="server" Text="주문 등록" /></h1>
    <asp:Label runat="server" AssociatedControlID="txtCustomer" Text="거래처" />
    <asp:TextBox ID="txtCustomer" runat="server" />
    <asp:RequiredFieldValidator runat="server" ControlToValidate="txtCustomer" ErrorMessage="거래처를 입력하세요." />
    <asp:Label runat="server" AssociatedControlID="txtDueDate" Text="납기일" />
    <asp:TextBox ID="txtDueDate" runat="server" TextMode="Date" />
    <asp:RequiredFieldValidator runat="server" ControlToValidate="txtDueDate" ErrorMessage="납기일을 입력하세요." />
    <asp:Label runat="server" AssociatedControlID="txtQuantity" Text="수량" />
    <asp:TextBox ID="txtQuantity" runat="server" TextMode="Number" />
    <asp:RangeValidator runat="server" ControlToValidate="txtQuantity" Type="Integer" MinimumValue="1" MaximumValue="9999" ErrorMessage="수량은 1 이상 9999 이하로 입력하세요." />
    <asp:Label runat="server" AssociatedControlID="txtMemo" Text="비고" />
    <asp:TextBox ID="txtMemo" runat="server" TextMode="MultiLine" Rows="3" />
    <asp:Button ID="btnSave" runat="server" Text="저장" OnClick="btnSave_Click" />
    <asp:HyperLink ID="lnkCancel" runat="server" NavigateUrl="~/Orders/List.aspx" Text="취소" />
</asp:Content>
