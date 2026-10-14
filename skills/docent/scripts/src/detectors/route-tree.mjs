// 코드로 선언된 라우트(React Router·Vue Router)를 읽는 작은 토크나이저와 파서.
// 실행하지 않고 소스 글자만 본다. 경로가 문자열 리터럴이 아닌 라우트는 건너뛴다(에이전트 탐색이 메운다).

const REDIRECTS = new Set(['Navigate', 'Redirect']);
const PUNCT3 = ['...'];
const PUNCT2 = ['=>'];

// → [{ t: 'str'|'tmpl'|'id'|'num'|'p', v, line }]. 주석은 버리고 줄 번호는 CR·LF·CRLF를 모두 센다.
export function tokenize(source) {
  const tokens = [];
  let line = 1;
  let i = 0;
  const newline = () => {
    if (source[i] === '\r' && source[i + 1] === '\n') i++;
    line++;
  };
  while (i < source.length) {
    const c = source[i];
    if (c === '\n' || c === '\r') {
      newline();
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') i++;
    } else if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n' || source[i] === '\r') newline();
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== '\n' && source[j] !== '\r') j += source[j] === '\\' ? 2 : 1;
      if (source[j] === c) {
        tokens.push({ t: 'str', v: source.slice(i + 1, j), line });
        i = j + 1;
      } else {
        // 줄 끝까지 닫히지 않은 따옴표는 JSX 글자 속 아포스트로피(doesn't 등)다. 문자열로 보지 않는다
        tokens.push({ t: 'p', v: c, line });
        i++;
      }
    } else if (c === '`') {
      const start = line;
      let j = i + 1;
      let dynamic = false;
      while (j < source.length && source[j] !== '`') {
        if (source[j] === '\\') j++;
        else if (source[j] === '$' && source[j + 1] === '{') dynamic = true;
        else if (source[j] === '\n' || source[j] === '\r') {
          if (source[j] === '\r' && source[j + 1] === '\n') j++;
          line++;
        }
        j++;
      }
      tokens.push({ t: dynamic ? 'tmpl' : 'str', v: source.slice(i + 1, j), line: start });
      i = j + 1;
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < source.length && /[\w$]/.test(source[j])) j++;
      tokens.push({ t: 'id', v: source.slice(i, j), line });
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < source.length && /[\w.]/.test(source[j])) j++;
      tokens.push({ t: 'num', v: source.slice(i, j), line });
      i = j;
    } else {
      const p = [...PUNCT3, ...PUNCT2].find((x) => source.startsWith(x, i)) ?? c;
      tokens.push({ t: 'p', v: p, line });
      i += p.length;
    }
  }
  return tokens;
}

const OPEN = new Set(['{', '[', '(']);
const CLOSE = new Set(['}', ']', ')']);
const isP = (tok, v) => tok?.t === 'p' && tok.v === v;

// tokens[i]부터 깊이 0의 ',' 또는 닫는 괄호 직전까지
function valueEnd(tokens, i) {
  let depth = 0;
  for (let j = i; j < tokens.length; j++) {
    const tok = tokens[j];
    if (tok.t !== 'p') continue;
    if (OPEN.has(tok.v)) depth++;
    else if (CLOSE.has(tok.v)) {
      if (depth === 0) return j;
      depth--;
    } else if (tok.v === ',' && depth === 0) return j;
  }
  return tokens.length;
}

// 짝이 맞는 닫는 괄호의 위치
function matching(tokens, i) {
  let depth = 0;
  for (let j = i; j < tokens.length; j++) {
    if (tokens[j].t !== 'p') continue;
    if (OPEN.has(tokens[j].v)) depth++;
    else if (CLOSE.has(tokens[j].v) && --depth === 0) return j;
  }
  return tokens.length - 1;
}

