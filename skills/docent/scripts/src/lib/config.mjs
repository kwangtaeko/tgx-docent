// .docent/config.yaml 읽기. 적지 않은 항목은 기본값을 쓴다.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

export const DEFAULT_CONFIG = Object.freeze({
  language: 'ko',
  detectors: [],
  screens: { include: [], exclude: [], idMap: {} },
  secrets: { paths: ['.env', '.env.*', 'appsettings*.json', 'web.config', '*.pem', '*.key', '*.pfx', 'id_rsa*'] },
  analyze: { concurrency: 4 },
});

function isObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function merge(base, override) {
  const out = structuredClone(base);
  if (!isObject(override)) return out;
  for (const [key, value] of Object.entries(override)) {
    out[key] = isObject(out[key]) && isObject(value) ? merge(out[key], value) : value;
  }
  return out;
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
  return merge(DEFAULT_CONFIG, data ?? {});
}
