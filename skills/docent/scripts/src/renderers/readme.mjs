// 처음 보는 사람에게 "이 시스템이 무엇을 하는가"를 설명하는 소개 README. 개발자용 설치 안내는 쓰지 않는다. (설계 문서 4·10장)
import { textOf } from './i18n.mjs';
import { orderedMenuEntries } from './menu.mjs';

// 값에 든 <!--·태그가 GitHub 렌더링에서 뒤 내용을 숨기지 않게 한다
const md = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function menuLines(inventory, screens) {
  const root = new Map();
  for (const { menu } of orderedMenuEntries(inventory, screens)) {
    let level = root;
    for (const name of menu) {
      if (!level.has(name)) level.set(name, new Map());
      level = level.get(name);
    }
  }
  const lines = [];
  const walk = (level, depth) => {
    for (const [name, children] of level) {
      lines.push(`${'  '.repeat(depth)}- ${md(name)}`);
      walk(children, depth + 1);
    }
  };
  walk(root, 0);
  return lines;
}

function previewLines(inventory, screens, media, limit, T) {
  const gifs = inventory.screens.filter((e) => media.gifs.has(e.id)).slice(0, limit);
  if (!gifs.length) return [];
  return [`## ${T.preview}`, '', ...gifs.map((e) => `![${md(screens.get(e.id).title.value).replace(/[[\]]/g, '\\$&')}](html/media/gif/${e.id}.gif)`), ''];
}

export function renderReadme({ inventory, screens, summary, date, projectName, media = { images: new Set(), gifs: new Set() }, options = {} }) {
  const preset = options.preset ?? 'handover';
  const T = textOf({ options });
  // 근거 주석은 인수인계용에만 남긴다
  const note = (ids) => (preset === 'handover' ? ` <!-- screens: ${ids.join(', ')} -->` : '');
  const roles = [...new Set([...screens.values()].flatMap((s) => s.roles.map((r) => r.value)))];
  const lines = [
    `# ${md(projectName)}`,
    '',
    `${md(summary.oneLiner.value)}${note(summary.oneLiner.screens)}`,
    '',
    ...(media.images.size || media.gifs.size ? [] : [`> ${T.noCapture}`, '']),
    `## ${T.features}`,
    '',
    ...summary.features.map((f) => `- **${md(f.menu)}** — ${md(f.value)}${note(f.screens)}`),
    '',
    ...previewLines(inventory, screens, media, preset === 'portfolio' ? 6 : 3, T),
    `## ${T.menu}`,
    '',
    ...menuLines(inventory, screens),
    '',
    `## ${T.roles}`,
    '',
    ...(roles.length ? roles.map((r) => `- ${md(r)}`) : [`- ${T.noRoles}`]),
    '',
    `## ${T.more}`,
    '',
    `- [${T.systemIntro}](html/index.html)`,
    `- [${T.screenList}](html/screens.html) — ${T.totalScreens(inventory.screens.length)}`,
    `- [${T.workflows}](html/workflows.html)`,
    '',
    `> ${T.readmeNote(date)}`,
    '',
  ];
  return lines.join('\n');
}
