// 근거(evidence)가 실제 소스 위치를 가리키는지 검사한다. (설계 문서 11장)
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';

export const TEXT_WINDOW = 5;

const LINE_RANGE = /^(\d+)(?:-(\d+))?$/;
const SYMBOL = /^[A-Za-z_$][\w$.]*$/;

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
  throw new Error(`근거 형식 오류: ${s}`);
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
    return { ok: false, reason: `project root 밖의 경로: ${ev.file}` };
  }

  let lines;
  try {
    lines = (await readFile(target, 'utf8')).split(/\r?\n/);
  } catch {
    return { ok: false, reason: `파일 없음: ${ev.file}` };
  }
  if (lines.at(-1) === '') lines.pop();

  let window;
  if ('symbol' in ev) {
    const pattern = new RegExp(`(^|[^\\w$])${escapeRegExp(ev.symbol)}($|[^\\w$])`);
    if (!lines.some((line) => pattern.test(line))) {
      return { ok: false, reason: `${ev.file}에 ${ev.symbol} 없음` };
    }
    window = lines;
  } else {
    const { startLine, endLine } = ev;
    if (startLine < 1 || startLine > endLine || endLine > lines.length) {
      return { ok: false, reason: `${ev.file}의 라인 범위 오류: ${startLine}-${endLine} (전체 ${lines.length}줄)` };
    }
    window = lines.slice(Math.max(0, startLine - 1 - TEXT_WINDOW), endLine + TEXT_WINDOW);
  }

  if (opts.expectText !== undefined && !window.some((line) => line.includes(opts.expectText))) {
    return { ok: false, reason: `${evidence} 근처(±${TEXT_WINDOW}줄)에 "${opts.expectText}" 없음` };
  }
  return { ok: true };
}
