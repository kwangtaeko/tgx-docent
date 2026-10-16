// /docent review: 확신도 낮은 항목과 unknowns를 .docent/review.md로 모은다. (설계 문서 11장)
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { t } from '../lib/cli-text.mjs';
import { readFailures } from '../lib/media.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';

const header = () => [
  t('# 확인 필요 항목'),
  '',
  t('> docent가 소스만으로 확정하지 못한 내용입니다. 답을 적고 체크한 뒤 `/docent-analyze`를 다시 실행하면 반영됩니다.'),
  '',
];
const LINE = /^- \[([ xX])\] (.*?)\s*<!-- key: (.+?) -->\s*$/;
// 답 표시: 쓸 때는 현재 언어로, 읽을 때는 두 언어 모두 알아본다(언어를 바꿔도 이전 답이 남게)
const answerMark = () => t(' 답:');
const ANSWER_MARKS = [' 답:', ' Answer:']; // t-skip: review.md에서 찾는 표시(두 언어 모두 읽는다)

// 기존 review.md → key별 { checked, answer }
export function parseReview(text) {
  const previous = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const found = ANSWER_MARKS.map((mark) => [m[2].indexOf(mark), mark]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0])[0];
    previous.set(m[3], { checked: m[1] !== ' ', answer: found ? m[2].slice(found[0] + found[1].length).trim() : '' });
  }
  return previous;
}

function items(s) {
  const out = [];
  const low = (x) => x.confidence === 'low';
  if (low(s.purpose)) out.push([`purpose`, t('목적 — 확신도 낮음: {0} ({1})', s.purpose.value, s.purpose.evidence)]);
  s.roles.forEach((r, i) => low(r) && out.push([`roles[${i}]`, t('역할 {0} — 확신도 낮음 ({1})', r.value, r.evidence)]));
  s.fields.forEach((f, i) => low(f) && out.push([`fields[${i}]`, t('{0} — 확신도 낮음: 입력 항목 ({1})', f.label, f.evidence)]));
  s.actions.forEach((a, i) => low(a) && out.push([`actions[${i}]`, t('{0} — 확신도 낮음: {1} ({2})', a.label, a.effect, a.evidence)]));
  s.unknowns.forEach((u, i) => out.push([`unknowns[${i}]`, u]));
  return out;
}

function line(key, text, previous) {
  const prev = previous.get(key);
  const answer = prev?.answer ? `${answerMark()} ${prev.answer}` : '';
  return `- [${prev?.checked ? 'x' : ' '}] ${text}${answer} <!-- key: ${key} -->`;
}

// 실행 중인 앱 대조(crawl.json) 항목
function crawlItems(crawl, routes) {
  if (!crawl) return [];
  return [
    ...crawl.unmatched.map((p) => [`crawl|unmatched|${p}`, t('화면 목록에 없는 경로: {0}', p)]),
    ...crawl.unreached.map((id) => [`crawl|unreached|${id}`, t('앱에서 링크로 도달하지 못한 화면: {0} ({1})', id, routes.get(id) ?? t('경로 없음'))]),
  ];
}

// screens: inventory 순서의 화면 JSON 배열, extra: { crawl, routes: Map<id, route>, failures }
export function renderReview(screens, previous, extra = {}) {
  const lines = header();
  let count = 0;
  for (const s of screens) {
    const list = items(s);
    if (!list.length) continue;
    lines.push(`## ${s.id} · ${s.title.value}`, '');
    for (const [path, text] of list) {
      lines.push(line(`${s.id}|${path}`, text, previous));
      count++;
    }
    lines.push('');
  }
  const media = (extra.failures ?? []).map((f) => [
    `media|${f.kind}|${f.id}`,
    f.kind === 'capture'
      ? t('{0} 캡처 실패: {1} (media/fail/{0}.png)', f.id, f.reason)
      : t('{0} 녹화 실패: {1}{2} (media/fail/{0}.png)', f.id, f.step !== undefined ? t('{0}번째 단계 — ', f.step + 1) : '', f.reason),
  ]);
  if (media.length) {
    lines.push(t('## 캡처·녹화 실패'), '');
    for (const [key, text] of media) lines.push(line(key, text, previous));
    count += media.length;
    lines.push('');
  }
  const crawl = crawlItems(extra.crawl, extra.routes ?? new Map());
  if (crawl.length) {
    lines.push(t('## 실행 중인 앱 대조'), '');
    for (const [key, text] of crawl) lines.push(line(key, text, previous));
    count += crawl.length;
    lines.push('');
  }
  if (!count) lines.push(t('확인할 항목이 없습니다.'), '');
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
  const crawl = await readJsonIfExists(join(dir, 'crawl.json')).catch(() => undefined);
  const routes = new Map(inventory.screens.map((s) => [s.id, s.route]));
  const failures = await readFailures(projectDir);
  const text = renderReview(screens, previous, { crawl, routes, failures });
  await writeFile(path, text);
  return { items: text.split('\n').filter((l) => LINE.test(l)).length };
}
