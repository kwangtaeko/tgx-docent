// /docent review: 확신도 낮은 항목과 unknowns를 .docent/review.md로 모은다. (설계 문서 11장)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { docentDir, readJson } from '../lib/workspace.mjs';

const HEADER = [
  '# 확인 필요 항목',
  '',
  '> docent가 소스만으로 확정하지 못한 내용입니다. 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영됩니다.',
  '',
];
const LINE = /^- \[([ xX])\] (.*?)\s*<!-- key: (.+?) -->\s*$/;
const ANSWER = ' 답:';

// 기존 review.md → key별 { checked, answer }
export function parseReview(text) {
  const previous = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const i = m[2].indexOf(ANSWER);
    previous.set(m[3], { checked: m[1] !== ' ', answer: i >= 0 ? m[2].slice(i + ANSWER.length).trim() : '' });
  }
  return previous;
}

function items(s) {
  const out = [];
  const low = (x) => x.confidence === 'low';
  if (low(s.purpose)) out.push([`purpose`, `목적 — 확신도 낮음: ${s.purpose.value} (${s.purpose.evidence})`]);
  s.roles.forEach((r, i) => low(r) && out.push([`roles[${i}]`, `역할 ${r.value} — 확신도 낮음 (${r.evidence})`]));
  s.fields.forEach((f, i) => low(f) && out.push([`fields[${i}]`, `${f.label} — 확신도 낮음: 입력 항목 (${f.evidence})`]));
  s.actions.forEach((a, i) => low(a) && out.push([`actions[${i}]`, `${a.label} — 확신도 낮음: ${a.effect} (${a.evidence})`]));
  s.unknowns.forEach((u, i) => out.push([`unknowns[${i}]`, u]));
  return out;
}

// screens: inventory 순서의 화면 JSON 배열
export function renderReview(screens, previous) {
  const lines = [...HEADER];
  let count = 0;
  for (const s of screens) {
    const list = items(s);
    if (!list.length) continue;
    lines.push(`## ${s.id} · ${s.title.value}`, '');
    for (const [path, text] of list) {
      const key = `${s.id}|${path}`;
      const prev = previous.get(key);
      const answer = prev?.answer ? `${ANSWER} ${prev.answer}` : '';
      lines.push(`- [${prev?.checked ? 'x' : ' '}] ${text}${answer} <!-- key: ${key} -->`);
      count++;
    }
    lines.push('');
  }
  if (!count) lines.push('확인할 항목이 없습니다.', '');
  return lines.join('\n');
}

export async function runReview(projectDir) {
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = [];
  for (const { id } of inventory.screens) {
    try {
      screens.push(await readJson(join(dir, 'screens', `${id}.json`)));
    } catch {
      // 아직 분석되지 않았거나 깨진 화면은 validate가 보고한다
    }
  }
  const path = join(dir, 'review.md');
  let previous = new Map();
  try {
    previous = parseReview(await readFile(path, 'utf8'));
  } catch {
    // 처음 만드는 경우
  }
  const text = renderReview(screens, previous);
  await writeFile(path, text);
  return { items: text.split('\n').filter((l) => LINE.test(l)).length };
}
