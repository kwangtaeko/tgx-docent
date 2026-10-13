'use client';

import { useActionState, useState } from 'react';
import { createOrder } from './actions';
import CustomerSearch from './customer-search';

export default function OrderForm({ customers }: { customers: string[] }) {
  const [state, formAction] = useActionState(createOrder, {});
  const [customer, setCustomer] = useState('');
  const [searching, setSearching] = useState(false);

  return (
    <form action={formAction}>
      <label>
        거래처
        <input name="customer" type="text" value={customer} readOnly required />
      </label>
      <button type="button" onClick={() => setSearching(true)}>거래처 찾기</button>
      <label>
        납기일
        <input name="dueDate" type="date" required />
      </label>
      <label>
        수량
        <input name="quantity" type="number" min={1} required />
      </label>
      <label>
        비고
        <textarea name="note" />
      </label>
      {state.error && <p role="alert">{state.error}</p>}
      <button type="submit">저장</button>
      {searching && (
        <CustomerSearch
          customers={customers}
          onSelect={(c) => {
            setCustomer(c);
            setSearching(false);
          }}
          onClose={() => setSearching(false)}
        />
      )}
    </form>
  );
}
