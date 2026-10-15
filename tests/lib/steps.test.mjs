import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyMask, runSteps } from '../../skills/docent/scripts/src/lib/steps.mjs';
import { validateScenario } from '../../skills/docent/scripts/src/lib/schema.mjs';
import { browser, closeBrowser } from '../helpers/browser.mjs';
import { page as html, startTestSite } from '../helpers/web.mjs';

const FORM = html('폼', `
  <label>이름 <input name="name"></label>
  <label>메모 <input name="memo"></label>
  <label>상태 <select name="st"><option>접수</option><option>완료</option></select></label>
  <label><input type="checkbox" name="ok"> 동의</label>
  <button onclick="document.getElementById('msg').textContent='저장되었습니다.'">저장</button>
  <p id="msg"></p>
  <a href="#1">더보기</a> <a href="#2">더보기</a>
  <span class="ssn">900101-1234567</span>`);

const site = await startTestSite({ pages: { '/form': FORM } });
after(async () => {
  await site.close();
  await closeBrowser();
});

async function open() {
  const p = await (await browser()).newPage();
  await p.goto(`${site.url}/form`);
  return p;
}

const ev = 'app/form.tsx:1';

test('정상 시나리오', async () => {
  const p = await open();
  const seen = [];
  const r = await runSteps(
    p,
    [
      { do: 'fill', label: '이름', value: '홍길동', evidence: ev },
      { do: 'select', label: '상태', value: '완료', evidence: ev },
      { do: 'check', label: '동의', evidence: ev },
      { do: 'click', role: 'button', label: '저장', evidence: ev },
      { do: 'expectText', text: '저장되었습니다.', evidence: ev },
      { do: 'wait', ms: 10, evidence: ev },
    ],
    { onStep: (i) => seen.push(i) },
  );
  assert.deepEqual(r, { ok: true });
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
  assert.equal(await p.getByLabel('이름').inputValue(), '홍길동');
  await p.close();
});

test('없는 라벨은 그 단계에서 실패', async () => {
  const p = await open();
  const r = await runSteps(p, [{ do: 'fill', label: '주소', value: 'x', evidence: ev }], { timeoutMs: 1000 });
  assert.equal(r.ok, false);
  assert.equal(r.index, 0);
  assert.match(r.reason, /주소/);
  await p.close();
});

