import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeComment, escapeHtml } from '../../skills/docent/scripts/src/renderers/escape.mjs';
import { renderSite } from '../../skills/docent/scripts/src/renderers/html.mjs';
import { loadGolden } from '../helpers/golden.mjs';

test('escape', () => {
  assert.equal(escapeHtml(`<b>&"'`), '&lt;b&gt;&amp;&quot;&#39;');
  assert.ok(!escapeComment('a --> b').includes('--'));
});

test('파일 목록', async () => {
  const site = renderSite(await loadGolden());
  const ids = (await loadGolden()).inventory.screens.map((s) => `screens/${s.id}.html`);
  assert.deepEqual([...site.keys()].sort(), ['assets/style.css', 'index.html', 'screens.html', 'workflows.html', ...ids].sort());
});

test('화면별 매뉴얼', async () => {
  const html = renderSite(await loadGolden()).get('screens/orders-new.html');
  for (const text of ['거래처', '납기일', '<mark class="flag">확인 필요</mark>', '<!-- evidence: app/orders/new/order-form.tsx:32 -->', 'href="orders.html"', 'href="orders-new--customer-search.html"']) {
    assert.ok(html.includes(text), text);
  }
});

test('워크플로우 페이지', async () => {
  const html = renderSite(await loadGolden()).get('workflows.html');
  assert.ok(html.includes('s_orders --> s_orders_new'));
  assert.ok(html.includes('src="assets/mermaid.min.js"'));
});

test('소개·목록 페이지', async () => {
  const site = renderSite(await loadGolden());
  const index = site.get('index.html');
  assert.ok(index.includes('거래처 주문을 등록하고 조회·수정·삭제하는 주문 관리 시스템입니다'));
  for (const role of ['영업담당', '관리자']) assert.ok(index.includes(role), role);
  const list = site.get('screens.html');
  for (const id of ['login', 'orders-new--customer-search', 'admin-users']) assert.ok(list.includes(`href="screens/${id}.html"`), id);
});

