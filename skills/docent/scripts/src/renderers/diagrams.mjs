// 워크플로우 Mermaid → PNG(Playwright). PPT에 넣는다. 그리지 못한 워크플로우는 null. (설계 문서 10장)
import { join } from 'node:path';
import { workflowMermaid } from './html.mjs';

export async function renderDiagrams(browser, input, { assetsDir }) {
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width: 1400, height: 900 } });
  try {
    const page = await context.newPage();
    await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="d" style="display:inline-block;padding:16px;background:#fff"></div></body></html>');
    await page.addScriptTag({ path: join(assetsDir, 'mermaid.min.js') });
    await page.evaluate(() => window.mermaid.initialize({ startOnLoad: false, theme: 'default' }));
    const pngs = [];
    for (const [i, wf] of input.summary.workflows.entries()) {
      const code = workflowMermaid(input, wf, { forHtml: false });
      try {
        await page.evaluate(
          async ({ code, i }) => {
            const { svg } = await window.mermaid.render(`wf${i}`, code);
            document.getElementById('d').innerHTML = svg;
          },
          { code, i },
        );
        pngs.push(await page.locator('#d').screenshot({ type: 'png' }));
      } catch {
        pngs.push(null); // 이 워크플로우는 단계 목록만 넣는다(HTML·PDF와 같게)
      }
    }
    return pngs;
  } finally {
    await context.close();
  }
}
