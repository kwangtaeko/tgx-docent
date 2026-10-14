using System;
using System.Web.UI;

namespace WebFormsSample.Orders
{
    public partial class List : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                if (Request.QueryString["saved"] == "1")
                {
                    lblMessage.Text = "저장되었습니다.";
                }
                Bind();
            }
        }

        protected void btnSearch_Click(object sender, EventArgs e)
        {
            Bind();
        }

        private void Bind()
        {
            gvOrders.DataSource = OrderRepository.Search(txtCustomer.Text, ddlStatus.SelectedValue);
            gvOrders.DataBind();
        }
    }
}
