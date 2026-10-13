import { login } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <section>
      <h2>로그인</h2>
      <form action={login}>
        <label>
          아이디
          <input name="username" type="text" required />
        </label>
        <label>
          비밀번호
          <input name="password" type="password" required />
        </label>
        {error && <p role="alert">아이디 또는 비밀번호가 올바르지 않습니다.</p>}
        <button type="submit">로그인</button>
      </form>
    </section>
  );
}
