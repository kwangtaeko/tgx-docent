const HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => HTML[c]);
}

// HTML 주석 안에 넣을 문자열: '--'가 들어가면 주석이 깨지므로 끊어 둔다.
export function escapeComment(value) {
  return String(value).replace(/-(?=-)/g, '- ').replace(/-$/, '- ');
}
