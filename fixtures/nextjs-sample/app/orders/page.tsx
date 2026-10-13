import Link from 'next/link';
import { listOrders } from '@/lib/store';

export const dynamic = 'force-dynamic';

type Search = { customer?: string; status?: string; saved?: string; deleted?: string };

export default async function OrderListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { customer, status, saved, deleted } = await searchParams;
  const orders = listOrders({ customer, status });

  return (
    <section>
      <h2>주문 목록</h2>
      {saved && <p role="status">저장되었습니다.</p>}
      {deleted && <p role="status">삭제되었습니다.</p>}
      <form method="get">
        <label>
          거래처명
          <input name="customer" type="text" defaultValue={customer} />
        </label>
        <label>
          상태
          <select name="status" defaultValue={status ?? ''}>
            <option value="">전체</option>
            <option value="접수">접수</option>
            <option value="출고">출고</option>
            <option value="완료">완료</option>
          </select>
        </label>
        <button type="submit">검색</button>
      </form>
      <Link href="/orders/new">신규 등록</Link>
      <table>
        <thead>
          <tr><th>번호</th><th>거래처</th><th>납기일</th><th>수량</th><th>상태</th></tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><Link href={`/orders/${o.id}`}>{o.id}</Link></td>
              <td>{o.customer}</td>
              <td>{o.dueDate}</td>
              <td>{o.quantity}</td>
              <td>{o.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