test('외부 URL 없음', async () => {
  for (const [path, content] of renderSite(await loadGolden())) {
    assert.ok(!/https?:\/\//.test(content), path);
  }
});

test('결정적 출력', async () => {
  const a = renderSite(await loadGolden());
  const b = renderSite(await loadGolden());
  assert.deepEqual([...a], [...b]);
});

test('특수문자', async () => {
  const input = await loadGolden();
  const s = input.screens.get('login');
  s.fields[0].label = '<b>&"';
  s.fields[0].evidence = 'app/login/page.tsx:11';
  s.purpose.value = '닫기 --> 시도';
  const html = renderSite(input).get('screens/login.html');
  assert.ok(html.includes('&lt;b&gt;&amp;&quot;'));
  assert.ok(!html.includes('<b>&"'));
  const comments = html.match(/<!--[\s\S]*?-->/g) ?? [];
  for (const c of comments) assert.ok(!c.slice(4, -3).includes('--'), c);
});

test('근거 주석 때문에 쉼표 앞에 공백이 생기지 않는다', async () => {
  const html = renderSite(await loadGolden()).get('screens/orders.html');
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(text.includes('영업담당, 관리자'), text.match(/사용 역할.*$/m)?.[0]);
});

test('캡처가 없으면 소개에 안내를 넣는다', async () => {
  const site = renderSite(await loadGolden());
  assert.ok(site.get('index.html').includes('화면 캡처 없이 소스만으로 만들었습니다.'));
  assert.ok(!site.get('screens/orders-new.html').includes('media/img'));
});

test('캡처와 GIF를 화면 페이지와 소개에 넣는다', async () => {
  const input = await loadGolden();
  input.media = { images: new Set(['orders-new', 'orders']), gifs: new Set(['orders-new', 'orders', 'login', 'home']) };
  const site = renderSite(input);
  const page = site.get('screens/orders-new.html');
  assert.ok(page.includes('<img src="../media/img/orders-new.png" alt="주문 등록 화면" data-zoomable>'));
  assert.ok(page.includes('<img src="../media/gif/orders-new.gif" alt="주문 등록 조작 예시" data-zoomable>'));
  const index = site.get('index.html');
  assert.ok(!index.includes('화면 캡처 없이'));
  assert.equal((index.match(/media\/gif\//g) ?? []).length, 3);
});

const withPreset = async (preset, extra = {}) => {
  const input = await loadGolden();
  input.options = { preset, formats: ['html'], title: '사용자 매뉴얼', organization: '샘플㈜', revisions: [], ...extra };
  return input;
};
const allText = (site) => [...site.values()].join('\n');

test('delivery: 표지·목차·개정 이력, 근거 주석 제거', async () => {
  const site = renderSite(await withPreset('delivery'));
  const index = site.get('index.html');
  for (const t of ['class="cover"', 'class="toc"', 'id="revisions"', '초안', '샘플㈜', '사용자 매뉴얼']) assert.ok(index.includes(t), t);
  assert.ok(!/<!-- (evidence|screens):/.test(allText(site)));
  assert.ok(allText(site).includes('<mark class="flag">확인 필요</mark>'));
});

test('delivery: 본문에 든 <!--는 지우지 않는다', async () => {
  const input = await withPreset('delivery');
  input.screens.get('login').fields[0].label = '<!--x-->';
  const html = renderSite(input).get('screens/login.html');
  assert.ok(html.includes('&lt;!--x--&gt;'));
});

test('delivery: 개정 이력 지정', async () => {
  const site = renderSite(await withPreset('delivery', { revisions: [{ version: '1.0', date: '2026-10-14', author: '김영업', note: '최초 납품' }] }));
  const index = site.get('index.html');
  assert.ok(index.includes('최초 납품') && index.includes('김영업'));
  assert.ok(!index.includes('초안</td>'));
});

test('handover: 화면별 소스 파일 목록', async () => {
  const html = renderSite(await withPreset('handover')).get('screens/orders-new.html');
  assert.ok(html.includes('<h2>소스 파일</h2>'));
  assert.ok(html.includes('<code>app/orders/new/page.tsx</code>'));
});

test('portfolio: 상세 페이지 없이 카드, 미리보기 6개, 링크는 카드로', async () => {
  const input = await withPreset('portfolio');
  const ids = input.inventory.screens.map((s) => s.id);
  input.media = { images: new Set(ids), gifs: new Set(ids.slice(0, 7)) };
  const site = renderSite(input);
  assert.ok(![...site.keys()].some((k) => k.startsWith('screens/')));
  const list = site.get('screens.html');
  assert.equal((list.match(/<article class="card"/g) ?? []).length, 8);
  assert.ok(list.includes('id="orders-new"'));
  const index = site.get('index.html');
  assert.equal((index.match(/media\/gif\//g) ?? []).length, 6);
  assert.ok(index.includes('href="screens.html#orders-new"') || site.get('workflows.html').includes('href="screens.html#orders-new"'));
  assert.ok(!allText(site).includes('href="screens/'));
  assert.ok(!/<!-- (evidence|screens):/.test(allText(site)));
});

test('Mermaid 예약어와 겹치는 화면 ID', async () => {
  const input = await loadGolden();
  const end = { ...input.screens.get('home'), id: 'end' };
  input.screens.set('end', end);
  input.inventory.screens.push({ ...input.inventory.screens.find((s) => s.id === 'home'), id: 'end', route: '/end' });
  input.summary.workflows.push({ name: '끝', description: '끝', steps: ['end', 'orders'] });
  assert.ok(renderSite(input).get('workflows.html').includes('s_end --> s_orders'));
});

test('메뉴로 옮겨 가는 단계는 점선과 "메뉴"로 그린다', async () => {
  const input = await loadGolden();
  // 주문 목록 → 사용자 관리: 버튼 연결은 없고 사용자 관리가 메뉴에 있다
  input.summary.workflows.push({ name: '메뉴 이동', description: '메뉴 이동', steps: ['orders', 'admin-users'] });
  assert.ok(renderSite(input).get('workflows.html').includes('s_orders -. 메뉴 .-> s_admin_users'));
});

test('HTML 메뉴 트리는 메뉴 근거(파일·줄) 순서를 따른다', async () => {
  const { renderSite } = await import('../../skills/docent/scripts/src/renderers/html.mjs');
  const { loadGolden } = await import('../helpers/golden.mjs');
  const index = renderSite(await loadGolden()).get('index.html').split('<h2>메뉴 구조</h2>')[1];
  const order = ['>대시보드<', '<li>주문관리<', '<li>관리자<'].map((t) => index.indexOf(t));
  assert.ok(order.every((x) => x > 0), String(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('portfolio 카드의 캡처는 위쪽만 일정 비율로 보여 준다', async () => {
  const input = await loadGolden();
  input.options = { preset: 'portfolio' };
  const css = renderSite(input).get('assets/style.css');
  assert.match(css, /\.card \.frame img \{[^}]*aspect-ratio: 16 \/ 10;[^}]*object-fit: cover;[^}]*object-position: top/);
});

test('역할이 없으면 근거 없이 로그인 여부를 단정하지 않고 확인된 역할이 없다고 쓴다', async () => {
  const input = await loadGolden();
  for (const s of input.screens.values()) s.roles = [];
  const site = renderSite(input);
  assert.match(site.get('index.html'), /<h2>사용자 역할<\/h2>\n<ul class="chips"><li>확인된 역할 없음<\/li><\/ul>/);
  assert.ok(site.get('screens/orders.html').includes('확인된 역할 없음'));
  for (const html of site.values()) assert.ok(!html.includes('로그인 없이 사용'));
  const { renderReadme } = await import('../../skills/docent/scripts/src/renderers/readme.mjs');
  const md = renderReadme(input);
  assert.ok(md.includes('- 확인된 역할 없음') && !md.includes('로그인 없이 사용'));
});

test('view 화면은 부모 주소와 "메뉴로 전환"으로 보인다', async () => {
  const input = await loadGolden();
  const child = input.inventory.screens.find((s) => s.parentId);
  const parent = input.inventory.screens.find((s) => s.id === child.parentId);
  child.kind = 'view';
  input.screens.get(child.id).kind = 'view';
  const site = renderSite(input);
  assert.ok(site.get('screens.html').includes(`<td>${parent.route} · 메뉴로 전환</td>`));
  assert.match(site.get(`screens/${child.id}.html`), /<dt>경로<\/dt><dd><code>[^<]*<\/code> · 메뉴로 전환<\/dd>/);
});

test('입력 항목의 선택지와 같은 라벨을 구분하는 구획 표시', async () => {
  const input = await loadGolden();
  const s = input.screens.get('orders-new');
  s.fields[0] = { ...s.fields[0], options: ['검증된 버전 사용', '정책에 맞는 버전 조회'], section: 'GitHub' };
  s.actions[0] = { ...s.actions[0], section: 'GitLab' };
  const html = renderSite(input).get('screens/orders-new.html');
  assert.match(html, /<ul class="options"><li>검증된 버전 사용<\/li><li>정책에 맞는 버전 조회<\/li><\/ul>/);
  assert.match(html, /<span class="field-section">GitHub<\/span>/);
  assert.match(html, /<span class="field-section">GitLab<\/span>/);
});

test('같은 group의 메시지는 표 하나로, group 없는 메시지는 알림 상자로', async () => {
  const input = await loadGolden();
  const s = input.screens.get('orders-new');
  const ev = s.messages[0].evidence;
  s.messages = [
    { text: '저장되었습니다.', when: '저장에 성공하면', evidence: ev },
    { text: '검증 완료', when: 'CI가 통과하면', group: 'CI 검증 상태', evidence: ev },
    { text: '검증 실패', when: 'CI가 실패하면', group: 'CI 검증 상태', evidence: ev },
  ];
  const html = renderSite(input).get('screens/orders-new.html');
  assert.equal((html.match(/class="callout note"/g) ?? []).length, 1);
  assert.match(html, /<p class="message-group-title">CI 검증 상태 <span>2<\/span><\/p>/);
  assert.match(html, /<tr><td>검증 완료[^<]*(<!--[^>]*-->)?<\/td><td>CI가 통과하면<\/td><\/tr>/);
});

test('묶음 없는 문구가 많으면 표 하나로, 자리 표시는 칩으로', async () => {
  const input = await loadGolden();
  const s = input.screens.get('orders-new');
  const ev = s.messages[0].evidence;
  s.messages = Array.from({ length: 6 }, (_, i) => ({ text: `현재 버전 {버전 ${i}}이 최신입니다.`, when: '확인하면', evidence: ev }));
  const html = renderSite(input).get('screens/orders-new.html');
  assert.equal((html.match(/class="callout note"/g) ?? []).length, 0);
  assert.match(html, /<table class="messages">/);
  assert.match(html, /현재 버전 <span class="ph">버전 0<\/span>이 최신입니다\./);
});

test('handover는 effectEvidence도 근거 주석으로 남긴다', async () => {
  const input = await loadGolden();
  input.screens.get('orders-new').actions[0].effectEvidence = ['app/actions/orders.ts:12'];
  assert.match(renderSite(input).get('screens/orders-new.html'), /<!-- evidence: app\/actions\/orders\.ts:12 -->/);
});

test('인쇄(PDF)에서는 표가 가로로 넘치지 않고 모든 칸이 줄을 바꾼다', async () => {
  const css = renderSite(await loadGolden()).get('assets/style.css');
  const print = css.slice(css.indexOf('@media print'));
  for (const rule of ['.table-wrap { overflow: visible; }', '.screen-list td:nth-child(-n+4) { white-space: normal; }', '.screen-list td:last-child { min-width: 0; }', 'table-layout: fixed']) {
    assert.ok(print.includes(rule), rule);
  }
});

test('산출물의 경로는 주소창 경로(route group을 뺀 것)로 보인다', async () => {
  const input = await loadGolden();
  const entry = input.inventory.screens.find((s) => s.id === 'orders');
  entry.route = '/(shop)/orders';
  input.screens.get('orders').route = '/(shop)/orders';
  const site = renderSite(input);
  assert.ok(!site.get('screens.html').includes('(shop)'));
  assert.ok(site.get('screens/orders.html').includes('<code>/orders</code>'));
});

test('capture.device: mobile이면 캡처를 휴대폰 폭 틀로 보인다', async () => {
  const input = await loadGolden();
  input.media = { images: new Set(['orders']), gifs: new Set() };
  input.options = { ...input.options, device: 'mobile' };
  const html = renderSite(input).get('screens/orders.html');
  assert.ok(html.includes('<figure class="frame phone">'));
  assert.ok(renderSite(input).get('assets/style.css').includes('.frame.phone { max-width: 400px'));
});

test('합친 매뉴얼은 화면(앱)마다 캡처 크기를 따른다', async () => {
  const input = await loadGolden();
  input.media = { images: new Set(['orders', 'home']), gifs: new Set() };
  input.inventory.screens.find((e) => e.id === 'orders').device = 'mobile';
  input.inventory.screens.find((e) => e.id === 'home').device = 'desktop';
  input.options = { ...input.options, device: 'desktop' };
  const site = renderSite(input);
  assert.ok(site.get('screens/orders.html').includes('<figure class="frame phone">'));
  assert.ok(!site.get('screens/home.html').includes('frame phone'));
});
