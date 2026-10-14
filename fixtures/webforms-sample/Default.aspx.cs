using System;
using System.Web.UI;

namespace WebFormsSample
{
    public partial class _Default : Page
    {
        protected void Page_Load(object sender, EventArgs e)
        {
            if (!IsPostBack)
            {
                lblTodayCount.Text = OrderRepository.Search(null, "접수").Rows.Count.ToString();
            }
        }
    }
}
