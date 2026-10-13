'use server';

import { redirect } from 'next/navigation';
import { removeOrder } from '@/lib/store';

export async function deleteOrder(id: number) {
  removeOrder(id);
  redirect('/orders?deleted=1');
}