test('같은 이름 요소가 여러 개면 nth가 필요하다', async () => {
  const p = await open();
  const r = await runSteps(p, [{ do: 'click', role: 'link', label: '더보기', evidence: ev }], { timeoutMs: 1000 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /2개/);
  assert.deepEqual(await runSteps(p, [{ do: 'click', role: 'link', label: '더보기', nth: 1, evidence: ev }]), { ok: true });
  await p.close();
});

test('환경변수 치환과 비밀값 보호', async () => {
  const p = await open();
  delete process.env.DOCENT_SECRET_X;
  let r = await runSteps(p, [{ do: 'fill', label: '이름', value: '${DOCENT_SECRET_X}', evidence: ev }]);
  assert.deepEqual(r, { ok: false, index: 0, reason: '환경변수 없음: DOCENT_SECRET_X' });
  r = await runSteps(
    p,
    [
      { do: 'fill', label: '이름', value: '${DOCENT_SECRET_X}', evidence: ev },
      { do: 'fill', label: '없는칸', value: '${DOCENT_SECRET_X}', evidence: ev },
    ],
    { env: { DOCENT_SECRET_X: 'top-secret-9' }, timeoutMs: 1000 },
  );
  assert.equal(await p.getByLabel('이름').inputValue(), 'top-secret-9');
  assert.equal(r.ok, false);
  assert.doesNotMatch(r.reason, /top-secret-9/);
  await p.close();
});

test('마스킹', async () => {
  const p = await open();
  await applyMask(p, ['.ssn']);
  assert.match(await p.locator('.ssn').evaluate((el) => getComputedStyle(el).filter), /blur/);
  await p.close();
});

test('시나리오 스키마', () => {
  const base = { screenId: 'a', path: '/a', setup: [], steps: [], sourceHash: 'sha256:' + 'a'.repeat(64) };
  assert.equal(validateScenario(base).valid, true);
  assert.equal(validateScenario({ ...base, steps: [{ do: 'click', role: 'button', label: '저장' }] }).valid, false);
  assert.equal(validateScenario({ ...base, steps: [{ do: 'hover', label: 'x', evidence: ev }] }).valid, false);
  assert.equal(validateScenario({ ...base, steps: [{ do: 'wait', ms: 5000, evidence: ev }] }).valid, false);
  assert.equal(validateScenario({ ...base, path: 'a' }).valid, false);
});

test('마스킹은 페이지를 이동해도 유지된다', async () => {
  const { maskContext } = await import('../../skills/docent/scripts/src/lib/steps.mjs');
  const context = await (await browser()).newContext();
  await maskContext(context, ['.ssn']);
  const p = await context.newPage();
  await p.goto(`${site.url}/form`);
  await p.goto(`${site.url}/form?again=1`);
  assert.match(await p.locator('.ssn').evaluate((el) => getComputedStyle(el).filter), /blur/);
  await context.close();
});

test('fill·select·check는 nth로 몇 번째 항목인지 고른다', async () => {
  const twin = await startTestSite({
    pages: {
      '/twin': html('두 줄', `<label>수량 <input name="q1"></label><label>수량 <input name="q2"></label>
        <label>단위 <select name="u1"><option>개</option><option>박스</option></select></label>
        <label>단위 <select name="u2"><option>개</option><option>박스</option></select></label>
        <label><input type="checkbox" name="c1"> 긴급</label><label><input type="checkbox" name="c2"> 긴급</label>`),
    },
  });
  try {
    const p = await (await browser()).newPage();
    await p.goto(`${twin.url}/twin`);
    const r = await runSteps(p, [
      { do: 'fill', label: '수량', value: '3', nth: 1, evidence: ev },
      { do: 'select', label: '단위', value: '박스', nth: 1, evidence: ev },
      { do: 'check', label: '긴급', nth: 1, evidence: ev },
    ], { timeoutMs: 2000 });
    assert.deepEqual(r, { ok: true });
    assert.equal(await p.locator('[name=q1]').inputValue(), '');
    assert.equal(await p.locator('[name=q2]').inputValue(), '3');
    assert.equal(await p.locator('[name=u2]').inputValue(), '박스');
    assert.equal(await p.locator('[name=c2]').isChecked(), true);
    assert.equal(await p.locator('[name=c1]').isChecked(), false);
    assert.equal(validateScenario({ screenId: 'x', path: '/', setup: [], steps: [{ do: 'fill', label: '수량', value: '3', nth: 1, evidence: ev }], sourceHash: 'sha256:' + 'a'.repeat(64) }).valid, true);
    await p.close();
  } finally {
    await twin.close();
  }
});

test('보이는 글자와 접근성 이름이 달라도 보이는 글자로 누른다', async () => {
  const s = await startTestSite({
    pages: {
      '/a': html('목차', `<a href="#c"><b>02</b>Company</a>
        <button aria-label="가 프로젝트 상세 보기" onclick="document.getElementById('m').textContent='열림'">자세히 →</button>
        <button aria-label="나 프로젝트 상세 보기">자세히 →</button><p id="m"></p>`),
    },
  });
  try {
    const p = await (await browser()).newPage();
    await p.goto(`${s.url}/a`);
    assert.deepEqual(await runSteps(p, [{ do: 'click', role: 'link', label: 'Company', evidence: ev }], { timeoutMs: 2000 }), { ok: true });
    const two = await runSteps(p, [{ do: 'click', role: 'button', label: '자세히', evidence: ev }], { timeoutMs: 2000 });
    assert.match(two.reason, /2개/);
    assert.deepEqual(await runSteps(p, [
      { do: 'click', role: 'button', label: '자세히', nth: 0, evidence: ev },
      { do: 'expectText', text: '열림', evidence: ev },
    ], { timeoutMs: 2000 }), { ok: true });
    await p.close();
  } finally {
    await s.close();
  }
});

test('정확한 이름의 요소가 늦게 나타나도 비슷한 이름의 다른 요소를 누르지 않는다', async () => {
  const s = await startTestSite({
    pages: {
      '/late': html('늦게', `<button onclick="document.getElementById('m').textContent='임시'">임시 저장</button><p id="m"></p>
        <script>setTimeout(() => { const b = document.createElement('button'); b.textContent = '저장';
          b.onclick = () => { document.getElementById('m').textContent = '정식'; }; document.body.appendChild(b); }, 2500);</script>`),
    },
  });
  try {
    const p = await (await browser()).newPage();
    await p.goto(`${s.url}/late`);
    const r = await runSteps(p, [{ do: 'click', role: 'button', label: '저장', evidence: ev }, { do: 'expectText', text: '정식', evidence: ev }], { timeoutMs: 5000 });
    assert.deepEqual(r, { ok: true });
    await p.close();
  } finally {
    await s.close();
  }
});
