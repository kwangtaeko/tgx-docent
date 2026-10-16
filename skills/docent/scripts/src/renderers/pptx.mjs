// PPTX 산출물(pptxgenjs). 표지 → 소개 → 메뉴 구조 → 워크플로우 → 화면별 → (납품용) 개정 이력. (설계 문서 10장)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import PptxGenJS from 'pptxgenjs';
import { presetOf, revisionRows, screenTitle } from './html.mjs';
import { orderedMenuEntries } from './menu.mjs';

const FONT = 'Malgun Gothic';
const W = 13.333;
// HTML 산출물과 같은 색 토큰
const C = { fg: '17171C', muted: '5B5B66', line: 'E4E4EA', soft: 'F6F6F8', accent: '4F46E5', accentSoft: 'EEF2FF', ink: '1E1B4B', onInk: 'E0E7FF' };
const FRAME_BAR = 0.28;
const MAX_ROWS = 8;
const MENU_LINES = 18;
const FEATURES_PER_SLIDE = 9;
// 표 높이 추정(11pt 한글 기준): 칸 너비(in)당 한 줄 글자 수, 한 줄 높이
const CHARS_PER_IN = 6.5;
const LINE_IN = 0.2;
const ROW_PAD_IN = 0.12;
const TABLE_BUDGET_IN = 5.2;
const COL_W = [0.8, 1.8, 3.4];
const SHOT_BOX = { x: 0.5, y: 1.5, w: 6.0, h: 5.6 };
const TYPE_LABELS = { text: '텍스트', textarea: '여러 줄', number: '숫자', date: '날짜', select: '선택', checkbox: '체크', radio: '단일 선택', file: '파일', password: '비밀번호', email: '이메일', other: '기타' };
const low = (x) => (x.confidence === 'low' ? '[확인 필요] ' : '');

