import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runPending } from '../../skills/docent/scripts/src/commands/pending.mjs';
import { runReview } from '../../skills/docent/scripts/src/commands/review.mjs';
import { copyFixture, copyGoldenWorkspace } from '../helpers/fixture.mjs';

async function golden() {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  return { dir, docent };
}

test('모두 최신이면 비어 있다', async () => {
  const { dir } = await golden();
  assert.deepEqual(await runPending(dir), []);
});

test('분석 결과 없음·소스 변경·답이 달린 확인 항목', async () => {
  const { dir, docent } = await golden();
  await rm(join(docent, 'screens', 'home.json'));
  await appendFile(join(dir, 'app', 'login', 'page.tsx'), '\n// changed\n');
  await runReview(dir);
  const path = join(docent, 'review.md');
  const { readFile } = await import('node:fs/promises');
  await writeFile(path, (await readFile(path, 'utf8')).replace('- [ ] 여신', '- [x] 여신').replace(' (lib/credit.ts:1-9)', ' (lib/credit.ts:1-9) 답: 외부 기준'));
  assert.deepEqual(await runPending(dir), [
    { id: 'home', reason: '분석 결과 없음' },
    { id: 'login', reason: '소스 변경' },
    { id: 'orders-new', reason: '확인 항목 답변 1건' },
  ]);
});

test('깨진 화면 파일은 다시 분석 대상', async () => {
  const { dir, docent } = await golden();
  await writeFile(join(docent, 'screens', 'orders.json'), 'null');
  assert.deepEqual(await runPending(dir), [{ id: 'orders', reason: '분석 결과를 읽을 수 없음' }]);
});
