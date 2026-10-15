// 화면 JSON·inventory·summary → 정적 HTML 사이트. 외부 URL을 쓰지 않는다. (설계 문서 3·10장)
// 용도 프리셋(input.options.preset): delivery 납품 / handover 인수인계(기본) / portfolio 포트폴리오
import { escapeComment, escapeHtml as h } from './escape.mjs';
import { orderedMenuEntries } from './menu.mjs';

const TYPE_LABELS = {
  text: '텍스트', textarea: '여러 줄 텍스트', number: '숫자', date: '날짜', select: '선택', checkbox: '체크박스',
  radio: '단일 선택', file: '파일', password: '비밀번호', email: '이메일', other: '기타',
};

const NO_CAPTURE = '화면 캡처 없이 소스만으로 만들었습니다.';
const flag = (item) => (item.confidence === 'low' ? '<mark>[확인 필요]</mark> ' : '');
// Mermaid 예약어(end, class, style 등)와 겹치지 않게 접두어를 붙인다
const nodeId = (id) => `s_${id.replace(/-/g, '_')}`;
const mediaOf = (input) => input.media ?? { images: new Set(), gifs: new Set() };
export const presetOf = (input) => input.options?.preset ?? 'handover';
const keepEvidence = (input) => presetOf(input) === 'handover';

// 근거 주석. handover가 아니면 처음부터 넣지 않는다
const evOf = (input, space = ' ') => (evidence) => (keepEvidence(input) ? `${space}<!-- evidence: ${escapeComment(evidence)} -->` : '');
const screensNote = (input, ids) => (keepEvidence(input) ? ` <!-- screens: ${escapeComment(ids.join(', '))} -->` : '');

// 화면 링크. from: 'root'(html 폴더) | 'screens'(screens/ 폴더)
export function screenHref(input, id, from = 'root') {
  if (presetOf(input) === 'portfolio') return `${from === 'screens' ? '../' : ''}screens.html#${id}`;
  return from === 'screens' ? `${id}.html` : `screens/${id}.html`;
}

function page({ title, body, root, projectName, date, scripts = '' }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(title)} · ${h(projectName)}</title>
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body>
<header class="site">
  <a class="brand" href="${root}index.html">${h(projectName)}</a>
  <nav><a href="${root}index.html">소개</a><a href="${root}screens.html">화면 목록</a><a href="${root}workflows.html">워크플로우</a></nav>
</header>
<main>
${body}
</main>
<footer class="site">docent로 생성한 초안입니다 · 기준일 ${h(date)}</footer>
${scripts}</body>
</html>
`;
}

export function screenTitle(screens, id) {
  return screens.get(id)?.title.value ?? id;
}

function rolesOf(screens) {
  const roles = new Set();
  for (const s of screens.values()) for (const r of s.roles) roles.add(r.value);
  return [...roles];
}

function menuTree(input, from) {
  const { inventory, screens } = input;
  const root = new Map();
  for (const { id, menu } of orderedMenuEntries(inventory, screens)) {
    let level = root;
    menu.forEach((name, i) => {
      if (!level.has(name)) level.set(name, { children: new Map(), id: undefined });
      if (i === menu.length - 1) level.get(name).id = id;
      level = level.get(name).children;
    });
  }
  const render = (level) =>
    level.size
      ? `<ul>${[...level]
          .map(([name, node]) => `<li>${node.id ? `<a href="${screenHref(input, node.id, from)}">${h(name)}</a>` : h(name)}${render(node.children)}</li>`)
          .join('')}</ul>`
      : '';
  return render(root);
}

export function revisionRows(input) {
  const list = input.options?.revisions ?? [];
  return list.length ? list : [{ version: '0.1', date: input.date, author: '', note: '초안' }];
}

export function coverBody(input) {
  const o = input.options ?? {};
  return `<section class="cover">
