import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEvidence, checkEvidence, TEXT_WINDOW } from '../../skills/docent/scripts/src/lib/evidence.mjs';

const LINES = [
  'export default function Page() {',
  '  return (',
  '    <form>',
  '      <input name="a" />',
  '      <input name="b" />',
  '      <input name="c" />',
  '      <button>저장</button>',
  '    </form>',
  '  );',
  '}',
];

let root;
before(async () => {
  const base = await mkdtemp(join(tmpdir(), 'docent-ev-'));
  root = join(base, 'project');
  await mkdir(root);
  await writeFile(join(root, 'page.tsx'), LINES.join('\n') + '\n');
  await writeFile(join(root, 'crlf.tsx'), LINES.join('\r\n') + '\r\n');
  await writeFile(
    join(root, 'actions.ts'),
    ['export async function handleSave() {}', '', '', '', '', '', '', '', "const far = '저장';"].join('\n') + '\n',
  );
  // 루트 밖 파일: 존재해도 읽으면 안 된다.
  await writeFile(join(base, 'outside.ts'), '저장\n');
});

test('TEXT_WINDOW는 5', () => {
  assert.equal(TEXT_WINDOW, 5);
});

test('parseEvidence 형식', () => {
  assert.deepEqual(parseEvidence('a/b.tsx:3'), { file: 'a/b.tsx', startLine: 3, endLine: 3 });
  assert.deepEqual(parseEvidence('a.ts:3-7'), { file: 'a.ts', startLine: 3, endLine: 7 });
  assert.deepEqual(parseEvidence('a.ts:btnSave_Click'), { file: 'a.ts', symbol: 'btnSave_Click' });
  assert.throws(() => parseEvidence('a.ts'));
});

test('정확한 줄의 문구', async () => {
  assert.deepEqual(await checkEvidence(root, 'page.tsx:7', { expectText: '저장' }), { ok: true });
});

test('±5줄 안의 문구는 통과, 밖이면 실패', async () => {
  assert.equal((await checkEvidence(root, 'page.tsx:2', { expectText: '저장' })).ok, true);
  assert.equal((await checkEvidence(root, 'page.tsx:1', { expectText: '저장' })).ok, false);
});

test('CRLF 파일도 같은 결과', async () => {
  assert.equal((await checkEvidence(root, 'crlf.tsx:7', { expectText: '저장' })).ok, true);
  assert.equal((await checkEvidence(root, 'crlf.tsx:10')).ok, true);
  assert.equal((await checkEvidence(root, 'crlf.tsx:11')).ok, false);
});

test('잘못된 라인 범위는 실패', async () => {
  for (const ev of ['page.tsx:11', 'page.tsx:0', 'page.tsx:5-3']) {
    assert.equal((await checkEvidence(root, ev)).ok, false, ev);
  }
});

test('루트 밖 경로는 읽지 않고 실패', async () => {
  for (const ev of ['../outside.ts:1', '/etc/passwd:1', 'sub\\..\\..\\outside.ts:1']) {
    const r = await checkEvidence(root, ev, { expectText: '저장' });
    assert.equal(r.ok, false, ev);
    assert.match(r.reason, /root/, ev);
  }
});

test('없는 파일', async () => {
  const r = await checkEvidence(root, 'missing.tsx:1');
  assert.equal(r.ok, false);
  assert.match(r.reason, /missing\.tsx/);
});

test('함수명 근거', async () => {
  assert.equal((await checkEvidence(root, 'actions.ts:handleSave')).ok, true);
  assert.equal((await checkEvidence(root, 'actions.ts:handleSav')).ok, false);
});

test('형식이 틀린 근거는 예외 대신 실패 결과', async () => {
  const r = await checkEvidence(root, 'page.tsx');
  assert.equal(r.ok, false);
});

test('함수명 근거의 문구는 그 함수 위치 ±5줄 안에서만 찾는다', async () => {
  assert.equal((await checkEvidence(root, 'actions.ts:handleSave', { expectText: 'handleSave' })).ok, true);
  assert.equal((await checkEvidence(root, 'actions.ts:handleSave', { expectText: '저장' })).ok, false);
});

test('루트 안의 심볼릭 링크가 루트 밖을 가리키면 거부한다', async () => {
  const { symlink } = await import('node:fs/promises');
  const outside = await mkdtemp(join(tmpdir(), 'docent-out-'));
  await writeFile(join(outside, 'secret.ts'), 'x\n');
  const root = await mkdtemp(join(tmpdir(), 'docent-root-'));
  await symlink(join(outside, 'secret.ts'), join(root, 'link.ts'));
  const r = await checkEvidence(root, 'link.ts:1');
  assert.equal(r.ok, false);
  assert.match(r.reason, /root 밖/);
});

