'use server';

import { redirect } from 'next/navigation';
import type { Role } from '@/lib/auth';
import { listUsers, setUserRole } from '@/lib/store';

export async function saveRoles(formData: FormData) {
  for (const user of listUsers()) {
    const role = formData.get(`role-${user.username}`);
    if (role === 'sales' || role === 'admin') setUserRole(user.username, role as Role);
  }
  redirect('/admin/users?saved=1');
}
