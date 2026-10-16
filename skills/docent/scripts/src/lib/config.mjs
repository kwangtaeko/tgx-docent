// .docent/config.yaml 읽기. 적지 않은 항목은 기본값을 쓴다.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { LANGUAGES } from '../renderers/i18n.mjs';
import { normalizeRel } from './paths.mjs';

export const DEFAULT_CONFIG = Object.freeze({
  language: 'ko',
  // 모노레포에서 문서로 만들 앱 폴더(프로젝트 루트 기준). 비우면 루트
  app: '',
  detectors: [],
  screens: { include: [], exclude: [], idMap: {} },
  secrets: { paths: ['.env', '.env.*', 'appsettings*.json', 'web.config', '*.pem', '*.key', '*.pfx', 'id_rsa*'] },
  analyze: { concurrency: 4 },
  mask: { selectors: [] },
  gif: { screens: { include: [], exclude: [] } },
  // title은 비우면 language에 맞는 기본값(사용자 매뉴얼 | User Manual)
  output: { preset: 'handover', formats: ['html', 'readme'], organization: '', revisions: [] },
});

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 값을 비운 키(YAML의 null)는 기본값을 둔다
function merge(base, override) {
  const out = structuredClone(base);
  if (!isObject(override)) return out;
  for (const [key, value] of Object.entries(override)) {
    if (value === null) continue;
    out[key] = isObject(out[key]) && isObject(value) ? merge(out[key], value) : value;
  }
  return out;
}

const ARRAY_KEYS = ['detectors', 'screens.include', 'screens.exclude', 'secrets.paths', 'mask.selectors', 'gif.screens.include', 'gif.screens.exclude', 'output.formats', 'output.revisions'];
const OBJECT_KEYS = ['screens', 'screens.idMap', 'secrets', 'analyze', 'mask', 'gif', 'gif.screens', 'output'];
const STRING_KEYS = ['language', 'app', 'output.preset', 'output.theme', 'output.projectName', 'output.title', 'output.organization'];

const get = (obj, path) => path.split('.').reduce((o, k) => (isObject(o) ? o[k] : undefined), obj);

function checkConfig(config) {
  const fail = (path, kind) => {
    const code = kind.charCodeAt(kind.length - 1) - 0xac00;
    const copula = code >= 0 && code % 28 ? '이어야' : '여야'; // 받침이 있으면 '이어야'
    throw new Error(`config.yaml: ${path}는 ${kind}${copula} 합니다`);
  };
  for (const path of OBJECT_KEYS) if (!isObject(get(config, path))) fail(path, '객체');
  // 형식 하나만 적은 경우(formats: pdf)는 목록으로 받는다
  if (typeof config.output.formats === 'string') config.output.formats = [config.output.formats];
  for (const path of ARRAY_KEYS) if (!Array.isArray(get(config, path))) fail(path, '목록');
  for (const path of STRING_KEYS) {
    const value = get(config, path);
    if (value === undefined) continue;
    // title: 2026처럼 YAML이 숫자로 읽은 값은 문자열로 받는다
    if (typeof value === 'number') {
      const [head, key] = path.includes('.') ? path.split('.') : [undefined, path];
      if (head) config[head][key] = String(value);
      else config[key] = String(value);
    } else if (typeof value !== 'string') fail(path, '문자열');
  }
  if (config.app) {
    try {
      config.app = normalizeRel(config.app.replace(/\\/g, '/'));
    } catch {
      throw new Error(`config.yaml: app은 프로젝트 안의 폴더 경로여야 합니다 (${config.app})`);
    }
  }
  if (!LANGUAGES.includes(config.language)) throw new Error(`config.yaml: language는 ${LANGUAGES.join(', ')} 중 하나여야 합니다 (${config.language})`);
  const n = config.analyze.concurrency;
  if (!Number.isInteger(n) || n < 1) fail('analyze.concurrency', '양의 정수');
  return config;
}

export async function loadConfig(projectDir) {
  const path = join(projectDir, '.docent', 'config.yaml');
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return structuredClone(DEFAULT_CONFIG);
    throw err;
  }
  let data;
  try {
    data = parse(text);
  } catch (err) {
    throw new Error(`.docent/config.yaml 형식 오류: ${err.message}`);
  }
  return checkConfig(merge(DEFAULT_CONFIG, data ?? {}));
}
