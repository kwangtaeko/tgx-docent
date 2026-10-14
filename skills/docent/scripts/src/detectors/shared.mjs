// 감지기 공용: 파일 탐색, tsconfig 별칭, import 해석, 화면 파일 목록.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { normalizeRel } from '../lib/paths.mjs';

// 의존성·빌드 산출물·작업 폴더는 화면 소스가 아니다
export const SKIP_DIRS = new Set(['node_modules', '.git', '.docent', '.next', '.nuxt', '.output', '.svelte-kit', 'dist', 'build', 'coverage']);
const RESOLVE_SUFFIXES = ['', '.tsx', '.ts', '.jsx', '.js', '.vue', '.svelte', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
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

export async function readJsonc(path) {
  try {
    return JSON.parse(stripJsonc(await readFile(path, 'utf8')));
  } catch {
    return undefined;
  }
}

export async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

// rel 아래 파일 목록(프로젝트 루트 기준 상대 경로, '/' 구분)
export async function walk(projectDir, rel) {
  const out = [];
  for (const entry of await readdir(join(projectDir, rel), { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...(await walk(projectDir, child)));
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

export async function hasDependency(projectDir, names) {
  const pkg = await readJsonc(join(projectDir, 'package.json'));
  return names.some((n) => Boolean(pkg?.dependencies?.[n] || pkg?.devDependencies?.[n]));
}

// tsconfig·jsconfig의 paths + 프레임워크 기본 별칭(extra)
export async function loadAliases(projectDir, extra = []) {
  for (const file of ['tsconfig.json', 'jsconfig.json']) {
    const config = await readJsonc(join(projectDir, file));
    const paths = config?.compilerOptions?.paths;
    if (!paths) continue;
    const baseUrl = config.compilerOptions.baseUrl ?? '.';
    return [
      ...Object.entries(paths).map(([pattern, targets]) => ({
        prefix: pattern.replace(/\*$/, ''),
        wildcard: pattern.endsWith('*'),
        targets: targets.map((t) => posix.join(baseUrl, t)),
      })),
      ...extra,
    ];
  }
  return [...extra];
}

export async function resolveImport(projectDir, fromFile, spec, aliases) {
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

// 화면 파일과 그 파일이 직접 import하는 프로젝트 내부 파일(1단계까지). (설계 문서 6장)
export async function screenFiles(projectDir, file, aliases) {
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
  return [file, ...[...imports].sort()];
}

// 정규식이 처음 맞는 줄(1부터). 없으면 1
export function lineOf(source, regex) {
  return source.split(/\r\n|\r|\n/).findIndex((l) => regex.test(l)) + 1 || 1;
}

export function byRoute(a, b) {
  return a.route < b.route ? -1 : a.route > b.route ? 1 : 0;
}
