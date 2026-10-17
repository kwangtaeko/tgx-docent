// 근거(evidence)가 실제 소스 위치를 가리키는지 검사한다. (설계 문서 11장)
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';
import { t } from './cli-text.mjs';

export const TEXT_WINDOW = 5;
// 문구 안의 자리 표시({버전}, {name})와 그 자리에 올 수 있는 소스 글자 수
const PLACEHOLDER = /\{[^{}\n]{1,30}\}/;
const PLACEHOLDER_GAP = 160;
// 문장 안에 끼는 JSX 인라인 태그와 공백 표현({" "}·{' '})
const INLINE_TAG = /<\/?(?:b|strong|em|i|u|s|mark|small|span|code|kbd|sup|sub|a|br)(?:\s[^<>]*)?\/?>/g;
const JSX_COMMENT = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g;
const JSX_SPACE = /\{\s*(?:"\s*"|'\s*'|`\s*`)\s*\}/g;
const MAX_PLACEHOLDERS = 20;

const LINE_RANGE = /^(\d+)(?:-(\d+))?$/;
const SYMBOL = /^[A-Za-z_$][\w$.]*$/;

// 자리 표시를 뺀 글자 조각들이 순서대로, 자리마다 PLACEHOLDER_GAP자 안에 이어지는지.
// 정규식 대신 indexOf로 찾는다(자리가 여럿이면 정규식 되돌아가기가 지수적으로 느려짐).
// 각 조각은 가능한 가장 앞에서 찾는다 — 간격에 상한만 있으므로 가장 앞이 늘 최선이다
export function matchesWithPlaceholders(text, source) {
  const parts = text.split(PLACEHOLDER);
  if (parts.length < 2 || parts.length > MAX_PLACEHOLDERS + 1) return false;
  const pieces = [];
  let gaps = 0;
  parts.forEach((part, i) => {
    if (i > 0) gaps++;
    if (!part.trim()) return; // 이어진 자리 표시({a}{b})는 간격을 합친다
    pieces.push({ text: part, maxGap: gaps * PLACEHOLDER_GAP });
    gaps = 0;
  });
  if (!pieces.length || pieces.map((p) => p.text).join('').replace(/\s/g, '').length < 2) return false;
  const [first, ...rest] = pieces;
  for (let start = source.indexOf(first.text); start >= 0; start = source.indexOf(first.text, start + 1)) {
    let pos = start + first.text.length;
    let ok = true;
    for (const piece of rest) {
      const at = source.indexOf(piece.text, pos);
      if (at < 0 || at - pos > piece.maxGap) {
        ok = false;
        break;
      }
      pos = at + piece.text.length;
    }
    if (ok) return true;
  }
  return false;
}

export function parseEvidence(s) {
  const i = s.lastIndexOf(':');
  const file = i > 0 ? s.slice(0, i) : '';
  const loc = i > 0 ? s.slice(i + 1) : '';
  const range = LINE_RANGE.exec(loc);
  if (file && range) {
    const startLine = Number(range[1]);
    return { file, startLine, endLine: range[2] ? Number(range[2]) : startLine };
  }
  if (file && SYMBOL.test(loc)) return { file, symbol: loc };
  throw new Error(t('근거 형식 오류: {0}', s));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function checkEvidence(rootDir, evidence, opts = {}) {
  let ev;
  try {
    ev = parseEvidence(evidence);
  } catch (err) {
    return { ok: false, reason: err.message };
  }

  const rootPath = resolve(rootDir);
  const target = resolve(rootPath, ev.file);
  if (ev.file.includes('\\') || isAbsolute(ev.file) || !target.startsWith(rootPath + sep)) {
    return { ok: false, reason: t('project root 밖의 경로: {0}', ev.file) };
  }

  // 루트 안의 심볼릭 링크가 루트 밖 파일을 가리키는 경우도 막는다
  try {
    const [realRoot, realTarget] = await Promise.all([realpath(rootPath), realpath(target)]);
    if (!realTarget.startsWith(realRoot + sep)) return { ok: false, reason: t('project root 밖의 경로: {0}', ev.file) };
  } catch {
    return { ok: false, reason: t('파일 없음: {0}', ev.file) };
  }

  let lines;
  try {
    lines = (await readFile(target, 'utf8')).split(/\r\n|\r|\n/);
  } catch {
    return { ok: false, reason: t('파일 없음: {0}', ev.file) };
  }
  if (lines.at(-1) === '') lines.pop();

  let window;
  if ('symbol' in ev) {
    const pattern = new RegExp(`(^|[^\\w$])${escapeRegExp(ev.symbol)}($|[^\\w$])`);
    const hits = lines.flatMap((line, i) => (pattern.test(line) ? [i] : []));
    if (hits.length === 0) {
      return { ok: false, reason: t('{0}에 {1} 없음', ev.file, ev.symbol) };
    }
    // 심볼이 나오는 각 위치의 ±TEXT_WINDOW줄
    window = lines.filter((_, i) => hits.some((h) => Math.abs(i - h) <= TEXT_WINDOW));
  } else {
    const { startLine, endLine } = ev;
    if (startLine < 1 || startLine > endLine || endLine > lines.length) {
      return { ok: false, reason: t('{0}의 라인 범위 오류: {1}-{2} (전체 {3}줄)', ev.file, startLine, endLine, lines.length) };
    }
    window = lines.slice(Math.max(0, startLine - 1 - TEXT_WINDOW), endLine + TEXT_WINDOW);
  }

  // 문구가 여러 줄로 나뉘어 있을 수 있으므로 공백을 하나로 모은 창 전체에서도 찾는다
  const squash = (t) => t.replace(/\s+/g, ' ').trim();
  const joined = squash(window.join(' '));
  // JSX에서 한 문장이 인라인 태그(<b>·<strong>·<br/> 등)나 {" "}로 끊겨 있어도 화면에는 이어진 글자로 보인다
  const plain = squash(joined.replace(JSX_COMMENT, '').replace(INLINE_TAG, '').replace(JSX_SPACE, ' '));
  const found = (text) => {
    if (window.some((line) => line.includes(text)) || joined.includes(squash(text)) || plain.includes(squash(text))) return true;
    // 실행 중에 값이 채워지는 문구: {이름} 자리는 소스의 ${...}·변수 등 짧은 글자로 본다(나머지 글자는 그대로 있어야 함)
    return matchesWithPlaceholders(squash(text), joined) || matchesWithPlaceholders(squash(text), plain);
  };
  if (opts.expectText !== undefined && !found(opts.expectText)) {
    return { ok: false, reason: t('{0} 근처(±{1}줄)에 "{2}" 없음', evidence, TEXT_WINDOW, opts.expectText) };
  }
  return { ok: true };
}
