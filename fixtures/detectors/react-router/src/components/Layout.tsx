import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      <nav>
        <Link to="/">대시보드</Link>
        <Link to="/orders">주문 목록</Link>
      </nav>
      <Outlet />
    </div>
  );
}
