import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { renderDiagrams } from '../../skills/docent/scripts/src/renderers/diagrams.mjs';
import { browser, closeBrowser } from '../helpers/browser.mjs';
import { loadGolden } from '../helpers/golden.mjs';

after(closeBrowser);
const ASSETS = 'skills/docent/assets';

test('워크플로우마다 PNG 하나', async () => {
  const input = await loadGolden();
  const pngs = await renderDiagrams(await browser(), input, { assetsDir: ASSETS });
  assert.equal(pngs.length, input.summary.workflows.length);
  for (const buf of pngs) {
    assert.ok(buf.subarray(1, 4).equals(Buffer.from('PNG')));
    assert.ok(PNG.sync.read(buf).width > 200);
  }
});

test('예약어 화면 ID도 렌더된다', async () => {
  const input = await loadGolden();
  input.screens.set('end', { ...input.screens.get('home'), id: 'end' });
  input.summary.workflows = [{ name: '끝', description: '끝', steps: ['end', 'orders'] }];
  const [png] = await renderDiagrams(await browser(), input, { assetsDir: ASSETS });
  assert.ok(PNG.sync.read(png).width > 100);
});

test('mermaid.render에 넘기는 정의는 HTML 엔티티가 아닌 원문 라벨', async () => {
  const { workflowMermaid } = await import('../../skills/docent/scripts/src/renderers/html.mjs');
  const input = await loadGolden();
  input.screens.get('orders').title.value = '주문 & 출고 "목록"';
  const wf = input.summary.workflows.find((w) => w.steps.includes('orders'));
  const raw = workflowMermaid(input, wf, { forHtml: false });
  assert.ok(raw.includes('주문 & 출고 #quot;목록#quot;'));
  assert.ok(workflowMermaid(input, wf).includes('주문 &amp; 출고'));
});
