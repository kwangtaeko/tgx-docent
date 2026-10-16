// 명령줄 안내 문구의 언어(산출물 언어와 별개). 한국어 문구를 열쇠로 쓰고, 영어면 번역표에서 찾는다(없으면 한국어 그대로).
// t('파일 없음: {0}', path) — {0}·{1}…은 인자 자리
import commandsA from './cli-text/commands-a.mjs';
import commandsB from './cli-text/commands-b.mjs';
import lib from './cli-text/lib.mjs';
import main from './cli-text/main.mjs';

export const EN = { ...main, ...commandsA, ...commandsB, ...lib };

let language = 'ko';

// DOCENT_LANG 환경변수 > config.yaml의 language > ko
export function setCliLanguage(value) {
  language = value === 'en' ? 'en' : 'ko';
}

export const cliLanguage = () => language;

export function t(text, ...args) {
  const template = language === 'en' && Object.hasOwn(EN, text) ? EN[text] : text;
  return template.replace(/\{(\d+)\}/g, (whole, i) => (Number(i) < args.length ? String(args[Number(i)]) : whole));
}
