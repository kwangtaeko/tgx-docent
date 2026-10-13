'use client';

import { useActionState } from 'react';
import type { Order } from '@/lib/store';
import { saveOrder } from './actions';

export default function EditForm({ order }: { order: Order }) {
  const [state, formAction] = useActionState(saveOrder.bind(null, order.id), {});

  return (
    <form action={formAction}>
      <p>거래처: {order.customer}</p>
      <label>
        납기일
        <input name="dueDate" type="date" defaultValue={order.dueDate} required />
      </label>
      <label>
        수량
        <input name="quantity" type="number" min={1} defaultValue={order.quantity} required />
      </label>
      <label>
        비고
        <textarea name="note" defaultValue={order.note} />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit">저장</button>
    </form>
  );
}
