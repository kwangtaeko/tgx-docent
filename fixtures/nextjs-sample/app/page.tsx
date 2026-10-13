import Link from 'next/link';
import { countOrdersOn } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section>
      <h2>대시보드</h2>
      <div className="card">
        <p>오늘 주문 수</p>
        <strong>{countOrdersOn(today)}건</strong>
      </div>
      <p>
        <Link href="/orders">주문 목록</Link> · <Link href="/orders/new">주문 등록</Link>
      </p>
    </section>
  );
}
