import type { ReactNode } from 'react';
import Nav from '@/components/nav';

export const metadata = { title: '주문 관리 시스템' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header>
          <h1>주문 관리 시스템</h1>
          <Nav />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
