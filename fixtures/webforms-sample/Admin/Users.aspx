<%@ Page Title="사용자 관리" Language="C#" MasterPageFile="~/Site.Master" AutoEventWireup="true" CodeBehind="Users.aspx.cs" Inherits="WebFormsSample.Admin.Users" %>
<asp:Content ID="TitleBody" ContentPlaceHolderID="TitleContent" runat="server">사용자 관리</asp:Content>
<asp:Content ID="MainBody" ContentPlaceHolderID="MainContent" runat="server">
    <h1>사용자 관리</h1>
    <asp:GridView ID="gvUsers" runat="server" AutoGenerateColumns="false">
        <Columns>
            <asp:BoundField HeaderText="아이디" DataField="UserName" />
            <asp:BoundField HeaderText="이메일" DataField="Email" />
            <asp:CheckBoxField HeaderText="잠김" DataField="IsLockedOut" />
        </Columns>
    </asp:GridView>
</asp:Content>
