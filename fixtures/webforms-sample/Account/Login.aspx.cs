using System;
using System.Web.Security;
using System.Web.UI;

namespace WebFormsSample.Account
{
    public partial class Login : Page
    {
        protected void btnLogin_Click(object sender, EventArgs e)
        {
            if (!Membership.ValidateUser(txtUserId.Text, txtPassword.Text))
            {
                lblError.Text = "아이디 또는 비밀번호가 올바르지 않습니다.";
                return;
            }
            FormsAuthentication.SetAuthCookie(txtUserId.Text, false);
            Response.Redirect("~/Default.aspx");
        }
    }
}