test('단독 \\r 줄바꿈도 줄로 센다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docent-cr-'));
  await writeFile(join(root, 'mac.txt'), 'a\rb\rc');
  assert.deepEqual(await checkEvidence(root, 'mac.txt:3', { expectText: 'c' }), { ok: true });
});

test('여러 줄로 나뉜 문구도 근거 근처에 있으면 찾는다', async () => {
  const root = await mkdtemp(join(tmpdir(), 'docent-ml-'));
  await writeFile(join(root, 'p.tsx'), '<p>\n  방문 기록은 남기지만\n  개인을 식별하지 않습니다.\n</p>\n');
  assert.deepEqual(await checkEvidence(root, 'p.tsx:2', { expectText: '방문 기록은 남기지만 개인을 식별하지 않습니다.' }), { ok: true });
  assert.equal((await checkEvidence(root, 'p.tsx:2', { expectText: '방문 기록은 남기지 않습니다.' })).ok, false);
});

test('{이름} 자리 표시: 실행 중 값이 채워지는 문구도 근거와 맞춰 본다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'docent-ev-'));
  await writeFile(
    join(dir, 'a.tsx'),
    ['const a = 1;', "toast(`현재 버전 ${version}이 최신입니다.`);", "setStatus(`${provider.name} 준비됨`);", 'const msg = name + "을(를) 선택해야 합니다.";', ''].join('\n'),
  );
  const ok = async (text, line = 2) => (await checkEvidence(dir, `a.tsx:${line}`, { expectText: text })).ok;
  assert.equal(await ok('현재 버전 {버전}이 최신입니다.'), true);
  assert.equal(await ok('{서비스} 준비됨', 3), true);
  assert.equal(await ok('{항목}을(를) 선택해야 합니다.', 4), true);
  // 자리 표시 밖의 글자는 그대로 있어야 한다
  assert.equal(await ok('현재 버전 {버전}이 오래되었습니다.'), false);
  assert.equal(await ok('현재 버전 {현재 버전}이 최신입니다.'), true);
  // 자리 표시만 있는 문구는 아무것과도 맞지 않는다
  assert.equal(await ok('{버전}'), false);
});

test('자리 표시가 많아도 빨리 끝난다(정규식 되돌아가기 없음)', async () => {
  const { matchesWithPlaceholders } = await import('../../skills/docent/scripts/src/lib/evidence.mjs');
  const source = Array.from({ length: 11 }, (_, i) => `<div className="row-${i}">{items.map((item) => <span key={item.id}>{item.label}</span>)}</div>`).join(' ');
  const started = Date.now();
  assert.equal(matchesWithPlaceholders('{a}{b}{c}{d}zz', source), false);
  assert.equal(matchesWithPlaceholders('{a} {b} {c} {d} done', source), false);
  assert.ok(Date.now() - started < 500, `${Date.now() - started}ms`);
  // 이어진 자리 표시는 간격을 합쳐 본다
  assert.equal(matchesWithPlaceholders('row-{n}">{목록}</div>', source), true);
  assert.equal(matchesWithPlaceholders('{a}{b}', source), false);
});

test('JSX 인라인 태그·{" "}로 끊긴 문장도 화면 글자 그대로 찾는다', async () => {
  const { mkdtemp, writeFile } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'docent-jsx-'));
  await writeFile(join(dir, 'a.tsx'), 'export default () => (\n  <p>\n    취소 가능한 시간은 <b>{deadline}</b>까지예요.{" "}\n    이후에는 <strong>1회</strong>가 차감됩니다.\n  </p>\n);\n');
  assert.equal((await checkEvidence(dir, 'a.tsx:3', { expectText: '이후에는 1회가 차감됩니다.' })).ok, true);
  assert.equal((await checkEvidence(dir, 'a.tsx:3', { expectText: '취소 가능한 시간은 {마감}까지예요. 이후에는 1회가 차감됩니다.' })).ok, true);
  assert.equal((await checkEvidence(dir, 'a.tsx:3', { expectText: '이후에는 2회가 차감됩니다.' })).ok, false);
  await writeFile(join(dir, 'b.tsx'), '<p>\n  예약을 {/* 주석 */}\n  취소했어요.<br />\n  다시 예약하세요.\n</p>\n');
  assert.equal((await checkEvidence(dir, 'b.tsx:2', { expectText: '예약을 취소했어요. 다시 예약하세요.' })).ok, true);
  // 속성 안의 => · > 와 같은 줄의 <br/>
  await writeFile(join(dir, 'c.tsx'), '<p>Click <a onClick={() => go()} className={n > 0 ? "x" : "y"}>here</a> to continue<br/>then wait.</p>\n');
  assert.equal((await checkEvidence(dir, 'c.tsx:1', { expectText: 'Click here to continue then wait.' })).ok, true);
});
