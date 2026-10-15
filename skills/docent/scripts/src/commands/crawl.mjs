// docent crawl — 실행 중인 앱을 링크로 돌아다니며 화면 목록과 대조한다. (설계 문서 6장 3번)
import { join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { launchBrowser } from '../lib/playwright.mjs';
import { docentDir, readJson, writeJson } from '../lib/workspace.mjs';
import { newContext } from './auth.mjs';
import { loadRun } from './run.mjs';

// 로그아웃 링크: /logout, /Logout.aspx, logout.php, /logoff, sign_out, ?action=logout 등
const LOGOUT = /(log[-_]?(out|off)|sign[-_]?(out|off))/i;
const FILE_EXT = /\.(pdf|zip|gz|tar|png|jpe?g|gif|svg|webp|ico|csv|xlsx?|docx?|pptx?|hwp|txt|xml|json|mp4|mp3)$/i;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// inventory 라우트 → 실제 경로에 맞는 정규식
export function routeMatcher(route) {
  let body = '';
  for (const seg of route.split('/').filter(Boolean)) {
    if (/^\(.*\)$/.test(seg) || seg.startsWith('@')) continue; // route group·병렬 슬롯
    if (/^\[\[\.\.\..+\]\]$/.test(seg)) body += '(?:/.+)?';
    else if (/^\[\.\.\..+\]$/.test(seg)) body += '/.+';
    else if (/^\[.+\]$/.test(seg)) body += '/[^/]+';
    else body += '/' + escapeRegExp(seg.replace(/^\(\.{1,3}\)+/, ''));
  }
  return new RegExp(`^${body || '/'}$`);
}

function normalizePath(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

// matchers: inventory 라우트 정규식. .html 링크는 화면 라우트에 맞을 때만 따라간다(정적 문서 제외)
export function followable(href, origin, matchers = []) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.origin !== origin || !/^https?:$/.test(url.protocol)) return undefined;
  const path = normalizePath(url.pathname);
  if (LOGOUT.test(path) || LOGOUT.test(url.search) || FILE_EXT.test(path)) return undefined;
  if (/\.html?$/i.test(path) && !matchers.some((re) => re.test(path))) return undefined;
  return path;
}

// 앱의 /sitemap.xml에 적힌 주소(없거나 읽지 못하면 빈 목록)
async function sitemapLocations(origin) {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000), redirect: 'follow' });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')).slice(0, 500);
  } catch {
    return [];
  }
}

export async function runCrawl(projectDir, { maxPages = 200, maxDepth = 3 } = {}) {
  const run = await loadRun(projectDir);
  const inventory = await readJson(join(docentDir(projectDir), 'inventory.json'));
  const pages = inventory.screens.filter((s) => s.kind === 'page' && s.route);
  const origin = new URL(run.baseUrl).origin;

  const routeRes = pages.map((s) => routeMatcher(s.route));
  const browser = await launchBrowser();
  const visited = [];
  try {
    const context = await newContext(browser, projectDir);
    const page = await context.newPage();
    const seen = new Set(['/']);
    const queue = [{ path: normalizePath(new URL(run.baseUrl).pathname), depth: 0 }];
    seen.add(queue[0].path);
    // 메뉴·링크가 없는 화면도 사이트맵에 있으면 찾는다. 사이트맵은 운영 도메인으로 적히므로 경로만 쓴다
    for (const loc of await sitemapLocations(origin)) {
      let local;
      try {
        const u = new URL(loc, origin);
        local = new URL(u.pathname + u.search, origin).href;
      } catch {
        continue;
      }
      const next = followable(local, origin, routeRes);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push({ path: next, depth: 1 });
      }
    }
    while (queue.length && visited.length < maxPages) {
      const { path, depth } = queue.shift();
      try {
        await page.goto(new URL(path, origin).href, { waitUntil: 'load', timeout: 15000 });
      } catch {
        continue;
      }
      const landed = normalizePath(new URL(page.url()).pathname);
      if (new URL(page.url()).origin !== origin) continue;
      if (!visited.includes(landed)) visited.push(landed);
      if (depth >= maxDepth) continue;
      const hrefs = await page.$$eval('a[href]', (as) => as.map((a) => a.href));
      for (const href of hrefs) {
        const next = followable(href, origin, routeRes);
        if (next && !seen.has(next)) {
          seen.add(next);
          queue.push({ path: next, depth: depth + 1 });
        }
      }
    }
  } finally {
    await browser.close();
  }

  const matchers = pages.map((s) => [s.id, routeMatcher(s.route)]);
  const unmatched = visited.filter((p) => !matchers.some(([, re]) => re.test(p))).sort();
  const unreached = matchers.filter(([, re]) => !visited.some((p) => re.test(p))).map(([id]) => id);
  const result = { baseUrl: run.baseUrl, visited: [...visited].sort(), unmatched, unreached };
  await writeJson(join(docentDir(projectDir), 'crawl.json'), result);
  const warnings = [];
  // 모든 링크가 로그인 화면으로 돌아갔다면 저장된 로그인 상태가 만료된 것이다
  const loginPath = (await loadConfig(projectDir)).auth?.loginPath;
  if (loginPath && visited.length && visited.every((p) => p === normalizePath(loginPath))) {
    warnings.push('로그인 화면만 방문했습니다. 로그인 상태가 만료된 것 같습니다 — docent auth login으로 다시 로그인하세요');
  }
  return { visited, unmatched, unreached, warnings };
}
