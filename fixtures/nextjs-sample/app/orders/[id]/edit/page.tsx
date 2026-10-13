import { notFound } from 'next/navigation';
import { getOrder } from '@/lib/store';
import EditForm from './edit-form';

export const dynamic = 'force-dynamic';

export default async function OrderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrder(Number(id));
  if (!order) notFound();

  return (
    <section>
      <h2>주문 수정</h2>
      <EditForm order={order} />
    </section>
  );
}
