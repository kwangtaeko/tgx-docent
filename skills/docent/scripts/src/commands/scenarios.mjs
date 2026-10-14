// 시나리오 관련: GIF 대상 화면 선정. (설계 문서 9장 "GIF 대상 화면 기본값")

// screens: 화면 JSON 배열. 기본값은 버튼 동작이 있는 화면, config.gif.screens로 지정·제외
export function gifTargets(screens, config) {
  const { include = [], exclude = [] } = config.gif?.screens ?? {};
  return screens
    .filter((s) => (include.length ? include.includes(s.id) : (s.actions ?? []).length > 0))
    .filter((s) => !exclude.includes(s.id))
    .map((s) => s.id);
}