// 값 토큰 안의 import('…') 경로
function dynamicImport(value) {
  for (let k = 0; k + 2 < value.length; k++) {
    if (value[k].t === 'id' && value[k].v === 'import' && isP(value[k + 1], '(') && value[k + 2].t === 'str') return value[k + 2].v;
  }
  return undefined;
}

// 화면을 감싸기만 하는 요소(인증 가드·Suspense 등)
const WRAPPER = /^(Suspense|ErrorBoundary|Fragment|StrictMode|Require\w*|Protected\w*|Private\w*|Auth\w*|\w*Guard|\w*Boundary|\w*Provider|\w*Layout)$/;

// JSX 요소 이름들(속성 값 {…} 안의 요소, 예: fallback={<Spinner />}는 빼고 바깥→안쪽 순)
function elementNames(value) {
  const names = [];
  for (let k = 0; k < value.length; k++) {
    if (!(isP(value[k], '<') && value[k + 1]?.t === 'id')) continue;
    let name = value[k + 1].v;
    let j = k + 2;
    while (isP(value[j], '.') && value[j + 1]?.t === 'id') {
      name += '.' + value[j + 1].v;
      j += 2;
    }
    names.push(name);
    // 속성 건너뛰기: 깊이 0의 '>'까지, {…}는 통째로
    while (j < value.length && !isP(value[j], '>')) {
      if (isP(value[j], '{')) j = matching(value, j);
      j++;
    }
    k = j;
  }
  return names;
}

// JSX 요소 값의 화면 컴포넌트: 감싸는 요소를 지나 처음 나오는 요소
function jsxComponent(value) {
  const names = elementNames(value).map((n) => n.replace(/^React\./, ''));
  if (!names.length || REDIRECTS.has(names[0])) return undefined;
  const name = names.find((n) => !WRAPPER.test(n) && !REDIRECTS.has(n)) ?? names.at(-1);
  return { name };
}

function newNode(line) {
  return { index: false, line, children: [] };
}

// tokens[i] = '{'. → { node, end, isRoute }
function parseObject(tokens, i) {
  const node = newNode(tokens[i].line);
  const keys = new Set();
  let lineSet = false;
  let j = i + 1;
  while (j < tokens.length && !isP(tokens[j], '}')) {
    const key = tokens[j];
    if ((key.t === 'id' || key.t === 'str') && isP(tokens[j + 1], ':')) {
      const start = j + 2;
      const end = valueEnd(tokens, start);
      const value = tokens.slice(start, end);
      keys.add(key.v);
      switch (key.v) {
        case 'path':
          if (value.length === 1 && value[0].t === 'str') node.path = value[0].v;
          else node.dynamicPath = true;
          node.line = key.line;
          lineSet = true;
          break;
        case 'index':
          node.index = value[0]?.t === 'id' && value[0].v === 'true';
          if (!lineSet) node.line = key.line;
          break;
        case 'element':
          node.component = jsxComponent(value);
          break;
        case 'Component':
        case 'component': {
          const spec = dynamicImport(value);
          if (spec) node.component = { importPath: spec };
          else if (value.length === 1 && value[0].t === 'id') node.component = { name: value[0].v };
          break;
        }
        case 'lazy': {
          const spec = dynamicImport(value);
          if (spec) node.component = { importPath: spec };
          break;
        }
        case 'children':
          if (isP(value[0], '[')) node.children = parseArrayOfObjects(tokens, start);
          break;
        case 'redirect':
          node.redirect = true;
          break;
        default:
      }
      j = end;
    } else {
      j = valueEnd(tokens, j); // 스프레드·축약 속성
    }
    if (isP(tokens[j], ',')) j++;
    else if (!isP(tokens[j], '}')) j++;
  }
  const routeKey = keys.has('path') || keys.has('index');
  const content = ['element', 'component', 'Component', 'lazy', 'children', 'redirect'].some((k) => keys.has(k));
  return { node, end: j, isRoute: routeKey && content };
}