<h1>${h(input.projectName)}</h1>
<p class="doc-title">${h(o.title ?? '사용자 매뉴얼')}</p>
<dl>${o.organization ? `<dt>작성</dt><dd>${h(o.organization)}</dd>` : ''}<dt>기준일</dt><dd>${h(input.date)}</dd><dt>버전</dt><dd>${h(revisionRows(input).at(-1).version)}</dd></dl>
</section>`;
}

export function tocBody(input, { anchors = false } = {}) {
  const at = (file, anchor) => (anchors ? `#${anchor}` : file);
  const screens = input.inventory.screens
    .map((e) => `<li><a href="${anchors ? `#screen-${h(e.id)}` : screenHref(input, e.id)}">${h(screenTitle(input.screens, e.id))}</a></li>`)
    .join('');
  return `<nav class="toc">
<h2>목차</h2>
<ol>
<li><a href="${at('index.html', 'intro')}">소개</a></li>
<li><a href="${at('screens.html', 'screen-list')}">화면 목록</a></li>
<li><a href="${at('workflows.html', 'workflows')}">워크플로우</a></li>
<li>화면별 설명<ol>${screens}</ol></li>
<li><a href="${at('index.html#revisions', 'revisions')}">개정 이력</a></li>
</ol>
</nav>`;
}

