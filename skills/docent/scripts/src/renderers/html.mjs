// 화면 JSON·inventory·summary → 정적 HTML 사이트. 외부 URL을 쓰지 않는다. (설계 문서 10장)
import { escapeComment, escapeHtml as h } from './escape.mjs';

const TYPE_LABELS = {
  text: '텍스트', textarea: '여러 줄 텍스트', number: '숫자', date: '날짜', select: '선택', checkbox: '체크박스',
  radio: '단일 선택', file: '파일', password: '비밀번호', email: '이메일', other: '기타',
};

const ev = (evidence) => `<!-- evidence: ${escapeComment(evidence)} -->`;
const flag = (item) => (item.confidence === 'low' ? '<mark>[확인 필요]</mark> ' : '');
const nodeId = (id) => id.replace(/-/g, '_');

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

function screenTitle(screens, id) {
  return screens.get(id)?.title.value ?? id;
}

function rolesOf(screens) {
  const roles = new Set();
  for (const s of screens.values()) for (const r of s.roles) roles.add(r.value);
  return [...roles];
}

function menuTree(inventory, screens) {
  const root = new Map();
  for (const entry of inventory.screens) {
    const menu = screens.get(entry.id)?.menuPath?.value ?? entry.menuPath;
    if (!menu?.length) continue;
    let level = root;
    menu.forEach((name, i) => {
      if (!level.has(name)) level.set(name, { children: new Map(), id: undefined });
      if (i === menu.length - 1) level.get(name).id = entry.id;
      level = level.get(name).children;
    });
  }
  const render = (level) =>
    level.size
      ? `<ul>${[...level]
          .map(([name, node]) => `<li>${node.id ? `<a href="screens/${h(node.id)}.html">${h(name)}</a>` : h(name)}${render(node.children)}</li>`)
          .join('')}</ul>`
      : '';
  return render(root);
}

function renderIndex(input) {
  const { inventory, screens, summary } = input;
  const features = summary.features
    .map((f) => `<li><strong>${h(f.menu)}</strong> — ${h(f.value)} <!-- screens: ${escapeComment(f.screens.join(', '))} --></li>`)
    .join('\n');
  const roles = rolesOf(screens).map((r) => `<li>${h(r)}</li>`).join('');
  const body = `<h1>${h(input.projectName)}</h1>
<p class="lead">${h(summary.oneLiner.value)} <!-- screens: ${escapeComment(summary.oneLiner.screens.join(', '))} --></p>
<h2>주요 기능</h2>
<ul>
${features}
</ul>
<h2>사용자 역할</h2>
<ul>${roles}</ul>
<h2>메뉴 구조</h2>
${menuTree(inventory, screens)}
<p>전체 화면은 <a href="screens.html">화면 목록</a>, 업무 흐름은 <a href="workflows.html">워크플로우</a>에서 볼 수 있습니다.</p>`;
  return page({ ...input, title: '소개', body, root: '' });
}

