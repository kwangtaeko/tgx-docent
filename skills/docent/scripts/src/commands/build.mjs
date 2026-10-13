// /docent-build: 검증을 통과한 분석 결과로 .docent/out/에 HTML 사이트와 소개 README를 만든다.
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

export async function runBuild(projectDir, { assetsDir }) {
  const { ok, problems } = await runValidate(projectDir);
  if (!ok) throw new Error(`검증에 실패해 빌드를 멈췄습니다:\n${problems.map((p) => `- ${p}`).join('\n')}`);

  const config = await loadConfig(projectDir);
  if (config.language !== 'ko') console.warn(`docent: language "${config.language}"는 아직 지원하지 않아 한국어로 만듭니다.`);
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) screens.set(id, await readJson(join(dir, 'screens', `${id}.json`)));
  const input = {
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
  await put(outDir, 'README.md', renderReadme(input), files);
  return { files: files.sort() };
}
