import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrder } from '@/lib/store';
import DeleteButton from './delete-button';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string }> };

export default async function OrderDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { updated } = await searchParams;
  const order = getOrder(Number(id));
  if (!order) notFound();

  return (
    <section>
      <h2>주문 상세</h2>
      {updated && <p role="status">수정되었습니다.</p>}
      <dl>
        <dt>거래처</dt><dd>{order.customer}</dd>
        <dt>납기일</dt><dd>{order.dueDate}</dd>
        <dt>수량</dt><dd>{order.quantity}</dd>
        <dt>비고</dt><dd>{order.note}</dd>
        <dt>상태</dt><dd>{order.status}</dd>
      </dl>
      <Link href={`/orders/${order.id}/edit`}>수정</Link>
      <DeleteButton id={order.id} />
    </section>
  );
}
