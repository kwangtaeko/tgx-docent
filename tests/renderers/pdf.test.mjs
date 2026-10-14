import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderPdf } from '../../skills/docent/scripts/src/renderers/pdf.mjs';
import { renderPrint } from '../../skills/docent/scripts/src/renderers/print.mjs';
import { loadGolden, loadLarge } from '../helpers/golden.mjs';

async function printDir(input) {
  const dir = await mkdtemp(join(tmpdir(), 'docent-pdf-'));
  await mkdir(join(dir, 'assets'));
  await copyFile('skills/docent/assets/mermaid.min.js', join(dir, 'assets', 'mermaid.min.js'));
  await writeFile(join(dir, 'print.html'), renderPrint(input));
  return dir;
}

const pageCount = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

test('인쇄용 HTML을 PDF로 만든다', async () => {
  const input = await loadGolden();
  input.options = { preset: 'delivery', title: '사용자 매뉴얼', organization: '', revisions: [] };
  const dir = await printDir(input);
  const out = join(dir, 'manual.pdf');
  await renderPdf(join(dir, 'print.html'), out, { title: '사용자 매뉴얼', date: input.date });
  const buf = await readFile(out);
  assert.equal(buf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pageCount(buf) >= input.inventory.screens.length + 3, String(pageCount(buf)));
});

test('화면 60개도 60초 안에', { timeout: 60000 }, async () => {
  const input = await loadLarge(60);
  const dir = await printDir(input);
  const out = join(dir, 'manual.pdf');
  await renderPdf(join(dir, 'print.html'), out, { title: '사용자 매뉴얼', date: input.date });
  assert.ok(pageCount(await readFile(out)) >= 60);
});