// PNG·GIF 머리에서 크기를 읽는다
function imageSize(buf) {
  if (buf.subarray(1, 4).toString('latin1') === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (buf.subarray(0, 3).toString('latin1') === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  return { width: 4, height: 3 };
}

// 세로로 아주 긴 전체 화면 캡처는 슬라이드에서 너무 작아지므로 위쪽만 남긴다(전체는 HTML에)
export function cropForSlide(buf, boxW, boxH) {
  const { width, height } = imageSize(buf);
  const maxHeight = Math.round(width * (boxH / boxW) * 1.5);
  if (height <= maxHeight) return buf;
  const src = PNG.sync.read(buf);
  const out = new PNG({ width, height: maxHeight });
  PNG.bitblt(src, out, 0, 0, width, maxHeight, 0, 0);
  return PNG.sync.write(out);
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
  slide.addShape('rect', { x: 0.5, y: 0.4, w: 0.07, h: 0.42, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(text, { x: 0.68, y: 0.3, w: W - 1.2, h: 0.6, fontFace: FONT, fontSize: 24, bold: true, color: C.fg });
  // 부제는 두 줄까지(넘치면 줄임표) — 아래 내용 영역(y 1.5~)을 침범하지 않게
  if (sub) {
    const short = sub.length > SUB_MAX ? `${sub.slice(0, SUB_MAX - 1)}…` : sub;
    slide.addText(short, { x: 0.5, y: 0.9, w: W - 1, h: 0.55, fontFace: FONT, fontSize: 12, color: C.muted, valign: 'top', fit: 'shrink' });
  }
}

// 브라우저 틀(점 세 개 막대) 안에 이미지를 넣는다
function framed(slide, buf, type, box) {
  const img = fit(buf, { x: box.x, y: box.y + FRAME_BAR, w: box.w, h: box.h - FRAME_BAR });
  const top = img.y - FRAME_BAR;
  slide.addShape('roundRect', { x: img.x, y: top, w: img.w, h: img.h + FRAME_BAR, rectRadius: 0.08, fill: { color: C.soft }, line: { color: C.line, width: 0.75 } });
  ['FF5F57', 'FEBC2E', '28C840'].forEach((color, i) => {
    slide.addShape('ellipse', { x: img.x + 0.14 + i * 0.16, y: top + 0.09, w: 0.1, h: 0.1, fill: { color }, line: { color } });
  });
  slide.addImage({ data: dataUri(buf, type), ...img });
}

// 둥근 칸 안의 제목·설명 카드
function card(slide, { x, y, w, h }, head, body) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: C.line, width: 0.75 } });
  slide.addShape('ellipse', { x: x + 0.22, y: y + 0.27, w: 0.09, h: 0.09, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(head, { x: x + 0.38, y: y + 0.12, w: w - 0.55, h: 0.38, fontFace: FONT, fontSize: 13, bold: true, color: C.fg, valign: 'middle', fit: 'shrink' });
  slide.addText(body, { x: x + 0.2, y: y + 0.52, w: w - 0.4, h: h - 0.64, fontFace: FONT, fontSize: 11, color: C.muted, valign: 'top', fit: 'shrink', paraSpaceAfter: 2 });
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
  pptx.defineSlideMaster({
    title: 'DOCENT',
    background: { color: 'FFFFFF' },
    objects: [{ line: { x: 0.5, y: 7.05, w: W - 1, h: 0, line: { color: C.line, width: 0.75 } } }, { text: { text: input.projectName, options: { x: 0.5, y: 7.08, w: 6, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted } } }],
    slideNumber: { x: W - 1.2, y: 7.08, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 9, color: C.muted, align: 'right' },
  });
  const addSlide = () => pptx.addSlide({ masterName: 'DOCENT' });

  const cover = pptx.addSlide();
  cover.background = { color: C.ink };
  cover.addShape('rect', { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: C.accent }, line: { color: C.accent } });
  cover.addText(options.title ?? '사용자 매뉴얼', { x: 0.9, y: 1.9, w: 2.4, h: 0.42, shape: 'roundRect', rectRadius: 0.2, fill: { color: C.accent }, align: 'center', fontFace: FONT, fontSize: 13, bold: true, color: 'FFFFFF', fit: 'shrink' });
  cover.addText(input.projectName, { x: 0.9, y: 2.5, w: W - 1.8, h: 1.2, fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF' });
  cover.addText(input.summary.oneLiner.value, { x: 0.9, y: 3.75, w: W - 3, h: 1.0, fontFace: FONT, fontSize: 16, color: C.onInk, valign: 'top', fit: 'shrink' });
  const stats = [[input.inventory.screens.length, '화면'], [input.summary.workflows.length, '워크플로우']];
  stats.forEach(([n, label], i) => {
    cover.addText([{ text: String(n), options: { fontSize: 26, bold: true, color: 'FFFFFF', breakLine: true } }, { text: label, options: { fontSize: 11, color: C.onInk } }], { x: 0.9 + i * 1.9, y: 5.0, w: 1.7, h: 1.0, shape: 'roundRect', rectRadius: 0.12, fill: { color: '2E2A6B' }, line: { color: '4338CA', width: 0.75 }, fontFace: FONT, valign: 'middle', margin: 10 });
  });
  cover.addText([options.organization, `기준일 ${input.date}`].filter(Boolean).join('  ·  '), { x: 0.9, y: 6.5, w: W - 1.8, h: 0.4, fontFace: FONT, fontSize: 12, color: C.onInk });

  // 소개(주요 기능이 많으면 여러 장)
  splitEvery(input.summary.features, FEATURES_PER_SLIDE).forEach((features, i) => {
    const intro = addSlide();
    title(intro, `소개${i ? ' (계속)' : ''}`, input.summary.oneLiner.value);
    const cols = 3;
    const rows = Math.max(1, Math.ceil(features.length / cols));
    const gap = 0.2;
    const cw = (W - 1.2 - gap * (cols - 1)) / cols;
    const ch = Math.min(2.2, (5.3 - gap * (rows - 1)) / rows);
    features.forEach((f, k) => card(intro, { x: 0.6 + (k % cols) * (cw + gap), y: 1.6 + Math.floor(k / cols) * (ch + gap), w: cw, h: ch }, f.menu, f.value));
  });

  // 메뉴 구조(길면 여러 장)
  splitEvery(menuLines(input), MENU_LINES).forEach((lines, i) => {
    const menu = addSlide();
    title(menu, `메뉴 구조${i ? ' (계속)' : ''}`);
    // 상자 높이는 줄 수에 맞춘다(15pt 한 줄 약 0.3in)
    const boxH = Math.min(5.75, 0.5 + Math.max(1, lines.length) * 0.3);
    menu.addShape('roundRect', { x: 0.6, y: 1.15, w: W - 1.2, h: boxH, rectRadius: 0.1, fill: { color: C.soft }, line: { color: C.line, width: 0.75 } });
    menu.addText(lines.join('\n') || '메뉴 정보 없음', { x: 0.9, y: 1.3, w: W - 1.8, h: boxH - 0.25, fontFace: FONT, fontSize: 15, color: C.fg, valign: 'top' });
  });

  // 워크플로우
  input.summary.workflows.forEach((wf, i) => {
    const slide = addSlide();
    title(slide, `워크플로우 · ${wf.name}`, wf.description);
    const png = diagrams?.[i];
    if (png) {
      slide.addShape('roundRect', { x: 0.6, y: 1.6, w: W - 1.2, h: 3.5, rectRadius: 0.1, fill: { color: C.soft }, line: { color: C.line, width: 0.75 } });
      slide.addImage({ data: dataUri(png, 'image/png'), ...fit(png, { x: 0.8, y: 1.75, w: W - 1.6, h: 3.2 }) });
    }
    // 단계 칩: 번호 + 화면 이름, 사이에 화살표
    const n = wf.steps.length;
    const arrow = 0.4;
    const chipW = Math.min(3, (W - 1.2 - arrow * Math.max(0, n - 1)) / Math.max(1, n));
    const y = png ? 5.45 : 1.9;
    wf.steps.forEach((id, k) => {
      const x = 0.6 + k * (chipW + arrow);
      slide.addText([{ text: `${k + 1}  `, options: { bold: true, color: C.accent } }, { text: screenTitle(input.screens, id), options: { color: C.ink } }], { x, y, w: chipW, h: 0.55, shape: 'roundRect', rectRadius: 0.27, fill: { color: C.accentSoft }, line: { color: 'C7D2FE', width: 0.75 }, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 13, fit: 'shrink' });
      if (k < n - 1) slide.addText('→', { x: x + chipW, y, w: arrow, h: 0.55, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 14, color: C.muted });
    });
  });

  // 화면별
  for (const entry of input.inventory.screens) {
    const s = input.screens.get(entry.id);
    if (preset === 'portfolio') {
      if (!media.gifs.has(entry.id)) continue;
      const gif = await readMaybe(join(mediaDir, 'gif', `${entry.id}.gif`));
      const slide = addSlide();
      title(slide, s.title.value, s.purpose.value);
      if (gif) framed(slide, gif, 'image/gif', { x: 0.6, y: 1.5, w: W - 1.2, h: 5.4 });
      continue;
    }
    const rows = screenRows(s);
    const chunks = chunkRows(rows);
    const raw = media.images.has(entry.id) ? await readMaybe(join(mediaDir, 'img', `${entry.id}.png`)) : undefined;
    const shot = raw && cropForSlide(raw, SHOT_BOX.w, SHOT_BOX.h);
    chunks.forEach((chunk, i) => {
      const slide = addSlide();
      title(slide, `${s.title.value}${i ? ' (계속)' : ''}`, `${low(s.purpose)}${s.purpose.value}`);
      const box = SHOT_BOX;
      if (shot) framed(slide, shot, 'image/png', box);
      else {
        slide.addShape('roundRect', { ...box, rectRadius: 0.1, line: { color: C.line, dashType: 'dash' }, fill: { color: C.soft } });
        slide.addText('캡처 없음', { ...box, align: 'center', valign: 'middle', fontFace: FONT, fontSize: 16, color: C.muted });
      }
      const header = ['구분', '이름', '설명'].map((t) => ({ text: t, options: { bold: true, color: C.ink, fill: { color: C.accentSoft } } }));
      const body = (chunk.length ? chunk : [['', '입력 항목·버튼 없음', '']]).map(([kind, ...rest]) => [{ text: kind, options: { bold: true, color: kind === '입력' ? C.accent : '7C3AED' } }, ...rest]);
      slide.addTable([header, ...body], { x: 6.8, y: 1.5, w: 6.0, colW: COL_W, fontFace: FONT, fontSize: 11, color: C.fg, border: { type: 'solid', color: C.line, pt: 0.75 }, valign: 'top' });
    });
  }

  if (preset === 'delivery') {
    const slide = addSlide();
    title(slide, '개정 이력');
    const header = ['버전', '날짜', '작성자', '내용'].map((t) => ({ text: t, options: { bold: true, color: C.ink, fill: { color: C.accentSoft } } }));
    const rows = revisionRows(input).map((r) => [r.version, r.date, r.author, r.note]);
    slide.addTable([header, ...rows], { x: 0.6, y: 1.3, w: W - 1.2, colW: [1.2, 1.8, 2.0, W - 6.2], fontFace: FONT, fontSize: 12, color: C.fg, border: { type: 'solid', color: C.line, pt: 0.75 } });
  }

  return Buffer.from(await pptx.write({ outputType: 'nodebuffer' }));
}
