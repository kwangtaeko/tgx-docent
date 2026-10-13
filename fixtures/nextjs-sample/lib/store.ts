import type { Role } from './auth';

export type OrderStatus = '접수' | '출고' | '완료';

export type Order = {
  id: number;
  customer: string;
  dueDate: string;
  quantity: number;
  note: string;
  status: OrderStatus;
  createdAt: string;
};

export type User = { username: string; name: string; role: Role };

export const CUSTOMERS = ['(주)샘플상사', '한빛유통', '대한물산', '세종무역', '미래식품'];

const orders: Order[] = [
  { id: 1, customer: '(주)샘플상사', dueDate: '2026-10-20', quantity: 10, note: '', status: '접수', createdAt: '2026-10-13' },
  { id: 2, customer: '한빛유통', dueDate: '2026-10-25', quantity: 5, note: '오전 배송', status: '출고', createdAt: '2026-10-12' },
  { id: 3, customer: '대한물산', dueDate: '2026-11-01', quantity: 20, note: '', status: '완료', createdAt: '2026-10-10' },
];

const users: User[] = [
  { username: 'user', name: '김영업', role: 'sales' },
  { username: 'admin', name: '이관리', role: 'admin' },
];

export function listOrders(filter: { customer?: string; status?: string } = {}) {
  return orders.filter(
    (o) =>
      (!filter.customer || o.customer.includes(filter.customer)) &&
      (!filter.status || o.status === filter.status),
  );
}

export function getOrder(id: number) {
  return orders.find((o) => o.id === id);
}

export function addOrder(input: Omit<Order, 'id' | 'status' | 'createdAt'>) {
  const id = Math.max(0, ...orders.map((o) => o.id)) + 1;
  orders.push({ ...input, id, status: '접수', createdAt: new Date().toISOString().slice(0, 10) });
  return id;
}

export function updateOrder(id: number, input: Pick<Order, 'dueDate' | 'quantity' | 'note'>) {
  const order = getOrder(id);
  if (order) Object.assign(order, input);
}

export function removeOrder(id: number) {
  const index = orders.findIndex((o) => o.id === id);
  if (index >= 0) orders.splice(index, 1);
}

export function countOrdersOn(date: string) {
  return orders.filter((o) => o.createdAt === date).length;
}

export function listUsers() {
  return users;
}

export function setUserRole(username: string, role: Role) {
  const user = users.find((u) => u.username === username);
  if (user) user.role = role;
}
