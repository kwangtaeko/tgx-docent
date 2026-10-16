// 화면 JSON·inventory·summary → 정적 HTML 사이트. 외부 URL을 쓰지 않는다. (설계 문서 3·10장)
// 용도 프리셋(input.options.preset): delivery 납품 / handover 인수인계(기본) / portfolio 포트폴리오
import { escapeComment, escapeHtml as h } from './escape.mjs';
import { textOf } from './i18n.mjs';
import { orderedMenuEntries } from './menu.mjs';
import { DEFAULT_THEME, mermaidInit, themeCss } from './theme.mjs';

const flag = (item, T) => (item.confidence === 'low' ? `<mark class="flag">${T.flag}</mark> ` : '');
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

const NAV = [
  ['index.html', 'intro'],
  ['screens.html', 'screenList'],
  ['workflows.html', 'workflows'],
];

// 캡처를 누르면 크게 본다(medium-zoom, 산출물 assets에 함께 들어감)
const zoomScript = (root) => `<script src="${root}assets/zoom.min.js"></script>
<script>if (window.mediumZoom) mediumZoom('[data-zoomable]', { margin: 24, background: 'rgba(12, 12, 16, 0.86)' });</script>
`;

// 브라우저 창 모양의 틀. 주소 칸에 화면 경로를 보인다
function frame(img, url = '') {
  return `<figure class="frame"><div class="frame-bar" aria-hidden="true"><i></i><i></i><i></i>${url ? `<span class="frame-url">${h(url)}</span>` : ''}</div>${img}</figure>`;
}

function page({ title, body, root, projectName, date, scripts = '', active = '', ...input }) {
  const T = textOf(input);
  const nav = NAV.map(([file, key]) => `<a href="${root}${file}"${file === active ? ' aria-current="page"' : ''}>${T[key]}</a>`).join('');
  return `<!doctype html>
<html lang="${T.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${h(title)} · ${h(projectName)}</title>
<link rel="stylesheet" href="${root}assets/style.css">
</head>
<body>
<header class="site">
  <div class="site-inner">
    <a class="brand" href="${root}index.html"><span class="brand-mark" aria-hidden="true">${h([...projectName][0] ?? 'D')}</span>${h(projectName)}</a>
    <nav>${nav}</nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="site"><div class="site-inner">${h(T.footer(date))}</div></footer>
${scripts}${zoomScript(root)}</body>
</html>
`;
}

const routeOf = (inventory, id) => inventory.screens.find((x) => x.id === id)?.route ?? '';

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
  return list.length ? list : [{ version: '0.1', date: input.date, author: '', note: textOf(input).draft }];
}

export function coverBody(input) {
  const o = input.options ?? {};
  const T = textOf(input);
  return `<section class="cover">
<h1>${h(input.projectName)}</h1>
<p class="doc-title">${h(o.title ?? T.defaultTitle)}</p>
<dl>${o.organization ? `<dt>${T.author}</dt><dd>${h(o.organization)}</dd>` : ''}<dt>${T.baseDate}</dt><dd>${h(input.date)}</dd><dt>${T.version}</dt><dd>${h(revisionRows(input).at(-1).version)}</dd></dl>
</section>`;
}

