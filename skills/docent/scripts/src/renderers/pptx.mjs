// PPTX 산출물(pptxgenjs). 표지 → 소개 → 메뉴 구조 → 워크플로우 → 화면별 → (납품용) 개정 이력. (설계 문서 10장)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import PptxGenJS from 'pptxgenjs';
import { presetOf, revisionRows, screenTitle } from './html.mjs';
import { orderedMenuEntries } from './menu.mjs';

const FONT = 'Malgun Gothic';
const W = 13.333;
const MAX_ROWS = 8;
const MENU_LINES = 18;
const FEATURES_PER_SLIDE = 9;
// 표 높이 추정(11pt 한글 기준): 칸 너비(in)당 한 줄 글자 수, 한 줄 높이
const CHARS_PER_IN = 6.5;
const LINE_IN = 0.2;
const ROW_PAD_IN = 0.12;
const TABLE_BUDGET_IN = 5.2;
const COL_W = [0.8, 1.8, 3.4];
const TYPE_LABELS = { text: '텍스트', textarea: '여러 줄', number: '숫자', date: '날짜', select: '선택', checkbox: '체크', radio: '단일 선택', file: '파일', password: '비밀번호', email: '이메일', other: '기타' };
const low = (x) => (x.confidence === 'low' ? '[확인 필요] ' : '');

// PNG·GIF 머리에서 크기를 읽는다
function imageSize(buf) {
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  return { width: 4, height: 3 };
}

function fit(buf, box) {
  const { width, height } = imageSize(buf);
  const scale = Math.min(box.w / width, box.h / height);
  const w = width * scale;
  const h = height * scale;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

const dataUri = (buf, type) => `${type};base64,${buf.toString('base64')}`;

async function readMaybe(path) {
  try {
    return await readFile(path);
  } catch {
    return undefined;
  }
}

const SUB_MAX = 180;
function title(slide, text, sub) {
  slide.addText(text, { x: 0.5, y: 0.3, w: W - 1, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: '1F2328' });
  // 부제는 두 줄까지(넘치면 줄임표) — 아래 내용 영역(y 1.5~)을 침범하지 않게
  if (sub) {
    const short = sub.length > SUB_MAX ? `${sub.slice(0, SUB_MAX - 1)}…` : sub;
    slide.addText(short, { x: 0.5, y: 0.9, w: W - 1, h: 0.55, fontFace: FONT, fontSize: 12, color: '59636E', valign: 'top', fit: 'shrink' });
  }
}

// 행 높이를 글자 수로 추정해 한 장에 들어갈 만큼씩 나눈다
function rowHeight(row) {
  const lines = row.map((cell, i) => Math.max(1, Math.ceil(String(cell).length / Math.max(1, (COL_W[i] - 0.15) * CHARS_PER_IN))));
  return ROW_PAD_IN + LINE_IN * Math.max(...lines);
}

export function chunkRows(rows) {
  const chunks = [];
  let current = [];
  let height = 0;
  for (const row of rows) {
    const h = rowHeight(row);
    if (current.length && (current.length >= MAX_ROWS || height + h > TABLE_BUDGET_IN)) {
      chunks.push(current);
      current = [];
      height = 0;
    }
    current.push(row);
    height += h;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [[]];
}

const splitEvery = (list, n) => (list.length ? Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, (i + 1) * n)) : [[]]);

function bullets(slide, lines, box) {
  slide.addText(
    lines.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
    { ...box, fontFace: FONT, fontSize: 14, color: '1F2328', valign: 'top', paraSpaceAfter: 6 },
  );
}

function menuLines(input) {
  const lines = [];
  const seen = new Set();
  for (const { menu } of orderedMenuEntries(input.inventory, input.screens)) {
    menu.forEach((name, i) => {
      const key = menu.slice(0, i + 1).join('›');
      if (seen.has(key)) return;
      seen.add(key);
      lines.push(`${'    '.repeat(i)}${name}`);
    });
  }
  return lines;
}

function screenRows(s) {
  return [
    ...s.fields.map((f) => ['입력', `${low(f)}${f.label}`, `${TYPE_LABELS[f.type] ?? f.type}${f.required ? ' · 필수' : ''}`]),
    ...s.actions.map((a) => ['버튼', a.label, `${low(a)}${a.effect}`]),
  ];
}

