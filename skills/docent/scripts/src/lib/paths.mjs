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

// 화면 경로(라우트) → 사용자가 주소창에서 보는 경로. Next.js route group `(admin)`·병렬 슬롯 `@modal`은 주소에 없다
// (가로챔 `(.)photo`는 그대로 둔다). inventory의 route는 파일 구조를 따르는 열쇠라 바꾸지 않고, 산출물에 보일 때만 쓴다
export function urlPath(route) {
  if (!route) return route;
  const segs = route.split('/').filter((seg) => seg && !(/^\([^.][^)]*\)$/.test(seg) || seg.startsWith('@')));
  return '/' + segs.join('/');
}
