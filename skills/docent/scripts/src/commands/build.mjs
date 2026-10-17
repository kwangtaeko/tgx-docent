// /docent-build: 검증을 통과한 분석 결과로 .docent/out/에 프리셋·형식에 맞는 산출물(HTML·README·PDF·PPTX)을 만든다.
import { copyFile, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { loadConfig } from '../lib/config.mjs';
import { t } from '../lib/cli-text.mjs';
import { projectDate } from '../lib/project-date.mjs';
import { docentDir, readJson, withWorkspace, workspaceName } from '../lib/workspace.mjs';
import { renderSite } from '../renderers/html.mjs';
import { stringsFor } from '../renderers/i18n.mjs';
import { renderReadme } from '../renderers/readme.mjs';
import { renderDiagrams } from '../renderers/diagrams.mjs';
import { renderPdf } from '../renderers/pdf.mjs';
import { renderPptx } from '../renderers/pptx.mjs';
import { renderPrint } from '../renderers/print.mjs';
import { resolveOutputOptions } from '../lib/output-options.mjs';
import { launchBrowser, PlaywrightMissing } from '../lib/playwright.mjs';
import { runValidate } from './validate.mjs';

const readText = (path) => readFile(path, 'utf8').catch(() => undefined);
const jsonOf = async (path) => {
  try {
    return JSON.parse(await readText(path));
  } catch {
    return undefined;
  }
};

// 사용자에게 보이는 제품 이름: package.json productName, electron-builder·Tauri 설정의 productName
async function productName(dir) {
  const pkg = await jsonOf(join(dir, 'package.json'));
  if (pkg?.productName) return pkg.productName;
  for (const file of ['electron-builder.yml', 'electron-builder.yaml']) {
    const m = /^productName:\s*["']?([^"'\n#]+?)["']?\s*$/m.exec((await readText(join(dir, file))) ?? '');
    if (m) return m[1];
  }
  const builder = await jsonOf(join(dir, 'electron-builder.json'));
  if (builder?.productName) return builder.productName;
  const tauri = await jsonOf(join(dir, 'src-tauri', 'tauri.conf.json'));
  return tauri?.productName ?? tauri?.package?.productName;
}

// 산출물 머리의 프로젝트 이름: output.projectName > 앱(app 폴더)·루트의 제품 이름 > 루트 package.json name > 폴더 이름
async function projectName(projectDir, config) {
  if (config.output?.projectName) return String(config.output.projectName);
  const name = (config.app && (await productName(join(projectDir, config.app)))) || (await productName(projectDir));
  if (name) return name;
  const pkg = await jsonOf(join(projectDir, 'package.json'));
  return pkg?.name ?? basename(projectDir);
}

async function put(outDir, rel, content, files) {
  const path = join(outDir, rel);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  files.push(rel);
}

// .docent/media의 캡처·GIF 중 inventory에 있는 화면 것만(실패 이미지 media/fail은 넣지 않는다)
async function collectMedia(mediaRoot, inventory) {
  const ids = new Set(inventory.screens.map((s) => s.id));
  const pick = async (sub, ext) => {
    try {
      const names = await readdir(join(mediaRoot, sub));
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

// 파일 이름: 경로·예약 문자는 _로, 공백은 뺀다(사용자 매뉴얼 → 사용자매뉴얼, User Manual → UserManual)
const safeFileName = (name, language) => name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '') || stringsFor(language).defaultFileName;

// 지금 고른 작업(루트 또는 앱 작업)의 분석 결과를 검증하고 읽는다
async function loadWorkspace(projectDir) {
  const { ok, problems } = await runValidate(projectDir);
  if (!ok) {
    const where = workspaceName() ? ` (${workspaceName()})` : '';
    throw new Error(`${t('검증에 실패해 빌드를 멈췄습니다:')}${where}\n${problems.map((p) => `- ${p}`).join('\n')}`);
  }
  const config = await loadConfig(projectDir);
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  const screens = new Map();
  for (const { id } of inventory.screens) screens.set(id, await readJson(join(dir, 'screens', `${id}.json`)));
  const mediaRoot = join(dir, 'media');
  return {
    config,
    inventory,
    screens,
    summary: await readJson(join(dir, 'summary.json')),
    mediaRoot,
    media: await collectMedia(mediaRoot, inventory),
    date: projectDate(projectDir, config, [...new Set([...inventory.screens.flatMap((s) => s.files), ...[...screens.values()].flatMap((s) => s.readFiles)])]),
    projectName: await projectName(projectDir, config),
  };
}

// 화면 ID 앞에 앱 작업 이름을 붙인다(합친 매뉴얼에서 앱끼리 ID가 겹치지 않게): web + home → web.home
const prefixed = (ws, id) => (id === undefined ? undefined : `${ws}.${id}`);

// 앱 하나의 분석 결과를 합친 매뉴얼용으로 바꾼다: ID·연결에 앱 이름, 메뉴 경로·기능·워크플로우 이름 앞에 앱 제목
function renameApp(part, ws, title) {
  const re = (id) => prefixed(ws, id);
  const inventory = part.inventory.screens.map((e) => ({
    ...e,
    id: re(e.id),
    ...(e.parentId ? { parentId: re(e.parentId) } : {}),
    ...(e.menuPath ? { menuPath: [title, ...e.menuPath] } : {}),
    app: title,
    // 앱마다 캡처 크기가 다를 수 있다(관리자 웹은 데스크톱, 수강생 앱은 휴대폰)
    device: part.config.capture.device,
  }));
  const screens = new Map();
  for (const [id, s] of part.screens) {
    screens.set(re(id), {
      ...s,
      id: re(id),
      ...(s.parentId ? { parentId: re(s.parentId) } : {}),
      ...(s.menuPath ? { menuPath: { ...s.menuPath, value: [title, ...s.menuPath.value] } } : {}),
      actions: s.actions.map((a) => ({ ...a, ...(a.navigatesTo ? { navigatesTo: re(a.navigatesTo) } : {}), ...(a.opens ? { opens: re(a.opens) } : {}) })),
    });
  }
  const summary = {
    oneLiner: { ...part.summary.oneLiner, screens: part.summary.oneLiner.screens.map(re) },
    features: part.summary.features.map((f) => ({ ...f, menu: `${title} · ${f.menu}`, screens: f.screens.map(re) })),
    workflows: part.summary.workflows.map((w) => ({ ...w, name: `${title} · ${w.name}`, steps: w.steps.map(re) })),
  };
  const media = { images: new Set([...part.media.images].map(re)), gifs: new Set([...part.media.gifs].map(re)) };
  return { inventory, screens, summary, media };
}

// 루트 config.yaml의 combine: 앱 작업마다 검증·읽기 → 하나의 산출물 입력으로.
// 캡처·GIF는 바뀐 ID로 임시 폴더에 모은다(실제 데이터가 찍혔을 수 있어 레포 안에 남기지 않는다. build가 끝나면 지운다)
async function loadCombined(projectDir, config, warnings, mediaRoot) {
  const merged = { inventory: { version: 1, screens: [] }, screens: new Map(), summary: { oneLiner: { value: '', screens: [] }, features: [], workflows: [] }, media: { images: new Set(), gifs: new Set() } };
  const oneLiners = [];
  const dates = [];
  for (const { workspace, title: given } of config.combine) {
    const part = await withWorkspace(workspace, () => loadWorkspace(projectDir));
    if (part.config.language !== config.language) warnings.push(t('앱 작업 {0}의 language({1})가 루트 config.yaml({2})와 다릅니다. 화면 설명이 섞인 언어로 나옵니다', workspace, part.config.language, config.language));
    const title = given ?? part.projectName;
    const app = renameApp(part, workspace, title);
    merged.inventory.screens.push(...app.inventory);
    for (const [id, s] of app.screens) merged.screens.set(id, s);
    oneLiners.push(part.summary.oneLiner.value);
    merged.summary.oneLiner.screens.push(...app.summary.oneLiner.screens);
    merged.summary.features.push(...app.summary.features);
    merged.summary.workflows.push(...app.summary.workflows);
    for (const [kind, set, ext] of [['img', 'images', 'png'], ['gif', 'gifs', 'gif']]) {
      for (const id of part.media[set]) {
        await mkdir(join(mediaRoot, kind), { recursive: true });
        await cp(join(part.mediaRoot, kind, `${id}.${ext}`), join(mediaRoot, kind, `${prefixed(workspace, id)}.${ext}`));
      }
      for (const id of app.media[set]) merged.media[set].add(id);
    }
    dates.push(part.date);
  }
  merged.summary.oneLiner.value = oneLiners.join(' ');
  return {
    ...merged,
    mediaRoot,
    // 날짜: config.date가 있으면 그것, 없으면 앱 중 가장 최근
    date: config.date ? String(config.date) : dates.sort().at(-1),
    projectName: await projectName(projectDir, config),
  };
}

export async function runBuild(projectDir, { assetsDir, preset, formats, browserFactory = launchBrowser } = {}) {
  const config = await loadConfig(projectDir);
  const warnings = [];
  const skipped = [];
  // 루트에서 combine이 있으면 앱 작업들을 합친 매뉴얼, 아니면 지금 고른 작업 하나
  const combined = !workspaceName() && config.combine.length > 0;
  const staging = combined ? await mkdtemp(join(tmpdir(), 'docent-combined-')) : undefined;
  try {
    return await buildFrom(projectDir, config, combined ? await loadCombined(projectDir, config, warnings, staging) : await loadWorkspace(projectDir), {
      assetsDir,
      preset,
      formats,
      browserFactory,
      warnings,
      skipped,
      combined,
    });
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
  }
}

async function buildFrom(projectDir, config, loaded, { assetsDir, preset, formats, browserFactory, warnings, skipped, combined }) {
  const options = resolveOutputOptions(config, { preset, formats });
  const dir = docentDir(projectDir);
  const { inventory, screens, media, mediaRoot } = loaded;
  const input = {
    options,
    media,
    inventory,
    screens,
    summary: loaded.summary,
    date: loaded.date,
    projectName: loaded.projectName,
    ...(combined ? { apps: config.combine.length } : {}),
  };
  if (options.preset === 'delivery') {
    const n = uncertainCount(screens);
    if (n) warnings.push(t('확인 필요 항목 {0}건이 남아 있습니다(.docent/review.md). 납품 전에 확인하세요', n));
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
    // 그림·확대 스크립트와 글꼴(Pretendard, SIL OFL — 라이선스 파일을 함께 넣어야 함)
    await mkdir(join(outDir, 'html', 'assets', 'fonts'), { recursive: true });
    for (const asset of ['mermaid.min.js', 'zoom.min.js', 'fonts/PretendardVariable.woff2', 'fonts/Pretendard-OFL.txt']) {
      await copyFile(join(assetsDir, asset), join(outDir, 'html', 'assets', asset));
      files.push(`html/assets/${asset}`);
    }
    for (const [kind, ext] of [['img', 'png'], ['gif', 'gif']]) {
      const set = kind === 'img' ? media.images : media.gifs;
      if (!set.size) continue;
      await mkdir(join(outDir, 'html', 'media', kind), { recursive: true });
      for (const id of set) {
        await copyFile(join(mediaRoot, kind, `${id}.${ext}`), join(outDir, 'html', 'media', kind, `${id}.${ext}`));
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
      const base = safeFileName(options.title, options.language);
      if (wants('pdf')) {
        if (!browser) skipped.push({ format: 'pdf', reason: t('Playwright가 없어 PDF를 만들지 못했습니다(docent runtime install)') });
        else {
          await put(outDir, 'html/print.html', renderPrint(input), files);
          const { diagramsReady } = await renderPdf(join(outDir, 'html', 'print.html'), join(outDir, `${base}.pdf`), { title: options.title, date: input.date, browser });
          if (!diagramsReady && input.summary.workflows.length) warnings.push(t('PDF의 워크플로우 다이어그램이 준비되지 않아 Mermaid 원문이 들어갔을 수 있습니다'));
          files.push(`${base}.pdf`);
        }
      }
      if (wants('pptx')) {
        let diagrams;
        if (browser) {
          diagrams = await renderDiagrams(browser, input, { assetsDir });
          const failed = diagrams.filter((d) => !d).length;
          if (failed) warnings.push(t('워크플로우 다이어그램 {0}개를 그리지 못해 단계 목록만 넣었습니다', failed));
        }
        else if (input.summary.workflows.length) warnings.push(t('Playwright가 없어 PPT의 워크플로우 다이어그램 대신 단계 목록을 넣었습니다'));
        const buf = await renderPptx(input, { diagrams, mediaDir: mediaRoot });
        await writeFile(join(outDir, `${base}.pptx`), buf);
        files.push(`${base}.pptx`);
      }
    } finally {
      if (browser) await browser.close();
    }
  }
  return { files: files.sort(), warnings, skipped };
}
