'use client';

import { deleteOrder } from './actions';

export default function DeleteButton({ id }: { id: number }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm('삭제하시겠습니까?')) deleteOrder(id);
      }}
    >
      삭제
    </button>
  );
}
