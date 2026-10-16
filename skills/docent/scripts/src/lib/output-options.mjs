// 산출물 옵션: config.yaml의 output + CLI 인자(우선). (설계 문서 3장 용도 프리셋)
import { stringsFor } from '../renderers/i18n.mjs';
export const PRESETS = ['delivery', 'handover', 'portfolio'];
export const FORMATS = ['html', 'readme', 'pdf', 'pptx'];
const REVISION_FIELDS = ['version', 'date', 'author', 'note'];

export function resolveOutputOptions(config, cli = {}) {
  const output = config.output ?? {};
  const preset = cli.preset ?? output.preset ?? 'handover';
  if (!PRESETS.includes(preset)) throw new Error(`알 수 없는 프리셋 "${preset}" — ${PRESETS.join(', ')} 중 하나를 쓰세요`);
  const requested = cli.formats ?? output.formats ?? ['html', 'readme'];
  for (const f of requested) {
    if (!FORMATS.includes(f)) throw new Error(`알 수 없는 형식 "${f}" — ${FORMATS.join(', ')} 중에서 고르세요`);
  }
  const formats = FORMATS.filter((f) => requested.includes(f));
  if (!formats.length) throw new Error(`만들 형식이 없습니다 — ${FORMATS.join(', ')} 중에서 고르세요`);
  const revisions = output.revisions ?? [];
  if (!Array.isArray(revisions)) throw new Error('config.yaml: output.revisions는 목록이어야 합니다');
  revisions.forEach((r, i) => {
    for (const field of REVISION_FIELDS) {
      if (typeof r?.[field] !== 'string') throw new Error(`config.yaml: output.revisions[${i}]의 ${field} 값이 없거나 문자열이 아닙니다`);
    }
  });
  const language = config.language ?? 'ko';
  return {
    preset,
    formats,
    language,
    title: String(output.title ?? stringsFor(language).defaultTitle),
    organization: String(output.organization ?? ''),
    revisions: revisions.map((r) => Object.fromEntries(REVISION_FIELDS.map((f) => [f, r[f]]))),
  };
}
