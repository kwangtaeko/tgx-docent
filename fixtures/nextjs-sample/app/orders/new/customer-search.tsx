'use client';

import { useState } from 'react';

export default function CustomerSearch({
  customers,
  onSelect,
  onClose,
}: {
  customers: string[];
  onSelect: (customer: string) => void;
  onClose: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const matches = customers.filter((c) => c.includes(keyword));

  return (
    <div role="dialog" aria-label="거래처 찾기">
      <h3>거래처 찾기</h3>
      <label>
        거래처명 검색
        <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
      </label>
      <ul>
        {matches.map((c) => (
          <li key={c}>
            {c} <button type="button" onClick={() => onSelect(c)}>선택</button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>닫기</button>
    </div>
  );
}
