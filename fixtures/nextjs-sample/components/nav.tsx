import Link from 'next/link';
import { currentRole } from '@/lib/auth';

export default async function Nav() {
  const role = await currentRole();
  if (!role) return null;

  return (
    <nav>
      <ul>
        <li><Link href="/">대시보드</Link></li>
        <li>
          주문관리
          <ul>
            <li><Link href="/orders">주문 목록</Link></li>
            <li><Link href="/orders/new">주문 등록</Link></li>
          </ul>
        </li>
        {role === 'admin' && (
          <li>
            관리자
            <ul>
              <li><Link href="/admin/users">사용자 관리</Link></li>
            </ul>
          </li>
        )}
      </ul>
    </nav>
  );
}
