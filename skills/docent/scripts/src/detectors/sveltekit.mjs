// SvelteKit 화면 감지기: src/routes/**/+page.svelte. (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { byRoute, hasDependency, isDir, isFile, lineOf, loadAliases, screenFiles, walk } from './shared.mjs';

export const name = 'sveltekit';

const ROUTES = 'src/routes';
const LIB_ALIASES = [
  { prefix: '$lib/', wildcard: true, targets: ['src/lib/*'] },
  { prefix: '$lib', wildcard: false, targets: ['src/lib'] },
];
// 화면 데이터를 불러오는 같은 폴더의 파일
const LOADERS = ['+page.ts', '+page.js', '+page.server.ts', '+page.server.js'];

export async function detect(projectDir) {
  return hasDependency(projectDir, ['@sveltejs/kit']);
}

// src/routes/(app)/orders/[id=integer]/+page.svelte → /(app)/orders/[id]
function routeOf(file) {
  const parts = file.slice(ROUTES.length + 1).split('/').slice(0, -1);
  return '/' + parts.map((p) => p.replace(/^(\[{1,2}(?:\.\.\.)?[^\]=]+)=[^\]]+(\]{1,2})$/, '$1$2')).join('/');
}

export async function listScreens(projectDir) {
  if (!(await isDir(join(projectDir, ROUTES)))) return [];
  const aliases = await loadAliases(projectDir, LIB_ALIASES);
  const screens = [];
  for (const file of await walk(projectDir, ROUTES)) {
    // +page@.svelte·+page@(group).svelte는 레이아웃을 재설정한 화면
    if (!/^\+page(@[^/]*)?\.svelte$/.test(posix.basename(file))) continue;
    const route = routeOf(file);
    const segs = route.split('/').filter((s) => s && !/^\(.*\)$/.test(s));
    if (segs.length === 1 && /^\[\[?\.\.\./.test(segs[0])) continue; // 최상위 catch-all은 Not-found
    const [page, ...imports] = await screenFiles(projectDir, file, aliases);
    const dir = posix.dirname(file);
    for (const loader of LOADERS) {
      const path = `${dir}/${loader}`;
      if ((await isFile(join(projectDir, path))) && !imports.includes(path)) imports.push(path);
    }
    const source = await readFile(join(projectDir, file), 'utf8');
    screens.push({ route, files: [page, ...imports.sort()], evidence: `${file}:${lineOf(source, /<script\b/)}` });
  }
  return screens.sort(byRoute);
}
