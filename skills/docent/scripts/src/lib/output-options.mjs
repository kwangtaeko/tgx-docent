// 산출물 옵션: config.yaml의 output + CLI 인자(우선). (설계 문서 3장 용도 프리셋)
import { stringsFor } from '../renderers/i18n.mjs';
import { DEFAULT_THEME, isTheme, THEMES } from '../renderers/theme.mjs';
import { t } from './cli-text.mjs';
export const PRESETS = ['delivery', 'handover', 'portfolio'];
export const FORMATS = ['html', 'readme', 'pdf', 'pptx'];
const REVISION_FIELDS = ['version', 'date', 'author', 'note'];

export function resolveOutputOptions(config, cli = {}) {
  const output = config.output ?? {};
  const preset = cli.preset ?? output.preset ?? 'handover';
  if (!PRESETS.includes(preset)) throw new Error(t('알 수 없는 프리셋 "{0}" — {1} 중 하나를 쓰세요', preset, PRESETS.join(', ')));
  const requested = cli.formats ?? output.formats ?? ['html', 'readme'];
  for (const f of requested) {
    if (!FORMATS.includes(f)) throw new Error(t('알 수 없는 형식 "{0}" — {1} 중에서 고르세요', f, FORMATS.join(', ')));
  }
  const formats = FORMATS.filter((f) => requested.includes(f));
  if (!formats.length) throw new Error(t('만들 형식이 없습니다 — {0} 중에서 고르세요', FORMATS.join(', ')));
  const revisions = output.revisions ?? [];
  if (!Array.isArray(revisions)) throw new Error(t('config.yaml: output.revisions는 목록이어야 합니다'));
  revisions.forEach((r, i) => {
    for (const field of REVISION_FIELDS) {
      if (typeof r?.[field] !== 'string') throw new Error(t('config.yaml: output.revisions[{0}]의 {1} 값이 없거나 문자열이 아닙니다', i, field));
    }
  });
  const language = config.language ?? 'ko';
  const theme = output.theme ?? DEFAULT_THEME;
  if (!isTheme(theme)) throw new Error(t('알 수 없는 테마 "{0}" — {1} 중 하나를 쓰세요', theme, Object.keys(THEMES).join(', ')));
  return {
    preset,
    formats,
    language,
    theme,
    // 캡처를 휴대폰 크기로 찍었으면 산출물에서 휴대폰 폭으로 보인다
    device: config.capture?.device === 'mobile' ? 'mobile' : 'desktop',
    title: String(output.title ?? stringsFor(language).defaultTitle),
    organization: String(output.organization ?? ''),
    revisions: revisions.map((r) => Object.fromEntries(REVISION_FIELDS.map((f) => [f, r[f]]))),
  };
}