// tokens[i] = '['. 배열 안의 라우트 객체
function parseArrayOfObjects(tokens, i) {
  const end = matching(tokens, i);
  const nodes = [];
  for (let j = i + 1; j < end; j++) {
    if (!isP(tokens[j], '{')) continue;
    const r = parseObject(tokens, j);
    if (r.isRoute) nodes.push(r.node);
    j = r.end;
  }
  return nodes;
}

// createBrowserRouter([...])·useRoutes([...])·routes = [...] 같은 객체 라우트
export function parseRouteObjects(source) {
  const tokens = tokenize(source);
  const roots = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isP(tokens[i], '{')) continue;
    const r = parseObject(tokens, i);
    if (r.isRoute) {
      roots.push(r.node);
      i = r.end;
    }
  }
  return roots;
}

// <Route path="…" element={<X />}> 중첩
export function parseJsxRoutes(source) {
  const tokens = tokenize(source);
  const roots = [];
  const stack = [{ children: roots }];
  for (let i = 0; i < tokens.length; i++) {
    if (isP(tokens[i], '<') && isP(tokens[i + 1], '/') && tokens[i + 2]?.v === 'Route' && isP(tokens[i + 3], '>')) {
      if (stack.length > 1) stack.pop();
      i += 3;
      continue;
    }
    if (!(isP(tokens[i], '<') && tokens[i + 1]?.t === 'id' && tokens[i + 1].v === 'Route')) continue;
    const node = newNode(tokens[i].line);
    let j = i + 2;
    let selfClosing = false;
    while (j < tokens.length) {
      if (isP(tokens[j], '>')) break;
      if (isP(tokens[j], '/') && isP(tokens[j + 1], '>')) {
        selfClosing = true;
        j++;
        break;
      }
      const attr = tokens[j];
      if (attr.t === 'id' && isP(tokens[j + 1], '=')) {
        const v = tokens[j + 2];
        let value = [v];
        let next = j + 3;
        if (isP(v, '{')) {
          const close = matching(tokens, j + 2);
          value = tokens.slice(j + 3, close);
          next = close + 1;
        }
        if (attr.v === 'path') {
          if (value.length === 1 && value[0].t === 'str') node.path = value[0].v;
          else node.dynamicPath = true;
        } else if (attr.v === 'element') node.component = jsxComponent(value);
        else if (attr.v === 'Component' && value[0]?.t === 'id') node.component = { name: value[0].v };
        else if (attr.v === 'lazy') {
          const spec = dynamicImport(value);
          if (spec) node.component = { importPath: spec };
        }
        j = next;
      } else {
        if (attr.t === 'id' && attr.v === 'index') node.index = true;
        j++;
      }
    }
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
    i = j;
  }
  return roots;
}

const CONFIG_CALLS = new Set(['route', 'index', 'layout', 'prefix']);

// React Router v7 app/routes.ts: route()·index()·layout()·prefix()
export function parseRouteConfig(source) {
  const tokens = tokenize(source);
  let start = tokens.findIndex((t, k) => t.v === 'export' && tokens[k + 1]?.v === 'default');
  start = start < 0 ? 0 : start + 2;
  const open = tokens.findIndex((t, k) => k >= start && isP(t, '['));
  return open < 0 ? [] : parseConfigArray(tokens, open);
}

function parseConfigArray(tokens, i) {
  const end = matching(tokens, i);
  const nodes = [];
  let j = i + 1;
  while (j < end) {
    let k = j;
    if (isP(tokens[k], '...')) k++;
    if (tokens[k]?.t === 'id' && CONFIG_CALLS.has(tokens[k].v) && isP(tokens[k + 1], '(')) {
      const close = matching(tokens, k + 1);
      nodes.push(configNode(tokens, k, close));
      j = close + 1;
    } else {
      j = valueEnd(tokens, j);
    }
    if (isP(tokens[j], ',')) j++;
    else if (j < end && !CLOSE.has(tokens[j]?.v)) j++;
    else if (CLOSE.has(tokens[j]?.v)) break;
  }
  return nodes;
}

