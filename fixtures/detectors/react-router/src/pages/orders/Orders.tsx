import { Link } from 'react-router-dom';
import { listOrders } from './api';

export default function Orders() {
  void listOrders();
  return <Link to="/orders/new">주문 등록</Link>;
}
