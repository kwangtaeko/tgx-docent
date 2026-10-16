// /docent pending: 다시 분석해야 하는 화면 — 분석 결과 없음, 소스 변경, 사용자가 답한 확인 항목.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateScreen } from '../lib/schema.mjs';
import { t } from '../lib/cli-text.mjs';
import { hashFiles } from '../lib/source-hash.mjs';
import { docentDir, readJson, readJsonIfExists } from '../lib/workspace.mjs';
import { parseReview } from './review.mjs';

export async function runPending(projectDir) {
  const dir = docentDir(projectDir);
  const inventory = await readJson(join(dir, 'inventory.json'));
  let answers = new Map();
  try {
    answers = parseReview(await readFile(join(dir, 'review.md'), 'utf8'));
  } catch {
    // 확인 항목을 아직 만들지 않음
  }
  const pending = [];
  for (const { id } of inventory.screens) {
    let screen;
    try {
      screen = await readJsonIfExists(join(dir, 'screens', `${id}.json`));
    } catch {
      screen = null;
    }
    if (screen === undefined) {
      pending.push({ id, reason: t('분석 결과 없음') });
      continue;
    }
    if (!validateScreen(screen).valid) {
      pending.push({ id, reason: t('분석 결과를 읽을 수 없음') });
      continue;
    }
    let current;
    try {
      current = await hashFiles(projectDir, screen.readFiles);
    } catch {
      current = undefined;
    }
    if (current !== screen.sourceHash) {
      pending.push({ id, reason: t('소스 변경') });
      continue;
    }
    const answered = [...answers].filter(([key, v]) => key.startsWith(`${id}|`) && v.checked && v.answer).length;
    if (answered) pending.push({ id, reason: t('확인 항목 답변 {0}건', answered) });
  }
  return pending;
}