function configNode(tokens, k, close) {
  const name = tokens[k].v;
  const args = [];
  let j = k + 2;
  while (j < close) {
    const end = valueEnd(tokens, j);
    args.push({ at: j, value: tokens.slice(j, end) });
    j = isP(tokens[end], ',') ? end + 1 : end;
  }
  const str = (a) => (a && a.value.length === 1 && a.value[0].t === 'str' ? a.value[0].v : undefined);
  const kids = (a) => (a && isP(a.value[0], '[') ? parseConfigArray(tokens, a.at) : []);
  const node = newNode(tokens[k].line);
  const setPath = (a) => {
    const p = str(a);
    if (p === undefined) node.dynamicPath = true;
    else node.path = p;
  };
  if (name === 'route') {
    setPath(args[0]);
    node.component = str(args[1]) !== undefined ? { importPath: str(args[1]) } : undefined;
    node.children = kids(args[2]);
  } else if (name === 'index') {
    node.index = true;
    node.component = str(args[0]) !== undefined ? { importPath: str(args[0]) } : undefined;
  } else if (name === 'layout') {
    node.component = str(args[0]) !== undefined ? { importPath: str(args[0]) } : undefined;
    node.children = kids(args[1]);
  } else {
    setPath(args[0]);
    node.children = kids(args[1]);
  }
  return node;
}

function joinPath(base, path) {
  if (path === undefined || path === '') return base;
  if (path.startsWith('/')) return path;
  return `${base === '/' ? '' : base.replace(/\/+$/, '')}/${path}`;
}

// 중첩 라우트 → 화면 경로. 자식이 있는 라우트는 레이아웃이라 화면이 아니며, 컴포넌트가 없는(리다이렉트 등) 라우트도 뺀다.
export function flattenRoutes(nodes, base = '/') {
  const out = [];
  for (const node of nodes) {
    if (node.dynamicPath) continue;
    const full = node.index ? base : joinPath(base, node.path);
    if (node.children.length) out.push(...flattenRoutes(node.children, full));
    else if (node.component && !node.redirect) out.push({ path: full, node });
  }
  return out;
}

// 라우터 표기 → docent 표기(:id → [id], * → [...splat]). 경로 전체가 catch-all 하나면(Not-found) undefined
export function toDocentPath(path) {
  const segs = path
    .split('/')
    .filter(Boolean)
    .map((seg) => {
      if (seg === '*') return '[...splat]';
      const m = /^:([A-Za-z_$][\w$]*)(\(.*\))?([?*+])?$/.exec(seg);
      if (!m) return seg.replace(/\?$/, '');
      const [, name, regex, mod] = m;
      if (mod === '*' || mod === '?') return `[[...${name}]]`;
      if (mod === '+' || regex === '(.*)' || regex === '(.+)') return `[...${name}]`;
      return `[${name}]`;
    });
  if (segs.length === 1 && /^\[\[?\.\.\./.test(segs[0])) return undefined;
  return '/' + segs.join('/');
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 컴포넌트 이름이 어디서 왔는지(import 경로)
export function findImport(source, name) {
  const n = escapeRe(name);
  const def = new RegExp(`import\\s+${n}\\s*(?:,\\s*\\{[^}]*\\})?\\s*from\\s*['"]([^'"]+)['"]`).exec(source);
  if (def) return def[1];
  for (const m of source.matchAll(/import\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map((x) => x.trim().split(/\s+as\s+/).pop());
    if (names.includes(name)) return m[2];
  }
  const lazy = new RegExp(`(?:const|let|var)\\s+${n}\\s*=\\s*(?:React\\.)?(?:lazy|defineAsyncComponent)\\(\\s*\\(\\)\\s*=>\\s*import\\(\\s*['"]([^'"]+)['"]`).exec(source);
  return lazy?.[1];
}
