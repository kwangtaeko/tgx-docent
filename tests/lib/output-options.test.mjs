import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../../skills/docent/scripts/src/lib/config.mjs';
import { FORMATS, PRESETS, resolveOutputOptions } from '../../skills/docent/scripts/src/lib/output-options.mjs';

const cfg = (output) => ({ ...structuredClone(DEFAULT_CONFIG), output: { ...DEFAULT_CONFIG.output, ...output } });

test('상수', () => {
  assert.deepEqual(PRESETS, ['delivery', 'handover', 'portfolio']);
  assert.deepEqual(FORMATS, ['html', 'readme', 'pdf', 'pptx']);
});

test('기본값', () => {
  assert.deepEqual(resolveOutputOptions(structuredClone(DEFAULT_CONFIG), {}), {
    preset: 'handover',
    formats: ['html', 'readme'],
    language: 'ko',
    theme: 'indigo',
    device: 'desktop',
    title: '사용자 매뉴얼',
    organization: '',
    revisions: [],
  });
});

test('language: en이면 기본 제목이 영어', () => {
  const config = structuredClone(DEFAULT_CONFIG);
  config.language = 'en';
  const r = resolveOutputOptions(config, {});
  assert.equal(r.language, 'en');
  assert.equal(r.title, 'User Manual');
});

test('CLI 값이 우선하고 형식은 정렬·중복 제거', () => {
  const r = resolveOutputOptions(cfg({ preset: 'portfolio' }), { preset: 'delivery', formats: ['pptx', 'html', 'html'] });
  assert.equal(r.preset, 'delivery');
  assert.deepEqual(r.formats, ['html', 'pptx']);
});

test('잘못된 값', () => {
  assert.throws(() => resolveOutputOptions(cfg({}), { preset: 'x' }), /delivery, handover, portfolio/);
  assert.throws(() => resolveOutputOptions(cfg({}), { formats: ['docx'] }), /html, readme, pdf, pptx/);
});

test('개정 이력 검사', () => {
  assert.throws(() => resolveOutputOptions(cfg({ revisions: [{ version: '1.0', date: '2026-10-14', author: '김' }] }), {}), /output\.revisions\[0\].*note/);
  assert.throws(() => resolveOutputOptions(cfg({ revisions: [{ version: 1, date: 'd', author: 'a', note: 'n' }] }), {}), /output\.revisions\[0\].*version/);
  const ok = { version: '1.0', date: '2026-10-14', author: '김', note: '최초' };
  assert.deepEqual(resolveOutputOptions(cfg({ revisions: [ok] }), {}).revisions, [ok]);
});

test('형식이 비면 오류', () => {
  assert.throws(() => resolveOutputOptions(structuredClone(DEFAULT_CONFIG), { formats: [] }), /만들 형식이 없습니다/);
  assert.throws(() => resolveOutputOptions(cfg({ formats: [] }), {}), /만들 형식이 없습니다/);
});

test('개정 이력 오류 문구', () => {
  assert.throws(() => resolveOutputOptions(cfg({ revisions: [{ date: 'x', author: 'y', note: 'z' }] }), {}), /revisions\[0\]의 version 값이 없거나/);
});

test('theme은 정해진 이름만 받는다', () => {
  assert.equal(resolveOutputOptions(cfg({ theme: 'emerald' })).theme, 'emerald');
  assert.throws(() => resolveOutputOptions(cfg({ theme: 'neon' })), /알 수 없는 테마 "neon"/);
});

test('객체 기본 속성 이름(constructor 등)은 테마가 아니다', () => {
  for (const theme of ['constructor', '__proto__', 'toString']) assert.throws(() => resolveOutputOptions(cfg({ theme })), /알 수 없는 테마/);
});
