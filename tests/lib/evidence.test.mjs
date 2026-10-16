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
  // 자리 표시만 있는 문구는 아무것과도 맞지 않는다
  assert.equal(await ok('{버전}'), false);
});
