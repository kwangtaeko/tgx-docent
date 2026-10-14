// 메뉴 트리 순서: 화면 목록(라우트) 순서가 아니라 실제 메뉴 정의 순서(메뉴 근거의 파일·줄)를 따른다.
import { parseEvidence } from '../lib/evidence.mjs';

function position(evidence) {
  try {
    const ev = parseEvidence(evidence);
    return 'startLine' in ev ? { file: ev.file, line: ev.startLine } : undefined;
  } catch {
    return undefined;
  }
}

// → [{ id, menu }]. 근거 줄이 있는 항목을 (파일, 줄) 순으로 먼저, 나머지는 inventory 순서로 뒤에 둔다.
export function orderedMenuEntries(inventory, screens) {
  const entries = [];
  inventory.screens.forEach((entry, index) => {
    const analyzed = screens.get(entry.id)?.menuPath;
    const menu = analyzed?.value ?? entry.menuPath;
    if (!menu?.length) return;
    entries.push({ id: entry.id, menu, index, pos: analyzed ? position(analyzed.evidence) : undefined });
  });
  entries.sort((a, b) => {
    if (a.pos && b.pos) {
      if (a.pos.file !== b.pos.file) return a.pos.file < b.pos.file ? -1 : 1;
      if (a.pos.line !== b.pos.line) return a.pos.line - b.pos.line;
    } else if (a.pos || b.pos) {
      return a.pos ? -1 : 1;
    }
    return a.index - b.index;
  });
  return entries.map(({ id, menu }) => ({ id, menu }));
}
