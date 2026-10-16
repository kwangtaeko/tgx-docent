// 프로젝트 루트 기준 상대 경로를 한 가지 표기로 맞춘다.
import { posix } from 'node:path';
import { t } from './cli-text.mjs';

// 정규화된 상대 경로: 앞 '/' 없음, '.'·'..' 세그먼트 없음, '//' 없음, 역슬래시·':' 없음
export const REL_PATH_PATTERN = '^(?!/)(?!(?:.*/)?\\.\\.?(?:/|$))(?!.*//)[^\\\\:]+$';

export function normalizeRel(p) {
  if (typeof p !== 'string' || p.includes('\\') || p.includes(':') || posix.isAbsolute(p)) {
    throw new Error(t('프로젝트 상대 경로가 아닙니다: {0}', p));
  }
  const n = posix.normalize(p);
  if (n === '.' || n === '..' || n.startsWith('../')) {
    throw new Error(t('프로젝트 상대 경로가 아닙니다: {0}', p));
  }
  return n.replace(/\/$/, '');
}
