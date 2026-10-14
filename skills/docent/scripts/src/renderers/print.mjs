// PDF용 인쇄 HTML: 모든 내용을 한 문서로 잇는다. Mermaid 렌더가 끝나면 body[data-ready="1"]. (설계 문서 10장)
import { escapeHtml as h } from './escape.mjs';
import { cardsBody, coverBody, introBody, listBody, presetOf, revisionsBody, screenBody, STYLE, tocBody, workflowsBody } from './html.mjs';

const PRINT_STYLE = `
.screen, .part { break-before: page; }
.cover { break-after: page; }
header.site, footer.site, .crumb { display: none; }
main { max-width: none; padding: 0 0.5rem; }
`;

export function renderPrint(input) {
  const preset = presetOf(input);
  const printInput = { ...input, printAnchors: true };
  const anchor = (id) => `#screen-${h(id)}`;
  const parts = [];
  if (preset === 'delivery') parts.push(coverBody(input), tocBody(input, { anchors: true }));
  // 인쇄 문서 안에서는 화면 링크를 문서 내부 앵커로 바꾼다
  const toAnchors = (html) => html.replace(/href="screens\/([^"]+)\.html"/g, 'href="#screen-$1"').replace(/href="screens\.html#([^"]+)"/g, 'href="#$1"');
  parts.push(`<section class="part" id="intro">${toAnchors(introBody(printInput, { from: 'root' }))}</section>`);
  if (preset === 'portfolio') {
    parts.push(`<section class="part" id="screen-list">${cardsBody(input)}</section>`);
    parts.push(`<section class="part" id="workflows">${workflowsBody(input, { linkToScreen: (id) => `#${h(id)}` })}</section>`);
  } else {
    parts.push(`<section class="part" id="screen-list">${toAnchors(listBody(input))}</section>`);
    parts.push(`<section class="part" id="workflows">${workflowsBody(input, { linkToScreen: anchor })}</section>`);
    for (const entry of input.inventory.screens) {
      parts.push(`<section class="screen" id="screen-${h(entry.id)}">${screenBody(printInput, entry, { from: 'root' })}</section>`);
    }
  }
  if (preset === 'delivery') parts.push(revisionsBody(input));
  const title = input.options?.title ?? '사용자 매뉴얼';
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${h(input.projectName)} ${h(title)}</title>
<style>
${STYLE}${PRINT_STYLE}</style>
</head>
<body>
<main>
${parts.join('\n')}
</main>
<script src="assets/mermaid.min.js"></script>
<script>
(async () => {
  try {
    mermaid.initialize({ startOnLoad: false });
    await mermaid.run({ querySelector: 'pre.mermaid' });
  } finally {
    document.body.dataset.ready = '1';
  }
})();
</script>
</body>
</html>
`;
}
