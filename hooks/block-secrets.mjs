// docent PreToolUse 훅: 분석 세션(.docent/.session) 중에만 비밀 파일 읽기를 막는다. (설계 문서 12장)
// 번들하지 않는 단일 파일이며 Node 표준 라이브러리만 쓴다.
import { readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, sep } from 'node:path';

const DEFAULT_PATTERNS = ['.env', '.env.*', 'appsettings*.json', 'web.config', '*.pem', '*.key', '*.pfx', 'id_rsa*'];
// 값이 아니라 이름만 담는 예시 파일은 읽어도 된다(환경변수 이름 확인용).
const ALLOWED = /\.(example|sample|template)$/;
const SESSION_TTL_MS = 12 * 3600_000;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return undefined;
  }
}

// .session에는 시작 시각(ISO)이 적혀 있다. 읽을 수 없으면 파일 수정 시각을 쓴다.
function sessionActive(cwd) {
  const path = join(cwd, '.docent', '.session');
  try {
    let started = Date.parse(readFileSync(path, 'utf8').trim());
    if (Number.isNaN(started)) started = statSync(path).mtimeMs;
    return Date.now() - started < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

// config.yaml의 secrets.paths 목록만 읽는 최소 파서
function configPatterns(cwd) {
  let text;
  try {
    text = readFileSync(join(cwd, '.docent', 'config.yaml'), 'utf8');
  } catch {
    return [];
  }
  const out = [];
  let section = '';
  for (const line of text.split(/\r?\n/)) {
    if (/^\S/.test(line)) section = line.replace(/:.*$/, '');
    else if (section === 'secrets' && /^\s+paths:/.test(line)) section = 'secrets.paths';
    else if (section === 'secrets.paths') {
      const m = /^\s+-\s+['"]?([^'"#]+?)['"]?\s*(#.*)?$/.exec(line);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

function toRegExp(glob) {
  return new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
}

function isSecret(relPath, patterns) {
  const name = basename(relPath);
  if (ALLOWED.test(name)) return false;
  return patterns.some((p) => toRegExp(p).test(p.includes('/') ? relPath : name));
}

// Glob 패턴의 마지막 조각이 비밀 파일을 겨냥하는지(예: **/.env*)
function globTargetsSecret(pattern, patterns) {
  const last = pattern.split('/').pop() ?? '';
  const literal = last.replace(/\*/g, '');
  if (!literal) return false;
  return patterns.some((p) => toRegExp(p).test(literal) || toRegExp(last).test(p.replace(/\*/g, '')));
}

function main() {
  const input = readStdin();
  if (!input?.cwd || !sessionActive(input.cwd)) return 0;
  const patterns = [...DEFAULT_PATTERNS, ...configPatterns(input.cwd)];
  const toolInput = input.tool_input ?? {};
  const target = toolInput.file_path ?? toolInput.path;
  let blocked;
  if (target) {
    const rel = (isAbsolute(target) ? relative(input.cwd, target) : target).split(sep).join('/');
    if (isSecret(rel, patterns)) blocked = target;
  }
  if (!blocked && input.tool_name === 'Glob' && toolInput.pattern && globTargetsSecret(toolInput.pattern, patterns)) {
    blocked = toolInput.pattern;
  }
  if (!blocked) return 0;
  process.stderr.write(
    `docent: 비밀 파일(${blocked})은 분석하지 않습니다. 환경변수 이름은 .env.example이나 코드의 process.env 참조에서 확인하세요.\n`,
  );
  return 2;
}

process.exit(main());
