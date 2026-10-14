using System.Configuration;
using System.Data;
using System.Data.SqlClient;

namespace WebFormsSample
{
    // 주문 데이터는 web.config의 OrderDb 연결 문자열이 가리키는 DB에 있다
    public static class OrderRepository
    {
        private static string ConnectionString => ConfigurationManager.ConnectionStrings["OrderDb"].ConnectionString;

        public static DataTable Search(string customer, string status)
        {
            using (var conn = new SqlConnection(ConnectionString))
            using (var cmd = new SqlCommand("usp_SearchOrders", conn) { CommandType = CommandType.StoredProcedure })
            {
                cmd.Parameters.AddWithValue("@Customer", customer ?? "");
                cmd.Parameters.AddWithValue("@Status", status ?? "");
                var table = new DataTable();
                new SqlDataAdapter(cmd).Fill(table);
                return table;
            }
        }

        public static DataRow Find(int id)
        {
            using (var conn = new SqlConnection(ConnectionString))
            using (var cmd = new SqlCommand("usp_GetOrder", conn) { CommandType = CommandType.StoredProcedure })
            {
                cmd.Parameters.AddWithValue("@Id", id);
                var table = new DataTable();
                new SqlDataAdapter(cmd).Fill(table);
                return table.Rows.Count > 0 ? table.Rows[0] : null;
            }
        }

        public static void Save(int? id, string customer, string dueDate, int quantity, string memo)
        {
            using (var conn = new SqlConnection(ConnectionString))
            using (var cmd = new SqlCommand("usp_SaveOrder", conn) { CommandType = CommandType.StoredProcedure })
            {
                cmd.Parameters.AddWithValue("@Id", (object)id ?? System.DBNull.Value);
                cmd.Parameters.AddWithValue("@Customer", customer);
                cmd.Parameters.AddWithValue("@DueDate", dueDate);
                cmd.Parameters.AddWithValue("@Quantity", quantity);
                cmd.Parameters.AddWithValue("@Memo", memo ?? "");
                conn.Open();
                cmd.ExecuteNonQuery();
            }
        }
    }
}
