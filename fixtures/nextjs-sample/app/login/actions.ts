'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { findAccount } from '@/lib/auth';

export async function login(formData: FormData) {
  const account = findAccount(String(formData.get('username')), String(formData.get('password')));
  if (!account) {
    redirect('/login?error=1');
  }
  (await cookies()).set('role', account.role, { httpOnly: true, path: '/' });
  redirect('/');
}
