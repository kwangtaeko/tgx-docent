import { z } from 'zod';

export const orderSchema = z.object({
  customer: z.string().min(1, '거래처를 선택하세요.'),
  dueDate: z.string().min(1, '납기일을 입력하세요.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
  note: z.string().default(''),
});

export const orderUpdateSchema = orderSchema.omit({ customer: true });

export type FormState = { error?: string };
