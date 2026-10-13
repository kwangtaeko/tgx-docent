// 라우트에서 결정적으로 화면 ID를 만든다. (설계 문서 6장 "화면 ID 규칙")
import { createHash } from 'node:crypto';

const INTERCEPT_PREFIX = /^(\(\.{1,3}\))+/;

function slug(text) {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s) return s;
  // ASCII가 아닌 이름은 slug가 비므로 원문 해시로 결정적인 이름을 만든다.
  return 's' + createHash('sha1').update(text, 'utf8').digest('hex').slice(0, 8);
}

function segmentName(segment) {
  if (/^\(.*\)$/.test(segment) && !INTERCEPT_PREFIX.test(segment)) return null; // route group
  if (segment.startsWith('@')) return null; // 병렬 슬롯
  const name = segment.replace(INTERCEPT_PREFIX, '').replace(/^\[{1,2}(\.\.\.)?|\]{1,2}$/g, '');
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

export function assignIds(routes) {
  const ids = new Map();
  const taken = new Set();
  for (const route of [...routes].sort()) {
    const base = routeToId(route);
    let id = base;
    for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
    taken.add(id);
    ids.set(route, id);
  }
  return ids;
}
