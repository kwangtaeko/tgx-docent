import { ROLE_LABELS } from '@/lib/auth';
import { listUsers } from '@/lib/store';
import { saveRoles } from './actions';

export const dynamic = 'force-dynamic';

export default async function UserAdminPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;

  return (
    <section>
      <h2>사용자 관리</h2>
      {saved && <p role="status">권한이 변경되었습니다.</p>}
      <form action={saveRoles}>
        <table>
          <thead>
            <tr><th>아이디</th><th>이름</th><th>권한</th></tr>
          </thead>
          <tbody>
            {listUsers().map((u) => (
              <tr key={u.username}>
                <td>{u.username}</td>
                <td>{u.name}</td>
                <td>
                  <label>
                    권한
                    <select name={`role-${u.username}`} defaultValue={u.role}>
                      <option value="sales">{ROLE_LABELS.sales}</option>
                      <option value="admin">{ROLE_LABELS.admin}</option>
                    </select>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="submit">저장</button>
      </form>
    </section>
  );
}