export function revisionsBody(input) {
  const rows = revisionRows(input)
    .map((r) => `<tr><td>${h(r.version)}</td><td>${h(r.date)}</td><td>${h(r.author)}</td><td>${h(r.note)}</td></tr>`)
    .join('\n');
  return `<section id="revisions">
<h2>개정 이력</h2>
<table>
<thead><tr><th>버전</th><th>날짜</th><th>작성자</th><th>내용</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
}

export function introBody(input, { from = 'root', heading = true } = {}) {
  const { inventory, screens, summary } = input;
  const features = summary.features.map((f) => `<li><strong>${h(f.menu)}</strong> — ${h(f.value)}${screensNote(input, f.screens)}</li>`).join('\n');
  const roles = rolesOf(screens).map((r) => `<li>${h(r)}</li>`).join('') || '<li>로그인 없이 사용합니다</li>';
  const media = mediaOf(input);
  const limit = presetOf(input) === 'portfolio' ? 6 : 3;
  const prefix = from === 'screens' ? '../' : '';
  // 인쇄(PDF)에서는 GIF가 첫 장면만 찍히므로 캡처 PNG를 쓴다
  const gifs = inventory.screens.filter((e) => media.gifs.has(e.id) && (!input.printAnchors || media.images.has(e.id))).slice(0, limit);
  const preview = gifs.length
    ? `<h2>화면 미리보기</h2>\n<div class="preview">${gifs
        .map((e) => {
          const title = h(screenTitle(screens, e.id));
          const src = input.printAnchors ? `${prefix}media/img/${h(e.id)}.png` : `${prefix}media/gif/${h(e.id)}.gif`;
          return `<figure><img src="${src}" alt="${title} 조작 예시"><figcaption><a href="${screenHref(input, e.id, from)}">${title}</a></figcaption></figure>`;
        })
        .join('')}</div>`
    : '';
  const notice = media.images.size || media.gifs.size ? '' : `<p class="notice">${NO_CAPTURE}</p>\n`;
  return `${heading ? `<h1>${h(input.projectName)}</h1>\n` : ''}${notice}<p class="lead">${h(summary.oneLiner.value)}${screensNote(input, summary.oneLiner.screens)}</p>
<h2>주요 기능</h2>
<ul>
${features}
</ul>
${preview}
<h2>사용자 역할</h2>
<ul>${roles}</ul>
<h2>메뉴 구조</h2>
${menuTree(input, from)}`;
}

function renderIndex(input) {
  const delivery = presetOf(input) === 'delivery';
  const body = `${delivery ? `${coverBody(input)}\n${tocBody(input)}\n` : ''}${introBody(input)}
<p>전체 화면은 <a href="screens.html">화면 목록</a>, 업무 흐름은 <a href="workflows.html">워크플로우</a>에서 볼 수 있습니다.</p>${delivery ? `\n${revisionsBody(input)}` : ''}`;
  return page({ ...input, title: '소개', body, root: '' });
}

export function listBody(input) {
  const { inventory, screens } = input;
  const rows = inventory.screens
    .map((entry) => {
      const s = screens.get(entry.id);
      const menu = s.menuPath?.value.join(' › ') ?? '';
      const where = entry.route ?? `${screenTitle(screens, entry.parentId)}의 하위 화면`;
      return `<tr><td><code>${h(entry.id)}</code></td><td><a href="${screenHref(input, entry.id)}">${h(s.title.value)}</a></td><td>${h(where)}</td><td>${h(menu)}</td><td>${h(s.roles.map((r) => r.value).join(', '))}</td><td>${flag(s.purpose)}${h(s.purpose.value)}</td></tr>`;
    })
    .join('\n');
  return `<h1>화면 목록</h1>
<p>전체 ${inventory.screens.length}개 화면</p>
<table>
<thead><tr><th>ID</th><th>화면</th><th>경로</th><th>메뉴</th><th>역할</th><th>목적</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

// portfolio: 화면을 캡처·목적 카드로
export function cardsBody(input, { prefix = '' } = {}) {
  const { inventory, screens } = input;
  const media = mediaOf(input);
  const cards = inventory.screens
    .map((entry) => {
      const s = screens.get(entry.id);
      const shot = media.images.has(entry.id)
        ? `<img src="${prefix}media/img/${h(entry.id)}.png" alt="${h(s.title.value)} 화면">`
        : '<p class="no-shot">캡처 없음</p>';
      const gif = media.gifs.has(entry.id) ? `<p><a href="${prefix}media/gif/${h(entry.id)}.gif">조작 예시 보기</a></p>` : '';
      return `<article class="card" id="${h(entry.id)}">
<h2>${h(s.title.value)}</h2>
${shot}
<p>${flag(s.purpose)}${h(s.purpose.value)}</p>
${gif}</article>`;
    })
    .join('\n');
  return `<h1>화면 목록</h1>
<p>전체 ${inventory.screens.length}개 화면</p>
<div class="cards">
${cards}
</div>`;
}

function renderList(input) {
  const body = presetOf(input) === 'portfolio' ? cardsBody(input) : listBody(input);
  return page({ ...input, title: '화면 목록', body, root: '' });
}

function table(headers, rows) {
  if (!rows.length) return '<p class="empty">없음</p>';
  return `<table>
<thead><tr>${headers.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
<tbody>
${rows.join('\n')}
</tbody>
</table>`;
}

// 화면 상세 본문. from: 'screens'(screens/ 폴더의 페이지) | 'root'(인쇄용 단일 문서)
export function screenBody(input, entry, { from = 'screens', headingTag = 'h1' } = {}) {
  const { inventory, screens } = input;
  const ev = evOf(input);
  const s = screens.get(entry.id);
  const link = (id) => `<a href="${from === 'root' && input.printAnchors ? `#screen-${h(id)}` : screenHref(input, id, from)}">${h(screenTitle(screens, id))}</a>`;
  const prefix = from === 'screens' ? '../' : '';
  const meta = [];
  if (s.menuPath) meta.push(`<dt>메뉴 위치</dt><dd>${h(s.menuPath.value.join(' › '))}${ev(s.menuPath.evidence)}</dd>`);
  meta.push(s.route ? `<dt>경로</dt><dd><code>${h(s.route)}</code></dd>` : `<dt>상위 화면</dt><dd>${link(s.parentId)}</dd>`);
  meta.push(`<dt>목적</dt><dd>${flag(s.purpose)}${h(s.purpose.value)}${ev(s.purpose.evidence)}</dd>`);
  const evTight = evOf(input, '');
  const roles = s.roles.length ? s.roles.map((r) => `${flag(r)}${h(r.value)}${evTight(r.evidence)}`).join(', ') : '로그인 없이 사용';
  meta.push(`<dt>사용 역할</dt><dd>${roles}</dd>`);

  const sections = s.sections.length ? `<h2>구성</h2><ul>${s.sections.map((x) => `<li>${h(x.title)}${ev(x.evidence)}</li>`).join('')}</ul>` : '';
  const fields = table(
    ['항목', '형식', '필수'],
    s.fields.map((f) => `<tr><td>${flag(f)}${h(f.label)}${ev(f.evidence)}</td><td>${h(TYPE_LABELS[f.type])}</td><td>${f.required ? '필수' : ''}</td></tr>`),
  );
  const actions = table(
    ['버튼', '동작', '이어지는 화면'],
    s.actions.map((a) => {
      const next = [a.navigatesTo && `이동: ${link(a.navigatesTo)}`, a.opens && `열기: ${link(a.opens)}`].filter(Boolean).join(', ');
      return `<tr><td>${h(a.label)}</td><td>${flag(a)}${h(a.effect)}${ev(a.evidence)}</td><td>${next}</td></tr>`;
    }),
  );
  const messages = table(['메시지', '나오는 때'], s.messages.map((m) => `<tr><td>${h(m.text)}${ev(m.evidence)}</td><td>${h(m.when)}</td></tr>`));
  const children = inventory.screens.filter((x) => x.parentId === s.id);
  const childList = children.length ? `<h2>하위 화면</h2><ul>${children.map((c) => `<li>${link(c.id)}</li>`).join('')}</ul>` : '';
  const unknowns = s.unknowns.length
    ? `<h2>확인 필요</h2><ul class="unknowns">${s.unknowns.map((u) => `<li><mark>[확인 필요]</mark> ${h(u)}</li>`).join('')}</ul>`
    : '';
  const sources =
    presetOf(input) === 'handover' ? `<h2>소스 파일</h2><ul>${entry.files.map((f) => `<li><code>${h(f)}</code></li>`).join('')}</ul>` : '';

  const media = mediaOf(input);
  const shot = media.images.has(s.id)
    ? `<figure class="shot"><img src="${prefix}media/img/${h(s.id)}.png" alt="${h(s.title.value)} 화면"></figure>\n`
    : input.printAnchors
      ? '<p class="no-shot">캡처 없음</p>\n'
      : '';
  const gif =
    media.gifs.has(s.id) && !input.printAnchors
      ? `<h2>조작 예시</h2>\n<figure><img src="${prefix}media/gif/${h(s.id)}.gif" alt="${h(s.title.value)} 조작 예시"></figure>\n`
      : '';
  return `<${headingTag}>${h(s.title.value)}${ev(s.title.evidence)}</${headingTag}>
${shot}
<dl class="meta">
${meta.join('\n')}
</dl>
${sections}
${gif}<h2>입력 항목</h2>
${fields}
<h2>버튼과 동작</h2>
${actions}
<h2>안내 메시지</h2>
${messages}
${childList}
${unknowns}
${sources}`;
}

function renderScreen(input, entry) {
  const body = `<p class="crumb"><a href="../screens.html">화면 목록</a> › <code>${h(entry.id)}</code></p>
${screenBody(input, entry)}`;
  return page({ ...input, title: input.screens.get(entry.id).title.value, body, root: '../' });
}

// 워크플로우 하나의 Mermaid 정의. 라벨만 이스케이프하고 화살표는 그대로 둔다(mermaid는 textContent를 읽음)
// forHtml: <pre class="mermaid"> 안에 넣을 때(true, 이스케이프) / mermaid.render에 바로 넘길 때(false)
export function workflowMermaid(input, wf, { forHtml = true } = {}) {
  const { screens } = input;
  const label = (id) => {
    const title = screenTitle(screens, id);
    return forHtml ? h(title).replace(/&quot;/g, '#quot;') : title.replace(/"/g, '#quot;');
  };
  const nodes = [...new Set(wf.steps)].map((id) => `  ${nodeId(id)}["${label(id)}"]`);
  const edges = [];
  for (let i = 0; i + 1 < wf.steps.length; i++) {
    const edge = `  ${nodeId(wf.steps[i])} --> ${nodeId(wf.steps[i + 1])}`;
    if (!edges.includes(edge)) edges.push(edge);
  }
  return ['flowchart LR', ...nodes, ...edges].join('\n');
}

export function workflowsBody(input, { linkToScreen = (id) => screenHref(input, id) } = {}) {
  const { screens, summary } = input;
  const blocks = summary.workflows
    .map((wf) => {
      const steps = wf.steps.map((id) => `<li><a href="${linkToScreen(id)}">${h(screenTitle(screens, id))}</a></li>`).join('');
      return `<section class="workflow">
<h2>${h(wf.name)}</h2>
<p>${h(wf.description)}</p>
<pre class="mermaid">
${workflowMermaid(input, wf)}
</pre>
<ol>${steps}</ol>
</section>`;
    })
    .join('\n');
  return `<h1>워크플로우</h1>
<p>화면 사이를 오가며 업무를 처리하는 흐름입니다. 화면의 버튼 동작으로 확인된 연결만 그렸습니다.</p>
${blocks}`;
}

function renderWorkflows(input) {
  const scripts = '<script src="assets/mermaid.min.js"></script>\n<script>mermaid.initialize({ startOnLoad: true });</script>\n';
  return page({ ...input, title: '워크플로우', body: workflowsBody(input), root: '', scripts });
}

const STYLE = `:root { --fg: #1f2328; --muted: #59636e; --line: #d1d9e0; --bg: #ffffff; --accent: #0969da; --mark: #fff8c5; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
header.site, footer.site { display: flex; gap: 1.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid var(--line); }
footer.site { border-top: 1px solid var(--line); border-bottom: 0; color: var(--muted); font-size: 0.85rem; margin-top: 3rem; }
header.site nav { display: flex; gap: 1rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.brand { font-weight: 700; color: var(--fg); }
main { max-width: 960px; margin: 0 auto; padding: 1.5rem; }
.lead { font-size: 1.15rem; }
table { width: 100%; border-collapse: collapse; margin: 0.5rem 0 1.5rem; }
th, td { border: 1px solid var(--line); padding: 0.4rem 0.6rem; text-align: left; vertical-align: top; }
th { background: #f6f8fa; }
dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; }
dl.meta dt { color: var(--muted); }
dl.meta dd { margin: 0; }
mark { background: var(--mark); padding: 0 0.2rem; }
.crumb { color: var(--muted); font-size: 0.9rem; }
.empty { color: var(--muted); }
pre.mermaid { background: #f6f8fa; padding: 1rem; overflow-x: auto; }
figure { margin: 1rem 0; }
figure img { max-width: 100%; border: 1px solid var(--line); }
.preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.notice { background: #f6f8fa; border-left: 4px solid var(--line); padding: 0.5rem 0.75rem; color: var(--muted); }
.cover { padding: 4rem 0 3rem; border-bottom: 2px solid var(--fg); margin-bottom: 2rem; }
.cover h1 { font-size: 2.2rem; margin: 0 0 0.5rem; }
.cover .doc-title { font-size: 1.4rem; margin: 0 0 2rem; }
.cover dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; color: var(--muted); }
.toc ol { padding-left: 1.2rem; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
.card { border: 1px solid var(--line); padding: 0.75rem; }
.card h2 { font-size: 1.1rem; margin: 0 0 0.4rem; }
.card img { width: 100%; border: 1px solid var(--line); aspect-ratio: 16 / 10; object-fit: cover; object-position: top; }
.no-shot { border: 1px dashed var(--line); color: var(--muted); padding: 2rem; text-align: center; }
@media print {
  header.site nav, .crumb { display: none; }
  main { max-width: none; padding: 0; }
  a { color: var(--fg); }
  h1, h2 { break-after: avoid; }
  table, section.workflow { break-inside: avoid; }
}
`;

export { STYLE };

export function renderSite(input) {
  const site = new Map();
  site.set('assets/style.css', STYLE);
  site.set('index.html', renderIndex(input));
  site.set('screens.html', renderList(input));
  site.set('workflows.html', renderWorkflows(input));
  if (presetOf(input) !== 'portfolio') {
    for (const entry of input.inventory.screens) site.set(`screens/${entry.id}.html`, renderScreen(input, entry));
  }
  return site;
}