function renderList(input) {
  const { inventory, screens } = input;
  const rows = inventory.screens
    .map((entry) => {
      const s = screens.get(entry.id);
      const menu = s.menuPath?.value.join(' › ') ?? '';
      const where = entry.route ?? `${screenTitle(screens, entry.parentId)}의 하위 화면`;
      return `<tr><td><code>${h(entry.id)}</code></td><td><a href="screens/${h(entry.id)}.html">${h(s.title.value)}</a></td><td>${h(where)}</td><td>${h(menu)}</td><td>${h(s.roles.map((r) => r.value).join(', '))}</td><td>${flag(s.purpose)}${h(s.purpose.value)}</td></tr>`;
    })
    .join('\n');
  const body = `<h1>화면 목록</h1>
<p>전체 ${inventory.screens.length}개 화면</p>
<table>
<thead><tr><th>ID</th><th>화면</th><th>경로</th><th>메뉴</th><th>역할</th><th>목적</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
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

function link(screens, id) {
  return `<a href="${h(id)}.html">${h(screenTitle(screens, id))}</a>`;
}

function renderScreen(input, entry) {
  const { inventory, screens } = input;
  const s = screens.get(entry.id);
  const meta = [];
  if (s.menuPath) meta.push(`<dt>메뉴 위치</dt><dd>${h(s.menuPath.value.join(' › '))} ${ev(s.menuPath.evidence)}</dd>`);
  meta.push(s.route ? `<dt>경로</dt><dd><code>${h(s.route)}</code></dd>` : `<dt>상위 화면</dt><dd>${link(screens, s.parentId)}</dd>`);
  meta.push(`<dt>목적</dt><dd>${flag(s.purpose)}${h(s.purpose.value)} ${ev(s.purpose.evidence)}</dd>`);
  const roles = s.roles.length ? s.roles.map((r) => `${flag(r)}${h(r.value)}${ev(r.evidence)}`).join(', ') : '로그인 없이 사용';
  meta.push(`<dt>사용 역할</dt><dd>${roles}</dd>`);

  const sections = s.sections.length
    ? `<h2>구성</h2><ul>${s.sections.map((x) => `<li>${h(x.title)} ${ev(x.evidence)}</li>`).join('')}</ul>`
    : '';
  const fields = table(
    ['항목', '형식', '필수'],
    s.fields.map((f) => `<tr><td>${flag(f)}${h(f.label)} ${ev(f.evidence)}</td><td>${h(TYPE_LABELS[f.type])}</td><td>${f.required ? '필수' : ''}</td></tr>`),
  );
  const actions = table(
    ['버튼', '동작', '이어지는 화면'],
    s.actions.map((a) => {
      const next = [a.navigatesTo && `이동: ${link(screens, a.navigatesTo)}`, a.opens && `열기: ${link(screens, a.opens)}`].filter(Boolean).join(', ');
      return `<tr><td>${h(a.label)}</td><td>${flag(a)}${h(a.effect)} ${ev(a.evidence)}</td><td>${next}</td></tr>`;
    }),
  );
  const messages = table(
    ['메시지', '나오는 때'],
    s.messages.map((m) => `<tr><td>${h(m.text)} ${ev(m.evidence)}</td><td>${h(m.when)}</td></tr>`),
  );
  const children = inventory.screens.filter((x) => x.parentId === s.id);
  const childList = children.length
    ? `<h2>하위 화면</h2><ul>${children.map((c) => `<li>${link(screens, c.id)}</li>`).join('')}</ul>`
    : '';
  const unknowns = s.unknowns.length
    ? `<h2>확인 필요</h2><ul class="unknowns">${s.unknowns.map((u) => `<li><mark>[확인 필요]</mark> ${h(u)}</li>`).join('')}</ul>`
    : '';

  const body = `<p class="crumb"><a href="../screens.html">화면 목록</a> › <code>${h(s.id)}</code></p>
<h1>${h(s.title.value)} ${ev(s.title.evidence)}</h1>
<dl class="meta">
${meta.join('\n')}
</dl>
${sections}
<h2>입력 항목</h2>
${fields}
<h2>버튼과 동작</h2>
${actions}
<h2>안내 메시지</h2>
${messages}
${childList}
${unknowns}`;
  return page({ ...input, title: s.title.value, body, root: '../' });
}

function renderWorkflows(input) {
  const { screens, summary } = input;
  const blocks = summary.workflows
    .map((wf) => {
      // 라벨만 이스케이프하고 화살표는 그대로 둔다(mermaid는 textContent를 읽으므로 엔티티도 풀린다).
      const nodes = [...new Set(wf.steps)].map((id) => `  ${nodeId(id)}["${h(screenTitle(screens, id)).replace(/&quot;/g, '#quot;')}"]`);
      const edges = [];
      for (let i = 0; i + 1 < wf.steps.length; i++) {
        const edge = `  ${nodeId(wf.steps[i])} --> ${nodeId(wf.steps[i + 1])}`;
        if (!edges.includes(edge)) edges.push(edge);
      }
      const steps = wf.steps.map((id) => `<li><a href="screens/${h(id)}.html">${h(screenTitle(screens, id))}</a></li>`).join('');
      return `<section class="workflow">
<h2>${h(wf.name)}</h2>
<p>${h(wf.description)}</p>
<pre class="mermaid">
${['flowchart LR', ...nodes, ...edges].join('\n')}
</pre>
<ol>${steps}</ol>
</section>`;
    })
    .join('\n');
  const body = `<h1>워크플로우</h1>
<p>화면 사이를 오가며 업무를 처리하는 흐름입니다. 화면의 버튼 동작으로 확인된 연결만 그렸습니다.</p>
${blocks}`;
  const scripts = '<script src="assets/mermaid.min.js"></script>\n<script>mermaid.initialize({ startOnLoad: true });</script>\n';
  return page({ ...input, title: '워크플로우', body, root: '', scripts });
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
@media print {
  header.site nav, .crumb { display: none; }
  main { max-width: none; padding: 0; }
  a { color: var(--fg); }
  h1, h2 { break-after: avoid; }
  table, section.workflow { break-inside: avoid; }
}
`;

export function renderSite(input) {
  const site = new Map();
  site.set('assets/style.css', STYLE);
  site.set('index.html', renderIndex(input));
  site.set('screens.html', renderList(input));
  site.set('workflows.html', renderWorkflows(input));
  for (const entry of input.inventory.screens) site.set(`screens/${entry.id}.html`, renderScreen(input, entry));
  return site;
}
