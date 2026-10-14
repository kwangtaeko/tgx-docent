using System;
using System.Web.Security;
using System.Web.UI;

namespace WebFormsSample.Admin
{
    public partial class Users : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!User.IsInRole("Admin"))
            {
                Response.Redirect("~/Default.aspx");
                return;
            }
            gvUsers.DataSource = Membership.GetAllUsers();
            gvUsers.DataBind();
        }
    }
}