export async function renderPptx(input, { diagrams, mediaDir } = {}) {
  const preset = presetOf(input);
  const options = input.options ?? {};
  const media = input.media ?? { images: new Set(), gifs: new Set() };
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = `${input.projectName} ${options.title ?? '사용자 매뉴얼'}`;
  if (options.organization) pptx.company = options.organization;

  // 표지
  const cover = pptx.addSlide();
  cover.addText(input.projectName, { x: 0.8, y: 2.2, w: W - 1.6, h: 1, fontFace: FONT, fontSize: 40, bold: true });
  cover.addText(options.title ?? '사용자 매뉴얼', { x: 0.8, y: 3.2, w: W - 1.6, h: 0.7, fontFace: FONT, fontSize: 24, color: '59636E' });
  cover.addText([options.organization, `기준일 ${input.date}`].filter(Boolean).join('  ·  '), { x: 0.8, y: 4.2, w: W - 1.6, h: 0.5, fontFace: FONT, fontSize: 14, color: '59636E' });

  // 소개(주요 기능이 많으면 여러 장)
  splitEvery(input.summary.features, FEATURES_PER_SLIDE).forEach((features, i) => {
    const intro = pptx.addSlide();
    title(intro, `소개${i ? ' (계속)' : ''}`, input.summary.oneLiner.value);
    bullets(intro, features.map((f) => `${f.menu} — ${f.value}`), { x: 0.6, y: 1.6, w: W - 1.2, h: 5.4 });
  });

  // 메뉴 구조(길면 여러 장)
  splitEvery(menuLines(input), MENU_LINES).forEach((lines, i) => {
    const menu = pptx.addSlide();
    title(menu, `메뉴 구조${i ? ' (계속)' : ''}`);
    menu.addText(lines.join('\n') || '메뉴 정보 없음', { x: 0.6, y: 1.2, w: W - 1.2, h: 5.8, fontFace: FONT, fontSize: 16, valign: 'top' });
  });

  // 워크플로우
  input.summary.workflows.forEach((wf, i) => {
    const slide = pptx.addSlide();
    title(slide, `워크플로우 · ${wf.name}`, wf.description);
    const png = diagrams?.[i];
    if (png) slide.addImage({ data: dataUri(png, 'image/png'), ...fit(png, { x: 0.6, y: 1.6, w: W - 1.2, h: 3.4 }) });
    const steps = wf.steps.map((id, n) => `${n + 1}. ${screenTitle(input.screens, id)}`).join('   →   ');
    slide.addText(steps, { x: 0.6, y: png ? 5.3 : 1.8, w: W - 1.2, h: 1.2, fontFace: FONT, fontSize: 14, color: '1F2328' });
  });

  // 화면별
  for (const entry of input.inventory.screens) {
    const s = input.screens.get(entry.id);
    if (preset === 'portfolio') {
      if (!media.gifs.has(entry.id)) continue;
      const gif = await readMaybe(join(mediaDir, 'gif', `${entry.id}.gif`));
      const slide = pptx.addSlide();
      title(slide, s.title.value, s.purpose.value);
      if (gif) slide.addImage({ data: dataUri(gif, 'image/gif'), ...fit(gif, { x: 0.6, y: 1.5, w: W - 1.2, h: 5.6 }) });
      continue;
    }
    const rows = screenRows(s);
    const chunks = chunkRows(rows);
    const shot = media.images.has(entry.id) ? await readMaybe(join(mediaDir, 'img', `${entry.id}.png`)) : undefined;
    chunks.forEach((chunk, i) => {
      const slide = pptx.addSlide();
      title(slide, `${s.title.value}${i ? ' (계속)' : ''}`, `${low(s.purpose)}${s.purpose.value}`);
      const box = { x: 0.5, y: 1.5, w: 6.0, h: 5.6 };
      if (shot) slide.addImage({ data: dataUri(shot, 'image/png'), ...fit(shot, box) });
      else {
        slide.addShape(pptx.ShapeType.rect, { ...box, line: { color: 'D1D9E0', dashType: 'dash' }, fill: { color: 'F6F8FA' } });
        slide.addText('캡처 없음', { ...box, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 16, color: '59636E' });
      }
      const header = ['구분', '이름', '설명'].map((t) => ({ text: t, options: { bold: true, fill: { color: 'F6F8FA' } } }));
      const body = chunk.length ? chunk : [['', '입력 항목·버튼 없음', '']];
      slide.addTable([header, ...body], { x: 6.8, y: 1.5, w: 6.0, colW: COL_W, fontFace: FONT, fontSize: 11, border: { type: 'solid', color: 'D1D9E0', pt: 0.75 }, valign: 'top' });
    });
  }

  if (preset === 'delivery') {
    const slide = pptx.addSlide();
    title(slide, '개정 이력');
    const header = ['버전', '날짜', '작성자', '내용'].map((t) => ({ text: t, options: { bold: true, fill: { color: 'F6F8FA' } } }));
    const rows = revisionRows(input).map((r) => [r.version, r.date, r.author, r.note]);
    slide.addTable([header, ...rows], { x: 0.6, y: 1.3, w: W - 1.2, colW: [1.2, 1.8, 2.0, W - 6.2], fontFace: FONT, fontSize: 12, border: { type: 'solid', color: 'D1D9E0', pt: 0.75 } });
  }

  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}
