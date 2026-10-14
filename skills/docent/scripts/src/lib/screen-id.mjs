// 라우트에서 결정적으로 화면 ID를 만든다. (설계 문서 6장 "화면 ID 규칙")
import { createHash } from 'node:crypto';

const INTERCEPT_PREFIX = /^(\(\.{1,3}\))+/;

const NON_ASCII_WORD = /[^\x00-\x7F]/u;
// 서버 렌더링 레거시 페이지 확장자(/Orders/List.aspx → orders-list)
const LEGACY_PAGE_EXT = /\.(aspx|jsp|do|php|html?)$/i;

function slug(text) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  // ASCII가 아닌 글자는 slug에서 빠지므로, 그런 글자가 있으면 원문 해시를 붙여 구별한다(/주문a ≠ /a).
  const hasNonAscii = [...text].some((c) => NON_ASCII_WORD.test(c) && /[\p{L}\p{N}]/u.test(c));
  if (s && !hasNonAscii) return s;
  const h = 's' + createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 8);
  return s ? `${s}-${h}` : h;
}

function segmentName(segment) {
  if (/^\(.*\)$/.test(segment) && !INTERCEPT_PREFIX.test(segment)) return null; // route group
  if (segment.startsWith('@')) return null; // 병렬 슬롯
  const name = segment
    .replace(INTERCEPT_PREFIX, '')
    .replace(LEGACY_PAGE_EXT, '')
    .replace(/^\[{1,2}(\.\.\.)?|\]{1,2}$/g, '');
  return name || null;
}

export function routeToId(route) {
  const parts = route
    .split('/')
    .filter(Boolean)
    .map(segmentName)
    .filter((name) => name !== null)
    .map(slug);
  return parts.length ? parts.join('-') : 'home';
}

export function childId(parentId, name) {
  return `${parentId}--${slug(name)}`;
}

// previous: 이전 실행의 라우트 → ID 맵. 남아 있는 라우트는 같은 ID를 유지해,
// 새 라우트가 추가돼도 기존 화면의 ID(증분 갱신·캡처·GIF의 키)가 바뀌지 않게 한다.
export function assignIds(routes, previous = new Map()) {
  const ids = new Map();
  const taken = new Set();
  const sorted = [...routes].sort();
  for (const route of sorted) {
    const kept = previous.get(route);
    if (kept !== undefined && !taken.has(kept)) {
      ids.set(route, kept);
      taken.add(kept);
    }
  }
  for (const route of sorted) {
    if (ids.has(route)) continue;
    const base = routeToId(route);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    ids.set(route, id);
  }
  return new Map(routes.map((route) => [route, ids.get(route)]));
}
