// Next.js(App Router·Pages Router) 화면 감지기. (설계 문서 6장 1번)
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { normalizeRel } from '../lib/paths.mjs';

export const name = 'nextjs';

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.docent']);
const PAGE_EXT = /\.(tsx|jsx|ts|js)$/;
const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const IMPORT_PATTERNS = [
  /^\s*import\s[^'"]*?['"]([^'"]+)['"]/gm,
  /^\s*import\s*['"]([^'"]+)['"]/gm,
  /^\s*export\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/gm,
];

// tsconfig·jsconfig는 주석과 끝 쉼표를 허용하므로 문자열 밖의 것만 걷어 낸다.
function stripJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i < 0) break;
      i++;
    } else {
      out += c;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

async function readJson(path) {
  try {
    return JSON.parse(stripJsonc(await readFile(path, 'utf8')));
  } catch {
    return undefined;
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function walk(projectDir, rel) {
  const out = [];
  for (const entry of await readdir(join(projectDir, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(projectDir, child)));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

export async function detect(projectDir) {
  const pkg = await readJson(join(projectDir, 'package.json'));
  return Boolean(pkg?.dependencies?.next || pkg?.devDependencies?.next);
}

async function loadAliases(projectDir) {
  for (const file of ['tsconfig.json', 'jsconfig.json']) {
    const config = await readJson(join(projectDir, file));
    const paths = config?.compilerOptions?.paths;
    if (!paths) continue;
    const baseUrl = config.compilerOptions.baseUrl ?? '.';
    return Object.entries(paths).map(([pattern, targets]) => ({
      prefix: pattern.replace(/\*$/, ''),
      wildcard: pattern.endsWith('*'),
      targets: targets.map((t) => posix.join(baseUrl, t)),
    }));
  }
  return [];
}

async function resolveImport(projectDir, fromFile, spec, aliases) {
  const candidates = [];
  if (spec.startsWith('./') || spec.startsWith('../')) {
    candidates.push(posix.join(posix.dirname(fromFile), spec));
  } else {
    for (const alias of aliases) {
      if (alias.wildcard ? spec.startsWith(alias.prefix) : spec === alias.prefix) {
        const rest = spec.slice(alias.prefix.length);
        for (const target of alias.targets) candidates.push(target.replace(/\*$/, rest));
      }
    }
  }
  for (const base of candidates) {
    for (const suffix of RESOLVE_SUFFIXES) {
      let rel;
      try {
        rel = normalizeRel(base + suffix);
      } catch {
        continue;
      }
      if (await isFile(join(projectDir, rel))) return rel;
    }
  }
  return undefined;
}

async function describePage(projectDir, file, route, aliases) {
  const source = await readFile(join(projectDir, file), 'utf8');
  const specs = new Set();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) specs.add(match[1]);
  }
  const imports = new Set();
  for (const spec of specs) {
    const resolved = await resolveImport(projectDir, file, spec, aliases);
    if (resolved && resolved !== file) imports.add(resolved);
  }
  const lines = source.split(/\r?\n/);
  const line = lines.findIndex((l) => /\bexport\s+default\b/.test(l)) + 1 || 1;
  return { route, files: [file, ...[...imports].sort()], evidence: `${file}:${line}` };
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
  return screens.sort((a, b) => (a.route < b.route ? -1 : a.route > b.route ? 1 : 0));
}
