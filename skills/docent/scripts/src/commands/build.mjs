// /docent-build: 검증을 통과한 분석 결과로 .docent/out/에 프리셋·형식에 맞는 산출물(HTML·README·PDF·PPTX)을 만든다.
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { projectDate } from '../lib/project-date.mjs';
import { docentDir, readJson } from '../lib/workspace.mjs';
import { renderSite } from '../renderers/html.mjs';
import { renderReadme } from '../renderers/readme.mjs';
import { renderDiagrams } from '../renderers/diagrams.mjs';
import { renderPdf } from '../renderers/pdf.mjs';
import { renderPptx } from '../renderers/pptx.mjs';
import { renderPrint } from '../renderers/print.mjs';
import { resolveOutputOptions } from '../lib/output-options.mjs';
import { launchBrowser, PlaywrightMissing } from '../lib/playwright.mjs';
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

// 확인 필요 항목 수: 확신도 낮은 항목 + unknowns
function uncertainCount(screens) {
  let n = 0;
  for (const s of screens.values()) {
    for (const x of [s.purpose, ...s.roles, ...s.fields, ...s.actions]) if (x.confidence === 'low') n++;
    n += s.unknowns.length;
  }
  return n;
}

// 파일 이름: 경로·예약 문자는 _로, 공백은 뺀다(사용자 매뉴얼 → 사용자매뉴얼)
const safeFileName = (name) => name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '') || '사용자매뉴얼';

export async function runBuild(projectDir, { assetsDir, preset, formats, browserFactory = launchBrowser } = {}) {
  const { ok, problems } = await runValidate(projectDir);
  if (!ok) throw new Error(`검증에 실패해 빌드를 멈췄습니다:\n${problems.map((p) => `- ${p}`).join('\n')}`);

  const config = await loadConfig(projectDir);
  const options = resolveOutputOptions(config, { preset, formats });
  const warnings = [];
  const skipped = [];
  if (config.language !== 'ko') warnings.push(`language "${config.language}"는 아직 지원하지 않아 한국어로 만들었습니다`);
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) screens.set(id, await readJson(join(dir, 'screens', `${id}.json`)));
  const media = await collectMedia(projectDir, inventory);
  const input = {
    options,
    media,
    inventory,
    screens,
    summary: await readJson(join(dir, 'summary.json')),
    date: projectDate(projectDir, config),
    projectName: await projectName(projectDir),
  };
  if (options.preset === 'delivery') {
    const n = uncertainCount(screens);
    if (n) warnings.push(`확인 필요 항목 ${n}건이 남아 있습니다(.docent/review.md). 납품 전에 확인하세요`);
  }

  const outDir = join(dir, 'out');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const files = [];
  const wants = (f) => options.formats.includes(f);
  const needsHtmlDir = wants('html') || wants('pdf');

  if (wants('html')) for (const [rel, content] of renderSite(input)) await put(outDir, `html/${rel}`, content, files);
  if (needsHtmlDir) {
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
  }
  if (wants('readme')) await put(outDir, 'README.md', renderReadme(input), files);

  if (wants('pdf') || wants('pptx')) {
    let browser;
    try {
      browser = await browserFactory();
    } catch (err) {
      if (!(err instanceof PlaywrightMissing)) throw err;
    }
    try {
      const base = safeFileName(options.title);
      if (wants('pdf')) {
        if (!browser) skipped.push({ format: 'pdf', reason: 'Playwright가 없어 PDF를 만들지 못했습니다(docent runtime install)' });
        else {
          await put(outDir, 'html/print.html', renderPrint(input), files);
          await renderPdf(join(outDir, 'html', 'print.html'), join(outDir, `${base}.pdf`), { title: options.title, date: input.date, browser });
          files.push(`${base}.pdf`);
        }
      }
      if (wants('pptx')) {
        let diagrams;
        if (browser) diagrams = await renderDiagrams(browser, input, { assetsDir });
        else if (input.summary.workflows.length) warnings.push('Playwright가 없어 PPT의 워크플로우 다이어그램 대신 단계 목록을 넣었습니다');
        const buf = await renderPptx(input, { diagrams, mediaDir: join(dir, 'media') });
        await writeFile(join(outDir, `${base}.pptx`), buf);
        files.push(`${base}.pptx`);
      }
    } finally {
      if (browser) await browser.close();
    }
  }
  return { files: files.sort(), warnings, skipped };
}
