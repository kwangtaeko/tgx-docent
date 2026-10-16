// 산출물 색 테마(config.yaml output.theme). 바탕·글자색은 같고 강조색·그라데이션·번짐 색만 바뀐다.
export const DEFAULT_THEME = 'indigo';

// accent: 강조색(라이트), accentDark: 다크 모드 강조색, accent2: 보조색, hero: 배너 그라데이션 3색,
// glow: 바탕 번짐 2색, soft: 옅은 강조 바탕, ink: 진한 글자색, onInk: 진한 바탕 위 글자, chipLine: 칩 테두리
export const THEMES = {
  indigo: { accent: '4F46E5', accentDark: '8B8CF8', accent2: 'A855F7', hero: ['312E81', '4F46E5', '7C3AED'], glow: ['6366F1', 'EC4899'], soft: 'EEF2FF', ink: '1E1B4B', onInk: 'E0E7FF', chipLine: 'C7D2FE' },
  blue: { accent: '2563EB', accentDark: '60A5FA', accent2: '06B6D4', hero: ['1E3A8A', '2563EB', '0891B2'], glow: ['3B82F6', '06B6D4'], soft: 'EFF6FF', ink: '172554', onInk: 'DBEAFE', chipLine: 'BFDBFE' },
  emerald: { accent: '059669', accentDark: '34D399', accent2: '14B8A6', hero: ['064E3B', '059669', '0D9488'], glow: ['10B981', '84CC16'], soft: 'ECFDF5', ink: '022C22', onInk: 'D1FAE5', chipLine: 'A7F3D0' },
  rose: { accent: 'E11D48', accentDark: 'FB7185', accent2: 'F97316', hero: ['881337', 'E11D48', 'DB2777'], glow: ['F43F5E', 'F97316'], soft: 'FFF1F2', ink: '4C0519', onInk: 'FFE4E6', chipLine: 'FECDD3' },
  slate: { accent: '334155', accentDark: 'CBD5E1', accent2: '64748B', hero: ['0F172A', '334155', '475569'], glow: ['64748B', '94A3B8'], soft: 'F1F5F9', ink: '0F172A', onInk: 'E2E8F0', chipLine: 'CBD5E1' },
};

export const themeOf = (input) => THEMES[input?.options?.theme] ?? THEMES[DEFAULT_THEME];

const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
const rgba = (hex, a) => `rgba(${rgb(hex)}, ${a})`;

// 테마 색 변수. 기본 스타일 뒤에 붙여 덮어쓴다
export function themeCss(name) {
  const t = THEMES[name] ?? THEMES[DEFAULT_THEME];
  const hero = `radial-gradient(600px 320px at 100% 0%, ${rgba(t.glow[1], 0.55)}, transparent 62%), radial-gradient(520px 300px at 0% 100%, ${rgba(t.accent2, 0.4)}, transparent 60%), linear-gradient(135deg, #${t.hero[0]} 0%, #${t.hero[1]} 48%, #${t.hero[2]} 100%)`;
  return `
/* 테마: ${name in THEMES ? name : DEFAULT_THEME} */
:root {
  --accent: #${t.accent}; --accent-soft: ${rgba(t.accent, 0.08)}; --accent-2: #${t.accent2};
  --glow-1: ${rgba(t.glow[0], 0.16)}; --glow-2: ${rgba(t.glow[1], 0.1)};
  --hero-bg: ${hero}; --hero-shadow: ${rgba(t.accent, 0.55)};
}
@media (prefers-color-scheme: dark) {
  :root { --accent: #${t.accentDark}; --accent-soft: ${rgba(t.accentDark, 0.12)}; --glow-1: ${rgba(t.glow[0], 0.22)}; --glow-2: ${rgba(t.glow[1], 0.12)}; }
}
@media print {
  :root { --accent: #${t.accent}; --accent-soft: ${rgba(t.accent, 0.08)}; }
}
`;
}

// Mermaid 다이어그램 색(다크 모드면 어두운 색)
export function mermaidInit(name) {
  const t = THEMES[name] ?? THEMES[DEFAULT_THEME];
  return `(() => {
  const dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  return { startOnLoad: true, theme: 'base', themeVariables: dark
    ? { fontFamily: 'Pretendard Variable, sans-serif', primaryColor: '#${t.ink}', primaryTextColor: '#${t.onInk}', primaryBorderColor: '#${t.accent}', lineColor: '#8b8b98', background: '#0e0e11' }
    : { fontFamily: 'Pretendard Variable, sans-serif', primaryColor: '#${t.soft}', primaryTextColor: '#${t.ink}', primaryBorderColor: '#${t.accentDark}', lineColor: '#9a9aa6', background: '#ffffff' } };
})()`;
}
