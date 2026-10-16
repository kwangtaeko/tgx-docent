import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { renderSite } from '../../skills/docent/scripts/src/renderers/html.mjs';
import { backdrop, renderPptx } from '../../skills/docent/scripts/src/renderers/pptx.mjs';
import { renderPrint } from '../../skills/docent/scripts/src/renderers/print.mjs';
import { THEMES, themeCss } from '../../skills/docent/scripts/src/renderers/theme.mjs';
import { loadGolden } from '../helpers/golden.mjs';

const withTheme = async (theme) => {
  const input = await loadGolden();
  input.options = { preset: 'handover', formats: ['html'], language: 'ko', theme, title: '사용자 매뉴얼', organization: '', revisions: [] };
  return input;
};

test('테마마다 필요한 색이 모두 있다', () => {
  for (const [name, t] of Object.entries(THEMES)) {
    for (const key of ['accent', 'accentDark', 'accent2', 'soft', 'ink', 'onInk', 'chipLine']) assert.match(t[key], /^[0-9A-F]{6}$/, `${name}.${key}`);
    assert.equal(t.hero.length, 3, name);
    assert.equal(t.glow.length, 2, name);
  }
});

test('HTML·인쇄용 HTML의 강조색과 다이어그램 색이 테마를 따른다', async () => {
  const site = renderSite(await withTheme('emerald'));
  const css = site.get('assets/style.css');
  assert.ok(css.endsWith(themeCss('emerald')));
  assert.match(css, /--accent: #059669/);
  assert.match(site.get('workflows.html'), /primaryColor: '#ECFDF5'/);
  const print = renderPrint(await withTheme('rose'));
  assert.match(print, /--accent: #E11D48/);
  assert.match(print, /primaryColor: '#FFF1F2'/);
});

test('테마를 적지 않으면 indigo', async () => {
  const input = await withTheme(undefined);
  assert.match(renderSite(input).get('assets/style.css'), /테마: indigo/);
});

test('PPTX 강조색·배경 그림이 테마를 따른다', async () => {
  const input = await withTheme('blue');
  const zip = await JSZip.loadAsync(await renderPptx(input, { mediaDir: await mkdtemp(join(tmpdir(), 'docent-media-')) }));
  const slide2 = await zip.file('ppt/slides/slide2.xml').async('string');
  assert.match(slide2, /2563EB/);
  assert.doesNotMatch(slide2, /4F46E5/);
  assert.notEqual(backdrop('cover', 'blue'), backdrop('cover', 'indigo'));
});
