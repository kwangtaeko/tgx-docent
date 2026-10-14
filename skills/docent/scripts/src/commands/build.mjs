// /docent-build: 검증을 통과한 분석 결과로 .docent/out/에 HTML 사이트와 소개 README를 만든다.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { projectDate } from '../lib/project-date.mjs';
import { docentDir, readJson } from '../lib/workspace.mjs';
import { renderSite } from '../renderers/html.mjs';
import { renderReadme } from '../renderers/readme.mjs';
import { runValidate } from './validate.mjs';

async function projectName(projectDir) {
  try {
    const pkg = JSON.parse(await readFile(join(projectDir, 'package.json'), 'utf8'));
    if (pkg.name) return pkg.name;
  } catch {
    // package.json이 없는 프로젝트
  }
  return basename(projectDir);
}

async function put(outDir, rel, content, files) {
  const path = join(outDir, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  files.push(rel);
}

// .docent/media의 캡처·GIF 중 inventory에 있는 화면 것만(실패 이미지 media/fail은 넣지 않는다)
async function collectMedia(projectDir, inventory) {
  const ids = new Set(inventory.screens.map((s) => s.id));
  const pick = async (sub, ext) => {
    try {
      const names = await readdir(join(docentDir(projectDir), 'media', sub));
      return new Set(names.filter((n) => n.endsWith(`.${ext}`)).map((n) => n.slice(0, -ext.length - 1)).filter((id) => ids.has(id)));
    } catch {
      return new Set();
    }
  };
  return { images: await pick('img', 'png'), gifs: await pick('gif', 'gif') };
}

export async function runBuild(projectDir, { assetsDir }) {
  const { ok, problems } = await runValidate(projectDir);
  if (!ok) throw new Error(`검증에 실패해 빌드를 멈췄습니다:\n${problems.map((p) => `- ${p}`).join('\n')}`);

  const config = await loadConfig(projectDir);
  if (config.language !== 'ko') console.warn(`docent: language "${config.language}"는 아직 지원하지 않아 한국어로 만듭니다.`);
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) screens.set(id, await readJson(join(dir, 'screens', `${id}.json`)));
  const media = await collectMedia(projectDir, inventory);
  const input = {
    media,
    inventory,
    screens,
    summary: await readJson(join(dir, 'summary.json')),
    date: projectDate(projectDir, config),
    projectName: await projectName(projectDir),
  };

  const outDir = join(dir, 'out');
  await rm(outDir, { recursive: true, force: true });
  const files = [];
  for (const [rel, content] of renderSite(input)) await put(outDir, `html/${rel}`, content, files);
  await mkdir(join(outDir, 'html', 'assets'), { recursive: true });
  await copyFile(join(assetsDir, 'mermaid.min.js'), join(outDir, 'html', 'assets', 'mermaid.min.js'));
  files.push('html/assets/mermaid.min.js');
  for (const [kind, ext] of [['img', 'png'], ['gif', 'gif']]) {
    const set = kind === 'img' ? media.images : media.gifs;
    if (!set.size) continue;
    await mkdir(join(outDir, 'html', 'media', kind), { recursive: true });
    for (const id of set) {
      await copyFile(join(dir, 'media', kind, `${id}.${ext}`), join(outDir, 'html', 'media', kind, `${id}.${ext}`));
      files.push(`html/media/${kind}/${id}.${ext}`);
    }
  }
  await put(outDir, 'README.md', renderReadme(input), files);
  return { files: files.sort() };
}
