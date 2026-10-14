using System;
using System.Web.UI;

namespace WebFormsSample.Orders
{
    // 주소에 id가 있으면 수정, 없으면 신규 등록
    public partial class Edit : Page
    {
        private int? OrderId => int.TryParse(Request.QueryString["id"], out var id) ? id : (int?)null;

        protected void Page_Load(object sender, EventArgs e)
        {
            if (IsPostBack || OrderId == null)
            {
                return;
            }
            litHeading.Text = "주문 수정";
            var row = OrderRepository.Find(OrderId.Value);
            txtCustomer.Text = (string)row["Customer"];
            txtDueDate.Text = ((DateTime)row["DueDate"]).ToString("yyyy-MM-dd");
            txtQuantity.Text = row["Quantity"].ToString();
            txtMemo.Text = (string)row["Memo"];
        }

        protected void btnSave_Click(object sender, EventArgs e)
        {
            if (!IsValid)
            {
                return;
            }
            OrderRepository.Save(OrderId, txtCustomer.Text, txtDueDate.Text, int.Parse(txtQuantity.Text), txtMemo.Text);
            Response.Redirect("~/Orders/List.aspx?saved=1");
        }
    }
}
