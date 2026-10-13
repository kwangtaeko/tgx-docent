'use server';

import { redirect } from 'next/navigation';
import { orderUpdateSchema, type FormState } from '@/lib/order-schema';
import { updateOrder } from '@/lib/store';

export async function saveOrder(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orderUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  updateOrder(id, parsed.data);
  redirect(`/orders/${id}?updated=1`);
}