export function tocBody(input, { anchors = false } = {}) {
  const at = (file, anchor) => (anchors ? `#${anchor}` : file);
  const screens = input.inventory.screens
    .map((e) => `<li><a href="${anchors ? `#screen-${h(e.id)}` : screenHref(input, e.id)}">${h(screenTitle(input.screens, e.id))}</a></li>`)
    .join('');
  const T = textOf(input);
  return `<nav class="toc">
<h2>${T.toc}</h2>
<ol>
<li><a href="${at('index.html', 'intro')}">${T.intro}</a></li>
<li><a href="${at('screens.html', 'screen-list')}">${T.screenList}</a></li>
<li><a href="${at('workflows.html', 'workflows')}">${T.workflows}</a></li>
<li>${T.perScreen}<ol>${screens}</ol></li>
<li><a href="${at('index.html#revisions', 'revisions')}">${T.revisions}</a></li>
</ol>
</nav>`;
}

export function revisionsBody(input) {
  const rows = revisionRows(input)
    .map((r) => `<tr><td>${h(r.version)}</td><td>${h(r.date)}</td><td>${h(r.author)}</td><td>${h(r.note)}</td></tr>`)
    .join('\n');
  const T = textOf(input);
  return `<section id="revisions">
<h2>${T.revisions}</h2>
<table>
<thead><tr>${T.revisionHead.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</section>`;
}

export function introBody(input, { from = 'root', heading = true } = {}) {
  const { inventory, screens, summary } = input;
  const T = textOf(input);
  const features = summary.features
    .map((f) => `<article class="feature"><h3>${h(f.menu)}</h3><p>${h(f.value)}${screensNote(input, f.screens)}</p></article>`)
    .join('\n');
  const roleList = rolesOf(screens);
  const roles = roleList.map((r) => `<li>${h(r)}</li>`).join('') || `<li>${T.noRoles}</li>`;
  const media = mediaOf(input);
  const limit = presetOf(input) === 'portfolio' ? 6 : 3;
  const prefix = from === 'screens' ? '../' : '';
  // 인쇄(PDF)에서는 GIF가 첫 장면만 찍히므로 캡처 PNG를 쓴다
  const gifs = inventory.screens.filter((e) => media.gifs.has(e.id) && (!input.printAnchors || media.images.has(e.id))).slice(0, limit);
  const preview = gifs.length
    ? `<h2>${T.preview}</h2>\n<div class="preview">${gifs
        .map((e) => {
          const title = h(screenTitle(screens, e.id));
          const src = input.printAnchors ? `${prefix}media/img/${h(e.id)}.png` : `${prefix}media/gif/${h(e.id)}.gif`;
          return `<div class="preview-item">${frame(`<img src="${src}" alt="${T.demoAlt(title)}" data-zoomable>`)}<a class="preview-title" href="${screenHref(input, e.id, from)}">${title}</a></div>`;
        })
        .join('')}</div>`
    : '';
  const notice = media.images.size || media.gifs.size ? '' : `<p class="notice">${T.noCapture}</p>\n`;
  const stats = [
    [inventory.screens.length, T.statScreens],
    [summary.workflows.length, T.statWorkflows],
    [roleList.length, T.statRoles],
  ]
    .map(([n, label]) => `<li><b>${n}</b><span>${label}</span></li>`)
    .join('');
  return `<section class="hero">
<p class="eyebrow">${h(input.options?.title ?? T.defaultTitle)}</p>
${heading ? `<h1>${h(input.projectName)}</h1>\n` : ''}<p class="lead">${h(summary.oneLiner.value)}${screensNote(input, summary.oneLiner.screens)}</p>
<ul class="stats">${stats}</ul>
</section>
${notice}<h2>${T.features}</h2>
<div class="feature-grid">
${features}
</div>
${preview}
<h2>${T.roles}</h2>
<ul class="chips">${roles}</ul>
<h2>${T.menu}</h2>
${menuTree(input, from)}`;
}

function renderIndex(input) {
  const delivery = presetOf(input) === 'delivery';
  const T = textOf(input);
  const body = `${delivery ? `${coverBody(input)}\n${tocBody(input)}\n` : ''}${introBody(input)}
<p>${T.seeMore(`<a href="screens.html">${T.screenList}</a>`, `<a href="workflows.html">${T.workflows}</a>`)}</p>${delivery ? `\n${revisionsBody(input)}` : ''}`;
  return page({ ...input, title: T.intro, body, root: '', active: 'index.html' });
}

export function listBody(input) {
  const { inventory, screens } = input;
  const T = textOf(input);
  const rows = inventory.screens
    .map((entry) => {
      const s = screens.get(entry.id);
      const menu = s.menuPath?.value.join(' › ') ?? '';
      const where = entry.route ?? (entry.kind === 'view' ? `${routeOf(inventory, entry.parentId)} · ${T.viewNote}` : T.childOf(screenTitle(screens, entry.parentId)));
      return `<tr><td><code>${h(entry.id)}</code></td><td><a href="${screenHref(input, entry.id)}">${h(s.title.value)}</a></td><td>${h(where)}</td><td>${h(menu)}</td><td>${h(s.roles.map((r) => r.value).join(', '))}</td><td>${flag(s.purpose, T)}${h(s.purpose.value)}</td></tr>`;
    })
    .join('\n');
  return `<h1>${T.screenList}</h1>
<p class="lead">${T.totalScreens(inventory.screens.length)}</p>
<div class="table-wrap">
<table class="screen-list">
<thead><tr>${T.listHead.map((x) => `<th>${x}</th>`).join('')}</tr></thead>
<tbody>
${rows}
</tbody>
</table>
</div>`;
}

// portfolio: 화면을 캡처·목적 카드로
export function cardsBody(input, { prefix = '' } = {}) {
  const { inventory, screens } = input;
  const T = textOf(input);
  const media = mediaOf(input);
  const cards = inventory.screens
    .map((entry) => {
      const s = screens.get(entry.id);
      const shot = media.images.has(entry.id)
        ? frame(`<img src="${prefix}media/img/${h(entry.id)}.png" alt="${h(T.shotAlt(s.title.value))}" data-zoomable>`, entry.route ?? '')
        : `<p class="no-shot">${T.noShot}</p>`;
      const gif = media.gifs.has(entry.id) ? `<a class="button" href="${prefix}media/gif/${h(entry.id)}.gif">${T.watchDemo}</a>` : '';
      return `<article class="card" id="${h(entry.id)}">
${shot}
<div class="card-body">
<h2>${h(s.title.value)}</h2>
<p>${flag(s.purpose, T)}${h(s.purpose.value)}</p>
${gif}</div>
</article>`;
    })
    .join('\n');
  return `<h1>${T.screenList}</h1>
<p class="lead">${T.totalScreens(inventory.screens.length)}</p>
<div class="cards">
${cards}
</div>`;
}

function renderList(input) {
  const body = presetOf(input) === 'portfolio' ? cardsBody(input) : listBody(input);
  return page({ ...input, title: textOf(input).screenList, body, root: '', active: 'screens.html' });
}

// 화면 상세 본문. from: 'screens'(screens/ 폴더의 페이지) | 'root'(인쇄용 단일 문서)
export function screenBody(input, entry, { from = 'screens', headingTag = 'h1' } = {}) {
  const { inventory, screens } = input;
  const T = textOf(input);
  const ev = evOf(input);
  const s = screens.get(entry.id);
  const link = (id) => `<a href="${from === 'root' && input.printAnchors ? `#screen-${h(id)}` : screenHref(input, id, from)}">${h(screenTitle(screens, id))}</a>`;
  const prefix = from === 'screens' ? '../' : '';
  const meta = [];
  const item = (label, value) => `<div class="meta-item"><dt>${label}</dt><dd>${value}</dd></div>`;
  if (s.menuPath) meta.push(item(T.menuPath, `${h(s.menuPath.value.join(' › '))}${ev(s.menuPath.evidence)}`));
  // view(같은 주소에서 메뉴로 바뀌는 화면)는 부모 주소를 경로로 보인다
  if (s.route) meta.push(item(T.route, `<code>${h(s.route)}</code>`));
  else if (entry.kind === 'view') meta.push(item(T.route, `<code>${h(routeOf(inventory, s.parentId))}</code> · ${T.viewNote}`));
  else meta.push(item(T.parent, link(s.parentId)));
  const evTight = evOf(input, '');
  const roles = s.roles.length ? s.roles.map((r) => `${flag(r, T)}${h(r.value)}${evTight(r.evidence)}`).join(', ') : T.noRoles;
  meta.push(item(T.usedBy, roles));

  const sections = s.sections.length ? `<h2>${T.sections}</h2><ul class="chips">${s.sections.map((x) => `<li>${h(x.title)}${ev(x.evidence)}</li>`).join('')}</ul>` : '';
  const empty = `<p class="empty">${T.none}</p>`;
  // 같은 라벨이 여러 구획에 있을 때 어느 구획인지
  const sectionTag = (x) => (x.section ? `<span class="field-section">${h(x.section)}</span>` : '');
  const fields = s.fields.length
    ? `<ul class="fields">
${s.fields
  .map(
    (f) =>
      `<li><div class="field-head">${flag(f, T)}${sectionTag(f)}<span class="field-name">${h(f.label)}</span>${ev(f.evidence)}<span class="badge">${h(T.types[f.type])}</span>${f.required ? `<span class="badge required">${T.required}</span>` : ''}</div>${f.options ? `<ul class="options">${f.options.map((o) => `<li>${h(o)}</li>`).join('')}</ul>` : ''}</li>`,
  )
  .join('\n')}
</ul>`
    : empty;
  const actions = s.actions.length
    ? `<ul class="fields actions">
${s.actions
  .map((a) => {
    const next = [a.navigatesTo && `<span class="next">${T.goTo} → ${link(a.navigatesTo)}</span>`, a.opens && `<span class="next">${T.opens} → ${link(a.opens)}</span>`]
      .filter(Boolean)
      .join('');
    return `<li><div class="field-head">${sectionTag(a)}<span class="field-name">${h(a.label)}</span>${next}</div><p class="field-desc">${flag(a, T)}${h(a.effect)}${ev(a.evidence)}</p></li>`;
  })
  .join('\n')}
</ul>`
    : empty;
  // 묶음(group)이 없는 문구는 알림 상자로, 같은 묶음의 문구는 표 하나로(상태 코드마다 문구가 있는 화면이 길어지지 않게)
  const groups = new Map();
  for (const m of s.messages) if (m.group) groups.set(m.group, [...(groups.get(m.group) ?? []), m]);
  const messages = s.messages.length
    ? [
        ...s.messages
          .filter((m) => !m.group)
          .map((m) => `<aside class="callout note"><p class="callout-title">${h(m.text)}${ev(m.evidence)}</p><p>${h(m.when)}</p></aside>`),
        ...[...groups].map(
          ([name, list]) => `<div class="message-group">
<p class="message-group-title">${h(name)} <span>${list.length}</span></p>
<div class="table-wrap"><table class="messages"><thead><tr>${T.messageHead.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>
${list.map((m) => `<tr><td>${h(m.text)}${ev(m.evidence)}</td><td>${h(m.when)}</td></tr>`).join('\n')}
</tbody></table></div>
</div>`,
        ),
      ].join('\n')
    : empty;
  const children = inventory.screens.filter((x) => x.parentId === s.id);
  const childList = children.length ? `<h2>${T.children}</h2><ul class="chips">${children.map((c) => `<li>${link(c.id)}</li>`).join('')}</ul>` : '';
  const unknowns = s.unknowns.length
    ? `<h2>${T.flag}</h2>
<aside class="callout caution"><p class="callout-title">${T.unknownsTitle}</p><ul class="unknowns">${s.unknowns.map((u) => `<li>${h(u)}</li>`).join('')}</ul></aside>`
    : '';
  const sources =
    presetOf(input) === 'handover' ? `<h2>${T.sources}</h2><ul class="sources">${entry.files.map((f) => `<li><code>${h(f)}</code></li>`).join('')}</ul>` : '';

  const media = mediaOf(input);
  const shot = media.images.has(s.id)
    ? `${frame(`<img src="${prefix}media/img/${h(s.id)}.png" alt="${h(T.shotAlt(s.title.value))}" data-zoomable>`, s.route ?? '')}\n`
    : input.printAnchors
      ? `<p class="no-shot">${T.noShot}</p>\n`
      : '';
  const gif =
    media.gifs.has(s.id) && !input.printAnchors
      ? `<h2>${T.demo}</h2>\n${frame(`<img src="${prefix}media/gif/${h(s.id)}.gif" alt="${h(T.demoAlt(s.title.value))}" data-zoomable>`, s.route ?? '')}\n`
      : '';
  return `<${headingTag}>${h(s.title.value)}${ev(s.title.evidence)}</${headingTag}>
<p class="lead">${flag(s.purpose, T)}${h(s.purpose.value)}${ev(s.purpose.evidence)}</p>
${shot}
<dl class="meta">
${meta.join('\n')}
</dl>
${sections}
${gif}<h2>${T.fields}</h2>
${fields}
<h2>${T.actions}</h2>
${actions}
<h2>${T.messages}</h2>
${messages}
${childList}
${unknowns}
${sources}`;
}

function renderScreen(input, entry) {
  const body = `<p class="crumb"><a href="../screens.html">${textOf(input).screenList}</a> › <code>${h(entry.id)}</code></p>
${screenBody(input, entry)}`;
  return page({ ...input, title: input.screens.get(entry.id).title.value, body, root: '../', active: 'screens.html' });
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

// 워크플로우 다이어그램 색을 산출물 색에 맞춘다(다크 모드면 어두운 색). 테마별은 mermaidInit(theme)
export const MERMAID_INIT = mermaidInit(DEFAULT_THEME);

export function workflowsBody(input, { linkToScreen = (id) => screenHref(input, id) } = {}) {
  const { screens, summary } = input;
  const T = textOf(input);
  const blocks = summary.workflows
    .map((wf) => {
      const steps = wf.steps.map((id) => `<li><a href="${linkToScreen(id)}">${h(screenTitle(screens, id))}</a></li>`).join('');
      return `<section class="workflow">
<h2>${h(wf.name)}</h2>
<p>${h(wf.description)}</p>
<pre class="mermaid">
${workflowMermaid(input, wf)}
</pre>
<ol class="steps">${steps}</ol>
</section>`;
    })
    .join('\n');
  return `<h1>${T.workflows}</h1>
<p>${T.workflowsLead}</p>
${blocks}`;
}

function renderWorkflows(input) {
  const scripts = `<script src="assets/mermaid.min.js"></script>\n<script>mermaid.initialize(${mermaidInit(input.options?.theme)});</script>\n`;
  return page({ ...input, title: textOf(input).workflows, body: workflowsBody(input), root: '', scripts, active: 'workflows.html' });
}

const BASE_STYLE = `/* docent 산출물 스타일. 글꼴: Pretendard(SIL OFL 1.1, fonts/Pretendard-OFL.txt) */
@font-face {
  font-family: "Pretendard Variable";
  font-weight: 45 920;
  font-style: normal;
  font-display: swap;
  src: url("fonts/PretendardVariable.woff2") format("woff2-variations");
}
:root {
  --bg: #f6f6fb; --bg-soft: #f1f1f6; --card: #ffffff;
  --glow-1: rgba(99, 102, 241, 0.16); --glow-2: rgba(236, 72, 153, 0.10); --glow-3: rgba(14, 165, 233, 0.10); --dot: rgba(15, 15, 30, 0.07);
  --fg: #17171c; --muted: #6a6a76; --faint: #9a9aa6;
  --line: rgba(15, 15, 30, 0.08); --line-strong: rgba(15, 15, 30, 0.14);
  --accent: #4f46e5; --accent-soft: rgba(79, 70, 229, 0.08); --accent-fg: #ffffff;
  --note: #2563eb; --note-bg: rgba(37, 99, 235, 0.06); --note-line: rgba(37, 99, 235, 0.22);
  --caution: #b45309; --caution-bg: rgba(245, 158, 11, 0.1); --caution-line: rgba(217, 119, 6, 0.3);
  --success: #15803d;
  --radius: 14px; --radius-sm: 8px;
  --shadow: 0 1px 2px rgba(15, 15, 30, 0.04), 0 4px 14px rgba(15, 15, 30, 0.06);
  --shadow-lg: 0 2px 6px rgba(15, 15, 30, 0.05), 0 24px 48px -16px rgba(15, 15, 30, 0.22);
  --font: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --content: 1080px;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0b0b10; --bg-soft: #15151b; --card: #17171d;
    --glow-1: rgba(99, 102, 241, 0.22); --glow-2: rgba(236, 72, 153, 0.12); --glow-3: rgba(14, 165, 233, 0.10); --dot: rgba(255, 255, 255, 0.06);
    --fg: #ececf1; --muted: #a2a2ae; --faint: #6f6f7b;
    --line: rgba(255, 255, 255, 0.08); --line-strong: rgba(255, 255, 255, 0.14);
    --accent: #8b8cf8; --accent-soft: rgba(139, 140, 248, 0.12); --accent-fg: #0d0d10;
    --note: #7aa7ff; --note-bg: rgba(96, 140, 255, 0.1); --note-line: rgba(96, 140, 255, 0.28);
    --caution: #f5b544; --caution-bg: rgba(245, 158, 11, 0.12); --caution-line: rgba(245, 158, 11, 0.32);
    --success: #4ade80;
    --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 4px 14px rgba(0, 0, 0, 0.35);
    --shadow-lg: 0 2px 6px rgba(0, 0, 0, 0.4), 0 24px 48px -16px rgba(0, 0, 0, 0.7);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0; font-family: var(--font); font-size: 16px; line-height: 1.7; letter-spacing: -0.01em;
  color: var(--fg); background: var(--bg); word-break: keep-all; overflow-wrap: anywhere;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
/* 배경: 위쪽의 은은한 색 번짐과 점 격자(아래로 갈수록 흐려짐) */
body { position: relative; background:
  radial-gradient(1000px 520px at 8% -120px, var(--glow-1), transparent 65%),
  radial-gradient(820px 460px at 96% -80px, var(--glow-2), transparent 62%),
  radial-gradient(700px 420px at 50% 520px, var(--glow-3), transparent 65%) var(--bg) no-repeat; }
body::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 900px; z-index: -1; pointer-events: none;
  background-image: radial-gradient(var(--dot) 1px, transparent 1px); background-size: 22px 22px;
  -webkit-mask-image: linear-gradient(to bottom, #000, transparent); mask-image: linear-gradient(to bottom, #000, transparent); }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }
code { font-family: var(--mono); font-size: 0.86em; background: var(--bg-soft); border: 1px solid var(--line); border-radius: 6px; padding: 0.08em 0.4em; }
h1, h2, h3 { line-height: 1.3; letter-spacing: -0.025em; }
h1 { font-size: clamp(1.9rem, 3.4vw, 2.6rem); font-weight: 800; margin: 0.6rem 0 0.6rem; }
h2 { font-size: 1.3rem; font-weight: 700; margin: 2.6rem 0 0.9rem; }
h3 { font-size: 1.05rem; font-weight: 700; margin: 0 0 0.35rem; }
.lead { font-size: 1.12rem; color: var(--muted); margin: 0 0 1.4rem; max-width: 46rem; }

/* 머리말·꼬리말 */
header.site { position: sticky; top: 0; z-index: 10; background: color-mix(in srgb, var(--bg) 80%, transparent); backdrop-filter: saturate(180%) blur(12px); -webkit-backdrop-filter: saturate(180%) blur(12px); border-bottom: 1px solid var(--line); }
.site-inner { max-width: var(--content); margin: 0 auto; padding: 0 1.5rem; display: flex; align-items: center; gap: 1.5rem; }
header.site .site-inner { height: 60px; }
.brand { display: inline-flex; align-items: center; gap: 0.6rem; font-weight: 700; color: var(--fg); letter-spacing: -0.02em; }
.brand:hover { text-decoration: none; }
.brand-mark { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: linear-gradient(135deg, var(--accent), var(--accent-2)); color: #fff; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; }
header.site nav { display: flex; gap: 0.25rem; margin-left: auto; }
header.site nav a { color: var(--muted); padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.92rem; font-weight: 500; }
header.site nav a:hover { color: var(--fg); background: var(--bg-soft); text-decoration: none; }
header.site nav a[aria-current="page"] { color: var(--fg); background: var(--bg-soft); box-shadow: inset 0 0 0 1px var(--line); }
footer.site { margin-top: 5rem; border-top: 1px solid var(--line); background: color-mix(in srgb, var(--card) 55%, transparent); color: var(--faint); font-size: 0.85rem; }
footer.site .site-inner { padding-top: 1.6rem; padding-bottom: 2.4rem; }
main { max-width: var(--content); margin: 0 auto; padding: 2.2rem 1.5rem 0; }

/* 소개 */
.hero { position: relative; padding: 3.4rem 2.6rem 2.6rem; margin: 0 0 1rem; border-radius: 24px; color: #fff; overflow: hidden; isolation: isolate;
  box-shadow: 0 30px 60px -24px var(--hero-shadow); background: var(--hero-bg); }
.hero::after { content: ""; position: absolute; inset: 0; z-index: -1; opacity: 0.35;
  background-image: linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px); background-size: 32px 32px;
  -webkit-mask-image: radial-gradient(ellipse at 70% 0%, #000, transparent 70%); mask-image: radial-gradient(ellipse at 70% 0%, #000, transparent 70%); }
.hero h1 { font-size: clamp(2.2rem, 4.6vw, 3.4rem); margin: 0.3rem 0 0.8rem; color: #fff; }
.hero .lead { font-size: 1.2rem; color: rgba(255, 255, 255, 0.88); }
.hero .eyebrow { background: rgba(255, 255, 255, 0.14); border-color: rgba(255, 255, 255, 0.28); color: #fff; }
.hero .stats li { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.24); box-shadow: none; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.hero .stats span { color: rgba(255, 255, 255, 0.78); }
.eyebrow { display: inline-block; margin: 0; padding: 0.2rem 0.7rem; border-radius: 999px; background: var(--card); border: 1px solid var(--line); color: var(--accent); font-size: 0.8rem; font-weight: 600; letter-spacing: 0; }
.stats { list-style: none; display: flex; flex-wrap: wrap; gap: 0.8rem; padding: 0; margin: 1.6rem 0 0; }
.stats li { min-width: 120px; padding: 0.8rem 1.1rem; border-radius: 12px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); }
.stats b { display: block; font-size: 1.7rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1.2; }
.stats span { color: var(--muted); font-size: 0.85rem; }
.feature-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.9rem; }
.feature { padding: 1.1rem 1.2rem; border-radius: var(--radius); background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); transition: transform .18s ease, box-shadow .18s ease; }
.feature:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }
.feature h3::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.5rem; vertical-align: 0.12em; background: var(--accent); }
.feature p { margin: 0; color: var(--muted); font-size: 0.95rem; }
.chips { list-style: none; display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0; margin: 0 0 1rem; }
.chips li { padding: 0.25rem 0.8rem; border-radius: 999px; background: var(--card); border: 1px solid var(--line); font-size: 0.9rem; }
.notice { padding: 0.8rem 1rem; border-radius: var(--radius-sm); background: var(--bg-soft); border: 1px dashed var(--line-strong); color: var(--muted); }
.preview { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.2rem; }
.preview-title { display: inline-block; margin-top: 0.55rem; font-weight: 600; }
main > ul:not([class]), main ul:not([class]) ul { padding-left: 1.2rem; }

/* 브라우저 틀 */
.frame { margin: 1rem 0 1.4rem; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--line-strong); background: var(--card); box-shadow: var(--shadow-lg); }
.frame-bar { display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; background: var(--bg-soft); border-bottom: 1px solid var(--line); }
.frame-bar i { width: 10px; height: 10px; border-radius: 50%; background: #ff5f57; }
.frame-bar i:nth-child(2) { background: #febc2e; }
.frame-bar i:nth-child(3) { background: #28c840; }
.frame-url { margin: 0 auto; min-width: 40%; max-width: 70%; padding: 2px 12px; border-radius: 6px; background: var(--card); border: 1px solid var(--line); color: var(--muted); font: 12px/18px var(--mono); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frame img { display: block; width: 100%; height: auto; cursor: zoom-in; }
.medium-zoom-overlay, .medium-zoom-image--opened { z-index: 999; }

/* 화면 목록 */
.table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); background: var(--card); }
table { width: 100%; border-collapse: collapse; font-size: 0.93rem; }
th, td { padding: 0.7rem 0.9rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
th { background: var(--bg-soft); color: var(--muted); font-size: 0.8rem; font-weight: 600; text-transform: none; letter-spacing: 0; white-space: nowrap; }
/* 화면 목록: ID·화면·경로·메뉴는 줄을 바꾸지 않고, 남는 폭은 목적 칸이 쓴다(좁으면 표만 가로로 밀림) */
.screen-list td:nth-child(-n+4) { white-space: nowrap; }
.screen-list td:last-child { min-width: 16rem; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover td { background: var(--bg-soft); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.2rem; }
.card { display: flex; flex-direction: column; border-radius: var(--radius); background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); overflow: hidden; transition: transform .18s ease, box-shadow .18s ease; }
.card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); }
.card .frame { margin: 0; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; box-shadow: none; }
.card .frame img { aspect-ratio: 16 / 10; object-fit: cover; object-position: top; }
.card-body { padding: 1rem 1.1rem 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
.card h2 { font-size: 1.08rem; margin: 0; }
.card p { margin: 0; color: var(--muted); font-size: 0.93rem; }
.card .button { margin-top: auto; align-self: flex-start; }
.button { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.35rem 0.85rem; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 0.85rem; font-weight: 600; }
.button:hover { text-decoration: none; filter: brightness(1.05); }
.no-shot { margin: 0; padding: 2.4rem 1rem; text-align: center; color: var(--faint); background: repeating-linear-gradient(135deg, var(--bg-soft) 0 10px, transparent 10px 20px); border-bottom: 1px solid var(--line); }

/* 화면별 매뉴얼 */
.crumb { color: var(--muted); font-size: 0.88rem; margin: 0; }
dl.meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.7rem; margin: 0 0 0.5rem; }
.meta-item { padding: 0.75rem 1rem; border-radius: 12px; background: var(--card); box-shadow: var(--shadow); border: 1px solid var(--line); }
.meta-item dt { color: var(--muted); font-size: 0.78rem; font-weight: 600; }
.meta-item dd { margin: 0.1rem 0 0; }
.fields { list-style: none; padding: 0; margin: 0 0 0.5rem; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); box-shadow: var(--shadow); overflow: hidden; }
.fields > li { padding: 0.8rem 1.1rem; border-bottom: 1px solid var(--line); }
.fields > li:last-child { border-bottom: 0; }
.field-head { display: flex; flex-wrap: wrap; align-items: center; gap: 0.45rem; }
.field-name { font-weight: 650; }
.field-desc { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.94rem; }
.field-section { font-size: 0.78rem; color: var(--muted); padding: 0 0.45rem; border-radius: 6px; background: var(--bg-soft); border: 1px solid var(--line); }
.message-group { margin: 1rem 0; }
.message-group-title { margin: 0 0 0.4rem; font-weight: 600; }
.message-group-title span { margin-left: 0.3rem; font-size: 0.78rem; font-weight: 500; color: var(--muted); padding: 0 0.45rem; border-radius: 999px; border: 1px solid var(--line); }
table.messages td:first-child { width: 55%; }
.options { list-style: none; display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0; margin: 0.45rem 0 0; }
.options li { font-size: 0.82rem; padding: 0.05rem 0.55rem; border-radius: 999px; color: var(--muted); border: 1px dashed var(--line-strong); }
.badge { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; border: 1px solid var(--line-strong); color: var(--muted); font-size: 0.74rem; font-weight: 500; line-height: 1; white-space: nowrap; }
.badge.required { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); background: var(--accent-soft); }
.next { font-size: 0.85rem; color: var(--muted); margin-left: auto; }
mark.flag { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; background: var(--caution-bg); color: var(--caution); border: 1px solid var(--caution-line); font-size: 0.74rem; font-weight: 600; line-height: 1; vertical-align: 0.1em; }
.callout { margin: 0 0 0.6rem; padding: 0.8rem 1rem 0.8rem 2.6rem; border-radius: 12px; position: relative; border: 1px solid; }
.callout::before { position: absolute; left: 1rem; top: 0.82rem; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 0.72rem; font-weight: 800; color: #fff; }
.callout p { margin: 0; }
.callout .callout-title { font-weight: 650; margin-bottom: 0.15rem; }
.callout.note { background: var(--note-bg); border-color: var(--note-line); }
.callout.note::before { content: "i"; background: var(--note); }
.callout.note p:not(.callout-title) { color: var(--muted); font-size: 0.92rem; }
.callout.caution { background: var(--caution-bg); border-color: var(--caution-line); }
.callout.caution::before { content: "!"; background: var(--caution); }
.callout.caution ul { margin: 0.3rem 0 0; padding-left: 1.1rem; }
.empty { color: var(--faint); margin: 0; }
.sources { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 0.4rem; }

/* 워크플로우 */
section.workflow { margin: 1.4rem 0; padding: 1.4rem 1.5rem; border-radius: var(--radius); background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); }
section.workflow h2 { margin-top: 0; }
pre.mermaid { margin: 1rem 0; padding: 1.2rem; border-radius: 12px; background: var(--bg-soft); border: 1px solid var(--line); overflow-x: auto; text-align: center; }
.steps { list-style: none; counter-reset: step; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; padding: 0; margin: 0; }
.steps li { counter-increment: step; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.75rem 0.25rem 0.3rem; border-radius: 999px; background: var(--bg-soft); border: 1px solid var(--line); font-size: 0.9rem; }
.steps li::before { content: counter(step); display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); font-size: 0.72rem; font-weight: 700; }
.steps li + li { margin-left: 1.1rem; position: relative; }
.steps li + li::after { content: "→"; position: absolute; left: -1.2rem; color: var(--faint); }

/* 납품용 표지·목차 */
.cover { padding: 5rem 2.6rem 3rem; margin-bottom: 2.4rem; border-radius: 22px; color: #fff; background: var(--hero-bg); }
.cover h1 { font-size: 2.8rem; margin: 0 0 0.4rem; color: #fff; }
.cover .doc-title { font-size: 1.35rem; margin: 0 0 3rem; opacity: 0.85; }
.cover dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1.2rem; margin: 0; opacity: 0.9; }
.cover dd { margin: 0; }
.toc { padding: 1.4rem 1.6rem; border-radius: var(--radius); background: var(--bg-soft); border: 1px solid var(--line); }
.toc h2 { margin-top: 0; }
.toc ol { padding-left: 1.2rem; margin: 0; }

@media (max-width: 640px) {
  .site-inner { padding: 0 1rem; gap: 0.8rem; }
  header.site nav a { padding: 0.3rem 0.5rem; font-size: 0.85rem; }
  main { padding: 1.4rem 1rem 0; }
  .hero { padding: 2rem 1.2rem 1.6rem; }
}
@media print {
  :root { color-scheme: light; --bg: #fff; --bg-soft: #f6f6f8; --card: #fff; --fg: #17171c; --muted: #555561; --line: #e3e3e8; --line-strong: #d0d0d8; --shadow: none; --shadow-lg: none; }
  header.site, .crumb, footer.site, body::before { display: none; }
  body { background: #fff; }
  .hero { box-shadow: none; }
  main { max-width: none; padding: 0; }
  a { color: var(--fg); }
  h1, h2 { break-after: avoid; }
  .fields > li, .callout, section.workflow, .frame, .feature, .card, .preview-item, .meta-item, tr { break-inside: avoid; }
  .preview .frame img { aspect-ratio: 16 / 10; object-fit: cover; object-position: top; }
  .feature:hover, .card:hover { transform: none; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

// 기본 스타일 + 테마 색. STYLE은 기본 테마
export const styleFor = (theme) => BASE_STYLE + themeCss(theme ?? DEFAULT_THEME);
const STYLE = styleFor(DEFAULT_THEME);
export { STYLE };

export function renderSite(input) {
  const site = new Map();
  site.set('assets/style.css', styleFor(input.options?.theme));
  site.set('index.html', renderIndex(input));
  site.set('screens.html', renderList(input));
  site.set('workflows.html', renderWorkflows(input));
  if (presetOf(input) !== 'portfolio') {
    for (const entry of input.inventory.screens) site.set(`screens/${entry.id}.html`, renderScreen(input, entry));
  }
  return site;
}
