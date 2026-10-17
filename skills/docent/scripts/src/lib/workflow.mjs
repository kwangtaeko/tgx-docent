// 워크플로우의 두 단계 a → b가 어떻게 이어지는지. 검증과 산출물이 같은 판정을 쓴다.
// 'action': a의 버튼이 b로 가거나 b를 연다, 또는 a가 b 위에 뜬 창(모달·팝업)이라 닫으면 b로 돌아간다
//           (view는 메뉴로 바뀌는 화면이라 닫고 돌아가는 연결이 아니다)
// 'menu':   a가 창이 아닌 화면(page·view)이고 b가 메뉴에 있는 화면(menuPath가 있는 page·view)이라 메뉴로 옮겨 간다
// undefined: 연결이 없다
const WINDOW = new Set(['modal', 'popup']);

export function edgeKind(screens, a, b) {
  const from = screens.get(a);
  const to = screens.get(b);
  if (!from || !to) return undefined;
  if (from.parentId === b && from.kind !== 'view') return 'action';
  if (from.actions.some((x) => x.navigatesTo === b || x.opens === b)) return 'action';
  if (!WINDOW.has(from.kind) && !WINDOW.has(to.kind) && to.menuPath) return 'menu';
  return undefined;
}
