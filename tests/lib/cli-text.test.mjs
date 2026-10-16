import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EN, setCliLanguage, t } from '../../skills/docent/scripts/src/lib/cli-text.mjs';

const SRC = 'skills/docent/scripts/src';
// 산출물 문구는 renderers/i18n.mjs가, 번역표는 cli-text/가 맡는다
const SKIP = [/^renderers\//, /^lib\/cli-text/];

async function sourceFiles(dir = SRC, rel = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await sourceFiles(join(dir, e.name), r)));
    else if (e.name.endsWith('.mjs') && !SKIP.some((s) => s.test(r))) out.push(r);
  }
  return out.sort();
}

// 주석을 뺀 코드(줄 단위 // 와 /* */)
const code = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, '')) // 줄 번호가 원본과 맞게 줄바꿈은 남긴다
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? '' : line.replace(/(^|[^:'"`])\/\/(?![^'"`]*['"`]).*$/, '$1')))
    .join('\n');

// t('…') · t("…") · t(`…`)의 첫 인자(문자열 리터럴)
const T_CALL = /\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const unescape = (s, q) => (q === '`' ? s : s.replace(/\\(['"\\])/g, '$1'));

test('명령줄 문구의 한국어 문자열은 모두 t()로 감싼다', async () => {
  const missing = [];
  for (const file of await sourceFiles()) {
    const raw = (await readFile(join(SRC, file), 'utf8')).split('\n');
    const body = code(raw.join('\n'));
    body.split('\n').forEach((line, i) => {
      // 문구가 아니라 데이터인 한국어(소스에서 찾는 글자 등)는 그 줄 끝에 `// t-skip: 이유`
      if (/\/\/ t-skip\b/.test(raw[i] ?? '')) return;
      if (/[가-힣]/.test(line.replace(T_CALL, ''))) missing.push(`${file}:${i + 1}: ${line.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(missing, []);
});

test('t()로 감싼 문구는 모두 영어 번역이 있고, {n} 자리가 같다', async () => {
  const problems = [];
  for (const file of await sourceFiles()) {
    const body = code(await readFile(join(SRC, file), 'utf8'));
    for (const m of body.matchAll(T_CALL)) {
      const key = unescape(m[2], m[1]);
      if (m[1] === '`' && key.includes('${')) {
        problems.push(`${file}: t()의 문구에 \${…}를 쓰지 말고 {0} 자리와 인자로: ${key.slice(0, 60)}`);
        continue;
      }
      if (!Object.hasOwn(EN, key)) {
        problems.push(`${file}: 번역 없음: ${key.slice(0, 80)}`);
        continue;
      }
      const slots = (s) => [...s.matchAll(/\{(\d+)\}/g)].map((x) => x[1]).sort().join(',');
      if (slots(key) !== slots(EN[key])) problems.push(`${file}: {n} 자리가 다름: ${key.slice(0, 60)}`);
      if (/[가-힣]/.test(EN[key])) problems.push(`${file}: 번역에 한국어가 남음: ${EN[key].slice(0, 60)}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('t(): 기본은 한국어, en이면 번역, 인자 자리 채우기', () => {
  setCliLanguage('en');
  try {
    assert.equal(t('없는 문구 {0}', 1), '없는 문구 1');
  } finally {
    setCliLanguage('ko');
  }
  assert.equal(t('파일 {0}·{1}', 'a', 'b'), '파일 a·b');
});
