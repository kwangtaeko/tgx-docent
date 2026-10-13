import { CUSTOMERS } from '@/lib/store';
import OrderForm from './order-form';

export default function OrderNewPage() {
  return (
    <section>
      <h2>주문 등록</h2>
      <OrderForm customers={CUSTOMERS} />
    </section>
  );
}
