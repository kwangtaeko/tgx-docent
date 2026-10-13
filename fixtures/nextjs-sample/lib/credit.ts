// 외부 여신 API를 흉내 낸 스텁. 실제 판정 규칙은 외부 시스템에 있어 이 코드만으로는 알 수 없다.
export async function checkCredit(customer: string, quantity: number): Promise<boolean> {
  const response = await callCreditApi({ customer, quantity });
  return response.approved;
}

async function callCreditApi(_request: { customer: string; quantity: number }) {
  return { approved: true };
}
