// 인쇄용 HTML → PDF(Playwright page.pdf). (설계 문서 10장)
import { pathToFileURL } from 'node:url';
import { launchBrowser } from '../lib/playwright.mjs';
import { escapeHtml as h } from './escape.mjs';

export async function renderPdf(printHtmlPath, outPath, { title, date, browser } = {}) {
  const own = !browser;
  const b = browser ?? (await launchBrowser());
  try {
    const page = await b.newPage();
    await page.goto(pathToFileURL(printHtmlPath).href, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ready="1"]', { timeout: 20000 }).catch(() => {});
    await page.pdf({
      path: outPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '18mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;width:100%;text-align:right;padding-right:15mm;color:#59636e">${h(title ?? '')}</div>`,
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#59636e"><span class="pageNumber"></span> / <span class="totalPages"></span>${date ? ` · ${h(date)}` : ''}</div>`,
    });
    await page.close();
  } finally {
    if (own) await b.close();
  }
}
