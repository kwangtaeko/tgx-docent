import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseReview, renderReview, runReview } from '../../skills/docent/scripts/src/commands/review.mjs';
import { copyFixture, copyGoldenWorkspace, EXPECTED, readJsonFile } from '../helpers/fixture.mjs';

async function goldenScreens() {
  const inv = await readJsonFile(join(EXPECTED, 'inventory.json'));
  return Promise.all(inv.screens.map((s) => readJsonFile(join(EXPECTED, 'screens', `${s.id}.json`))));
}

const HEADER = [
  '# 확인 필요 항목',
  '',
  '> docent가 소스만으로 확정하지 못한 내용입니다. 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영됩니다.',
  '',
];

test('골든 화면의 확인 필요 항목', async () => {
  const text = renderReview(await goldenScreens(), new Map());
  assert.equal(
    text,
    [
      ...HEADER,
      '## orders-new · 주문 등록',
      '',
      '- [ ] 저장 — 확신도 낮음: 입력값을 검증하고 여신 확인을 거쳐 주문을 저장한 뒤 주문 목록으로 이동합니다. 여신 확인을 통과하지 못하면 저장하지 않습니다 (app/orders/new/order-form.tsx:32) <!-- key: orders-new|actions[1] -->',
      '- [ ] 여신 확인(checkCredit)의 승인 기준은 외부 여신 API에 있어 소스만으로 알 수 없음 (lib/credit.ts:1-9) <!-- key: orders-new|unknowns[0] -->',
      '',
    ].join('\n'),
  );
});

test('체크 상태와 답은 다시 만들어도 남는다', async () => {
  const previous = parseReview(
    '- [x] 여신 확인(…) 답: 한도 1억 이하만 승인 <!-- key: orders-new|unknowns[0] -->\n- [ ] 저장 — … 답: 미정 <!-- key: orders-new|actions[1] -->\n',
  );
  const text = renderReview(await goldenScreens(), previous);
  assert.match(text, /^- \[x\] 여신 확인\(checkCredit\)[^\n]* 답: 한도 1억 이하만 승인 <!-- key: orders-new\|unknowns\[0\] -->$/m);
  assert.match(text, /^- \[ \] 저장 — [^\n]* 답: 미정 <!-- key: orders-new\|actions\[1\] -->$/m);
});

test('항목이 없으면 안내 문장', () => {
  assert.equal(renderReview([], new Map()), [...HEADER, '확인할 항목이 없습니다.', ''].join('\n'));
});

test('runReview는 .docent/review.md를 쓰고 기존 답을 보존한다', async () => {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  assert.deepEqual(await runReview(dir), { items: 2 });
  const path = join(docent, 'review.md');
  const edited = (await readFile(path, 'utf8')).replace('- [ ] 여신', '- [x] 여신').replace(' (lib/credit.ts:1-9)', ' (lib/credit.ts:1-9) 답: 외부 시스템 기준');
  await writeFile(path, edited);
  await runReview(dir);
  assert.match(await readFile(path, 'utf8'), /- \[x\] 여신.* 답: 외부 시스템 기준 <!-- key/);
});

test('실행 앱 대조 결과를 review.md에 넣고 답을 보존한다', async () => {
  const dir = await copyFixture();
  const docent = await copyGoldenWorkspace(dir);
  await writeFile(join(docent, 'crawl.json'), JSON.stringify({ baseUrl: 'http://x', visited: ['/', '/hidden'], unmatched: ['/hidden'], unreached: ['admin-users'] }));
  await runReview(dir);
  const path = join(docent, 'review.md');
  let text = await readFile(path, 'utf8');
  assert.match(text, /## 실행 중인 앱 대조/);
  assert.match(text, /^- \[ \] 화면 목록에 없는 경로: \/hidden <!-- key: crawl\|unmatched\|\/hidden -->$/m);
  assert.match(text, /^- \[ \] 앱에서 링크로 도달하지 못한 화면: admin-users \(\/admin\/users\) <!-- key: crawl\|unreached\|admin-users -->$/m);
  await writeFile(path, text.replace('- [ ] 화면 목록에 없는 경로: /hidden', '- [x] 화면 목록에 없는 경로: /hidden 답: 테스트용'));
  await runReview(dir);
  text = await readFile(path, 'utf8');
  assert.match(text, /- \[x\] 화면 목록에 없는 경로: \/hidden 답: 테스트용 <!-- key/);
});
