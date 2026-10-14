// 처음 보는 사람에게 "이 시스템이 무엇을 하는가"를 설명하는 소개 README. 개발자용 설치 안내는 쓰지 않는다. (설계 문서 4·10장)

function menuLines(inventory, screens) {
  const root = new Map();
  for (const entry of inventory.screens) {
    const menu = screens.get(entry.id)?.menuPath?.value ?? entry.menuPath;
    if (!menu?.length) continue;
    let level = root;
    for (const name of menu) {
      if (!level.has(name)) level.set(name, new Map());
      level = level.get(name);
    }
  }
  const lines = [];
  const walk = (level, depth) => {
    for (const [name, children] of level) {
      lines.push(`${'  '.repeat(depth)}- ${name}`);
      walk(children, depth + 1);
    }
  };
  walk(root, 0);
  return lines;
}

function previewLines(inventory, screens, media, limit) {
  const gifs = inventory.screens.filter((e) => media.gifs.has(e.id)).slice(0, limit);
  if (!gifs.length) return [];
  return ['## 화면 미리보기', '', ...gifs.map((e) => `![${screens.get(e.id).title.value}](html/media/gif/${e.id}.gif)`), ''];
}

export function renderReadme({ inventory, screens, summary, date, projectName, media = { images: new Set(), gifs: new Set() }, options = {} }) {
  const preset = options.preset ?? 'handover';
  // 근거 주석은 인수인계용에만 남긴다
  const note = (ids) => (preset === 'handover' ? ` <!-- screens: ${ids.join(', ')} -->` : '');
  const roles = [...new Set([...screens.values()].flatMap((s) => s.roles.map((r) => r.value)))];
  const lines = [
    `# ${projectName}`,
    '',
    `${summary.oneLiner.value}${note(summary.oneLiner.screens)}`,
    '',
    ...(media.images.size || media.gifs.size ? [] : ['> 화면 캡처 없이 소스만으로 만들었습니다.', '']),
    '## 주요 기능',
    '',
    ...summary.features.map((f) => `- **${f.menu}** — ${f.value}${note(f.screens)}`),
    '',
    ...previewLines(inventory, screens, media, preset === 'portfolio' ? 6 : 3),
    '## 메뉴 구조',
    '',
    ...menuLines(inventory, screens),
    '',
    '## 사용자 역할',
    '',
    ...(roles.length ? roles.map((r) => `- ${r}`) : ['- 로그인 없이 사용']),
    '',
    '## 더 보기',
    '',
    '- [시스템 소개](html/index.html)',
    `- [화면 목록](html/screens.html) — 전체 ${inventory.screens.length}개 화면`,
    '- [워크플로우](html/workflows.html)',
    '',
    `> docent로 소스 코드를 분석해 만든 초안입니다 (기준일 ${date}).`,
    '',
  ];
  return lines.join('\n');
}
