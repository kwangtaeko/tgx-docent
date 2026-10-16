// 인쇄용 HTML → PDF(Playwright page.pdf). (설계 문서 10장)
import { pathToFileURL } from 'node:url';
import { launchBrowser } from '../lib/playwright.mjs';
import { escapeHtml as h } from './escape.mjs';

const BAND_BG = '#f6f6fb';
const band = (inner, justify) =>
  `<style>#header,#footer{padding:0!important}</style><div style="-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;width:100%;height:18mm;margin:0;padding:0 15mm;display:flex;align-items:center;justify-content:${justify};background:${BAND_BG};font-size:8px;color:#6a6a76">${inner}</div>`;

// → { diagramsReady }: Mermaid 렌더가 끝나지 않았으면 false(PDF에 원문이 들어갔을 수 있음)
export async function renderPdf(printHtmlPath, outPath, { title, date, browser, waitMs = 20000 } = {}) {
  const own = !browser;
  const b = browser ?? (await launchBrowser());
  try {
    const page = await b.newPage();
    await page.goto(pathToFileURL(printHtmlPath).href, { waitUntil: 'load' });
    const diagramsReady = await page
      .waitForSelector('body[data-ready="1"]', { timeout: waitMs })
      .then(() => true)
      .catch(() => false);
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      // 좌우 여백은 인쇄용 HTML의 안쪽 여백으로, 위아래 여백은 바탕색을 칠한 머리글·바닥글로 채워 쪽 전체가 같은 바탕이 되게 한다
      margin: { top: '18mm', bottom: '18mm', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: band(`<span style="margin-left:auto">${h(title ?? '')}</span>`, 'flex-end'),
      footerTemplate: band(`<span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>${date ? `&nbsp;·&nbsp;${h(date)}` : ''}`, 'center'),
    });
    await page.close();
    return { diagramsReady };
  } finally {
    if (own) await b.close();
  }
}
