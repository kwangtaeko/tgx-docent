import { useParams } from 'react-router-dom';
import { listOrders } from './api';

export function Component() {
  const { orderId } = useParams();
  void listOrders();
  return <h1>주문 {orderId}</h1>;
}
