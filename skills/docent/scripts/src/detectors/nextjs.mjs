// Next.js(App Router·Pages Router) 화면 감지기. (설계 문서 6장 1번)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { byRoute, hasDependency, isDir, lineOf, loadAliases, screenFiles, walk } from './shared.mjs';

export const name = 'nextjs';

const PAGE_EXT = /\.(tsx|jsx|ts|js)$/;

export async function detect(projectDir) {
  return hasDependency(projectDir, ['next']);
}

async function describePage(projectDir, file, route, aliases) {
  const source = await readFile(join(projectDir, file), 'utf8');
  return { route, files: await screenFiles(projectDir, file, aliases), evidence: `${file}:${lineOf(source, /\bexport\s+default\b/)}` };
}

function appRoute(dir, file) {
  const parts = file.slice(dir.length + 1).split('/').slice(0, -1);
  return '/' + parts.join('/');
}

function pagesRoute(dir, file) {
  const rel = file.slice(dir.length + 1).replace(PAGE_EXT, '');
  const parts = rel.split('/');
  if (parts.at(-1) === 'index') parts.pop();
  return '/' + parts.join('/');
}

export async function listScreens(projectDir) {
  const aliases = await loadAliases(projectDir);
  const screens = [];
  for (const dir of ['app', 'src/app']) {
    if (!(await isDir(join(projectDir, dir)))) continue;
    for (const file of await walk(projectDir, dir)) {
      if (/(^|\/)page\.(tsx|jsx|ts|js)$/.test(file)) {
        screens.push(await describePage(projectDir, file, appRoute(dir, file), aliases));
      }
    }
  }
  for (const dir of ['pages', 'src/pages']) {
    if (!(await isDir(join(projectDir, dir)))) continue;
    for (const file of await walk(projectDir, dir)) {
      const rel = file.slice(dir.length + 1);
      if (!PAGE_EXT.test(file) || rel.startsWith('api/') || /^_(app|document|error)\./.test(rel)) continue;
      screens.push(await describePage(projectDir, file, pagesRoute(dir, file), aliases));
    }
  }
  return screens.sort(byRoute);
}
