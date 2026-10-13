import { cookies } from 'next/headers';

export type Role = 'sales' | 'admin';

export const ROLE_LABELS: Record<Role, string> = {
  sales: '영업담당',
  admin: '관리자',
};

export const ACCOUNTS = [
  { username: 'user', password: 'user1234', role: 'sales' as Role },
  { username: 'admin', password: 'admin1234', role: 'admin' as Role },
];

export function findAccount(username: string, password: string) {
  return ACCOUNTS.find((a) => a.username === username && a.password === password);
}

export async function currentRole(): Promise<Role | undefined> {
  const value = (await cookies()).get('role')?.value;
  return value === 'sales' || value === 'admin' ? value : undefined;
}
