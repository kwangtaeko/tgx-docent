'use server';

import { redirect } from 'next/navigation';
import { checkCredit } from '@/lib/credit';
import { orderSchema, type FormState } from '@/lib/order-schema';
import { addOrder } from '@/lib/store';

export async function createOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const approved = await checkCredit(parsed.data.customer, parsed.data.quantity);
  if (!approved) {
    return { error: '여신 한도를 초과하여 주문할 수 없습니다.' };
  }
  addOrder(parsed.data);
  redirect('/orders?saved=1');
}
