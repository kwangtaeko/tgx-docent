// .docent/config.yaml 읽기. 적지 않은 항목은 기본값을 쓴다.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';
import { LANGUAGES } from '../renderers/i18n.mjs';
import { t } from './cli-text.mjs';
import { normalizeRel } from './paths.mjs';
import { docentDir, WORKSPACE_NAME } from './workspace.mjs';

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
  // 캡처·GIF 화면 크기: desktop(1280 폭) | mobile(390 폭, 휴대폰 우선 웹앱·PWA)
  capture: { device: 'desktop' },
  // title은 비우면 language에 맞는 기본값(사용자 매뉴얼 | User Manual)
  output: { preset: 'handover', formats: ['html', 'readme'], organization: '', revisions: [] },
  // 루트 config.yaml에서만: 한 매뉴얼로 합칠 앱 작업(.docent/apps/<이름>/) [{ workspace, title? }]
  combine: [],
});

export const DEVICES = ['desktop', 'mobile'];

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

const ARRAY_KEYS = ['combine', 'detectors', 'screens.include', 'screens.exclude', 'secrets.paths', 'mask.selectors', 'gif.screens.include', 'gif.screens.exclude', 'output.formats', 'output.revisions'];
const OBJECT_KEYS = ['capture', 'screens', 'screens.idMap', 'secrets', 'analyze', 'mask', 'gif', 'gif.screens', 'output'];
const STRING_KEYS = ['language', 'app', 'capture.device', 'output.preset', 'output.theme', 'output.projectName', 'output.title', 'output.organization'];

const get = (obj, path) => path.split('.').reduce((o, k) => (isObject(o) ? o[k] : undefined), obj);

function checkConfig(config) {
  const fail = (path, kind) => {
    const code = kind.charCodeAt(kind.length - 1) - 0xac00;
    // 받침이 있으면 '이어야'. 영어 문구에는 쓰이지 않는다(kind가 이미 번역돼 있어 받침 판단도 무관)
    throw new Error(code >= 0 && code % 28 ? t('config.yaml: {0}는 {1}이어야 합니다', path, kind) : t('config.yaml: {0}는 {1}여야 합니다', path, kind));
  };
  for (const path of OBJECT_KEYS) if (!isObject(get(config, path))) fail(path, t('객체'));
  // 형식 하나만 적은 경우(formats: pdf)는 목록으로 받는다
  if (typeof config.output.formats === 'string') config.output.formats = [config.output.formats];
  for (const path of ARRAY_KEYS) if (!Array.isArray(get(config, path))) fail(path, t('목록'));
  for (const path of STRING_KEYS) {
    const value = get(config, path);
    if (value === undefined) continue;
    // title: 2026처럼 YAML이 숫자로 읽은 값은 문자열로 받는다
    if (typeof value === 'number') {
      const [head, key] = path.includes('.') ? path.split('.') : [undefined, path];
      if (head) config[head][key] = String(value);
      else config[key] = String(value);
    } else if (typeof value !== 'string') fail(path, t('문자열'));
  }
  if (config.app) {
    try {
      config.app = normalizeRel(config.app.replace(/\\/g, '/'));
    } catch {
      throw new Error(t('config.yaml: app은 프로젝트 안의 폴더 경로여야 합니다 ({0})', config.app));
    }
  }
  // combine: 이름만 적은 항목(- web)도 받는다
  config.combine = config.combine.map((item) => {
    const entry = typeof item === 'string' ? { workspace: item } : item;
    if (!isObject(entry) || typeof entry.workspace !== 'string' || !WORKSPACE_NAME.test(entry.workspace)) {
      throw new Error(t('config.yaml: combine의 항목은 앱 작업 이름(소문자·숫자·-)이어야 합니다 ({0})', JSON.stringify(item)));
    }
    if (entry.title !== undefined && typeof entry.title !== 'string') fail('combine[].title', t('문자열'));
    return { workspace: entry.workspace, ...(entry.title ? { title: entry.title } : {}) };
  });
  if (new Set(config.combine.map((c) => c.workspace)).size !== config.combine.length) throw new Error(t('config.yaml: combine에 같은 앱 작업이 두 번 있습니다'));
  if (!DEVICES.includes(config.capture.device)) throw new Error(t('config.yaml: capture.device는 {0} 중 하나여야 합니다 ({1})', DEVICES.join(', '), config.capture.device));
  if (!LANGUAGES.includes(config.language)) throw new Error(t('config.yaml: language는 {0} 중 하나여야 합니다 ({1})', LANGUAGES.join(', '), config.language));
  const n = config.analyze.concurrency;
  if (!Number.isInteger(n) || n < 1) fail('analyze.concurrency', t('양의 정수'));
  return config;
}

// workspace: 앱 작업 이름(기본은 이번 실행에서 고른 작업, 빈 값이면 루트)
export async function loadConfig(projectDir, workspace) {
  const path = join(docentDir(projectDir, workspace), 'config.yaml');
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
    throw new Error(t('.docent/config.yaml 형식 오류: {0}', err.message));
  }
  return checkConfig(merge(DEFAULT_CONFIG, data ?? {}));
}
